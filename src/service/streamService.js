import { fetchIdnGraphql } from "../utils/idnFetcher.js"
import { ResponseError } from "../error/responseError.js"

export const getAllLivestreams = async () => {
    const result = await fetchIdnGraphql()
    return result?.data?.getLivestreams || []
}

const fetchChatRoomId = async (username, slug) => {
    try {
        const url = `https://www.idn.app/${username}/live/${slug}`
        const res = await fetch(url, {
            headers: {
                "User-Agent":
                    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            },
        })

        if (!res.ok) {
            throw new Error(`Gagal memuat web IDN (HTTP status: ${res.status})`)
        }

        const html = await res.text()
        const match = html.match(/"chat_room_id":"(arn:aws:ivschat:[^"]+)"/)

        if (!match) {
            throw new Error("Chat room ID tidak ditemukan pada halaman live.")
        }

        return match[1]
    } catch (err) {
        console.error("Gagal mengambil chat_room_id:", err)
        throw new ResponseError(404, `Gagal mengambil chat_room_id: ${err.message}`)
    }
}

export const getLivestreamBySlug = async (slug) => {
    const streams = await getAllLivestreams()
    const stream = streams.find((item) => item.slug === slug)
    
    if (!stream || !stream.playback_url) {
        throw new ResponseError(404, "Live stream tidak ditemukan atau sudah berakhir.")
    }

    const chatRoomId = await fetchChatRoomId(stream.creator?.username, slug)

    return {
        ...stream,
        chat_room_id: chatRoomId,
    }
}