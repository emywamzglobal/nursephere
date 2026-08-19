/*
=========================================================
    NurseSphere Student Dashboard Controller
    File: js/dashboard-student.js

    Responsibilities:
    - Student authentication/session
    - Dashboard API loading
    - Dashboard data rendering
    - Trial status rendering
    - Recent activity rendering
    - Mobile sidebar toggle
    - Profile dropdown
    - Avatar preview
    - Avatar persistence in browser
    - Header search/navigation
    - Logout

    Notifications are intentionally NOT handled here.
=========================================================
*/

"use strict";

(() => {

    /*=========================================================
        API CONFIGURATION
    =========================================================*/

    const API_BASE =
        "https://nursephere.wamalwaemily.workers.dev/api";


    /*=========================================================
        STUDENT SESSION
    =========================================================*/

    const studentToken =
        localStorage.getItem("studentToken");


    /*=========================================================
        DASHBOARD DATA
    =========================================================*/

    let dashboardData = null;


    /*=========================================================
        DOM ELEMENTS
    =========================================================*/

    // Layout
    const studentSidebar =
        document.getElementById("studentSidebar");

    const menuToggle =
        document.getElementById("menuToggle");


    // Search
    const searchInput =
        document.getElementById("searchInput");


    // Profile
    const profileToggle =
        document.getElementById("profileToggle");

    const profileMenu =
        document.getElementById("profileMenu");


    // Avatar
    const studentAvatar =
        document.getElementById("studentAvatar");

    const avatarUpload =
        document.getElementById("avatarUpload");

    const uploadPhoto =
        document.getElementById("uploadPhoto");


    // Student information
    const welcomeStudentName =
        document.getElementById("welcomeStudentName");

    const headerStudentName =
        document.getElementById("headerStudentName");

    const studentPlan =
        document.getElementById("studentPlan");


    // Trial
    const daysLeft =
        document.getElementById("daysLeft");

    const questionsLeft =
        document.getElementById("questionsLeft");

    const trialCard =
        document.getElementById("trialCard");

    const trialExpiredCard =
        document.getElementById("trialExpiredCard");


    // Progress
    const subjectsStarted =
        document.getElementById("subjectsStarted");

    const questionsAnswered =
        document.getElementById("questionsAnswered");

    const successRate =
        document.getElementById("successRate");


    // Activity
    const recentActivity =
        document.getElementById("recentActivity");


    // Logout
    const sidebarLogoutBtn =
        document.getElementById("sidebarLogoutBtn");

    const profileLogoutBtn =
        document.getElementById("profileLogoutBtn");


    /*=========================================================
        CONSTANTS
    =========================================================*/

    const AVATAR_STORAGE_KEY =
        "studentAvatar";


    const DEFAULT_AVATAR =
        "../assets/images/avatar-placeholder.png";


    /*=========================================================
        SESSION MANAGEMENT
    =========================================================*/

    function clearStudentSession() {

        localStorage.removeItem("studentToken");
        localStorage.removeItem("studentId");
        localStorage.removeItem("studentName");
        localStorage.removeItem("studentEmail");
        localStorage.removeItem("subscriptionStatus");
        localStorage.removeItem("trialActive");
        localStorage.removeItem(AVATAR_STORAGE_KEY);

    }


    function redirectToLogin() {

        clearStudentSession();

        window.location.href =
            "../login.html";

    }


    function requireAuthentication() {

        if (!studentToken) {

            redirectToLogin();

            return false;
        }

        return true;

    }


    /*=========================================================
        LOGOUT
    =========================================================*/

    function logoutStudent(event) {

        if (event) {
            event.preventDefault();
        }

        clearStudentSession();

        window.location.href =
            "../index.html";

    }


    /*=========================================================
        MOBILE SIDEBAR
    =========================================================*/

    function setupSidebar() {

        if (!menuToggle || !studentSidebar) {
            return;
        }

        menuToggle.addEventListener(
            "click",
            () => {

                studentSidebar.classList.toggle(
                    "active"
                );

            }
        );

    }


    /*=========================================================
        PROFILE DROPDOWN
    =========================================================*/

    function closeProfileMenu() {

        if (!profileMenu) {
            return;
        }

        profileMenu.classList.remove("active");

    }


    function setupProfileDropdown() {

        if (!profileToggle || !profileMenu) {
            return;
        }

        profileToggle.addEventListener(
            "click",
            event => {

                event.stopPropagation();

                profileMenu.classList.toggle(
                    "active"
                );

            }
        );


        document.addEventListener(
            "click",
            event => {

                if (
                    !profileMenu.contains(event.target) &&
                    !profileToggle.contains(event.target)
                ) {

                    closeProfileMenu();

                }

            }
        );


        profileMenu.addEventListener(
            "click",
            event => {

                event.stopPropagation();

            }
        );

    }


   /*=========================================================
    AVATAR
=========================================================*/

function renderServerAvatar() {

    if (
        !studentAvatar ||
        !dashboardData ||
        !dashboardData.student
    ) {
        return;
    }


    const avatarUrl =
        dashboardData.student.avatar_url;


    if (
        typeof avatarUrl === "string" &&
        avatarUrl.trim() !== ""
    ) {

        /*
            avatar_url returned by the Worker is:

            /api/avatar/{studentId}

            API_BASE is:

            https://nursephere.wamalwaemily.workers.dev/api
        */

        const avatarEndpoint =
            avatarUrl.startsWith("http")
                ? avatarUrl
                : `${API_BASE.replace(
                    "/api",
                    ""
                )}${avatarUrl}`;

        studentAvatar.src =
            avatarEndpoint;

        return;

    }


    studentAvatar.src =
        DEFAULT_AVATAR;

}


/*=========================================================
    AVATAR UPLOAD
=========================================================*/

function setupAvatarUpload() {

    if (
        !uploadPhoto ||
        !avatarUpload
    ) {
        return;
    }


    uploadPhoto.addEventListener(
        "click",
        event => {

            event.preventDefault();

            avatarUpload.click();

        }
    );


    avatarUpload.addEventListener(
        "change",
        async () => {

            const file =
                avatarUpload.files?.[0];


            if (!file) {
                return;
            }


            /*-----------------------------------------
                VALIDATE FILE TYPE
            -----------------------------------------*/

            const allowedTypes = [
                "image/jpeg",
                "image/png",
                "image/webp"
            ];


            if (
                !allowedTypes.includes(
                    file.type
                )
            ) {

                alert(
                    "Please select a JPG, PNG or WebP image."
                );

                avatarUpload.value = "";

                return;

            }


            /*-----------------------------------------
                VALIDATE FILE SIZE
            -----------------------------------------*/

            const MAX_SIZE =
                5 * 1024 * 1024;


            if (
                file.size > MAX_SIZE
            ) {

                alert(
                    "Please choose an image smaller than 5 MB."
                );

                avatarUpload.value = "";

                return;

            }


            /*-----------------------------------------
                TEMPORARY PREVIEW
            -----------------------------------------*/

            const previewUrl =
                URL.createObjectURL(file);


            if (studentAvatar) {

                studentAvatar.src =
                    previewUrl;

            }


            /*-----------------------------------------
                UPLOAD TO R2
            -----------------------------------------*/

            try {

                const formData =
                    new FormData();


                formData.append(
                    "file",
                    file
                );


                const response =
                    await fetch(
                        `${API_BASE}/upload`,
                        {

                            method: "POST",

                            headers: {

                                "Authorization":
                                    `Bearer ${studentToken}`

                            },

                            body:
                                formData

                        }
                    );


                if (
                    response.status === 401
                ) {

                    redirectToLogin();

                    return;

                }


                const result =
                    await response.json();


                if (
                    !response.ok ||
                    !result.success
                ) {

                    throw new Error(
                        result.message ||
                        "Unable to upload profile photo."
                    );

                }


                /*-------------------------------------
                    STORE SERVER RESULT
                -------------------------------------*/

                if (
                    result.avatar_url &&
                    studentAvatar
                ) {

                    const avatarEndpoint =
                        result.avatar_url.startsWith("http")
                            ? result.avatar_url
                            : `${API_BASE.replace(
                                "/api",
                                ""
                            )}${result.avatar_url}`;

                    studentAvatar.src =
                        avatarEndpoint;

                }


                /*-------------------------------------
                    UPDATE DASHBOARD DATA
                -------------------------------------*/

                if (
                    dashboardData &&
                    dashboardData.student
                ) {

                    dashboardData.student.avatar_url =
                        result.avatar_url;

                }


            }

            catch (error) {

                console.error(
                    "Avatar upload error:",
                    error
                );


                alert(
                    error.message ||
                    "Unable to upload profile photo."
                );


                /*-------------------------------------
                    RESTORE CURRENT SERVER AVATAR
                -------------------------------------*/

                renderServerAvatar();

            }

            finally {

                URL.revokeObjectURL(
                    previewUrl
                );

                avatarUpload.value = "";

            }

        }
    );

}
    /*=========================================================
        SEARCH
    =========================================================*/

    function setupSearch() {

        if (!searchInput) {
            return;
        }


        searchInput.addEventListener(
            "keydown",
            event => {

                if (
                    event.key !== "Enter"
                ) {
                    return;
                }


                const query =
                    searchInput.value.trim();


                if (!query) {
                    return;
                }


                /*
                    No /api/search endpoint currently exists
                    in the supplied Worker.

                    Therefore we do not invent one.

                    For now, Enter takes the student to
                    Practice where question searching can
                    eventually be connected to the real
                    practice/search backend.
                */

                const target =
                    `practice.html?search=${encodeURIComponent(query)}`;

                window.location.href =
                    target;

            }
        );

    }


    /*=========================================================
        LOAD DASHBOARD
    =========================================================*/

    async function loadDashboard() {

        if (!requireAuthentication()) {
            return;
        }


        try {

            const response =
                await fetch(
                    `${API_BASE}/dashboard`,
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


            if (
                response.status === 401
            ) {

                redirectToLogin();

                return;

            }


            const result =
                await response.json();


            if (!response.ok) {

                throw new Error(
                    result.message ||
                    "Unable to load dashboard."
                );

            }


            if (
                result.success === false
            ) {

                throw new Error(
                    result.message ||
                    "Unable to load dashboard."
                );

            }


            dashboardData =
                result;


            renderDashboard();

            renderTrialStatus();

            renderRecentActivity();

            renderServerAvatar();

        }


        catch (error) {

            console.error(
                "Dashboard Error:",
                error
            );


            alert(
                error.message ||
                "Unable to load dashboard."
            );

        }

    }


    /*=========================================================
        RENDER DASHBOARD
    =========================================================*/

    function renderDashboard() {

        if (!dashboardData) {
            return;
        }


        const student =
            dashboardData.student || {};


        const trial =
            dashboardData.trial || {};


        const progress =
            dashboardData.progress || {};


        const subscription =
            dashboardData.subscription || {};


        /*-----------------------------------------
            Student Information
        -----------------------------------------*/

        if (welcomeStudentName) {

            welcomeStudentName.textContent =
                student.full_name ||
                "Student";

        }


        if (headerStudentName) {

            headerStudentName.textContent =
                student.full_name ||
                "Student";

        }


        if (studentPlan) {

            studentPlan.textContent =
                subscription.plan ||
                "Free Trial";

        }


        /*-----------------------------------------
            Trial Information
        -----------------------------------------*/

        if (daysLeft) {

            daysLeft.textContent =
                Number(
                    trial.days_left ?? 0
                );

        }


        if (questionsLeft) {

            questionsLeft.textContent =
                Number(
                    trial.questions_remaining ?? 0
                );

        }


        /*-----------------------------------------
            Learning Progress
        -----------------------------------------*/

        if (subjectsStarted) {

            subjectsStarted.textContent =
                Number(
                    progress.subjects_started ?? 0
                );

        }


        if (questionsAnswered) {

            questionsAnswered.textContent =
                Number(
                    progress.questions_answered ?? 0
                );

        }


        if (successRate) {

            const rate =
                Number(
                    progress.success_rate ?? 0
                );

            successRate.textContent =
                `${rate}%`;

        }

    }


    /*=========================================================
        TRIAL STATUS
    =========================================================*/

    function renderTrialStatus() {

        if (!dashboardData) {
            return;
        }


        const trial =
            dashboardData.trial || {};


        const upgradeRequired =
            Boolean(
                trial.upgrade_required
            );


        if (upgradeRequired) {

            if (trialCard) {

                trialCard.style.display =
                    "none";

            }


            if (trialExpiredCard) {

                trialExpiredCard.style.display =
                    "flex";

            }

        }


        else {

            if (trialCard) {

                trialCard.style.display =
                    "flex";

            }


            if (trialExpiredCard) {

                trialExpiredCard.style.display =
                    "none";

            }

        }

    }


    /*=========================================================
        RECENT ACTIVITY
    =========================================================*/

    function escapeHtml(value) {

        return String(value ?? "")
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");

    }


    function renderRecentActivity() {

        if (!recentActivity) {
            return;
        }


        recentActivity.innerHTML = "";


        const activities =
            Array.isArray(
                dashboardData?.recent_activity
            )
                ? dashboardData.recent_activity
                : [];


        if (
            activities.length === 0
        ) {

            recentActivity.innerHTML = `

                <div class="empty-state">

                    <i class="fas fa-clock-rotate-left"></i>

                    <h3>No Activity Yet</h3>

                    <p>
                        Your completed practice
                        sessions will appear here.
                    </p>

                    <a
                        href="practice.html"
                        class="secondary-btn">

                        Start Practicing

                    </a>

                </div>

            `;

            return;

        }


        activities.forEach(
            activity => {

                const subject =
                    escapeHtml(
                        activity.subject ||
                        "Practice"
                    );


                const questionsUsed =
                    Number(
                        activity.questions_used ?? 0
                    );


                const correctAnswers =
                    Number(
                        activity.correct_answers ?? 0
                    );


                const wrongAnswers =
                    Number(
                        activity.wrong_answers ?? 0
                    );


                recentActivity.insertAdjacentHTML(
                    "beforeend",

                    `

                    <div class="activity-item">

                        <div class="activity-details">

                            <h4>
                                ${subject}
                            </h4>

                            <p>
                                ${questionsUsed}
                                Question(s)
                            </p>

                        </div>

                        <div class="activity-score">

                            <span class="correct">
                                ✔ ${correctAnswers}
                            </span>

                            <span class="wrong">
                                ✖ ${wrongAnswers}
                            </span>

                        </div>

                    </div>

                    `
                );

            }
        );

    }


    /*=========================================================
        EVENT BINDINGS
    =========================================================*/

    function setupEventListeners() {

        if (sidebarLogoutBtn) {

            sidebarLogoutBtn.addEventListener(
                "click",
                logoutStudent
            );

        }


        if (profileLogoutBtn) {

            profileLogoutBtn.addEventListener(
                "click",
                logoutStudent
            );

        }


        setupSidebar();

        setupProfileDropdown();

        setupAvatarUpload();

        setupSearch();

    }


    /*=========================================================
        INITIALISE DASHBOARD
    =========================================================*/

    document.addEventListener(
        "DOMContentLoaded",
        () => {

            setupEventListeners();

            loadDashboard();

        }
    );

})();