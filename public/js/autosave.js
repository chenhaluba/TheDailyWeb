document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("article-form");
    if (!form) return;

    const saveButton = document.getElementById("save-button");
    const saveStatus = document.getElementById("save-status");
    const articleId = form.dataset.articleId;
    const isNew = form.dataset.isNew === "true";

    function showStatus(message, type = "") {
        if (!saveStatus) return;

        saveStatus.textContent = message;
        saveStatus.className = "save-status";

        if (type) saveStatus.classList.add(`save-status-${type}`);
    }

    function getFormData() {
        const formData = new FormData(form);

        return {
            title: formData.get("title") || "",
            summary: formData.get("summary") || "",
            content: formData.get("content") || "",
            category: formData.get("category") || "",
            mainImage: formData.get("mainImage") || ""
        };
    }

    async function readResponse(response) {
        if (response.redirected && response.url.includes("/login")) {
            window.location.href = "/login";
            return null;
        }

        const contentType = response.headers.get("content-type") || "";

        if (!contentType.includes("application/json")) {
            throw new Error("השרת החזיר תשובה לא תקינה");
        }

        return response.json();
    }

    form.addEventListener("submit", async (event) => {
        event.preventDefault();

        const requestUrl = isNew ? "/api/reporter/articles" : `/api/reporter/articles/${articleId}/draft`;
        const requestMethod = isNew ? "POST" : "PATCH";

        if (saveButton) saveButton.disabled = true;
        showStatus(isNew ? "יוצר טיוטה..." : "שומר...");

        try {
            const response = await fetch(requestUrl, {
                method: requestMethod,
                headers: {
                    "Content-Type": "application/json",
                    "Accept": "application/json"
                },
                body: JSON.stringify(getFormData())
            });

            const result = await readResponse(response);
            if (!result) return;

            if (!response.ok || !result.success) {
                throw new Error(result.message || "שמירת הכתבה נכשלה");
            }

            if (isNew) {
                window.location.href = `/reporter/articles/${result.data.article.id}/edit`;
                return;
            }

            showStatus("השינויים נשמרו", "success");
        } catch (error) {
            console.error("Failed to save article:", error);
            showStatus(error.message || "השמירה נכשלה", "error");
        } finally {
            if (saveButton) saveButton.disabled = false;
        }
    });
});