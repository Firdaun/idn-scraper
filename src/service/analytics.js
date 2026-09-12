import { prismaClient } from "../application/database.js"
import { ResponseError } from "../error/responseError.js"

const pluck = (arr, key) => arr.map(item => item[key])
const sum = arr => arr.reduce((acc, curr) => acc + curr, 0)
const getPeak = (arr) => Math.max(...arr, 0)
const getAverage = (arr, decimals = 2) => {
    if (arr.length === 0) return 0
    return parseFloat((sum(arr) / arr.length).toFixed(decimals))
}
const roundedTime = (time) => {
    return Math.round(new Date(time).getTime() / 30000) * 30000
}

const getLiveAnalytics = async (slug) => {
    const stream = await prismaClient.livestream.findUnique({
        where: { slug },
        include: {
            snapshots: {
                orderBy: { recordedAt: "asc" },
            },
            chatSnapshots: {
                orderBy: { recordedAt: "asc" },
            },
            topWords: {
                orderBy: { count: "desc" },
                take: 50,
            },
            topChatters: {
                orderBy: { count: "desc" },
                take: 50,
            }
        }
    })

    if (!stream || stream.snapshots.length === 0) {
        throw new ResponseError(404, "Data snapshot penonton belum tersedia.")
    }
    const snapshots = stream.snapshots

    const viewerCounts = pluck(snapshots, "viewCount")
    const peakViewers = getPeak(viewerCounts)
    const avgViewers = getAverage(viewerCounts, 2)

    const chatCounts = pluck(stream.chatSnapshots || [], "messageCount")
    const totalChat = sum(chatCounts)
    const peakChat = getPeak(chatCounts)
    const avgChat = getAverage(chatCounts, 1)

    // Agregasi sentimen keseluruhan
    const positiveCounts = pluck(stream.chatSnapshots || [], "positiveCount")
    const neutralCounts = pluck(stream.chatSnapshots || [], "neutralCount")
    const negativeCounts = pluck(stream.chatSnapshots || [], "negativeCount")

    const totalPositive = sum(positiveCounts)
    const totalNeutral = sum(neutralCounts)
    const totalNegative = sum(negativeCounts)
    const totalSentimentMessages = totalPositive + totalNeutral + totalNegative

    const sentiment = {
        positive: totalPositive,
        neutral: totalNeutral,
        negative: totalNegative,
        positivePercentage: totalSentimentMessages > 0 ? parseFloat(((totalPositive / totalSentimentMessages) * 100).toFixed(1)) : 0,
        neutralPercentage: totalSentimentMessages > 0 ? parseFloat(((totalNeutral / totalSentimentMessages) * 100).toFixed(1)) : 0,
        negativePercentage: totalSentimentMessages > 0 ? parseFloat(((totalNegative / totalSentimentMessages) * 100).toFixed(1)) : 0,
    }

    const chatMap = new Map()
    for (const cs of (stream.chatSnapshots || [])) {
        chatMap.set(roundedTime(cs.recordedAt), {
            chatCount: cs.messageCount,
            positiveCount: cs.positiveCount || 0,
            neutralCount: cs.neutralCount || 0,
            negativeCount: cs.negativeCount || 0,
        })
    }

    const chartData = snapshots.map((s) => {
        const timeKey = roundedTime(s.recordedAt)
        const chatInfo = chatMap.get(timeKey) || {
            chatCount: 0,
            positiveCount: 0,
            neutralCount: 0,
            negativeCount: 0
        }

        return {
            timestamp: s.recordedAt.toISOString(),
            timeLabel: new Date(s.recordedAt).toLocaleTimeString('id-ID', {
                hour: '2-digit',
                minute: '2-digit'
            }),
            viewers: s.viewCount,
            chatCount: chatInfo.chatCount,
            positiveCount: chatInfo.positiveCount,
            neutralCount: chatInfo.neutralCount,
            negativeCount: chatInfo.negativeCount,
        }
    })

    const wordCloud = (stream.topWords || []).map((w) => ({
        text: w.word,
        value: w.count,
    }))

    const topChatters = (stream.topChatters || []).map((c) => ({
        count: c.count,
        userUuid: c.userUuid,
        userName: c.userName,
        userAvatar: c.userAvatar
    }))

    return {
        livestreamId: stream.id,
        liveAt: stream.liveAt,
        slug: stream.slug,
        title: stream.title,
        streamer: stream.streamerName,
        peakViewers,
        avgViewers,
        totalChat,
        peakChat,
        avgChat,
        totalSnapshots: snapshots.length,
        sentiment,
        wordCloud,
        topChatters,
        chartData,
    }
}

