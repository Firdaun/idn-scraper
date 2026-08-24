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

    await prismaClient.livestream.update({
        where: { id: stream.id },
        data: {
            peakViewers,
            avgViewers
        }
    })

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

export const analytics = {
    getLiveAnalytics
}