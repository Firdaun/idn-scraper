import { prismaClient } from "../application/database.js";
import { getAllLivestreams } from "./streamService.js";

const recordViewerSnapshot = async (live) => {
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


    const snapshot = await prismaClient.snapshot.create({
        data: {
            livestreamId: streamRecord.id,
            viewCount: live.view_count,
            recordedAt: new Date()
        }
    })

    console.log(`[Snapshot Disimpan] ${live.creator?.name} -> ${snapshot.viewCount} Penonton (${new Date().toLocaleTimeString()})`);
    return {
        streamer: live.creator?.name,
        viewers: snapshot.viewCount,
        slug: live.slug,
    };
}

const saveSnapshot = async () => {
    const livestreams = await getAllLivestreams();

    const jkt48Lives = livestreams.filter((stream) => {
        if (stream.status !== "live" || !stream.creator) return false;

        const name = (stream.creator.name || "").toLowerCase();
        const username = (stream.creator.username || "").toLowerCase();

        return name.includes("jkt48") || username.startsWith("jkt48_");
    });

    if (jkt48Lives.length === 0) {
        console.log(`[${new Date().toLocaleTimeString("id-ID")}] Tidak ada member JKT48 yang sedang live.`);
        return [];
    }

    console.log(
        `[${new Date().toLocaleTimeString("id-ID")}] Terdeteksi ${jkt48Lives.length} member JKT48 sedang live:`
    );

    const results = await Promise.allSettled(
        jkt48Lives.map((live) => recordViewerSnapshot(live))
    );

    results.forEach((res) => {
        if (res.status === "fulfilled") {
            console.log(`---> ${res.value.streamer} (${res.value.slug}): ${res.value.viewers.toLocaleString()} CCU`);
        } else {
            console.error(`---> Gagal menyimpan snapshot:`, res.reason);
        }
    });

    return jkt48Lives;
}

export const poller = {
    saveSnapshot
}