const getLiveWordCloud = async (slug) => {
    const stream = await prismaClient.livestream.findUnique({
        where: { slug },
        include: {
            topWords: {
                orderBy: { count: "desc" },
                take: 50,
            }
        }
    })

    if (!stream) {
        throw new ResponseError(404, "Data livestream belum ditemukan.")
    }

    return (stream.topWords || []).map((w) => ({
        text: w.word,
        value: w.count,
    }))
}

const getLiveTopChatters = async (slug) => {
    const stream = await prismaClient.livestream.findUnique({
        where: { slug },
        include: {
            topChatters: {
                orderBy: { count: "desc" },
                take: 50,
            }
        }
    })

    if (!stream) {
        throw new ResponseError(404, "Data livestream belum ditemukan.")
    }

    return (stream.topChatters || []).map((c) => ({
        count: c.count,
        userUuid: c.userUuid,
        userName: c.userName,
        userAvatar: c.userAvatar
    }))
}

const getMultiLiveAnalytics = async (startDate, endDate) => {
    const snapshotWhere = {}

    if (startDate) {
        const start = new Date(startDate)
        if (!isNaN(start.getTime())) snapshotWhere.gte = start
    }

    if (endDate) {
        const end = new Date(endDate)
        if (!isNaN(end.getTime())) snapshotWhere.lte = end
    }

    const hasFilter = Object.keys(snapshotWhere).length > 0

    const activeStreams = await prismaClient.livestream.findMany({
        where: hasFilter ? {
            snapshots: {
                some: { recordedAt: snapshotWhere }
            }
        } : undefined,
        orderBy: { liveAt: "asc" },
        include: {
            snapshots: {
                where: hasFilter ? { recordedAt: snapshotWhere } : undefined,
                orderBy: { recordedAt: "asc" },
            },
            chatSnapshots: {
                where: hasFilter ? { recordedAt: snapshotWhere } : undefined,
                orderBy: { recordedAt: "asc" },
            }
        },
    })

    if (activeStreams.length === 0) return { chartData: [], streamers: [] }

    const timeMap = new Map()
    const streamersMap = new Map()

    for (const stream of activeStreams) {
        if (!stream.snapshots || stream.snapshots.length === 0) continue

        const name = stream.streamerName.replace(" JKT48", "")
        const counts = pluck(stream.snapshots, "viewCount")
        const chatCounts = pluck(stream.chatSnapshots || [], "messageCount")
        const peakViewers = getPeak(counts)
        const peakChat = getPeak(chatCounts)

        if (!streamersMap.has(name)) {
            streamersMap.set(name, {
                name,
                peakViewers,
                peakChat
            })
        } else {
            const existing = streamersMap.get(name)
            existing.peakViewers = Math.max(existing.peakViewers, peakViewers)
            existing.peakChat = Math.max(existing.peakChat, peakChat)
        }

        for (const snap of stream.snapshots) {
            const rawTime = roundedTime(snap.recordedAt)

            if (!timeMap.has(rawTime)) {
                timeMap.set(rawTime, {
                    timeLabel: rawTime
                })
            }

            const timeEntry = timeMap.get(rawTime)
            timeEntry[name] = snap.viewCount
            timeEntry[`_${name}_slug`] = stream.slug
        }

        for (const chat of (stream.chatSnapshots || [])) {
            const rawTime = roundedTime(chat.recordedAt)

            if (!timeMap.has(rawTime)) {
                timeMap.set(rawTime, {
                    timeLabel: rawTime
                })
            }

            const timeEntry = timeMap.get(rawTime)
            timeEntry[`_${name}_chat`] = chat.messageCount
            timeEntry[`_${name}_pos`] = chat.positiveCount || 0
            timeEntry[`_${name}_neu`] = chat.neutralCount || 0
            timeEntry[`_${name}_neg`] = chat.negativeCount || 0
        }
    }

    const chartData = Array.from(timeMap.values()).sort((a, b) =>
        a.timeLabel - b.timeLabel
    )

    return {
        chartData,
        streamers: Array.from(streamersMap.values())
    }
}

export const analytics = {
    getLiveAnalytics,
    getLiveWordCloud,
    getLiveTopChatters,
    getMultiLiveAnalytics
}