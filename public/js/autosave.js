document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("article-form");
    if (!form) return;

    const saveButton = document.getElementById("save-button");
    const submitButton = document.getElementById("submit-button");
    const saveStatus = document.getElementById("save-status");
    const validationSummary = document.getElementById("validation-summary");
    const requiredFields = [
        { name: "title", label: "Title" },
        { name: "summary", label: "Summary" },
        { name: "content", label: "Content" },
        { name: "category", label: "Category" },
        { name: "mainImage", label: "Main Image" }
    ];
    let articleId = form.dataset.articleId;
    let isNew = form.dataset.isNew === "true";
    let isDirty = false;
    let saveTimer;
    let activeSavePromise;

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

    let lastSavedSnapshot = JSON.stringify(getFormData());

    function clearFieldError(fieldName) {
        const field = form.elements[fieldName];
        const errorElement = document.getElementById(`${fieldName}-error`);
        if (field) {
            field.classList.remove("field-invalid");
            field.removeAttribute("aria-invalid");
        }
        if (errorElement) errorElement.textContent = "";
    }

    function clearValidationErrors() {
        requiredFields.forEach(({ name }) => clearFieldError(name));
        if (validationSummary) {
            validationSummary.hidden = true;
            validationSummary.textContent = "";
        }
    }

    function validateFormForSubmission() {
        const articleData = getFormData();
        clearValidationErrors();
        const missingFields = requiredFields.filter(({ name }) => !articleData[name].trim());

        missingFields.forEach(({ name }) => {
            const field = form.elements[name];
            const errorElement = document.getElementById(`${name}-error`);
            if (field) {
                field.classList.add("field-invalid");
                field.setAttribute("aria-invalid", "true");
            }
            if (errorElement) errorElement.textContent = "This field is required.";
        });

        if (missingFields.length && validationSummary) {
            validationSummary.textContent = `Complete the following fields: ${missingFields.map(({ label }) => label).join(", ")}.`;
            validationSummary.hidden = false;
        }

        if (missingFields.length) form.elements[missingFields[0].name]?.focus();
        return missingFields;
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
        return new Intl.DateTimeFormat("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(new Date());
    }

    function scheduleSave() {
        clearTimeout(saveTimer);
        saveTimer = setTimeout(saveArticle, 1200);
    }

    function getSaveRequest() {
        return isNew
            ? { url: "/api/reporter/articles", method: "POST" }
            : { url: `/api/reporter/articles/${articleId}/draft`, method: "PATCH" };
    }

    async function saveArticle(force = false) {
        if (activeSavePromise) await activeSavePromise;

        const currentData = getFormData();
        const currentSnapshot = JSON.stringify(currentData);
        if (!force && (!isDirty || currentSnapshot === lastSavedSnapshot)) return true;

        clearTimeout(saveTimer);
        showStatus(isNew ? "Creating draft..." : "Saving...");
        setButtonsDisabled(true);
        const { url, method } = getSaveRequest();

        const saveOperation = (async () => {
            try {
                const result = await requestJson(url, {
                    method,
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(currentData),
                    keepalive: true
                });
                if (!result) return false;

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
        if (missingFields.length) {
            showStatus("Some required fields are missing", "error");
            return;
        }
        if (!window.confirm("Submit this article for editor review?")) return;

        const savedSuccessfully = await saveArticle(true);
        if (!savedSuccessfully || !articleId) return;

        setButtonsDisabled(true);
        showStatus("Submitting for review...");
        try {
            const result = await requestJson(`/api/reporter/articles/${articleId}/submit`, { method: "POST" });
            if (!result) return;
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
        const { url, method } = getSaveRequest();
        fetch(url, {
            method,
            headers: { "Content-Type": "application/json", Accept: "application/json" },
            body: JSON.stringify(getFormData()),
            keepalive: true
        }).catch((error) => console.error("Failed to save article before leaving:", error));
    }

    form.addEventListener("input", (event) => {
        if (event.target.name && event.target.value.trim()) {
            clearFieldError(event.target.name);
            const hasVisibleErrors = requiredFields.some(({ name }) => form.elements[name]?.classList.contains("field-invalid"));
            if (!hasVisibleErrors && validationSummary) validationSummary.hidden = true;
        }

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
