import WebSocket from "ws"
import { prismaClient } from "../application/database.js"
import { analyzeSentiment, extractKeywords } from "../utils/sentiment.js"

class ChatPollerService {
    constructor() {
        this.activeConnections = new Map()
    }

    extractUserComment(rawIrcLine) {
        if (!rawIrcLine.includes("PRIVMSG") || rawIrcLine.includes("IDNHeimdall")) {
            return null
        }

        const jsonStartIndex = rawIrcLine.indexOf(" :{")
        if (jsonStartIndex === -1) return null

        try {
            const payload = JSON.parse(rawIrcLine.slice(jsonStartIndex + 2))
            if (payload?.chat?.message && typeof payload.chat.message === "string") {
                return payload.chat.message
            }
            return null
        } catch {
            return null
        }
    }

    connectToChat(livestreamId, streamerName, chatRoomId) {
        if (this.activeConnections.has(livestreamId)) return
        if (!chatRoomId) {
            return
        }

        const guestUuid = crypto.randomUUID()
        const connectionState = {
            messageCount: 0,
            positiveCount: 0,
            neutralCount: 0,
            negativeCount: 0,
            wordFrequency: new Map(),
            livestreamId,
            streamerName,
            chatRoomId,
            socket: null,
        }

        try {
            const socket = new WebSocket("wss://chat.idn.app/", {
                headers: {
                    "Origin": "https://www.idn.app",
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
                }
            })
            connectionState.socket = socket

            socket.on("open", () => {
                const randomGuestId = Math.random().toString(36).substring(2, 9)
                const guestUser = `idn-worker-${randomGuestId}`

                socket.send(`NICK ${guestUser}\r\n`)
                socket.send(`USER ${guestUser} 0 * :${guestUser}\r\n`)
            })

            let isJoined = false

            socket.on("message", (data) => {
                const rawLine = data.toString()

                if (rawLine.startsWith("PING")) {
                    socket.send(rawLine.replace("PING", "PONG\r\n"))
                    return
                }

                if (!isJoined && (rawLine.includes(" 001 ") || rawLine.includes(" 376 "))) {
                    isJoined = true
                    socket.send(`JOIN #${chatRoomId}\r\n`)

                    const heimdallPayload = {
                        room_identifier: chatRoomId,
                        user_identifier: guestUuid,
                        join_at: Date.now(),
                        created_at: Date.now(),
                        extra_user_identifier: guestUuid,
                        is_login: false,
                    }
                    socket.send(`PRIVMSG IDNHeimdall :JOINED ${JSON.stringify(heimdallPayload)}\r\n`)
                    console.log(`[Chat Worker] Terhubung ke chat room ${streamerName}`)
                    return
                }

                const commentText = this.extractUserComment(rawLine)
                if (commentText) {
                    connectionState.messageCount++

                    // 1. Analisis Sentimen per interval 30 detik
                    const { sentiment } = analyzeSentiment(commentText)
                    if (sentiment === "positive") {
                        connectionState.positiveCount++
                    } else if (sentiment === "negative") {
                        connectionState.negativeCount++
                    } else {
                        connectionState.neutralCount++
                    }

                    // 2. Akumulasi Word Cloud di memori RAM selama stream berlangsung
                    const words = extractKeywords(commentText)
                    for (const word of words) {
                        const currentCount = connectionState.wordFrequency.get(word) || 0
                        connectionState.wordFrequency.set(word, currentCount + 1)
                    }
                }
            })

            socket.on("error", (err) => {
                console.error(`[Chat Worker Error] (${streamerName}):`, err.message || err)
            })

            socket.on("close", (code, reason) => {
                if (this.activeConnections.has(livestreamId)) {
                    const reasonMsg = reason && reason.length > 0 ? ` - ${reason.toString()}` : ""
                    console.log(`[Chat Worker] Koneksi chat ${streamerName} terputus (Code: ${code}${reasonMsg}). Akan otomatis dihubungkan ulang.`)
                    this.activeConnections.delete(livestreamId)
                }
            })

            this.activeConnections.set(livestreamId, connectionState)

        } catch (e) {
            console.error(`[Chat Worker] Gagal menghubungkan chat (${streamerName}):`, e.message)
            this.activeConnections.delete(livestreamId)
        }
    }

    async disconnectChat(livestreamId) {
        const conn = this.activeConnections.get(livestreamId)
        if (!conn) return

        // Langsung hapus dari koneksi aktif agar tidak diproses ganda
        this.activeConnections.delete(livestreamId)

        try {
            if (conn.socket && (conn.socket.readyState === WebSocket.OPEN || conn.socket.readyState === WebSocket.CONNECTING)) {
                conn.socket.close()
            }
        } catch (e) {}

        console.log(`[Chat Worker] Menghentikan pemantauan chat: ${conn.streamerName}`)

        // Simpan Top 50 Kata ke database (Word Cloud) jika ada akumulasi kata
        if (conn.wordFrequency && conn.wordFrequency.size > 0) {
            try {
                const topWords = Array.from(conn.wordFrequency.entries())
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 50)
                    .map(([word, count]) => ({
                        livestreamId,
                        word,
                        count
                    }))

                if (topWords.length > 0) {
                    await prismaClient.chatTopWord.createMany({
                        data: topWords,
                        skipDuplicates: true
                    })
                    console.log(`[Word Cloud] Berhasil menyimpan ${topWords.length} kata teratas untuk ${conn.streamerName}`)
                }
            } catch (err) {
                console.error(`[Word Cloud Error] Gagal menyimpan kata teratas (${conn.streamerName}):`, err.message)
            } finally {
                conn.wordFrequency.clear()
            }
        }
    }

    async syncActiveStreams(activeLiveStreams) {
        const activeIds = new Set(activeLiveStreams.map(s => s.id))

        for (const live of activeLiveStreams) {
            const existingConn = this.activeConnections.get(live.id)
            const isSocketDead = !existingConn || !existingConn.socket ||
                existingConn.socket.readyState === WebSocket.CLOSED ||
                existingConn.socket.readyState === WebSocket.CLOSING

            if (isSocketDead) {
                this.connectToChat(live.id, live.streamerName, live.chatRoomId)
            }
        }

        for (const id of this.activeConnections.keys()) {
            if (!activeIds.has(id)) {
                await this.disconnectChat(id)
            }
        }
    }

    async saveChatSnapshots(batchTime = new Date()) {
        if (this.activeConnections.size === 0) return

        const records = []

        for (const [livestreamId, conn] of this.activeConnections.entries()) {
            const count = conn.messageCount
            const positiveCount = conn.positiveCount
            const neutralCount = conn.neutralCount
            const negativeCount = conn.negativeCount

            conn.messageCount = 0
            conn.positiveCount = 0
            conn.neutralCount = 0
            conn.negativeCount = 0

            records.push({
                livestreamId,
                messageCount: count,
                positiveCount,
                neutralCount,
                negativeCount,
                recordedAt: batchTime
            })

            console.log(`[Chat Snapshot] ${conn.streamerName} -> ${count} Pesan (+${positiveCount} =${neutralCount} -${negativeCount}) (${new Date(batchTime).toLocaleTimeString("id-ID")})`)
        }

        try {
            await prismaClient.chatSnapshot.createMany({
                data: records
            })
        } catch (err) {
            console.error(`[Chat Snapshot Error]:`, err.message)
        }
    }
}

export const chatPoller = new ChatPollerService()
