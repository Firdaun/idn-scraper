import express from "express";
import { getStreamDetail, getStreams } from "../controller/streamController.js";
import { proxyStream } from "../controller/proxyController.js";

const router = new express.Router()

router.get("/idn/streams", getStreams);

router.get("/idn/stream/:slug", getStreamDetail)

router.get("/idn/proxy", proxyStream)

export { router }