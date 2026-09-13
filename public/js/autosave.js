document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("article-form");
    if (!form) return;

    const saveButton = document.getElementById("save-button");
    const saveStatus = document.getElementById("save-status");

    let articleId = form.dataset.articleId;
    let isNew = form.dataset.isNew === "true";
    let isDirty = false;
    let isSaving = false;
    let saveTimer = null;
    let lastSavedSnapshot = JSON.stringify(getFormData());

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

    function showStatus(message, type = "") {
        if (!saveStatus) return;

        saveStatus.textContent = message;
        saveStatus.className = "save-status";

        if (type) saveStatus.classList.add(`save-status-${type}`);
    }

    function formatSavedTime() {
        return new Intl.DateTimeFormat("he-IL", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit"
        }).format(new Date());
    }

    function scheduleSave() {
        clearTimeout(saveTimer);
        saveTimer = setTimeout(() => saveArticle(), 1200);
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

    async function saveArticle(force = false) {
        const currentData = getFormData();
        const currentSnapshot = JSON.stringify(currentData);

        if (!force && (!isDirty || currentSnapshot === lastSavedSnapshot)) return;

        if (isSaving) {
            scheduleSave();
            return;
        }

        isSaving = true;
        clearTimeout(saveTimer);
        showStatus(isNew ? "יוצר טיוטה..." : "שומר...");

        if (saveButton) saveButton.disabled = true;

        const requestUrl = isNew ? "/api/reporter/articles" : `/api/reporter/articles/${articleId}/draft`;
        const requestMethod = isNew ? "POST" : "PATCH";

        try {
            const response = await fetch(requestUrl, {
                method: requestMethod,
                headers: {
                    "Content-Type": "application/json",
                    "Accept": "application/json"
                },
                body: JSON.stringify(currentData),
                keepalive: true
            });

            const result = await readResponse(response);
            if (!result) return;

            if (!response.ok || !result.success) {
                throw new Error(result.message || "שמירת הכתבה נכשלה");
            }

            if (isNew) {
                articleId = result.data.article.id;
                isNew = false;
                form.dataset.articleId = articleId;
                form.dataset.isNew = "false";
                window.history.replaceState({}, "", `/reporter/articles/${articleId}/edit`);

                if (saveButton) saveButton.textContent = "שמירה עכשיו";
            }

            lastSavedSnapshot = currentSnapshot;
            isDirty = JSON.stringify(getFormData()) !== lastSavedSnapshot;
            showStatus(`נשמר בשעה ${formatSavedTime()}`, "success");

            if (isDirty) scheduleSave();
        } catch (error) {
            console.error("Failed to save article:", error);
            isDirty = true;
            showStatus(error.message || "השמירה נכשלה", "error");
        } finally {
            isSaving = false;
            if (saveButton) saveButton.disabled = false;
        }
    }

    function saveBeforeLeaving() {
        if (!isDirty || isSaving) return;

        const requestUrl = isNew ? "/api/reporter/articles" : `/api/reporter/articles/${articleId}/draft`;
        const requestMethod = isNew ? "POST" : "PATCH";

        fetch(requestUrl, {
            method: requestMethod,
            headers: {
                "Content-Type": "application/json",
                "Accept": "application/json"
            },
            body: JSON.stringify(getFormData()),
            keepalive: true
        }).catch((error) => {
            console.error("Failed to save article before leaving:", error);
        });
    }

    form.addEventListener("input", () => {
        const currentSnapshot = JSON.stringify(getFormData());
        isDirty = currentSnapshot !== lastSavedSnapshot;

        if (!isDirty) {
            clearTimeout(saveTimer);
            showStatus("כל השינויים נשמרו", "success");
            return;
        }

        showStatus("יש שינויים שלא נשמרו");
        scheduleSave();
    });

    form.addEventListener("submit", async (event) => {
        event.preventDefault();
        isDirty = JSON.stringify(getFormData()) !== lastSavedSnapshot;
        await saveArticle(true);
    });

    window.addEventListener("pagehide", saveBeforeLeaving);

    document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "hidden" && isDirty && !isSaving) {
            saveArticle();
        }
    });
});