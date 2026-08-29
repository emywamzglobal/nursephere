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

        /*=====================================
            GET STUDENT PROFILE
        =====================================*/

        const profileResponse =
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

        if (!profileResponse.ok) {
            return;
        }

        const data =
            await profileResponse.json();

        const profile =
            data.profile;

        if (!profile) {
            return;
        }


        /*=====================================
            STUDENT ID
        =====================================*/

        const studentId =
            profile.student_id;

        if (!studentId) {

            console.error(
                "Student ID unavailable for avatar."
            );

            return;

        }


        /*=====================================
            FETCH PRIVATE AVATAR FROM R2
        =====================================*/

        const avatarResponse =
            await fetch(
                `${STUDENT_API_BASE}/avatar/${encodeURIComponent(studentId)}`,
                {
                    method: "GET",

                    headers: {
                        "Authorization":
                            `Bearer ${token}`
                    }
                }
            );

        if (!avatarResponse.ok) {

            console.error(
                "Unable to load student avatar:",
                avatarResponse.status
            );

            return;

        }


        /*=====================================
            CONVERT IMAGE TO BLOB
        =====================================*/

        const imageBlob =
            await avatarResponse.blob();

        const imageUrl =
            URL.createObjectURL(
                imageBlob
            );


        /*=====================================
            DISPLAY AVATAR
        =====================================*/

        avatar.src =
            imageUrl;

        avatar.onload =
            function () {

                URL.revokeObjectURL(
                    imageUrl
                );

            };

    }

    catch (error) {

        console.error(
            "Unable to load student avatar:",
            error
        );

    }

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