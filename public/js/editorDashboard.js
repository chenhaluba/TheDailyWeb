const filterButtons =
    document.querySelectorAll(".filter-button");

const articleCards =
    document.querySelectorAll(".article-card");

const visibleCount =
    document.getElementById("visible-count");


filterButtons.forEach(button => {

    button.addEventListener("click", () => {

        const selectedStatus =
            button.dataset.status;

        filterButtons.forEach(currentButton => {
            currentButton.classList.remove("active");
        });

        button.classList.add("active");

        let count = 0;

        articleCards.forEach(card => {

            const shouldShow =
                !selectedStatus ||
                card.dataset.status === selectedStatus;

            card.style.display =
                shouldShow ? "" : "none";

            if (shouldShow) {
                count++;
            }
        });

        visibleCount.textContent = count;
    });
});