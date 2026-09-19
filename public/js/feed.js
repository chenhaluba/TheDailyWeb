const articlesGrid = document.querySelector(".articles-grid");
const sentinel = document.querySelector("#feed-sentinel");
const searchForm = document.querySelector("#search-form");
const searchInput = document.querySelector("#search-input");
const sortSelect = document.querySelector("#sort-filter");
const categoryInput = document.querySelector("#category-input");
const categoryLinks = document.querySelectorAll(".main-nav a[data-category]");
const articlesTitle = document.querySelector("#articles-title");
const resultsCount = document.querySelector("#results-count");
const mainArticleSection = document.querySelector("#main-article-section");

let currentPage = 1;
let isLoading = false;
let reloadAfterLoading = false;
let activeFilters = getFilters();
let hasMore = sentinel?.dataset.hasMore !== "false";

function escapeHtml(value = "") {
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function getFilters() {
    const params = new URLSearchParams();
    const search = searchInput?.value.trim();
    const category = categoryInput?.value.trim();
    const sort = sortSelect?.value;

    if (search) {
        params.set("search", search);
    }
    if (category) {
        params.set("category", category);
    }
    if (sort) {
        params.set("sort", sort);
    }

    return params;
}

function buildApiUrl(page, filters) {
    const params = new URLSearchParams(filters);
    params.set("page", page);
    return `/api/articles?${params.toString()}`;
}

async function loadArticles(page, filters) {
    try {
        const response = await fetch(buildApiUrl(page, filters));
        if (!response.ok) {
            throw new Error("Failed to load articles");
        }

        const result = await response.json();
        if (!result.data || !Array.isArray(result.data.items)) {
            throw new Error("Invalid server response");
        }

        hasMore = result.data.pagination.hasMore;
        return result.data.items;
    } catch (error) {
        console.error("Failed to load articles:", error);
        return null;
    }
}

function createArticleCard(article) {
    if (!article || !article._id || !article.publishedVersion) {
        return null;
    }

    const publishedVersion = article.publishedVersion;
    const authorName = article.author?.displayName || "Unknown Author";
    const publicationDate = publishedVersion.savedAt
        ? new Date(publishedVersion.savedAt).toLocaleDateString("en-US")
        : "";

    const articleCard = document.createElement("article");
    articleCard.className = "article-card";
    articleCard.innerHTML = `
        <img
            src="/images/${escapeHtml(publishedVersion.mainImage)}"
            alt="${escapeHtml(publishedVersion.title)}">
        <div class="article-card-content">
            <span class="category">${escapeHtml(publishedVersion.category)}</span>
            <h3>${escapeHtml(publishedVersion.title)}</h3>
            <div class="article-card-meta">
                <span>By ${escapeHtml(authorName)}</span>
                <span>${escapeHtml(publicationDate)}</span>
            </div>
            <p>${escapeHtml(publishedVersion.summary)}</p>
            <a href="/articles/${encodeURIComponent(article._id)}">Read More →</a>
        </div>
    `;

    return articleCard;
}

function appendArticles(articles) {
    for (const article of articles) {
        const articleCard = createArticleCard(article);
        if (articleCard) {
            articlesGrid.appendChild(articleCard);
        }
    }
}

function renderEmptyState(title, message) {
    articlesGrid.innerHTML = `
        <div class="empty-state">
            <h3>${escapeHtml(title)}</h3>
            <p>${escapeHtml(message)}</p>
        </div>
    `;
}

function renderArticles(articles) {
    articlesGrid.innerHTML = "";

    if (articles.length === 0) {
        const search = activeFilters.get("search") || "";

        if (search) {
            renderEmptyState(
                "No results found",
                `We couldn't find any articles matching "${search}".`
            );
        } else {
            renderEmptyState(
                "No articles available",
                "There are currently no articles available."
            );
        }
        return;
    }

    appendArticles(articles);
}

function updateHeader() {
    if (!articlesTitle || !resultsCount) {
        return;
    }

    const displayedCount = articlesGrid.querySelectorAll(".article-card").length;
    const search = activeFilters.get("search") || "";
    const category = activeFilters.get("category") || "";

    if (search) {
        articlesTitle.textContent = "Search Results";
        resultsCount.innerHTML = `
            Showing <strong>${displayedCount}</strong>
            article(s) matching "${escapeHtml(search)}"
        `;
        return;
    }

    if (category) {
        articlesTitle.textContent = `${category} News`;
        resultsCount.innerHTML = `
            Showing <strong>${displayedCount}</strong> article(s)
        `;
        return;
    }

    articlesTitle.textContent = "Latest News";
    resultsCount.innerHTML = "";
}

function finishLoading() {
    isLoading = false;

    if (reloadAfterLoading) {
        reloadAfterLoading = false;
        reloadFeed();
    }
}

async function reloadFeed() {
    if (!articlesGrid) {
        return;
    }
    if (isLoading) {
        reloadAfterLoading = true;
        return;
    }

    isLoading = true;

    try {
        const filters = getFilters();
        const articles = await loadArticles(1, filters);

        if (reloadAfterLoading) {
            return;
        }
        if (articles === null) {
            hasMore = false;
        
            if (articlesTitle) {
                articlesTitle.textContent = "Unable to load articles";
            }
            if (resultsCount) {
                resultsCount.textContent = "";
            }
            if (sentinel) {
                sentinel.textContent = "";
            }
        
            renderEmptyState("Unable to load articles", "Please try again.");
            return;
        }

        activeFilters = filters;
        currentPage = 1;
        sentinel.textContent = "";
        renderArticles(articles);
        updateHeader();

        if (mainArticleSection) {
            mainArticleSection.hidden = true;
        }
    } finally {
        finishLoading();
    }
}

async function loadNextPage() {
    if (isLoading || !hasMore || !articlesGrid) {
        return;
    }

    isLoading = true;

    try {
        const nextPage = currentPage + 1;
        const articles = await loadArticles(nextPage, activeFilters);

        if (reloadAfterLoading) {
            return;
        }
        if (articles === null) {
            sentinel.textContent = "Unable to load more articles.";
            return;
        }

        sentinel.textContent = "";
        appendArticles(articles);
        updateHeader();
        currentPage = nextPage;
    } finally {
        finishLoading();
    }
}

function initSearch() {
    if (!searchForm) {
        return;
    }

    searchForm.addEventListener("submit", event => {
        event.preventDefault();
        reloadFeed();
    });
}

function initSort() {
    if (!sortSelect) {
        return;
    }

    sortSelect.addEventListener("change", () => {
        reloadFeed();
    });
}

function updateActiveCategory(selectedLink) {
    for (const link of categoryLinks) {
        link.classList.toggle("active", link === selectedLink);
    }
}

function initCategories() {
    if (!categoryInput) {
        return;
    }

    for (const link of categoryLinks) {
        link.addEventListener("click", event => {
            event.preventDefault();
            const category = link.dataset.category || "";

            if (!category) {
                categoryInput.value = "";
                if (searchInput) {
                    searchInput.value = "";
                }
                if (sortSelect) {
                    sortSelect.value = "newest";
                }
            } else {
                categoryInput.value = category;
            }

            updateActiveCategory(link);
            reloadFeed();
        });
    }
}

function initInfiniteScroll() {
    if (!articlesGrid || !sentinel) {
        return;
    }

    const observer = new IntersectionObserver(
        entries => {
            const entry = entries[0];
            if (entry.isIntersecting && hasMore) {
                loadNextPage();
            }
        },
        { rootMargin: "300px" }
    );

    observer.observe(sentinel);
}

function init() {
    initSearch();
    initSort();
    initCategories();
    initInfiniteScroll();
}

init();