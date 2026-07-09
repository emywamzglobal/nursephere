/*=========================================
        Nursephere STUDENT PORTAL
        MAIN JAVASCRIPT
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

    const currentPage = window.location.pathname.split("/").pop();

    document.querySelectorAll(".sidebar-menu a").forEach(link => {

        link.classList.remove("active");

        const href = link.getAttribute("href");

        if (href === currentPage) {

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

    studentSidebarToggle();

}


/*=========================================
        PROFILE DROPDOWN
=========================================*/

function studentProfileDropdown() {

    const toggle = document.getElementById("profileToggle");

    const menu = document.getElementById("profileMenu");

    if (!toggle || !menu) return;

    toggle.addEventListener("click", function (e) {

        e.stopPropagation();

        menu.classList.toggle("active");

    });

    document.addEventListener("click", function () {

        menu.classList.remove("active");

    });

}


/*=========================================
        PROFILE PHOTO
=========================================*/

function studentAvatarUpload() {

    const uploadButton = document.getElementById("uploadPhoto");

    const uploadInput = document.getElementById("avatarUpload");

    const avatar = document.getElementById("studentAvatar");

    if (!uploadButton || !uploadInput || !avatar) return;

    uploadButton.addEventListener("click", function (e) {

        e.preventDefault();

        uploadInput.click();

    });

    avatar.addEventListener("click", function () {

        uploadInput.click();

    });

    uploadInput.addEventListener("change", function () {

        const file = this.files[0];

        if (!file) return;

        const reader = new FileReader();

        reader.onload = function (event) {

            avatar.src = event.target.result;

        };

        reader.readAsDataURL(file);

    });

}


/*=========================================
        ACTIVE SIDEBAR MENU
=========================================*/

function highlightStudentMenu() {

    const currentPage = window.location.pathname.split("/").pop();

    const links = document.querySelectorAll(".sidebar-menu a");

    links.forEach(link => {

        link.classList.remove("active");

        const href = link.getAttribute("href");

        if (href === currentPage) {

            link.classList.add("active");

        }

    });

}


/*=========================================
        LOGOUT
=========================================*/

function studentLogout() {

    const logoutButton = document.getElementById("logoutBtn");

    if (!logoutButton) return;

    logoutButton.addEventListener("click", function (e) {

        const confirmLogout = confirm("Are you sure you want to logout?");

        if (!confirmLogout) {

            e.preventDefault();

        }

    });

}

/* ==========================================
   SIDEBAR COLLAPSE / EXPAND
========================================== */

function initializeSidebarToggle() {

    const sidebar = document.getElementById("studentSidebar");
    const content = document.querySelector(".dashboard-content");
    const toggle = document.getElementById("menuToggle");

    if (!sidebar || !toggle) return;

    // Restore previous state
    if (localStorage.getItem("sidebar") === "collapsed") {

        sidebar.classList.add("collapsed");

        if (content) {
            content.classList.add("expanded");
        }

    }

    toggle.addEventListener("click", () => {

        sidebar.classList.toggle("collapsed");

        if (content) {
            content.classList.toggle("expanded");
        }

        if (sidebar.classList.contains("collapsed")) {

            localStorage.setItem("sidebar", "collapsed");

        } else {

            localStorage.setItem("sidebar", "expanded");

        }

    });

}