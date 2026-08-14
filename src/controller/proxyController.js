export const proxyStream = async (req, res, next) => {
    try {
        const targetUrl = req.query.url;

        if (!targetUrl) {
            return res.status(400).send("Parameter url wajib disertakan.");
        }

        const response = await fetch(targetUrl, {
            headers: {
                "User-Agent":
                    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                Referer: "https://www.idn.app/",
                Origin: "https://www.idn.app",
            },
        });

        if (!response.ok) {
            return res.status(response.status).send(`Gagal mengambil data dari CDN: ${response.statusText}`);
        }

        const contentType = response.headers.get("content-type") || "";

        if (
            targetUrl.includes(".m3u8") ||
            contentType.includes("mpegurl") ||
            contentType.includes("application/x-mpegURL")
        ) {
            const text = await response.text();
            const baseUrl = targetUrl.substring(0, targetUrl.lastIndexOf("/") + 1);

            const modifiedManifest = text
                .split("\n")
                .map((line) => {
                    const trimmed = line.trim();
                    if (!trimmed || trimmed.startsWith("#")) {
                        return line;
                    }

                    let fullUrl = trimmed;
                    if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://")) {
                        fullUrl = new URL(trimmed, baseUrl).toString();
                    }
                    const backendBaseUrl = process.env.BASE_URL || `${req.protocol}://${req.get("host")}`;
                    return `${backendBaseUrl}/idn/proxy?url=${encodeURIComponent(fullUrl)}`;
                })
                .join("\n");

            res.setHeader("Content-Type", "application/vnd.apple.mpegurl");
            return res.send(modifiedManifest);
        }

        const arrayBuffer = await response.arrayBuffer();
        res.setHeader("Content-Type", contentType || "video/mp2t");
        return res.send(Buffer.from(arrayBuffer));
    } catch (error) {
        next(error);
    }
};