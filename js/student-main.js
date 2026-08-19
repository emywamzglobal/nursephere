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

    checkDocumentsAccess();

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

    studentAvatarUpload();

    studentLogout();

    initializeSidebarToggle();

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
                "active"
            );

        }
    );


    document.addEventListener(
        "click",
        function () {

            menu.classList.remove(
                "active"
            );

        }
    );

}


/*=========================================
        PROFILE PHOTO
=========================================*/

function studentAvatarUpload() {

    const uploadButton =
        document.getElementById(
            "uploadPhoto"
        );

    const uploadInput =
        document.getElementById(
            "avatarUpload"
        );

    const avatar =
        document.getElementById(
            "studentAvatar"
        );

    if (
        !uploadButton ||
        !uploadInput ||
        !avatar
    ) {

        return;

    }


    uploadButton.addEventListener(
        "click",
        function (e) {

            e.preventDefault();

            uploadInput.click();

        }
    );


    avatar.addEventListener(
        "click",
        function () {

            uploadInput.click();

        }
    );


    uploadInput.addEventListener(
        "change",
        function () {

            const file =
                this.files[0];

            if (!file) {

                return;

            }


            const reader =
                new FileReader();


            reader.onload =
                function (event) {

                    avatar.src =
                        event.target.result;

                };


            reader.readAsDataURL(
                file
            );

        }
    );

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
        DOCUMENTS ACCESS
=========================================*/

async function checkDocumentsAccess() {

    const documentsLink =
        document.querySelector(
            '.sidebar-menu a[href="documents.html"]'
        );


    if (!documentsLink) {

        return;

    }


    /*-----------------------------------------
            NO JWT
    -----------------------------------------*/

    if (!studentToken) {

        lockDocumentsMenu(
            documentsLink
        );

        return;

    }


    try {

        const response =
            await fetch(

                `${STUDENT_API_BASE}/documents`,

                {

                    method: "GET",

                    headers: {

                        "Authorization":
                            `Bearer ${studentToken}`,

                        "Content-Type":
                            "application/json"

                    }

                }

            );


        /*-----------------------------------------
                UNAUTHORIZED
        -----------------------------------------*/

        if (
            response.status === 401
        ) {

            lockDocumentsMenu(
                documentsLink
            );

            return;

        }


        /*-----------------------------------------
                NON-ANNUAL
        -----------------------------------------*/

        if (
            response.status === 403
        ) {

            lockDocumentsMenu(
                documentsLink
            );

            return;

        }


        /*-----------------------------------------
                OTHER API ERROR
        -----------------------------------------*/

        if (
            !response.ok
        ) {

            /*
                Do not unlock Documents when
                the access check fails.
            */

            lockDocumentsMenu(
                documentsLink
            );

            return;

        }


        /*-----------------------------------------
                ACCESS GRANTED
        -----------------------------------------*/

        const result =
            await response.json();


        if (
            result &&
            result.success === true &&
            result.access === true
        ) {

            unlockDocumentsMenu(
                documentsLink
            );

            return;

        }


        /*
            Fail closed.
            If the Worker does not explicitly
            grant access, keep Documents locked.
        */

        lockDocumentsMenu(
            documentsLink
        );

    }


    catch (error) {

        console.error(
            "Documents Access Check Error:",
            error
        );


        /*
            Fail closed.
            Network/API failure must never
            accidentally unlock a paid feature.
        */

        lockDocumentsMenu(
            documentsLink
        );

    }

}


/*=========================================
        LOCK DOCUMENTS MENU
=========================================*/

function lockDocumentsMenu(
    documentsLink
) {

    if (!documentsLink) {

        return;

    }


    documentsLink.classList.add(
        "documents-locked"
    );


    documentsLink.dataset.locked =
        "true";


    /*
        Replace icon
    */

    const icon =
        documentsLink.querySelector(
            "i"
        );


    if (icon) {

        icon.className =
            "fas fa-lock";

    }


    /*
        Replace label
    */

    const label =
        documentsLink.querySelector(
            "span"
        );


    if (label) {

        label.textContent =
            "Documents";

    }


    /*
        Do NOT navigate directly
        to documents.html.
    */

    documentsLink.addEventListener(
        "click",
        handleLockedDocumentsClick
    );

}


/*=========================================
        UNLOCK DOCUMENTS MENU
=========================================*/

function unlockDocumentsMenu(
    documentsLink
) {

    if (!documentsLink) {

        return;

    }


    documentsLink.classList.remove(
        "documents-locked"
    );


    documentsLink.dataset.locked =
        "false";


    const icon =
        documentsLink.querySelector(
            "i"
        );


    if (icon) {

        icon.className =
            "fas fa-folder-open";

    }


    const label =
        documentsLink.querySelector(
            "span"
        );


    if (label) {

        label.textContent =
            "Documents";

    }


    /*
        Remove the locked handler
        without affecting normal navigation.
    */

    documentsLink.removeEventListener(
        "click",
        handleLockedDocumentsClick
    );

}


/*=========================================
        LOCKED DOCUMENTS CLICK
=========================================*/

function handleLockedDocumentsClick(
    event
) {

    /*
        Locked Documents should still open
        the Documents page.

        The Documents page itself will show
        the Annual Plan upgrade requirement.

        Checkout is ONLY opened when the
        student explicitly clicks:
        "Upgrade to Annual Plan".
    */

    event.stopPropagation();

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