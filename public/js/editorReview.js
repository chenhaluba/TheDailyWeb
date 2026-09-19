const reviewPage = document.getElementById("review-page");

if (reviewPage) {
    const articleId = reviewPage.dataset.articleId;

    const form = document.getElementById("working-version-form");
    const approveButton = document.getElementById("approve-button");
    const returnButton = document.getElementById("return-button");
    const deleteButton = document.getElementById("delete-button");
    const editorNote = document.getElementById("editor-note");
    const messageBox = document.getElementById("message-box");

    function showMessage(message, type = "success") {
        messageBox.textContent = message;
        messageBox.className = `message-box ${type}`;
        messageBox.hidden = false;
    }

    form.addEventListener("submit", async (event) => {
        event.preventDefault();

        const updates = {
            title: document.getElementById("title").value.trim(),
            summary: document.getElementById("summary").value.trim(),
            category: document.getElementById("category").value.trim(),
            mainImage: document.getElementById("mainImage").value.trim(),
            content: document.getElementById("content").value.trim()
        };

        try {
            const response = await fetch(`/api/editor/articles/${articleId}`, {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(updates)
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || "Failed to save article");
            }

            showMessage("Changes saved successfully.");
        } catch (error) {
            showMessage(error.message, "error");
        }
    });

    approveButton?.addEventListener("click", async () => {
        try {
            const response = await fetch(
                `/api/editor/articles/${articleId}/approve`,
                {
                    method: "POST"
                }
            );

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || "Failed to approve article");
            }

            window.location.href = "/editor/dashboard";
        } catch (error) {
            showMessage(error.message, "error");
        }
    });

    returnButton?.addEventListener("click", async () => {
        const note = editorNote.value.trim();

        if (!note) {
            showMessage(
                "Please write an editor note before returning the article.",
                "error"
            );
            return;
        }

        try {
            const response = await fetch(
                `/api/editor/articles/${articleId}/return`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        editorNote: note
                    })
                }
            );

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || "Failed to return article");
            }

            window.location.href = "/editor/dashboard";
        } catch (error) {
            showMessage(error.message, "error");
        }
    });

    deleteButton.addEventListener("click", async () => {
        const confirmed = window.confirm(
            "Are you sure you want to permanently delete this article?"
        );

        if (!confirmed) {
            return;
        }

        try {
            const response = await fetch(
                `/api/editor/articles/${articleId}`,
                {
                    method: "DELETE"
                }
            );

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || "Failed to delete article");
            }

            window.location.href = "/editor/dashboard";
        } catch (error) {
            showMessage(error.message, "error");
        }
    });
}