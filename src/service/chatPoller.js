import WebSocket from "ws";
import { prismaClient } from "../application/database.js";

class ChatPollerService {
    constructor() {
        // Map untuk menampung koneksi chat aktif: Map<livestreamId, { socket, messageCount, slug, streamerName, chatRoomId }>
        this.activeConnections = new Map();
    }

    /**
     * Memeriksa apakah string pesan IRC adalah komentar asli dari penonton
     */
    isRealUserComment(rawIrcLine) {
        if (!rawIrcLine.includes("PRIVMSG") || rawIrcLine.includes("IDNHeimdall")) {
            return false;
        }

        const jsonStartIndex = rawIrcLine.indexOf(" :{");
        if (jsonStartIndex === -1) return false;

        try {
            const payload = JSON.parse(rawIrcLine.slice(jsonStartIndex + 2));
            // Hanya bernilai true jika memiliki objek 'chat' dan teks 'message'
            return Boolean(payload?.chat?.message && typeof payload.chat.message === "string");
        } catch {
            return false;
        }
    }

    /**
     * Membuka koneksi WebSocket ke ruang chat live stream tertentu
     */
    connectToChat(livestreamId, streamerName, chatRoomId) {
        if (this.activeConnections.has(livestreamId)) return;
        if (!chatRoomId) {
            return;
        }

        const guestUuid = crypto.randomUUID();
        const connectionState = {
            messageCount: 0,
            livestreamId,
            streamerName,
            chatRoomId,
            socket: null,
        };

        try {
            const socket = new WebSocket("wss://chat.idn.app/", {
                headers: {
                    "Origin": "https://www.idn.app",
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
                }
            });
            connectionState.socket = socket;

            socket.on("open", () => {
                const randomGuestId = Math.random().toString(36).substring(2, 9);
                const guestUser = `idn-worker-${randomGuestId}`;

                socket.send(`NICK ${guestUser}\r\n`);
                socket.send(`USER ${guestUser} 0 * :${guestUser}\r\n`);
            });

            socket.on("message", (data) => {
                const rawLine = data.toString();

                // 1. Respon PING / PONG
                if (rawLine.startsWith("PING")) {
                    socket.send(rawLine.replace("PING", "PONG\r\n"));
                    return;
                }

                // 2. Begitu terhubung, kirim perintah JOIN dan Heimdall handshake
                if (rawLine.includes(" 001 ") || rawLine.includes(" 376 ")) {
                    socket.send(`JOIN #${chatRoomId}\r\n`);

                    const heimdallPayload = {
                        room_identifier: chatRoomId,
                        user_identifier: guestUuid,
                        join_at: Date.now(),
                        created_at: Date.now(),
                        extra_user_identifier: guestUuid,
                        is_login: false,
                    };
                    socket.send(`PRIVMSG IDNHeimdall :JOINED ${JSON.stringify(heimdallPayload)}\r\n`);
                    console.log(`[Chat Worker] Terhubung ke chat room ${streamerName}`);
                    return;
                }

                // 3. Hitung komentar asli
                if (this.isRealUserComment(rawLine)) {
                    connectionState.messageCount++;
                }
            });

            socket.on("error", (err) => {
                console.error(`[Chat Worker Error] (${streamerName}):`, err.message || err);
            });

            socket.on("close", () => {
                if (this.activeConnections.has(livestreamId)) {
                    console.log(`[Chat Worker] Koneksi chat ${streamerName} terputus.`);
                }
            });

            this.activeConnections.set(livestreamId, connectionState);

        } catch (e) {
            console.error(`[Chat Worker] Gagal menghubungkan chat (${streamerName}):`, e.message);
        }
    }

    /**
     * Menutup koneksi chat untuk livestream yang sudah selesai
     */
    disconnectChat(livestreamId) {
        const conn = this.activeConnections.get(livestreamId);
        if (conn) {
            try {
                if (conn.socket && (conn.socket.readyState === WebSocket.OPEN || conn.socket.readyState === WebSocket.CONNECTING)) {
                    conn.socket.close();
                }
            } catch (e) {
                // Abaikan error saat close
            }
            console.log(`[Chat Worker] Menghentikan pemantauan chat: ${conn.streamerName}`);
            this.activeConnections.delete(livestreamId);
        }
    }

    /**
     * Sinkronisasi koneksi aktif dengan daftar live yang sedang berjalan
     */
    syncActiveStreams(activeLiveStreams) {
        const activeIds = new Set(activeLiveStreams.map(s => s.id));

        // 1. Hubungkan live baru yang belum terdaftar di ChatPoller
        for (const live of activeLiveStreams) {
            if (!this.activeConnections.has(live.id)) {
                this.connectToChat(live.id, live.streamerName, live.chatRoomId);
            }
        }

        // 2. Putus koneksi untuk stream yang sudah selesai
        for (const id of this.activeConnections.keys()) {
            if (!activeIds.has(id)) {
                this.disconnectChat(id)
            }
        }
    }

    async saveChatSnapshots(batchTime = new Date()) {
        if (this.activeConnections.size === 0) return;

        const records = [];

        for (const [livestreamId, conn] of this.activeConnections.entries()) {
            const count = conn.messageCount;
            conn.messageCount = 0;

            records.push({
                livestreamId,
                messageCount: count,
                recordedAt: batchTime
            });

            console.log(`[Chat Snapshot] ${conn.streamerName} -> ${count} Pesan (${new Date(batchTime).toLocaleTimeString("id-ID")})`);
        }

        try {
            await prismaClient.chatSnapshot.createMany({
                data: records
            });
        } catch (err) {
            console.error(`[Chat Snapshot Error]:`, err.message);
        }
    }
}

export const chatPoller = new ChatPollerService();
