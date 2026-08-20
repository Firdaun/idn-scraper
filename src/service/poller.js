import { prismaClient } from "../application/database.js";
import { ResponseError } from "../error/responseError.js";
import { getLivestreamBySlug } from "./streamService.js";

const recordViewerSnapshot = async(slug) => {
    const live = await getLivestreamBySlug(slug);

    if (!live || live.status !== "live") {
        throw new ResponseError(404, `${slug} sedang tidak aktif atau tidak ditemukan.`)
    }

    const streamRecord = await prismaClient.livestream.upsert({
        where: { slug: live.slug },
        create: {
            slug: live.slug,
            title: live.title,
            streamerName: live.creator?.name,
            liveAt: live.live_at
        },
        update: {
            title: live.title
        }
    })


    const snapshot = await prismaClient.livestreamViewerStat.create({
        data: {
            livestreamId: streamRecord.id,
            viewCount: live.view_count,
            recordedAt: new Date()
        }
    })

    console.log(`[Snapshot Disimpan] ${slug} -> ${snapshot.viewCount} Penonton (${new Date().toLocaleTimeString()})`);
    return snapshot;
}

export const poller = {
    recordViewerSnapshot
}