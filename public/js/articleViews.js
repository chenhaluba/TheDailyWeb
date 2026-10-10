document.addEventListener("DOMContentLoaded", async () => {
    const articleElement = document.querySelector(".article-page");

    if (!articleElement) {
        return;
    }

    const articleId = articleElement.dataset.articleId;

    if (!articleId) {
        return;
    }

    try {
        const response = await fetch(
            `/api/articles/${encodeURIComponent(articleId)}/view`,
            {
                method: "POST",
                headers: {
                    Accept: "application/json"
                }
            }
        );

        if (!response.ok) {
            console.error("Unable to record article view.");
        }
    } catch (error) {
        console.error("Unable to record article view.");
    }
});
