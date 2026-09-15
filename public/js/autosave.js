document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("article-form");
    if (!form) return;

    const saveButton = document.getElementById("save-button");
    const submitButton = document.getElementById("submit-button");
    const saveStatus = document.getElementById("save-status");

    let articleId = form.dataset.articleId;
    let isNew = form.dataset.isNew === "true";
    let isDirty = false;
    let saveTimer = null;
    let activeSavePromise = null;
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

    function validateFormForSubmission() {
        const articleData = getFormData();
        const requiredFields = [
            { name: "title", label: "Title" },
            { name: "summary", label: "Summary" },
            { name: "content", label: "Content" },
            { name: "category", label: "Category" },
            { name: "mainImage", label: "Main Image" }
        ];

        return requiredFields
            .filter((field) => !articleData[field.name].trim())
            .map((field) => field.label);
    }

    function showStatus(message, type = "") {
        if (!saveStatus) return;

        saveStatus.textContent = message;
        saveStatus.className = "save-status";
        if (type) saveStatus.classList.add(`save-status-${type}`);
    }

    function setButtonsDisabled(disabled) {
        if (saveButton) saveButton.disabled = disabled;
        if (submitButton) submitButton.disabled = disabled;
    }

    function formatSavedTime() {
        return new Intl.DateTimeFormat("en-US", {
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
            throw new Error("The server returned an unexpected response");
        }

        return response.json();
    }

    async function saveArticle(force = false) {
        if (activeSavePromise) await activeSavePromise;

        const currentData = getFormData();
        const currentSnapshot = JSON.stringify(currentData);

        if (!force && (!isDirty || currentSnapshot === lastSavedSnapshot)) return true;

        clearTimeout(saveTimer);
        showStatus(isNew ? "Creating draft..." : "Saving...");
        setButtonsDisabled(true);

        const requestUrl = isNew ? "/api/reporter/articles" : `/api/reporter/articles/${articleId}/draft`;
        const requestMethod = isNew ? "POST" : "PATCH";

        const saveOperation = (async () => {
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
                if (!result) return false;

                if (!response.ok || !result.success) {
                    throw new Error(result.message || "Failed to save article");
                }

                if (isNew) {
                    articleId = result.data.article.id;
                    isNew = false;
                    form.dataset.articleId = articleId;
                    form.dataset.isNew = "false";
                    window.history.replaceState({}, "", `/reporter/articles/${articleId}/edit`);

                    if (saveButton) saveButton.textContent = "Save Now";
                    if (submitButton) submitButton.hidden = false;
                }

                lastSavedSnapshot = currentSnapshot;
                isDirty = JSON.stringify(getFormData()) !== lastSavedSnapshot;
                showStatus(`Saved at ${formatSavedTime()}`, "success");

                if (isDirty) scheduleSave();
                return true;
            } catch (error) {
                console.error("Failed to save article:", error);
                isDirty = true;
                showStatus(error.message || "Save failed", "error");
                return false;
            } finally {
                setButtonsDisabled(false);
            }
        })();

        activeSavePromise = saveOperation;
        const savedSuccessfully = await saveOperation;

        if (activeSavePromise === saveOperation) activeSavePromise = null;
        return savedSuccessfully;
    }

    async function submitArticle() {
        clearTimeout(saveTimer);

        const missingFields = validateFormForSubmission();

        if (missingFields.length > 0) {
            showStatus(`Please complete the following fields: ${missingFields.join(", ")}`, "error");
            return;
        }

        const shouldSubmit = window.confirm("Submit this article for editor review?");
        if (!shouldSubmit) return;

        const savedSuccessfully = await saveArticle(true);
        if (!savedSuccessfully || !articleId) return;

        setButtonsDisabled(true);
        showStatus("Submitting for review...");

        try {
            const response = await fetch(`/api/reporter/articles/${articleId}/submit`, {
                method: "POST",
                headers: { "Accept": "application/json" }
            });

            const result = await readResponse(response);
            if (!result) return;

            if (!response.ok || !result.success) {
                const message = result.errors && result.errors.length > 0 ? result.errors.join(", ") : result.message;
                throw new Error(message || "Failed to submit article");
            }

            showStatus("Article submitted for review", "success");
            window.location.href = "/reporter/dashboard";
        } catch (error) {
            console.error("Failed to submit article:", error);
            showStatus(error.message || "Failed to submit article", "error");
            setButtonsDisabled(false);
        }
    }

    function saveBeforeLeaving() {
        if (!isDirty || activeSavePromise) return;

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
        }).catch((error) => console.error("Failed to save article before leaving:", error));
    }

    form.addEventListener("input", () => {
        isDirty = JSON.stringify(getFormData()) !== lastSavedSnapshot;

        if (!isDirty) {
            clearTimeout(saveTimer);
            showStatus("All changes saved", "success");
            return;
        }

        showStatus("Unsaved changes");
        scheduleSave();
    });

    form.addEventListener("submit", async (event) => {
        event.preventDefault();
        isDirty = JSON.stringify(getFormData()) !== lastSavedSnapshot;
        await saveArticle(true);
    });

    if (submitButton) submitButton.addEventListener("click", submitArticle);

    window.addEventListener("pagehide", saveBeforeLeaving);

    document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "hidden" && isDirty && !activeSavePromise) saveArticle();
    });
});
