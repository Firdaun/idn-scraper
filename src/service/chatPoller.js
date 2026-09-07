import WebSocket from "ws"
import { prismaClient } from "../application/database.js"
import { analyzeSentiment, extractKeywords } from "../utils/sentiment.js"

class ChatPollerService {
    constructor() {
        this.activeConnections = new Map()
    }

    extractChatPayload(rawIrcLine) {
        if (!rawIrcLine.includes("PRIVMSG") || rawIrcLine.includes("IDNHeimdall")) {
            return null
        }

        const jsonStartIndex = rawIrcLine.indexOf(" :{")
        if (jsonStartIndex === -1) return null

        try {
            const payload = JSON.parse(rawIrcLine.slice(jsonStartIndex + 2))
            const message = payload?.chat?.message
            if (message && typeof message === "string") {
                const user = payload.user || {}
                return {
                    message,
                    user: {
                        uuid: user.uuid,
                        name: user.name,
                        avatar: user.avatar_url || null
                    }
                }
            }
            return null
        } catch {
            return null
        }
    }

    connectToChat(livestreamId, streamerName, chatRoomId) {
        if (!chatRoomId) {
            return
        }

        const existingConn = this.activeConnections.get(livestreamId)
        if (existingConn) {
            if (existingConn.socket && existingConn.socket.readyState === WebSocket.OPEN && existingConn.isAlive) {
                return
            }
            try {
                existingConn.socket?.terminate?.()
            } catch {}
        }

        const guestUuid = crypto.randomUUID()
        const connectionState = {
            messageCount: existingConn?.messageCount || 0,
            positiveCount: existingConn?.positiveCount || 0,
            neutralCount: existingConn?.neutralCount || 0,
            negativeCount: existingConn?.negativeCount || 0,
            wordFrequency: existingConn?.wordFrequency || new Map(),
            userFrequency: existingConn?.userFrequency || new Map(),
            livestreamId,
            streamerName,
            chatRoomId,
            socket: null,
            isAlive: true,
            lastActivity: Date.now()
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
                connectionState.isAlive = true
                connectionState.lastActivity = Date.now()
                const randomGuestId = Math.random().toString(36).substring(2, 9)
                const guestUser = `idn-worker-${randomGuestId}`

                socket.send(`NICK ${guestUser}\r\n`)
                socket.send(`USER ${guestUser} 0 * :${guestUser}\r\n`)
            })

            socket.on("pong", () => {
                connectionState.isAlive = true
                connectionState.lastActivity = Date.now()
            })

            let isJoined = false

            socket.on("message", (data) => {
                connectionState.isAlive = true
                connectionState.lastActivity = Date.now()
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

                const chatData = this.extractChatPayload(rawLine)
                if (chatData) {
                    connectionState.messageCount++

                    const { sentiment } = analyzeSentiment(chatData.message)
                    if (sentiment === "positive") {
                        connectionState.positiveCount++
                    } else if (sentiment === "negative") {
                        connectionState.negativeCount++
                    } else {
                        connectionState.neutralCount++
                    }

                    const words = extractKeywords(chatData.message)
                    for (const word of words) {
                        const currentCount = connectionState.wordFrequency.get(word) || 0
                        connectionState.wordFrequency.set(word, currentCount + 1)
                    }

                    const userUuid = chatData.user?.uuid
                    if (userUuid) {
                        const existingUser = connectionState.userFrequency.get(userUuid) || {
                            userUuid,
                            userName: chatData.user.name,
                            userAvatar: chatData.user.avatar,
                            count: 0
                        }
                        existingUser.count++
                        existingUser.userName = chatData.user.name
                        if (chatData.user.avatar) {
                            existingUser.userAvatar = chatData.user.avatar
                        }
                        connectionState.userFrequency.set(userUuid, existingUser)
                    }
                }
            })

            socket.on("error", (err) => {
                console.error(`[Chat Worker Error] (${streamerName}):`, err.message || err)
                connectionState.isAlive = false
                try {
                    socket.terminate()
                } catch {}
            })

            socket.on("close", (code, reason) => {
                const reasonMsg = reason && reason.length > 0 ? ` - ${reason.toString()}` : ""
                console.log(`[Chat Worker] Koneksi chat ${streamerName} terputus (Code: ${code}${reasonMsg}). Akan otomatis dihubungkan ulang.`)
                connectionState.isAlive = false
                connectionState.socket = null
            })

            this.activeConnections.set(livestreamId, connectionState)

        } catch (e) {
            console.error(`[Chat Worker] Gagal menghubungkan chat (${streamerName}):`, e.message)
            connectionState.isAlive = false
        }
    }

    async disconnectChat(livestreamId) {
        const conn = this.activeConnections.get(livestreamId)
        if (!conn) return

        this.activeConnections.delete(livestreamId)

        try {
            if (conn.socket) {
                conn.socket.terminate()
            }
        } catch (e) {}

        console.log(`[Chat Worker] Menghentikan pemantauan chat: ${conn.streamerName}`)

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

        if (conn.userFrequency && conn.userFrequency.size > 0) {
            try {
                const topChatters = Array.from(conn.userFrequency.values())
                    .sort((a, b) => b.count - a.count)
                    .slice(0, 50)
                    .map((user) => ({
                        livestreamId,
                        userUuid: user.userUuid,
                        userName: user.userName,
                        userAvatar: user.userAvatar,
                        count: user.count
                    }))

                if (topChatters.length > 0) {
                    await prismaClient.chatTopUser.createMany({
                        data: topChatters,
                        skipDuplicates: true
                    })
                    console.log(`[Top Chatters] Berhasil menyimpan ${topChatters.length} chatter teratas untuk ${conn.streamerName}`)
                }
            } catch (err) {
                console.error(`[Top Chatters Error] Gagal menyimpan chatter teratas (${conn.streamerName}):`, err.message)
            } finally {
                conn.userFrequency.clear()
            }
        }
    }

    async syncActiveStreams(activeLiveStreams) {
        const activeIds = new Set(activeLiveStreams.map(s => s.id))

        for (const live of activeLiveStreams) {
            const conn = this.activeConnections.get(live.id)
            const isSocketAlive = conn && conn.socket && conn.socket.readyState === WebSocket.OPEN

            if (!conn || !conn.socket || conn.socket.readyState === WebSocket.CLOSED || conn.socket.readyState === WebSocket.CLOSING) {
                this.connectToChat(live.id, live.streamerName, live.chatRoomId)
                continue
            }

            if (conn.socket.readyState === WebSocket.CONNECTING) {
                if (Date.now() - conn.lastActivity > 15000) {
                    console.log(`[Chat Worker Watchdog] Koneksi ${live.streamerName} hang di status CONNECTING. Memaksa reconnect...`)
                    try {
                        conn.socket.terminate()
                    } catch {}
                    this.connectToChat(live.id, live.streamerName, live.chatRoomId)
                }
                continue
            }

            if (isSocketAlive) {
                if (!conn.isAlive) {
                    console.log(`[Chat Worker Watchdog] Koneksi ${live.streamerName} tidak merespons (mati suri / zombie). Memaksa reconnect...`)
                    try {
                        conn.socket.terminate()
                    } catch {}
                    this.connectToChat(live.id, live.streamerName, live.chatRoomId)
                    continue
                }

                conn.isAlive = false
                try {
                    conn.socket.ping()
                } catch (e) {
                    console.warn(`[Chat Worker Ping Error] (${live.streamerName}):`, e.message)
                    try {
                        conn.socket.terminate()
                    } catch {}
                    this.connectToChat(live.id, live.streamerName, live.chatRoomId)
                }
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
