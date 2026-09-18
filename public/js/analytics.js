document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("analytics-filters");
    const articleSelect = document.getElementById("article-select");
    const fromInput = document.getElementById("analytics-from");
    const toInput = document.getElementById("analytics-to");
    const loadButton = document.getElementById("load-analytics");
    const loadingElement = document.getElementById("analytics-loading");
    const errorElement = document.getElementById("analytics-error");
    const emptyElement = document.getElementById("analytics-empty");
    const resultsElement = document.getElementById("analytics-results");
    const articleTitle = document.getElementById("analytics-article-title");
    const totalViews = document.getElementById("analytics-total-views");
    const publicationCount = document.getElementById("analytics-publication-count");
    const chartCanvas = document.getElementById("views-chart");
    const publicationList = document.getElementById("publication-list");

    const requiredElements = [
        form,
        articleSelect,
        fromInput,
        toInput,
        loadButton,
        loadingElement,
        errorElement,
        emptyElement,
        resultsElement,
        articleTitle,
        totalViews,
        publicationCount,
        chartCanvas,
        publicationList
    ];

    if (requiredElements.some(element => !element)) return;

    let currentChart = null;
    let hasPublishedArticles = false;

    function createRequestError(message) {
        const error = new Error(message);
        error.isRequestError = true;
        return error;
    }

    async function parseApiResponse(response, fallbackMessage) {
        if (
            response.status === 401 ||
            response.status === 403 ||
            (response.redirected && response.url.includes("/login"))
        ) {
            throw createRequestError(
                "You are not authorized to view analytics."
            );
        }

        let result = null;

        try {
            result = await response.json();
        } catch (error) {
            throw createRequestError(fallbackMessage);
        }

        if (!response.ok || !result || result.success !== true) {
            const message =
                result &&
                typeof result.message === "string" &&
                result.message.trim()
                    ? result.message
                    : fallbackMessage;

            throw createRequestError(message);
        }

        return result;
    }

    function showError(message) {
        errorElement.textContent = message;
        errorElement.hidden = false;
        emptyElement.hidden = true;
        resultsElement.hidden = true;
    }

    function setLoading(isLoading) {
        loadingElement.hidden = !isLoading;
        loadButton.disabled = isLoading || !hasPublishedArticles;

        if (isLoading) {
            errorElement.hidden = true;
            emptyElement.hidden = true;
            resultsElement.hidden = true;
        }
    }

    function formatDateTime(value) {
        const date = new Date(value);

        if (Number.isNaN(date.getTime())) {
            return "Date unavailable";
        }

        return date.toLocaleString();
    }

    function normalizeTimestamp(value) {
        const date = new Date(value);

        if (Number.isNaN(date.getTime())) {
            return null;
        }

        return date.toISOString();
    }

    function renderPublications(publications) {
        const sortedPublications = publications.slice().sort((first, second) => {
            const firstTime = new Date(first && first.time).getTime();
            const secondTime = new Date(second && second.time).getTime();
            const safeFirstTime = Number.isNaN(firstTime)
                ? Number.POSITIVE_INFINITY
                : firstTime;
            const safeSecondTime = Number.isNaN(secondTime)
                ? Number.POSITIVE_INFINITY
                : secondTime;

            return safeFirstTime - safeSecondTime;
        });

        publicationList.replaceChildren();

        if (sortedPublications.length === 0) {
            const listItem = document.createElement("li");
            listItem.textContent = "No publication activity is available.";
            publicationList.append(listItem);
            return;
        }

        sortedPublications.forEach(publication => {
            const listItem = document.createElement("li");
            const versionNumber = publication && publication.versionNumber != null
                ? publication.versionNumber
                : "Unknown";
            const publishedAt = publication
                ? formatDateTime(publication.time)
                : "Date unavailable";

            listItem.textContent =
                `Version ${versionNumber} published on ${publishedAt}`;
            publicationList.append(listItem);
        });
    }

    function renderChart(views, publications) {
        if (currentChart) {
            currentChart.destroy();
            currentChart = null;
        }

        if (typeof window.Chart !== "function") {
            errorElement.textContent =
                "The analytics chart could not be loaded.";
            errorElement.hidden = false;
            return;
        }

        const viewCounts = new Map();
        const publicationVersions = new Map();

        views.forEach(view => {
            if (!view || typeof view !== "object") return;

            const timestamp = normalizeTimestamp(view.time);
            if (!timestamp || typeof view.count !== "number") return;

            const currentCount = viewCounts.get(timestamp) || 0;
            viewCounts.set(timestamp, currentCount + view.count);
        });

        publications.forEach(publication => {
            if (!publication || typeof publication !== "object") return;

            const timestamp = normalizeTimestamp(publication.time);
            if (!timestamp) return;

            const versions = publicationVersions.get(timestamp) || [];
            versions.push(publication.versionNumber);
            publicationVersions.set(timestamp, versions);
        });

        const labels = Array.from(new Set([
            ...viewCounts.keys(),
            ...publicationVersions.keys()
        ])).sort((first, second) => new Date(first) - new Date(second));

        const viewValues = labels.map(timestamp =>
            viewCounts.has(timestamp) ? viewCounts.get(timestamp) : null
        );
        const maximumViewCount = Math.max(0, ...viewCounts.values());
        const publicationHeight = maximumViewCount > 0
            ? maximumViewCount + Math.max(maximumViewCount * 0.1, 1)
            : 1;
        const publicationValues = labels.map(timestamp =>
            publicationVersions.has(timestamp) ? publicationHeight : null
        );
        const versionsByLabel = labels.map(timestamp =>
            publicationVersions.get(timestamp) || []
        );

        try {
            currentChart = new window.Chart(chartCanvas, {
                type: "line",
                data: {
                    labels,
                    datasets: [
                        {
                            label: "Views",
                            data: viewValues,
                            borderColor: "#1f4f78",
                            backgroundColor: "#1f4f78",
                            borderWidth: 2,
                            tension: 0.25,
                            fill: false,
                            spanGaps: true
                        },
                        {
                            label: "Publications",
                            data: publicationValues,
                            borderColor: "#027a48",
                            backgroundColor: "#027a48",
                            showLine: false,
                            pointRadius: 6,
                            pointHoverRadius: 8,
                            publicationVersions: versionsByLabel
                        }
                    ]
                },
                options: {
                    responsive: true,
                    scales: {
                        x: {
                            ticks: {
                                callback(value) {
                                    return formatDateTime(
                                        this.getLabelForValue(value)
                                    );
                                },
                                maxRotation: 45,
                                minRotation: 0
                            }
                        },
                        y: {
                            beginAtZero: true
                        }
                    },
                    plugins: {
                        tooltip: {
                            callbacks: {
                                title(items) {
                                    if (!items.length) return "";
                                    return formatDateTime(items[0].label);
                                },
                                label(context) {
                                    if (context.dataset.label === "Publications") {
                                        const versions =
                                            context.dataset.publicationVersions[
                                                context.dataIndex
                                            ] || [];

                                        if (!versions.length) return "Publications";

                                        return versions
                                            .map(version => `Version ${version}`)
                                            .join(", ");
                                    }

                                    return `Views: ${context.parsed.y}`;
                                }
                            }
                        }
                    }
                }
            });
        } catch (error) {
            errorElement.textContent =
                "The analytics chart could not be loaded.";
            errorElement.hidden = false;
        }
    }

    function renderAnalytics(data) {
        const views = Array.isArray(data.views) ? data.views : [];
        const publications = Array.isArray(data.publications)
            ? data.publications
            : [];
        const title =
            data.article &&
            typeof data.article === "object" &&
            typeof data.article.title === "string" &&
            data.article.title.trim()
                ? data.article.title
                : "Untitled article";
        const viewTotal = views.reduce((total, view) => {
            if (
                view &&
                typeof view.count === "number" &&
                Number.isFinite(view.count)
            ) {
                return total + view.count;
            }

            return total;
        }, 0);

        articleTitle.textContent = title;
        totalViews.textContent = String(viewTotal);
        publicationCount.textContent = String(publications.length);
        errorElement.hidden = true;
        emptyElement.hidden = true;
        resultsElement.hidden = false;

        renderPublications(publications);
        renderChart(views, publications);
    }

    async function loadAnalytics() {
        const articleId = articleSelect.value;

        if (!articleId) {
            showError("Please select an article.");
            return;
        }

        const fromValue = fromInput.value;
        const toValue = toInput.value;
        const fromDate = fromValue ? new Date(fromValue) : null;
        const toDate = toValue ? new Date(toValue) : null;

        if (
            (fromDate && Number.isNaN(fromDate.getTime())) ||
            (toDate && Number.isNaN(toDate.getTime()))
        ) {
            showError("Invalid date range.");
            return;
        }

        if (fromDate && toDate && fromDate > toDate) {
            showError("The From date must be earlier than the To date.");
            return;
        }

        const query = new URLSearchParams();
        if (fromDate) query.set("from", fromDate.toISOString());
        if (toDate) query.set("to", toDate.toISOString());

        const queryString = query.toString();
        const url = `/api/analytics/articles/${encodeURIComponent(articleId)}` +
            (queryString ? `?${queryString}` : "");

        setLoading(true);

        try {
            const response = await fetch(url, {
                credentials: "same-origin",
                headers: {
                    Accept: "application/json"
                }
            });
            const result = await parseApiResponse(
                response,
                "Failed to load analytics."
            );

            if (
                !result.data ||
                typeof result.data !== "object" ||
                Array.isArray(result.data)
            ) {
                throw createRequestError("Failed to load analytics.");
            }

            renderAnalytics(result.data);
        } catch (error) {
            const message = error && error.isRequestError
                ? error.message
                : "Failed to load analytics.";
            showError(message);
        } finally {
            setLoading(false);
        }
    }

    async function loadArticles() {
        articleSelect.disabled = true;
        setLoading(true);

        try {
            const response = await fetch("/api/editor/articles", {
                credentials: "same-origin",
                headers: {
                    Accept: "application/json"
                }
            });
            const result = await parseApiResponse(
                response,
                "Failed to load articles."
            );

            if (!Array.isArray(result.data)) {
                throw createRequestError("Failed to load articles.");
            }

            const publishedArticles = result.data.filter(article =>
                article &&
                typeof article === "object" &&
                article.publishedVersion != null &&
                article._id != null
            );

            publishedArticles.forEach(article => {
                const option = document.createElement("option");
                const publishedTitle =
                    article.publishedVersion &&
                    typeof article.publishedVersion.title === "string"
                        ? article.publishedVersion.title.trim()
                        : "";
                const workingTitle =
                    article.workingVersion &&
                    typeof article.workingVersion.title === "string"
                        ? article.workingVersion.title.trim()
                        : "";

                option.value = article._id;
                option.textContent =
                    publishedTitle || workingTitle || "Untitled article";
                articleSelect.append(option);
            });

            hasPublishedArticles = publishedArticles.length > 0;
            articleSelect.disabled = !hasPublishedArticles;
            setLoading(false);

            if (!hasPublishedArticles) {
                emptyElement.textContent =
                    "No published articles are available for analytics.";
                emptyElement.hidden = false;
                return;
            }

            emptyElement.textContent =
                "Select an article to view its analytics.";
            emptyElement.hidden = false;

            const articleId = new URLSearchParams(
                window.location.search
            ).get("articleId");
            const hasMatchingArticle = articleId &&
                Array.from(articleSelect.options).some(
                    option => option.value === articleId
                );

            if (hasMatchingArticle) {
                articleSelect.value = articleId;
                await loadAnalytics();
            }
        } catch (error) {
            hasPublishedArticles = false;
            articleSelect.disabled = true;
            setLoading(false);

            const message = error && error.isRequestError
                ? error.message
                : "Failed to load articles.";
            showError(message);
        }
    }

    form.addEventListener("submit", event => {
        event.preventDefault();
        loadAnalytics();
    });

    loadArticles();
});
