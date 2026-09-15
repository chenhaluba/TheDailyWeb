async function parseApiResponse(response) {
    if (response.redirected && response.url.includes("/login")) {
        window.location.href = "/login";
        return null;
    }

    const contentType = response.headers.get("content-type") || "";

    if (!contentType.includes("application/json")) {
        throw new Error("The server returned an unexpected response");
    }

    return response.json();
}
