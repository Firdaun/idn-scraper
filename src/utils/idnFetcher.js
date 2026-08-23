import { ResponseError } from "../error/responseError.js";

const IDN_GRAPHQL_URL = "https://api.idn.app/graphql";

export const fetchIdnGraphql = async (query) => {
    const response = await fetch(IDN_GRAPHQL_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query })
    });

    const responseBody = await response.json()

    if (!response.ok) {
        console.error("Detail Error IDN:", JSON.stringify(responseBody, null, 2));
        throw new ResponseError(404,
            responseBody?.errors?.[0]?.message || `IDN API Error: ${response.statusText}`
        );
    }

    return responseBody;
};