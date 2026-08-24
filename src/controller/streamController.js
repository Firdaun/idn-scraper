import { getAllLivestreams, getLivestreamBySlug } from "../service/streamService.js"

export const getStreams = async (_req, res, next) => {
    try {
        const data = await getAllLivestreams()
        res.status(200).json({
            success: true,
            data,
        })
    } catch (error) {
        next(error)
    }
}

export const getStreamDetail = async (req, res, next) => {
    try {
        const { slug } = req.params
        const result = await getLivestreamBySlug(slug)

        res.status(200).json({
            success: true,
            data: result,
        })
    } catch (error) {
        next(error)
    }
}