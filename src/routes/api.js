import express from "express";
import { getStreamDetail, getStreams } from "../controller/streamController.js";

const router = new express.Router()

router.get("/idn/streams", getStreams);

router.get("/idn/stream/:slug", getStreamDetail)

export { router }