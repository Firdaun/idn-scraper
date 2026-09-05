import express from "express"
import { getStreamDetail, getStreams } from "../controller/streamController.js"
import { proxyStream } from "../controller/proxyController.js"
import { getAllMultiLive, getAnalytics, getWordCloud } from "../controller/analyticsController.js"

const router = new express.Router()

router.get("/idn/streams", getStreams)

router.get("/idn/stream/:slug", getStreamDetail)

router.get("/idn/proxy", proxyStream)

router.get("/idn/analytics/:slug", getAnalytics)

router.get("/idn/analytics/:slug/wordcloud", getWordCloud)

router.get("/idn/multi-live", getAllMultiLive)

export { router }