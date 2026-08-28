import { prismaClient } from "../application/database.js"
import { ResponseError } from "../error/responseError.js"

const getLiveAnalytics = async (slug) => {
    const stream = await prismaClient.livestream.findUnique({
        where: { slug },
        include: {
            snapshots: {
                orderBy: { recordedAt: "asc" },
            }
        }
    })

    if (!stream || stream.snapshots.length === 0) {
        throw new ResponseError(404, "Data snapshot penonton belum tersedia.")
    }

    const snapshots = stream.snapshots
    const viewerCounts = snapshots.map(s => s.viewCount)

    const peakViewers = Math.max(...viewerCounts)

    const totalSum = viewerCounts.reduce((acc, curr) => acc + curr, 0)
    const avgViewers = parseFloat((totalSum / viewerCounts.length).toFixed(2))

    const chartData = snapshots.map((s) => ({
        timestamp: s.recordedAt.toISOString(),
        timeLabel: new Date(s.recordedAt).toLocaleTimeString('id-ID', {
            hour: '2-digit',
            minute: '2-digit'
        }),
        viewers: s.viewCount
    }))

    return {
        livestreamId: stream.id,
        liveAt: stream.liveAt,
        slug: stream.slug,
        title: stream.title,
        streamer: stream.streamerName,
        peakViewers,
        avgViewers,
        totalSnapshots: snapshots.length,
        chartData,
    }
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
        },
    })

    if (activeStreams.length === 0) return { chartData: [], streamers: [] }

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

    const timeMap = new Map()
    const streamersMap = new Map()

    const roundedTime = (time) => {
        return Math.round(new Date(time).getTime() / 30000) * 30000
    }

    for (const stream of activeStreams) {
        if (!stream.snapshots || stream.snapshots.length === 0) continue

        const name = stream.streamerName.replace(" JKT48", "")
        const counts = stream.snapshots.map(s => s.viewCount)

        const lastSnapshot = stream.snapshots[stream.snapshots.length - 1]
        const lastRecordedAt = roundedTime(lastSnapshot?.recordedAt || stream.liveAt)

        const sessionInfo = {
            slug: stream.slug,
            liveAt: stream.liveAt,
            avgViewers: stream.avgViewers,
            totalSnapshots: stream.snapshots.length,
            fullName: stream.streamerName,
            peakViewers: Math.max(...counts, 0),
            duration: formatDuration(stream.liveAt, lastRecordedAt),
            endAt: stream.endAt
        }

        if (!streamersMap.has(name)) {
            streamersMap.set(name, {
                ...sessionInfo,
                sessions: [sessionInfo]
            })
        } else {
            const existing = streamersMap.get(name)
            existing.sessions.push(sessionInfo)

            const isCurrentlyLive = !stream.endAt && existing.endAt
            const isNewer = new Date(stream.liveAt) >= new Date(existing.liveAt)
            if (isCurrentlyLive || isNewer) {
                Object.assign(existing, sessionInfo)
            }
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
    }

    const chartData = Array.from(timeMap.values()).sort((a, b) =>
        a.timeLabel - b.timeLabel
    )

    return {
        chartData,
        streamers: Array.from(streamersMap.entries()).map(([name, data]) => ({ name, ...data }))
    }
};

export const analytics = {
    getLiveAnalytics,
    getMultiLiveAnalytics
}