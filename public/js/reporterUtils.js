async function requestJson(url, options = {}) {
    const response = await fetch(url, {
        ...options,
        headers: { Accept: "application/json", ...options.headers }
    });

    if (response.redirected && response.url.includes("/login")) {
        window.location.href = "/login";
        return null;
    }

    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
        throw new Error("The server returned an unexpected response");
    }

    const result = await response.json();
    if (!response.ok || !result.success) {
        const validationMessage = Array.isArray(result.errors) && result.errors.length ? result.errors.join(", ") : "";
        throw new Error(validationMessage || result.message || "The request could not be completed");
    }

    return result;
}
