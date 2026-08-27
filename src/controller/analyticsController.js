import { analytics } from "../service/analytics.js"

export const getAnalytics = async (req, res, next) => {
    try {
        const { slug } = req.params
        const result = await analytics.getLiveAnalytics(slug)
        res.status(200).json({
            success: true,
            data: result
        })
    } catch (e) {
        next(e)
    }
}

export const getAllMultiLive = async (req, res, next) => {
    try {
        const { startDate, endDate } = req.query
        const result = await analytics.getMultiLiveAnalytics(startDate, endDate)
        res.status(200).json({
            success: true,
            data: result
        })
    } catch (e) {
        next(e)
    }
}
