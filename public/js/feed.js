const articlesGrid = document.querySelector(".articles-grid");
const sentinel = document.querySelector("#feed-sentinel");
const searchForm = document.querySelector("#search-form");
const sortSelect = document.querySelector("#sort-filter");
const sortForm = document.querySelector("#sort-form");
const categoryInput = document.querySelector("#category-input");
const categoryLinks = document.querySelectorAll(".main-nav a[data-category]");

let currentPage = 1;
let isLoading = false;
let hasMore = true;

function getFilters() {
    const params = new URLSearchParams();
    if (searchForm) {
        const searchData = new FormData(searchForm);
        for (const [key, value] of searchData) {
            params.set(key, value);
        }

    }

    if (sortForm) {
        const sortData = new FormData(sortForm);
        for (const [key, value] of sortData) {
            params.set(key, value);
        }

    }

    return params;
}

function buildApiUrl(page) {
    const params = getFilters();
    params.set("page", page);
    return `/api/articles?${params.toString()}`;
}

function clearArticles() {
    articlesGrid.innerHTML = "";
}

function resetPagination() {
    currentPage = 1;
    hasMore = true;
}

function renderEmptyState(title, message) {
    articlesGrid.innerHTML = `
        <div class="empty-state">
            <h3>${title}</h3>
            <p>${message}</p>
        </div>
    `;

}

function createArticleCard(article) {
    const articleCard = document.createElement("article");
    articleCard.className = "article-card";
    articleCard.innerHTML = `
        <img
            src="/images/${article.publishedVersion.mainImage}"
            alt="${article.publishedVersion.title}">

        <div class="article-card-content">

            <span class="category">
                ${article.publishedVersion.category}
            </span>

            <h3>
                ${article.publishedVersion.title}
            </h3>

            <p>
                ${article.publishedVersion.summary}
            </p>

            <a href="/articles/${article._id}">
                Read More →
            </a>

        </div>
    `;
    return articleCard;

}

function appendArticles(articles) {
    articles.forEach(article => {
        articlesGrid.appendChild(createArticleCard(article));
    });

}

function renderArticles(articles) {
    clearArticles();
    if (articles.length === 0) {
        renderEmptyState(
            "No results found",
            "Try searching for something else."
        );
        return;
    }
    appendArticles(articles);

}

async function loadArticles(page) {
    try {
        const response = await fetch(buildApiUrl(page));
        if (!response.ok) {
            throw new Error("Failed to fetch articles");
        }

        const result = await response.json();
        hasMore = result.data.pagination.hasMore;
        return result.data.items;

    } catch (error) {
        console.error("Failed to fetch articles:", error);
        return [];
    }

}

// Reload the first page after changing search, sort or category.
async function reloadFeed() {
    if (isLoading) {
        return;
    }

    isLoading = true;

    try {
        resetPagination();
        const articles = await loadArticles(currentPage);
        renderArticles(articles);


    } finally {
        isLoading = false;
    }

}

async function fetchArticles() {
    if (isLoading || !hasMore) {
        return;
    }

    isLoading = true;

    try {
        const nextPage = currentPage + 1;
        const articles = await loadArticles(nextPage);
        appendArticles(articles);
        currentPage = nextPage;

    } finally {
        isLoading = false;
    }

}

function initSearch() {
    if (!searchForm) {
        return;
    }

    searchForm.addEventListener("submit", async event => {
        event.preventDefault();
        await reloadFeed();
    });

}

function initSort() {
    if (!sortSelect) {
        return;
    }
    sortSelect.addEventListener("change", async event => {
        event.preventDefault();
        await reloadFeed();
    });

}

function initInfiniteScroll() {
    if (!articlesGrid || !sentinel) {
        return;
    }

    const observer = new IntersectionObserver(
        entries => {
            const entry = entries[0];
            if (!hasMore) {
                return;
            }

            if (entry.isIntersecting && !isLoading) {
                fetchArticles();
            }
        },

        {
            rootMargin: "300px"
        }

    );
    observer.observe(sentinel);
}

function initCategory() {

    if (!categoryInput || categoryLinks.length === 0) {
        return;
    }

    categoryLinks.forEach(link => {
        link.addEventListener("click", async event => {
            event.preventDefault();
            const category = link.dataset.category ?? "";
            if (categoryInput.value === category) {
                return;
            }

            categoryInput.value = category;
            await reloadFeed();
            categoryLinks.forEach(item =>
                item.classList.remove("active")
            );

            link.classList.add("active");
        });
    });
}


function init() {

    initSearch();
    initSort();
    initCategory();
    initInfiniteScroll();
}

init();