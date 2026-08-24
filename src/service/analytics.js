import { prismaClient } from "../application/database.js";
import { ResponseError } from "../error/responseError.js";

const getLiveAnalytics = async (slug) => {
    const stream = await prismaClient.livestream.findUnique({
        where: { slug },
        include: {
            viewerSnapshots: {
                orderBy: { recordedAt: "asc" },
            }
        }
    })

    if (!stream || stream.viewerSnapshots.length === 0) {
        throw new ResponseError(404, "Data snapshot penonton belum tersedia.")
    }

    const snapshots = stream.viewerSnapshots
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
        slug: stream.slug,
        title: stream.title,
        streamer: stream.streamerName,
        peakViewers,
        avgViewers,
        totalSnapshots: snapshots.length,
        chartData,
    }
}

const getMultiLiveAnalytics = async () => {
    const activeStreams = await prismaClient.livestream.findMany({
        include: {
            viewerSnapshots: {
                orderBy: { recordedAt: "asc" },
            },
        },
    });

    if (activeStreams.length === 0) return { chartData: [], streamers: [] };

    const formatDuration = (liveAt) => {
        const totalMinutes = Math.floor((new Date() - new Date(liveAt)) / (1000 * 60))

        if (totalMinutes < 60) {
            return `${totalMinutes} Menit`
        }

        const hours = Math.floor(totalMinutes / 60)
        const minutes = totalMinutes % 60

        const formattedHours = String(hours).padStart(2, '0')
        const formattedMinutes = String(minutes).padStart(2, '0')

        return `${formattedHours}:${formattedMinutes}`;
    }

    const timeMap = new Map();
    const streamersMap = new Map();

    for (const stream of activeStreams) {
        const name = stream.streamerName.replace(" JKT48", "");
        const counts = stream.viewerSnapshots.map(s => s.viewCount);
        streamersMap.set(name, {
            slug: stream.slug,
            fullName: stream.streamerName,
            peakViewers: Math.max(...counts, 0),
            duration: formatDuration(stream.liveAt)
        });

        for (const snap of stream.viewerSnapshots) {
            const timeStr = new Date(snap.recordedAt).toLocaleTimeString("id-ID", {
                hour: "2-digit",
                minute: "2-digit",
            });

            if (!timeMap.has(timeStr)) {
                timeMap.set(timeStr, {
                    timeLabel: timeStr,
                    _rawTime: new Date(snap.recordedAt).getTime()
                })
            }

            const timeEntry = timeMap.get(timeStr);
            timeEntry[name] = snap.viewCount;
        }
    }

    const chartData = Array.from(timeMap.values()).sort((a, b) =>
        a._rawTime - b._rawTime
    );

    chartData.forEach(item => delete item._rawTime)

    return {
        chartData,
        streamers: Array.from(streamersMap.entries()).map(([name, data]) => ({ name, ...data }))
    };
};

export const analytics = {
    getLiveAnalytics,
    getMultiLiveAnalytics
}