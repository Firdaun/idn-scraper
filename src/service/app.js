import { poller } from "./poller.js";
import { analytics } from "./analytics.js";

const TARGET_SLUG = "masukkan-slug-live-di-sini";
const POLLING_INTERVAL_MS = 2 * 60 * 1000; // 2 Menit

console.log(`[Worker Dimulai] Memantau live: ${TARGET_SLUG}`);

// Eksekusi pertama kali saat script jalan
await poller.recordViewerSnapshot(TARGET_SLUG);

// Eksekusi periodik
setInterval(async () => {
    await poller.recordViewerSnapshot(TARGET_SLUG);
}, POLLING_INTERVAL_MS);

// Contoh pemanggilan metrik analitik
async function displayMetrics() {
    const result = await analytics.getLiveAnalytics(TARGET_SLUG);
    console.log("\n--- HASIL ANALISIS ---");
    console.log(JSON.stringify(result, null, 2));
}

displayMetrics()