import { ResponseError } from "../error/responseError.js"

const IDN_GRAPHQL_URL = "https://api.idn.app/graphql"

export const fetchIdnGraphql = async () => {
    const query = `
        query GetFullLivestreams {
            page1: getLivestreams(page: 1) {
                slug
                title
                status
                view_count
                live_at
                end_at
                room_identifier
                playback_url
                image_url
                category {
                    name
                    slug
                }
                creator {
                    name
                    username
                    avatar
                    uuid
                }
            }
            page2: getLivestreams(page: 2) {
                slug
                title
                status
                view_count
                live_at
                end_at
                room_identifier
                playback_url
                image_url
                category {
                    name
                    slug
                }
                creator {
                    name
                    username
                    avatar
                    uuid
                }
            }
            page3: getLivestreams(page: 3) {
                slug
                title
                status
                view_count
                live_at
                end_at
                room_identifier
                playback_url
                image_url
                category {
                    name
                    slug
                }
                creator {
                    name
                    username
                    avatar
                    uuid
                }
            }
            page4: getLivestreams(page: 4) {
                slug
                title
                status
                view_count
                live_at
                end_at
                room_identifier
                playback_url
                image_url
                category {
                    name
                    slug
                }
                creator {
                    name
                    username
                    avatar
                    uuid
                }
            }
            searchJkt: searchLivestream(query: "jkt48", limit: 50) {
                result {
                    slug
                    title
                    status
                    view_count
                    live_at
                    end_at
                    room_identifier
                    playback_url
                    image_url
                    category {
                        name
                        slug
                    }
                    creator {
                        name
                        username
                        avatar
                        uuid
                    }
                }
            }
        }
    `

    const response = await fetch(IDN_GRAPHQL_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "Pragma": "no-cache",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        },
        body: JSON.stringify({ query })
    })

    const responseBody = await response.json()

    if (!response.ok) {
        console.error("Detail Error IDN:", JSON.stringify(responseBody, null, 2))
        throw new ResponseError(404,
            responseBody?.errors?.[0]?.message || `IDN API Error: ${response.statusText}`
        )
    }

    const p1 = responseBody.data?.page1 || []
    const p2 = responseBody.data?.page2 || []
    const p3 = responseBody.data?.page3 || []
    const p4 = responseBody.data?.page4 || []
    const search = responseBody.data?.searchJkt?.result || []

    const streamMap = new Map()
    for (const stream of [...p1, ...p2, ...p3, ...p4, ...search]) {
        if (stream && stream.slug) {
            streamMap.set(stream.slug, stream)
        }
    }

    return {
        data: {
            getLivestreams: Array.from(streamMap.values())
        }
    }
};