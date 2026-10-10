function getAnalyticsHourBucket(value) {
    const bucketStart = new Date(value);
    bucketStart.setUTCMinutes(0, 0, 0);
    return bucketStart.getTime();
}

const analyticsDateFormatter = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric"
});

const analyticsTimeFormatter = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
});

const analyticsAxisDateFormatter = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short"
});

function formatAnalyticsDate(value) {
    const date = new Date(value);
    return Number.isNaN(date.getTime())
        ? "Date unavailable"
        : analyticsDateFormatter.format(date);
}

function formatAnalyticsTime(value) {
    const date = new Date(value);
    return Number.isNaN(date.getTime())
        ? "Time unavailable"
        : analyticsTimeFormatter.format(date);
}

function formatAnalyticsAxisTick(value) {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return ["", ""];

    return [
        analyticsAxisDateFormatter.format(date),
        analyticsTimeFormatter.format(date)
    ];
}

function getAnalyticsLocalMidnight(value) {
    const date = new Date(value);
    return new Date(
        date.getFullYear(),
        date.getMonth(),
        date.getDate()
    );
}

function isAnalyticsMultiDayRange(minimum, maximum) {
    return getAnalyticsLocalMidnight(minimum).getTime() !==
        getAnalyticsLocalMidnight(maximum).getTime();
}

function buildAnalyticsAxisTicks(minimum, maximum) {
    const oneHour = 60 * 60 * 1000;

    if (isAnalyticsMultiDayRange(minimum, maximum)) {
        const ticks = [minimum];
        const candidate = getAnalyticsLocalMidnight(minimum);
        candidate.setDate(candidate.getDate() + 1);

        while (candidate.getTime() <= maximum) {
            ticks.push(candidate.getTime());
            const previous = candidate.getTime();
            candidate.setDate(candidate.getDate() + 1);

            if (candidate.getTime() <= previous) break;
        }

        return ticks;
    }

    const usesHourlyTicks = maximum - minimum < 4 * oneHour;
    const hourStep = usesHourlyTicks ? 1 : 4;
    const candidate = new Date(minimum);

    if (usesHourlyTicks) {
        candidate.setMinutes(0, 0, 0);
        if (candidate.getTime() < minimum) {
            candidate.setHours(candidate.getHours() + 1);
        }
    } else {
        const nextFourHour = Math.ceil(candidate.getHours() / 4) * 4;
        candidate.setHours(nextFourHour, 0, 0, 0);
        if (candidate.getTime() < minimum) {
            candidate.setHours(candidate.getHours() + 4);
        }
    }

    const ticks = [];

    while (candidate.getTime() <= maximum) {
        ticks.push(candidate.getTime());
        const previous = candidate.getTime();
        candidate.setHours(candidate.getHours() + hourStep);

        if (candidate.getTime() <= previous) break;
    }

    return ticks;
}

function getAnalyticsDisplayPeriodEnd(value) {
    const date = new Date(value);

    if (
        date.getMinutes() === 59 &&
        date.getSeconds() === 59 &&
        date.getMilliseconds() === 999
    ) {
        return date.getTime() + 1;
    }

    return date.getTime();
}

function formatAnalyticsTimeRange(startValue, endValue) {
    const start = new Date(startValue);
    const end = new Date(getAnalyticsDisplayPeriodEnd(endValue));
    const startDate = formatAnalyticsDate(start);
    const endDate = formatAnalyticsDate(end);
    const startTime = formatAnalyticsTime(start);
    const endTime = formatAnalyticsTime(end);

    if (startDate !== endDate) {
        return `${startDate} ${startTime}–${endDate} ${endTime}`;
    }

    return `${startTime}–${endTime}`;
}

function buildAnalyticsHourlyTooltipTitle(periodStart, periodEnd) {
    const displayEnd = getAnalyticsDisplayPeriodEnd(periodEnd);
    const timeRange = formatAnalyticsTimeRange(periodStart, periodEnd);

    if (
        formatAnalyticsDate(periodStart) !==
        formatAnalyticsDate(displayEnd)
    ) {
        return [timeRange];
    }

    return [formatAnalyticsDate(periodStart), timeRange];
}

