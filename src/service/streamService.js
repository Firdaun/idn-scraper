import { fetchIdnGraphql } from "../utils/idnFetcher.js";
import { ResponseError } from "../error/responseError.js";

const LIVESTREAMS_QUERY = `
    query GetLivestreams {
        getLivestreams {
            title
            slug
            playback_url
            live_at
            view_count
            image_url
            creator {
                name
                username
                avatar
            }
        }
    }
`;

// Mengambil seluruh daftar live yang sedang aktif
export const getAllLivestreams = async () => {
    const result = await fetchIdnGraphql(LIVESTREAMS_QUERY);
    return result?.data?.getLivestreams || [];
};

// Mengambil satu live stream spesifik berdasarkan slug
export const getLivestreamBySlug = async (slug) => {
    const streams = await getAllLivestreams();
    const stream = streams.find((item) => item.slug === slug);

    if (!stream || !stream.playback_url) {
        throw new ResponseError(404, "Live stream tidak ditemukan atau sudah berakhir.");
    }

    return stream;
};