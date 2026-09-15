document.addEventListener("DOMContentLoaded", () => {
    const commentsSection = document.querySelector("#comments-section");

    if (!commentsSection) {
        return;
    }

    const articleId = commentsSection.dataset.articleId;
    const commentForm = document.querySelector("#comment-form");
    const authorInput = document.querySelector("#comment-author");
    const contentInput = document.querySelector("#comment-content");
    const submitButton = document.querySelector("#comment-submit");
    const statusElement = document.querySelector("#comment-status");
    const commentsList = document.querySelector("#comments-list");

    if (
        !articleId ||
        !commentForm ||
        !authorInput ||
        !contentInput ||
        !submitButton ||
        !statusElement ||
        !commentsList
    ) {
        return;
    }

    const commentsUrl = `/api/articles/${encodeURIComponent(articleId)}/comments`;
    const originalButtonText = submitButton.textContent.trim();
    let isSubmitting = false;

    function setStatus(message, type = "") {
        statusElement.textContent = message;
        statusElement.className = "comment-status";

        if (type) {
            statusElement.classList.add(`comment-status-${type}`);
        }
    }

    function showListMessage(message, type = "") {
        const messageElement = document.createElement("p");
        messageElement.className = "comments-list-message";
        messageElement.textContent = message;

        if (type) {
            messageElement.classList.add(`comments-list-${type}`);
        }

        commentsList.replaceChildren(messageElement);
    }

    function formatCommentDate(createdAt) {
        const date = new Date(createdAt);

        if (Number.isNaN(date.getTime())) {
            return "Date unavailable";
        }

        return date.toLocaleString("en-GB", {
            day: "2-digit",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            hour12: false
        });
    }

    function createCommentElement(comment) {
        const commentCard = document.createElement("article");
        commentCard.className = "comment-card";

        const commentMeta = document.createElement("div");
        commentMeta.className = "comment-meta";

        const authorName = document.createElement("h3");
        authorName.className = "comment-author";
        authorName.textContent = typeof comment.authorName === "string"
            ? comment.authorName
            : "guest";

        const commentDate = document.createElement("time");
        commentDate.className = "comment-date";
        commentDate.dir = "ltr";
        commentDate.textContent = formatCommentDate(comment.createdAt);

        const parsedDate = new Date(comment.createdAt);
        if (!Number.isNaN(parsedDate.getTime())) {
            commentDate.dateTime = parsedDate.toISOString();
        }

        const commentContent = document.createElement("p");
        commentContent.className = "comment-content";
        commentContent.textContent = typeof comment.content === "string"
            ? comment.content
            : "";

        commentMeta.append(authorName, commentDate);
        commentCard.append(commentMeta, commentContent);

        return commentCard;
    }

    function renderComments(comments) {
        const validComments = comments.filter(
            comment => comment &&
                typeof comment === "object" &&
                !Array.isArray(comment)
        );

        commentsList.replaceChildren();

        if (validComments.length === 0) {
            showListMessage("No comments yet. Be the first to comment!", "empty");
            return;
        }

        validComments.forEach(comment => {
            commentsList.append(createCommentElement(comment));
        });
    }

    async function readApiResponse(response) {
        try {
            return await response.json();
        } catch (error) {
            return null;
        }
    }

    async function loadComments() {
        showListMessage("Loading comments...", "loading");

        try {
            const response = await fetch(commentsUrl, {
                headers: {
                    Accept: "application/json"
                }
            });
            const result = await readApiResponse(response);

            if (
                !response.ok ||
                !result ||
                result.success !== true ||
                !Array.isArray(result.data)
            ) {
                const message = result && typeof result.message === "string"
                    ? result.message
                    : "Unable to load comments.";
                showListMessage(message, "error");
                return;
            }

            renderComments(result.data);
        } catch (error) {
            showListMessage(
                "Unable to load comments. Please try again later.",
                "error"
            );
        }
    }

    function addCommentToList(comment) {
        const firstComment = commentsList.querySelector(".comment-card");

        if (!firstComment) {
            commentsList.replaceChildren();
        }

        commentsList.prepend(createCommentElement(comment));
    }

    async function submitComment(event) {
        event.preventDefault();

        if (isSubmitting) {
            return;
        }

        const authorName = authorInput.value.trim();
        const content = contentInput.value.trim();

        if (!content) {
            setStatus("Please enter a comment before posting.", "error");
            contentInput.focus();
            return;
        }

        isSubmitting = true;
        submitButton.disabled = true;
        submitButton.textContent = "Posting...";
        setStatus("");

        try {
            const response = await fetch(commentsUrl, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Accept: "application/json"
                },
                body: JSON.stringify({
                    authorName,
                    content
                })
            });
            const result = await readApiResponse(response);

            if (
                !response.ok ||
                !result ||
                result.success !== true ||
                !result.data ||
                typeof result.data !== "object" ||
                Array.isArray(result.data)
            ) {
                let message = "Unable to post your comment.";

                if (result && typeof result.message === "string") {
                    message = result.message;
                } else if (response.status === 429) {
                    message = "Comment limit reached. Please wait before posting again.";
                }

                setStatus(message, "error");
                return;
            }

            contentInput.value = "";
            addCommentToList(result.data);
            setStatus(
                typeof result.message === "string" && result.message
                    ? result.message
                    : "Comment posted successfully.",
                "success"
            );
        } catch (error) {
            setStatus(
                "Unable to post your comment. Please check your connection and try again.",
                "error"
            );
        } finally {
            isSubmitting = false;
            submitButton.disabled = false;
            submitButton.textContent = originalButtonText;
        }
    }

    commentForm.addEventListener("submit", submitComment);
    loadComments();
});