function buildAnalyticsHourlyViewPoints(views, range) {
    const counts = new Map();

    views.forEach(view => {
        if (!view || typeof view !== "object") return;

        const timestamp = new Date(view.time).getTime();
        if (
            Number.isNaN(timestamp) ||
            typeof view.count !== "number" ||
            !Number.isFinite(view.count)
        ) {
            return;
        }

        counts.set(timestamp, (counts.get(timestamp) || 0) + view.count);
    });

    const firstBucket = getAnalyticsHourBucket(range.from);
    const lastBucket = getAnalyticsHourBucket(range.to);
    const points = [];

    for (
        let bucketStart = firstBucket;
        bucketStart <= lastBucket;
        bucketStart += 60 * 60 * 1000
    ) {
        points.push({
            x: bucketStart === firstBucket ? range.from : bucketStart,
            y: counts.get(bucketStart) || 0,
            bucketStart,
            periodStart: Math.max(bucketStart, range.from),
            periodEnd: Math.min(bucketStart + (60 * 60 * 1000), range.to)
        });
    }

    return points;
}

function buildAnalyticsFourHourViewPoints(views, range) {
    const fourHours = 4 * 60 * 60 * 1000;
    const groupCount = Math.floor(
        (range.to - range.from) / fourHours
    ) + 1;
    const counts = Array(groupCount).fill(0);

    views.forEach(view => {
        if (!view || typeof view !== "object") return;

        const timestamp = new Date(view.time).getTime();
        if (
            Number.isNaN(timestamp) ||
            typeof view.count !== "number" ||
            !Number.isFinite(view.count)
        ) {
            return;
        }

        const timestampInRange = Math.min(
            Math.max(timestamp, range.from),
            range.to
        );
        const groupIndex = Math.min(
            Math.floor((timestampInRange - range.from) / fourHours),
            groupCount - 1
        );
        counts[groupIndex] += view.count;
    });

    return counts.map((count, index) => {
        const periodStart = range.from + (index * fourHours);

        return {
            x: periodStart,
            y: count,
            periodStart,
            periodEnd: Math.min(periodStart + fourHours, range.to)
        };
    });
}

function buildAnalyticsViewSeries(views, range) {
    const usesFourHourGroups =
        range.to - range.from > 48 * 60 * 60 * 1000;

    return {
        mode: usesFourHourGroups ? "four-hour" : "hourly",
        points: usesFourHourGroups
            ? buildAnalyticsFourHourViewPoints(views, range)
            : buildAnalyticsHourlyViewPoints(views, range)
    };
}

function buildAnalyticsLocalHourBoundary(
    dateValue,
    hourValue,
    boundaryType,
    bounds
) {
    if (!dateValue && !hourValue) return { date: null, error: null };

    if (!dateValue) {
        return {
            date: null,
            error: `Select a date before choosing an hour for ${boundaryType}.`
        };
    }

    const dateParts = dateValue.split("-").map(Number);
    const hasHour = hourValue !== "";
    const hour = hasHour ? Number(hourValue) : null;

    if (
        dateParts.length !== 3 ||
        dateParts.some(part => !Number.isInteger(part)) ||
        (hasHour && (
            !Number.isInteger(hour) ||
            hour < 0 ||
            hour > 23
        ))
    ) {
        return { date: null, error: `Invalid ${boundaryType} date or hour.` };
    }

    const [year, month, day] = dateParts;
    const isFrom = boundaryType === "From";
    const selected = hasHour
        ? new Date(
            year,
            month - 1,
            day,
            hour,
            isFrom ? 0 : 59,
            isFrom ? 0 : 59,
            isFrom ? 0 : 999
        )
        : new Date(
            new Date(year, month - 1, day + (isFrom ? 0 : 1)).getTime() -
                (isFrom ? 0 : 1)
        );

    if (
        selected.getFullYear() !== year ||
        selected.getMonth() !== month - 1 ||
        selected.getDate() !== day ||
        (hasHour && selected.getHours() !== hour)
    ) {
        return { date: null, error: `Invalid ${boundaryType} date or hour.` };
    }

    const lowerBound = new Date(bounds.from);
    const upperBound = new Date(bounds.to);
    const isSameLocalDate = (first, second) =>
        first.getFullYear() === second.getFullYear() &&
        first.getMonth() === second.getMonth() &&
        first.getDate() === second.getDate();

    if (
        isFrom &&
        (
            hasHour
                ? getAnalyticsHourBucket(selected) ===
                    getAnalyticsHourBucket(lowerBound)
                : isSameLocalDate(selected, lowerBound)
        ) &&
        selected < lowerBound
    ) {
        return { date: lowerBound, error: null };
    }

    if (
        !isFrom &&
        (
            hasHour
                ? getAnalyticsHourBucket(selected) ===
                    getAnalyticsHourBucket(upperBound)
                : isSameLocalDate(selected, upperBound)
        ) &&
        selected > upperBound
    ) {
        return { date: upperBound, error: null };
    }

    return { date: selected, error: null };
}

