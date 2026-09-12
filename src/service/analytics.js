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

const formatDuration = (liveAt, lastRecordedAt) => {
    if (!liveAt || !lastRecordedAt) return "0 Seconds"
    const totalSeconds = Math.max(0, Math.floor((new Date(lastRecordedAt) - new Date(liveAt)) / 1000))

    if (totalSeconds < 60) {
        return `${totalSeconds} ${totalSeconds === 1 ? "Second" : "Seconds"}`
    }

    const totalMinutes = Math.floor(totalSeconds / 60)

    if (totalMinutes < 60) {
        return `${totalMinutes} ${totalMinutes === 1 ? "Minute" : "Minutes"}`
    }

    const hours = Math.floor(totalMinutes / 60)
    const minutes = totalMinutes % 60

    const hourText = `${hours} ${hours === 1 ? "Hour" : "Hours"}`
    if (minutes === 0) return hourText

    const minuteText = `${minutes} ${minutes === 1 ? "Minute" : "Minutes"}`
    return `${hourText} ${minuteText}`
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

    const totalMessage = sum(pluck(stream.chatSnapshots, "messageCount"))
    const totalPositive = sum(pluck(stream.chatSnapshots, "positiveCount"))
    const totalNeutral = sum(pluck(stream.chatSnapshots, "neutralCount"))
    const totalNegative = sum(pluck(stream.chatSnapshots, "negativeCount"))

    const sentiment = {
        totalChat: totalMessage,
        positive: totalPositive,
        neutral: totalNeutral,
        negative: totalNegative,
        positivePercentage: parseFloat(((totalPositive / totalMessage) * 100).toFixed(1)),
        neutralPercentage: parseFloat(((totalNeutral / totalMessage) * 100).toFixed(1)),
        negativePercentage: parseFloat(((totalNegative / totalMessage) * 100).toFixed(1))
    }

    const wordCloud = (stream.topWords).map((w) => ({
        text: w.word,
        value: w.count,
    }))

    const topChatters = (stream.topChatters).map((c) => ({
        count: c.count,
        userName: c.userName,
        userAvatar: c.userAvatar
    }))
    
    const memberStreams = await prismaClient.livestream.findMany({
        where: { streamerName: stream.streamerName },
        orderBy: { liveAt: "asc" },
        include: {
            snapshots: {
                orderBy: { recordedAt: "asc" },
            },
            chatSnapshots: {
                orderBy: { recordedAt: "asc" },
            }
        }
    })

    const name = memberStreams[0].streamerName.replace(" JKT48", "")
    const streamersMap = new Map()

    for (const dataStrm of memberStreams) {
        if (!dataStrm.snapshots || dataStrm.snapshots.length === 0) continue
        
        const LastSnapshot = dataStrm.snapshots[dataStrm.snapshots.length - 1]
        const LastRecordedAt = roundedTime(LastSnapshot?.recordedAt)
        const avgChat = getAverage(pluck(dataStrm.chatSnapshots, "messageCount"), 1)

        const sessionInfo = {
            slug: dataStrm.slug,
            liveAt: dataStrm.liveAt,
            endAt: dataStrm.endAt,
            avgViewers: dataStrm.avgViewers,
            avgChat: avgChat,
            peakViewers: dataStrm.peakViewers,
            peakChat: getPeak(pluck(dataStrm.chatSnapshots, "messageCount")),
            duration: formatDuration(dataStrm.liveAt, LastRecordedAt),
        }

        if (!streamersMap.has(name)) {
            streamersMap.set(name, {
                sessions: [sessionInfo],
            })
        } else {
            const existing = streamersMap.get(name)
            existing.sessions.push(sessionInfo)
        }
    }

    const streamerData = streamersMap.get(name) || {}

    return {
        name: name,
        ...streamerData,
        sentiment,
        wordCloud,
        topChatters
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