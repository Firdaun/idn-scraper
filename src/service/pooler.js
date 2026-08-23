export async function fetchLiveStreamData(slug) {
    try {
        const response = await fetch('https://api.idn.app/graphql', {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                query: `
                    query GetActiveLivestreams {
                        getLivestreams {
                            slug
                            title
                            status
                            view_count
                            live_at
                            end_at
                            room_identifier
                            category {
                                name
                                slug
                            }
                            creator {
                                name
                                username
                                uuid
                            }
                        }
                    }
                `
            })
        })

        const result = await response.json()

        const livestreams = result?.data?.getLivestreams || [];
        const targetLive = livestreams.find((stream) => stream.slug === slug);

        return targetLive || null;
    } catch (e) {
        console.error(`[Error Fetch API] ${e.message}`)
        return null
    }
}