const IDN_GRAPHQL_URL = "https://api.idn.app/graphql";

const HEADERS = {
    "Content-Type": "application/json",
    "User-Agent":
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
};

export const fetchIdnGraphql = async (query, variables = {}) => {
    const response = await fetch(IDN_GRAPHQL_URL, {
        method: "POST",
        headers: HEADERS,
        body: JSON.stringify({ query, variables }),
    });

    const responseBody = await response.json().catch(() => null);

    if (!response.ok) {
        console.error("Detail Error IDN:", JSON.stringify(responseBody, null, 2));
        throw new Error(
            responseBody?.errors?.[0]?.message || `IDN API Error: ${response.statusText}`
        );
    }

    return responseBody;
};