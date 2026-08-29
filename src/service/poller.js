import { prismaClient } from "../application/database.js"
import { getAllLivestreams, fetchChatRoomId } from "./streamService.js"
import { chatPoller } from "./chatPoller.js"

const chatRoomCache = new Map()

const recordViewerSnapshot = async (live, recordedAt) => {
    const streamRecord = await prismaClient.livestream.upsert({
        where: { slug: live.slug },
        create: {
            slug: live.slug,
            title: live.title,
            streamerName: live.creator?.name,
            liveAt: live.live_at
        },
        update: {
            title: live.title,
            endAt: null
        }
    })

    let chatRoomId = chatRoomCache.get(live.slug)
    if (!chatRoomId && live.creator?.username) {
        chatRoomId = await fetchChatRoomId(live.creator.username, live.slug)
        if (chatRoomId) {
            chatRoomCache.set(live.slug, chatRoomId)
        }
    }

    const snapshot = await prismaClient.snapshot.create({
        data: {
            livestreamId: streamRecord.id,
            viewCount: live.view_count,
            recordedAt: recordedAt
        }
    })

    console.log(`[Snapshot Disimpan] ${live.creator?.name} -> ${snapshot.viewCount} Penonton (${new Date().toLocaleTimeString()})`)
    return {
        id: streamRecord.id,
        streamer: live.creator?.name,
        viewers: snapshot.viewCount,
        slug: live.slug,
        chatRoomId: chatRoomId || null
    }
}

const handleEndedStreams = async (activeSlugs) => {
    const endedStreams = await prismaClient.livestream.findMany({
        where: {
            endAt: null,
            ...(activeSlugs.length > 0 ? { slug: { notIn: activeSlugs } } : {})
        },
        include: {
            snapshots: {
                orderBy: { recordedAt: "asc" }
            }
        }
    })

    for (const stream of endedStreams) {
        const snapshots = stream.snapshots
        if (snapshots.length === 0) continue

        const lastSnapshot = snapshots[snapshots.length - 1]
        const finalEndAt = lastSnapshot.recordedAt

        const viewerCounts = snapshots.map((s) => s.viewCount)
        const peakViewers = Math.max(...viewerCounts, 0)
        const totalSum = viewerCounts.reduce((acc, curr) => acc + curr, 0)
        const avgViewers = parseFloat((totalSum / viewerCounts.length).toFixed(2))

        await prismaClient.livestream.update({
            where: { id: stream.id },
            data: {
                endAt: finalEndAt,
                peakViewers,
                avgViewers
            }
        })

        chatRoomCache.delete(stream.slug)
        chatPoller.disconnectChat(stream.id)

        console.log(`[Live Berakhir] ${stream.streamerName} telah selesai live. endAt di-set ke: ${new Date(finalEndAt).toLocaleTimeString("id-ID")}`)
    }
}

const saveSnapshot = async () => {
    const batchTime = new Date()
    const livestreams = await getAllLivestreams()

    const jkt48Lives = livestreams.filter((stream) => {
        if (stream.status !== "live" || !stream.creator) return false

        const name = (stream.creator.name || "").toLowerCase()
        const username = (stream.creator.username || "").toLowerCase()

        return name.includes("jkt48") || username.startsWith("jkt48_")
    })

    const activeSlugs = jkt48Lives.map((s) => s.slug)

    await handleEndedStreams(activeSlugs)

    if (jkt48Lives.length === 0) {
        chatPoller.syncActiveStreams([])
        console.log(`[${new Date().toLocaleTimeString("id-ID")}] Tidak ada member JKT48 yang sedang live.`)
        return []
    }

    console.log(
        `[${new Date().toLocaleTimeString("id-ID")}] Terdeteksi ${jkt48Lives.length} member JKT48 sedang live:`
    )

    const results = await Promise.allSettled(
        jkt48Lives.map((live) => recordViewerSnapshot(live, batchTime))
    )

    const activeStreamsForChat = []
    results.forEach((res) => {
        if (res.status === "fulfilled" && res.value) {
            activeStreamsForChat.push({
                id: res.value.id,
                slug: res.value.slug,
                streamerName: res.value.streamer,
                chatRoomId: res.value.chatRoomId
            })
            console.log(`---> ${res.value.streamer} (${res.value.slug}): ${res.value.viewers.toLocaleString()} CCU`)
        } else {
            console.error(`---> Gagal menyimpan snapshot:`, res.reason)
        }
    })

    chatPoller.syncActiveStreams(activeStreamsForChat)
    await chatPoller.saveChatSnapshots(batchTime)

    return jkt48Lives
}

export const poller = {
    saveSnapshot
}