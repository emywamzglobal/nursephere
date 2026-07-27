/*=========================================
    NURSEPHERE NAVBAR & FAQ
=========================================*/

document.addEventListener("DOMContentLoaded", () => {

    /*=========================
            NAVBAR
    =========================*/

    const dropdownBtn = document.querySelector(".dropdown-btn");
    const dropdownMenu = document.querySelector(".dropdown-menu");
    const arrow = document.querySelector(".arrow");

    if (dropdownBtn && dropdownMenu && arrow) {

        dropdownBtn.addEventListener("click", (e) => {

            e.stopPropagation();

            dropdownMenu.classList.toggle("show");
            arrow.classList.toggle("rotate");

        });

        document.addEventListener("click", () => {

            dropdownMenu.classList.remove("show");
            arrow.classList.remove("rotate");

        });

        dropdownMenu.addEventListener("click", (e) => {

            e.stopPropagation();

        });

    }


    /*=========================
                FAQ
    =========================*/

    const faqButtons = document.querySelectorAll(".faq-question");

    if (faqButtons.length) {

        faqButtons.forEach(button => {

            button.addEventListener("click", () => {

                const answer = button.nextElementSibling;

                button.classList.toggle("active");

                if (answer.style.maxHeight) {

                    answer.style.maxHeight = null;

                    button.querySelector("span").textContent = "+";

                } else {

                    answer.style.maxHeight =
                        answer.scrollHeight + "px";

                    button.querySelector("span").textContent = "−";

                }

            });

        });

    }

});