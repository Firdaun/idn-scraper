import { poller } from "./poller.js"
import { analytics } from "./analytics.js"

const POLLING_INTERVAL_MS = 30 * 1000

console.log(`[Worker Dimulai] Memantau semua live member JKT48...`)

async function runWorker() {
    try {
        const activeLives = await poller.saveSnapshot()
        for (const live of activeLives) {
            try {
                const result = await analytics.getLiveAnalytics(live.slug)
                console.log(`\n--- HASIL ANALISIS (${result.streamer}) ---`)
                console.log(JSON.stringify(result, null, 2))
            } catch (e) {
                console.log(`[Info] ${live.creator?.name}: ${e.message}`)
            }
        }
    } catch (e) {
        console.error(`[Worker Error]`, e.message)
    }
}

await runWorker()

setInterval(async () => {
    await runWorker()
}, POLLING_INTERVAL_MS)