if (typeof module !== "undefined" && module.exports) {
    module.exports = {
        buildAnalyticsFourHourViewPoints,
        buildAnalyticsHourlyViewPoints,
        buildAnalyticsHourlyTooltipTitle,
        buildAnalyticsLocalHourBoundary,
        buildAnalyticsViewSeries,
        buildAnalyticsAxisTicks,
        formatAnalyticsAxisTick,
        formatAnalyticsDate,
        formatAnalyticsTime,
        formatAnalyticsTimeRange,
        isAnalyticsMultiDayRange,
        getAnalyticsHourBucket
    };
}

if (typeof document !== "undefined") {
document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("analytics-filters");
    const articleSelect = document.getElementById("article-select");
    const fromDateInput = document.getElementById("analytics-from-date");
    const fromHourSelect = document.getElementById("analytics-from-hour");
    const toDateInput = document.getElementById("analytics-to-date");
    const toHourSelect = document.getElementById("analytics-to-hour");
    const loadButton = document.getElementById("load-analytics");
    const loadingElement = document.getElementById("analytics-loading");
    const errorElement = document.getElementById("analytics-error");
    const emptyElement = document.getElementById("analytics-empty");
    const resultsElement = document.getElementById("analytics-results");
    const articleTitle = document.getElementById("analytics-article-title");
    const viewTotalLabel = document.getElementById("analytics-view-total-label");
    const totalViews = document.getElementById("analytics-total-views");
    const publicationCount = document.getElementById("analytics-publication-count");
    const chartScroller = document.querySelector(".analytics-chart-canvas");
    const chartInner = document.getElementById("analytics-chart-inner");
    const chartCanvas = document.getElementById("views-chart");
    const publicationList = document.getElementById("publication-list");

    const requiredElements = [
        form,
        articleSelect,
        fromDateInput,
        fromHourSelect,
        toDateInput,
        toHourSelect,
        loadButton,
        loadingElement,
        errorElement,
        emptyElement,
        resultsElement,
        articleTitle,
        viewTotalLabel,
        totalViews,
        publicationCount,
        chartScroller,
        chartInner,
        chartCanvas,
        publicationList
    ];

    if (requiredElements.some(element => !element)) return;

    let currentChart = null;
    let hasPublishedArticles = false;
    let currentArticleBounds = null;

    form.noValidate = true;

    [fromHourSelect, toHourSelect].forEach(select => {
        for (let hour = 0; hour < 24; hour++) {
            const value = String(hour).padStart(2, "0");
            const option = document.createElement("option");
            option.value = value;
            option.textContent = value;
            select.append(option);
        }
    });

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

        return `${formatAnalyticsDate(date)} ${formatAnalyticsTime(date)}`;
    }

    function normalizeTimestamp(value) {
        const date = new Date(value);

        if (Number.isNaN(date.getTime())) {
            return null;
        }

        return date.getTime();
    }

    function formatLocalDateInput(value) {
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return "";

        const pad = number => String(number).padStart(2, "0");

        return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-` +
            pad(date.getDate());
    }

    function resetHourAvailability(select) {
        Array.from(select.options).forEach(option => {
            option.disabled = false;
        });
    }

    function updateHourAvailability(dateInput, hourSelect) {
        resetHourAvailability(hourSelect);
        if (!currentArticleBounds || !dateInput.value) return;

        const minimumDate = formatLocalDateInput(currentArticleBounds.from);
        const maximumDate = formatLocalDateInput(currentArticleBounds.to);
        const minimumHour = new Date(currentArticleBounds.from).getHours();
        const maximumHour = new Date(currentArticleBounds.to).getHours();

        Array.from(hourSelect.options).forEach(option => {
            if (!option.value) return;

            const hour = Number(option.value);
            option.disabled =
                (dateInput.value === minimumDate && hour < minimumHour) ||
                (dateInput.value === maximumDate && hour > maximumHour);
        });

        const selectedOption = hourSelect.selectedOptions[0];
        if (selectedOption && selectedOption.disabled) {
            hourSelect.value = "";
        }
    }

    function clearBoundary(dateInput, hourSelect) {
        dateInput.value = "";
        hourSelect.value = "";
    }

    function getSelectedBoundary(dateInput, hourSelect, boundaryType) {
        if (!currentArticleBounds) {
            return { date: null, error: null };
        }

        return buildAnalyticsLocalHourBoundary(
            dateInput.value,
            hourSelect.value,
            boundaryType,
            currentArticleBounds
        );
    }

    function clearDateInputBounds() {
        currentArticleBounds = null;
        fromDateInput.removeAttribute("min");
        fromDateInput.removeAttribute("max");
        toDateInput.removeAttribute("min");
        toDateInput.removeAttribute("max");
        resetHourAvailability(fromHourSelect);
        resetHourAvailability(toHourSelect);
    }

    function updateDateInputBounds(bounds) {
        const lowerBound = normalizeTimestamp(bounds && bounds.from);
        const upperBound = normalizeTimestamp(bounds && bounds.to);

        if (
            lowerBound === null ||
            upperBound === null ||
            lowerBound > upperBound
        ) {
            throw createRequestError("Invalid article analytics bounds.");
        }

        currentArticleBounds = {
            from: lowerBound,
            to: upperBound
        };

        const minimumValue = formatLocalDateInput(lowerBound);
        const maximumValue = formatLocalDateInput(upperBound);

        [fromDateInput, toDateInput].forEach(input => {
            input.min = minimumValue;
            input.max = maximumValue;
        });

        updateHourAvailability(fromDateInput, fromHourSelect);
        updateHourAvailability(toDateInput, toHourSelect);

        const fromSelection = getSelectedBoundary(
            fromDateInput,
            fromHourSelect,
            "From"
        );
        const toSelection = getSelectedBoundary(
            toDateInput,
            toHourSelect,
            "To"
        );

        if (
            fromSelection.error ||
            (fromSelection.date && (
                fromSelection.date.getTime() < lowerBound ||
                fromSelection.date.getTime() > upperBound
            ))
        ) {
            clearBoundary(fromDateInput, fromHourSelect);
        }

        if (
            toSelection.error ||
            (toSelection.date && (
                toSelection.date.getTime() < lowerBound ||
                toSelection.date.getTime() > upperBound
            ))
        ) {
            clearBoundary(toDateInput, toHourSelect);
        }
    }

    function refreshCurrentUpperBound() {
        if (!currentArticleBounds) return;

        currentArticleBounds.to = Date.now();
        const maximumValue = formatLocalDateInput(currentArticleBounds.to);
        fromDateInput.max = maximumValue;
        toDateInput.max = maximumValue;
        updateHourAvailability(fromDateInput, fromHourSelect);
        updateHourAvailability(toDateInput, toHourSelect);
    }

    function parseResponseRange(range) {
        const from = normalizeTimestamp(range && range.from);
        const to = normalizeTimestamp(range && range.to);

        if (from === null || to === null || from > to) {
            throw createRequestError("Invalid analytics date range.");
        }

        return { from, to };
    }

    function validateSelectedRange(fromDate, toDate) {
        if (currentArticleBounds) {
            if (fromDate && fromDate.getTime() < currentArticleBounds.from) {
                return "The From date cannot be before the article's first publication.";
            }

            if (toDate && toDate.getTime() < currentArticleBounds.from) {
                return "The To date cannot be before the article's first publication.";
            }

            if (fromDate && fromDate.getTime() > currentArticleBounds.to) {
                return "The From date cannot be in the future.";
            }

            if (toDate && toDate.getTime() > currentArticleBounds.to) {
                return "The To date cannot be in the future.";
            }
        }

        if (fromDate && toDate && fromDate > toDate) {
            return "The From date must not be later than the To date.";
        }

        return null;
    }

    function filterPublicationsByRange(publications, range) {
        return publications.filter(publication => {
            if (!publication || typeof publication !== "object") return false;

            const timestamp = normalizeTimestamp(publication.time);
            if (timestamp === null) return false;
            if (range.from !== null && timestamp < range.from) return false;
            if (range.to !== null && timestamp > range.to) return false;

            return true;
        });
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

    function renderChart(views, publications, range) {
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

        const publicationVersions = new Map();

        publications.forEach(publication => {
            if (!publication || typeof publication !== "object") return;

            const timestamp = normalizeTimestamp(publication.time);
            if (timestamp === null) return;

            const versions = publicationVersions.get(timestamp) || [];
            versions.push(publication.versionNumber);
            publicationVersions.set(timestamp, versions);
        });

        const viewSeries = buildAnalyticsViewSeries(views, range);
        const viewPoints = viewSeries.points;
        const viewDatasetLabel = viewSeries.mode === "four-hour"
            ? "Views per 4 hours"
            : "Hourly views";
        viewTotalLabel.textContent = viewSeries.mode === "four-hour"
            ? "Views in 4-hour groups"
            : "Views in overlapping hourly buckets";
        const publicationEvents = Array.from(publicationVersions.entries())
            .sort((first, second) => first[0] - second[0])
            .map(([timestamp, versions]) => ({
                timestamp,
                label: versions
                    .map(version => `Version ${version}`)
                    .join(", ")
            }));
        const allTimestamps = [
            ...viewPoints.map(point => point.x),
            ...publicationEvents.map(event => event.timestamp)
        ];
        const oneDay = 24 * 60 * 60 * 1000;
        let minimumTime = range.from;
        let maximumTime = range.to;

        if (minimumTime === null && allTimestamps.length > 0) {
            minimumTime = Math.min(...allTimestamps);
        }

        if (maximumTime === null && allTimestamps.length > 0) {
            maximumTime = Math.max(...allTimestamps);
        }

        if (minimumTime === null && maximumTime === null) {
            maximumTime = Date.now();
            minimumTime = maximumTime - oneDay;
        } else if (minimumTime === null) {
            minimumTime = maximumTime - oneDay;
        } else if (maximumTime === null) {
            maximumTime = minimumTime + oneDay;
        } else if (minimumTime === maximumTime) {
            minimumTime -= oneDay / 2;
            maximumTime += oneDay / 2;
        }

        const usesDailyAxisTicks = isAnalyticsMultiDayRange(
            minimumTime,
            maximumTime
        );
        const axisTickValues = buildAnalyticsAxisTicks(
            minimumTime,
            maximumTime
        );
        chartInner.style.minWidth = usesDailyAxisTicks
            ? `${Math.max(
                chartScroller.clientWidth,
                axisTickValues.length * 72
            )}px`
            : "100%";

        const publicationLinesPlugin = {
            id: "publicationLines",
            beforeDatasetsDraw(chart, args, options) {
                const publicationDatasetIndex = chart.data.datasets.findIndex(
                    dataset => dataset.label === "Publication events"
                );

                if (
                    publicationDatasetIndex === -1 ||
                    !chart.isDatasetVisible(publicationDatasetIndex)
                ) {
                    return;
                }

                const xScale = chart.scales.x;
                const { ctx, chartArea } = chart;

                ctx.save();
                ctx.strokeStyle = options.color;
                ctx.lineWidth = 1.25;
                ctx.setLineDash([6, 4]);

                options.events.forEach(event => {
                    const x = xScale.getPixelForValue(event.timestamp);
                    if (x < chartArea.left || x > chartArea.right) return;

                    ctx.beginPath();
                    ctx.moveTo(x, chartArea.top);
                    ctx.lineTo(x, chartArea.bottom);
                    ctx.stroke();
                });

                ctx.restore();
            },
            afterDatasetsDraw(chart, args, options) {
                const publicationDatasetIndex = chart.data.datasets.findIndex(
                    dataset => dataset.label === "Publication events"
                );

                if (
                    publicationDatasetIndex === -1 ||
                    !chart.isDatasetVisible(publicationDatasetIndex)
                ) {
                    return;
                }

                const xScale = chart.scales.x;
                const { ctx, chartArea } = chart;
                const rowRightEdges = [];
                const rowHeight = 22;
                const labelAreaTop = Math.max(2, chartArea.top - 48);
                const maximumRows = 2;

                ctx.save();
                ctx.font = "600 11px sans-serif";
                ctx.textBaseline = "middle";

                options.events.forEach(event => {
                    const lineX = xScale.getPixelForValue(event.timestamp);
                    if (lineX < chartArea.left || lineX > chartArea.right) return;

                    const textWidth = ctx.measureText(event.label).width;
                    const boxWidth = Math.min(textWidth + 12, chartArea.width);
                    const boxX = Math.max(
                        chartArea.left,
                        Math.min(lineX - (boxWidth / 2), chartArea.right - boxWidth)
                    );
                    let row = rowRightEdges.findIndex(
                        rightEdge => boxX > rightEdge + 4
                    );

                    if (row === -1 && rowRightEdges.length < maximumRows) {
                        row = rowRightEdges.length;
                    }

                    if (row === -1) {
                        return;
                    }

                    rowRightEdges[row] = boxX + boxWidth;
                    const boxY = labelAreaTop + (row * rowHeight);

                    ctx.fillStyle = "rgba(255, 255, 255, 0.92)";
                    ctx.fillRect(boxX, boxY, boxWidth, 18);
                    ctx.strokeStyle = options.color;
                    ctx.setLineDash([]);
                    ctx.strokeRect(boxX, boxY, boxWidth, 18);
                    ctx.fillStyle = options.color;
                    ctx.textAlign = "center";
                    ctx.fillText(
                        event.label,
                        boxX + (boxWidth / 2),
                        boxY + 9,
                        Math.max(0, boxWidth - 8)
                    );
                });

                ctx.restore();
            }
        };

        try {
            currentChart = new window.Chart(chartCanvas, {
                type: "line",
                data: {
                    datasets: [
                        {
                            label: viewDatasetLabel,
                            data: viewPoints,
                            borderColor: "#1f4f78",
                            backgroundColor: "rgba(31, 79, 120, 0.12)",
                            borderWidth: 1.5,
                            tension: 0.25,
                            cubicInterpolationMode: "monotone",
                            fill: true,
                            spanGaps: true,
                            pointRadius: 0,
                            pointHoverRadius: 5,
                            pointHitRadius: 8,
                            parsing: false
                        },
                        {
                            label: "Publication events",
                            data: [],
                            borderColor: "rgba(2, 122, 72, 0.72)",
                            backgroundColor: "transparent",
                            borderDash: [6, 4],
                            borderWidth: 1.25,
                            pointRadius: 0
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    layout: {
                        padding: {
                            top: 52
                        }
                    },
                    interaction: {
                        mode: "nearest",
                        intersect: false
                    },
                    scales: {
                        x: {
                            type: "linear",
                            min: minimumTime,
                            max: maximumTime,
                            title: {
                                display: true,
                                text: "Time"
                            },
                            grid: {
                                color: "rgba(31, 79, 120, 0.08)"
                            },
                            afterBuildTicks(axis) {
                                axis.ticks = axisTickValues.map(
                                    value => ({ value })
                                );
                            },
                            ticks: {
                                callback(value) {
                                    return usesDailyAxisTicks
                                        ? formatAnalyticsAxisTick(value)[0]
                                        : formatAnalyticsAxisTick(value);
                                },
                                autoSkip: false,
                                maxRotation: 0,
                                minRotation: 0,
                                font: {
                                    size: usesDailyAxisTicks ? 10 : 12
                                }
                            }
                        },
                        y: {
                            beginAtZero: true,
                            title: {
                                display: true,
                                text: viewDatasetLabel
                            },
                            grid: {
                                color: "rgba(31, 79, 120, 0.08)"
                            },
                            ticks: {
                                precision: 0
                            }
                        }
                    },
                    plugins: {
                        publicationLines: {
                            events: publicationEvents,
                            color: "rgba(2, 122, 72, 0.72)"
                        },
                        tooltip: {
                            filter(context) {
                                return context.dataset.label === viewDatasetLabel;
                            },
                            callbacks: {
                                title(items) {
                                    if (!items.length) return "";

                                    return buildAnalyticsHourlyTooltipTitle(
                                        items[0].raw.periodStart,
                                        items[0].raw.periodEnd
                                    );
                                },
                                label(context) {
                                    return `Views: ${context.parsed.y}`;
                                }
                            }
                        }
                    }
                },
                plugins: [publicationLinesPlugin]
            });
        } catch (error) {
            errorElement.textContent =
                "The analytics chart could not be loaded.";
            errorElement.hidden = false;
        }
    }

    function renderAnalytics(data, range) {
        const views = Array.isArray(data.views) ? data.views : [];
        const publications = Array.isArray(data.publications)
            ? data.publications
            : [];
        const visiblePublications = filterPublicationsByRange(
            publications,
            range
        );
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
        publicationCount.textContent = String(visiblePublications.length);
        errorElement.hidden = true;
        emptyElement.hidden = true;
        resultsElement.hidden = false;

        renderPublications(visiblePublications);
        renderChart(views, visiblePublications, range);
    }

    async function loadAnalytics({ ignoreFilters = false } = {}) {
        const articleId = articleSelect.value;

        if (!articleId) {
            showError("Please select an article.");
            return false;
        }

        refreshCurrentUpperBound();

        const fromSelection = ignoreFilters
            ? { date: null, error: null }
            : getSelectedBoundary(
                fromDateInput,
                fromHourSelect,
                "From"
            );
        const toSelection = ignoreFilters
            ? { date: null, error: null }
            : getSelectedBoundary(
                toDateInput,
                toHourSelect,
                "To"
            );

        if (fromSelection.error || toSelection.error) {
            showError(fromSelection.error || toSelection.error);
            return false;
        }

        const fromDate = fromSelection.date;
        const toDate = toSelection.date;
        const validationMessage = validateSelectedRange(fromDate, toDate);

        if (validationMessage) {
            showError(validationMessage);
            return false;
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

            updateDateInputBounds(result.data.bounds);
            const effectiveRange = parseResponseRange(result.data.range);
            renderAnalytics(result.data, effectiveRange);
            return true;
        } catch (error) {
            const message = error && error.isRequestError
                ? error.message
                : "Failed to load analytics.";
            showError(message);
            return false;
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

    articleSelect.addEventListener("change", async () => {
        if (!articleSelect.value) {
            clearDateInputBounds();
            clearBoundary(fromDateInput, fromHourSelect);
            clearBoundary(toDateInput, toHourSelect);
            errorElement.hidden = true;
            resultsElement.hidden = true;
            emptyElement.hidden = false;
            return;
        }

        clearDateInputBounds();
        const loaded = await loadAnalytics({ ignoreFilters: true });

        if (loaded && (
            fromDateInput.value ||
            fromHourSelect.value ||
            toDateInput.value ||
            toHourSelect.value
        )) {
            await loadAnalytics();
        }
    });

    fromDateInput.addEventListener("change", () => {
        updateHourAvailability(fromDateInput, fromHourSelect);
    });

    toDateInput.addEventListener("change", () => {
        updateHourAvailability(toDateInput, toHourSelect);
    });

    loadArticles();
});
}
