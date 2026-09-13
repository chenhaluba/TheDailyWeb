document.addEventListener("DOMContentLoaded", () => {
    const updateButtons = document.querySelectorAll(".start-update-button");

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

    async function startUpdate(button) {
        const articleId = button.dataset.articleId;
        const originalText = button.textContent;

        const shouldStart = window.confirm("להתחיל לערוך גרסה חדשה של הכתבה?");
        if (!shouldStart) return;

        button.disabled = true;
        button.textContent = "פותח עדכון...";

        try {
            const response = await fetch(`/api/reporter/articles/${articleId}/start-update`, {
                method: "POST",
                headers: { "Accept": "application/json" }
            });

            const result = await readResponse(response);
            if (!result) return;

            if (!response.ok || !result.success) {
                throw new Error(result.message || "לא ניתן היה להתחיל את העדכון");
            }

            window.location.href = `/reporter/articles/${articleId}/edit`;
        } catch (error) {
            console.error("Failed to start article update:", error);
            window.alert(error.message || "לא ניתן היה להתחיל את העדכון");
            button.disabled = false;
            button.textContent = originalText;
        }
    }

    updateButtons.forEach((button) => {
        button.addEventListener("click", () => startUpdate(button));
    });
});