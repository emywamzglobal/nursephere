/*=========================================
        Nursephere STUDENT PORTAL
        MAIN JAVASCRIPT
=========================================*/

"use strict";


/*=========================================
        API CONFIGURATION
=========================================*/

const STUDENT_API_BASE =
    "https://nursephere.wamalwaemily.workers.dev/api";


/*=========================================
        STUDENT SESSION
=========================================*/

const studentToken =
    localStorage.getItem("studentToken");


/*=========================================
        PAGE INITIALISATION
=========================================*/

document.addEventListener("DOMContentLoaded", () => {

    highlightStudentMenu();

    initialiseStudentHeader();

    initializeSidebarToggle();

});


/*=========================================
        ACTIVE SIDEBAR MENU
=========================================*/

function highlightStudentMenu() {

    const currentPage =
        window.location.pathname
            .split("/")
            .pop();

    document
        .querySelectorAll(".sidebar-menu a")
        .forEach(link => {

            link.classList.remove("active");

            const href =
                link.getAttribute("href");

            if (
                href === currentPage
            ) {

                link.classList.add("active");

            }

        });

}


/*=========================================
        INITIALISE HEADER
=========================================*/

function initialiseStudentHeader() {

    studentProfileDropdown();

    loadStudentHeaderAvatar();

    studentLogout();

}

/*=========================================
        PROFILE DROPDOWN
=========================================*/

function studentProfileDropdown() {

    const toggle =
        document.getElementById(
            "profileToggle"
        );

    const menu =
        document.getElementById(
            "profileMenu"
        );

    if (
        !toggle ||
        !menu
    ) {
        return;
    }

    toggle.addEventListener(
        "click",
        function (e) {

            e.stopPropagation();

            menu.classList.toggle(
                "show"
            );

        }
    );

    document.addEventListener(
        "click",
        function () {

            menu.classList.remove(
                "show"
            );

        }
    );

}

/*=========================================
        STUDENT HEADER AVATAR
=========================================*/

async function loadStudentHeaderAvatar() {

    const avatar =
        document.getElementById(
            "studentAvatar"
        );

    if (!avatar) {
        return;
    }

    const token =
        localStorage.getItem(
            "studentToken"
        );

    if (!token) {
        return;
    }

    try {

        const response =
            await fetch(
                `${STUDENT_API_BASE}/profile`,
                {
                    method: "GET",

                    headers: {
                        "Authorization":
                            `Bearer ${token}`
                    }
                }
            );

        if (!response.ok) {
            return;
        }

        const data =
            await response.json();

        const profile =
            data.profile ||
            data.student ||
            data;

        if (
            profile &&
            profile.avatar_url
        ) {

            avatar.src =
                profile.avatar_url;

        }

    }

    catch (error) {

        console.error(
            "Unable to load student avatar:",
            error
        );

    }

}

/*=========================================
        LOGOUT
=========================================*/

function studentLogout() {

    const logoutButtons =
        document.querySelectorAll(
            "#logoutBtn, #sidebarLogoutBtn, #profileLogoutBtn"
        );

    if (
        !logoutButtons.length
    ) {

        return;

    }


    logoutButtons.forEach(
        logoutButton => {

            logoutButton.addEventListener(
                "click",
                function (e) {

                    const confirmLogout =
                        confirm(
                            "Are you sure you want to logout?"
                        );


                    if (
                        !confirmLogout
                    ) {

                        e.preventDefault();

                    }

                }
            );

        }
    );

}


/*=========================================
        SIDEBAR COLLAPSE / EXPAND
=========================================*/

function initializeSidebarToggle() {

    const sidebar =
        document.getElementById(
            "studentSidebar"
        );

    const content =
        document.querySelector(
            ".dashboard-content"
        );

    const toggle =
        document.getElementById(
            "menuToggle"
        );


    if (
        !sidebar ||
        !toggle
    ) {

        return;

    }


    /*-----------------------------------------
            RESTORE PREVIOUS STATE
    -----------------------------------------*/

    if (
        localStorage.getItem(
            "sidebar"
        ) === "collapsed"
    ) {

        sidebar.classList.add(
            "collapsed"
        );


        if (content) {

            content.classList.add(
                "expanded"
            );

        }

    }


    /*-----------------------------------------
            TOGGLE
    -----------------------------------------*/

    toggle.addEventListener(
        "click",
        () => {

            sidebar.classList.toggle(
                "collapsed"
            );


            if (content) {

                content.classList.toggle(
                    "expanded"
                );

            }


            if (
                sidebar.classList.contains(
                    "collapsed"
                )
            ) {

                localStorage.setItem(
                    "sidebar",
                    "collapsed"
                );

            } else {

                localStorage.setItem(
                    "sidebar",
                    "expanded"
                );

            }

        }
    );

}