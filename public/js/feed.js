const articlesGrid = document.querySelector(".articles-grid");
const sentinel = document.querySelector("#feed-sentinel");

let currentPage = 1;
let isLoading = false;
let hasMore = true;

function buildApiUrl(page) {
    const params = new URLSearchParams(window.location.search);
    params.set("page", page);
    return `/api/articles?${params.toString()}`;
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
        const articleCard = createArticleCard(article);
        articlesGrid.appendChild(articleCard);
    });

}

async function fetchArticles() {
    if (isLoading || !hasMore) {
        return;
    }
    
    isLoading = true;
    const nextPage = currentPage + 1;
    
    try {
        const response = await fetch(buildApiUrl(nextPage));
        if (!response.ok) {
            throw new Error("Failed to fetch articles");
        }
        const result = await response.json();
        currentPage = nextPage;
        hasMore = result.data.pagination.hasMore;
        appendArticles(result.data.items);
    
    } catch (error) {
        console.error("Failed to fetch articles:", error);
    
    } finally {
        isLoading = false;
    }
}

function initInfiniteScroll() {

    if (!articlesGrid || !sentinel) {
        return;
    }

    const observer = new IntersectionObserver(
        entries => {
            const entry = entries[0];
            if (!hasMore) {
                observer.disconnect();
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

initInfiniteScroll();