document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll(".start-update-button").forEach((button) => {
        button.addEventListener("click", async () => {
            if (!window.confirm("Start editing a new version of this article?")) return;

            const articleId = button.dataset.articleId;
            const originalText = button.textContent;
            button.disabled = true;
            button.textContent = "Starting update...";

            try {
                const result = await requestJson(`/api/reporter/articles/${articleId}/start-update`, { method: "POST" });
                if (result) window.location.href = `/reporter/articles/${articleId}/edit`;
            } catch (error) {
                console.error("Failed to start article update:", error);
                window.alert(error.message || "Failed to start article update");
                button.disabled = false;
                button.textContent = originalText;
            }
        });
    });
});
