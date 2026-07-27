/*
=========================================================
    NurseSphere Student Dashboard Controller
    File: js/dashboard-student.js
=========================================================
*/

"use strict";

/*=========================================================
    API Configuration
=========================================================*/

const API_BASE =
    "https://nursephere.wamalwaemily.workers.dev/api";

/*=========================================================
    Student Session
=========================================================*/

const studentToken =
    localStorage.getItem("studentToken");

/*=========================================================
    Dashboard Data
=========================================================*/

let dashboardData = null;

/*=========================================================
    DOM Elements
=========================================================*/

const welcomeStudentName =
    document.getElementById("welcomeStudentName");

const headerStudentName =
    document.getElementById("headerStudentName");

const studentPlan =
    document.getElementById("studentPlan");

const daysLeft =
    document.getElementById("daysLeft");

const questionsLeft =
    document.getElementById("questionsLeft");

const subjectsStarted =
    document.getElementById("subjectsStarted");

const questionsAnswered =
    document.getElementById("questionsAnswered");

const successRate =
    document.getElementById("successRate");

const recentActivity =
    document.getElementById("recentActivity");

const trialCard =
    document.getElementById("trialCard");

const trialExpiredCard =
    document.getElementById("trialExpiredCard");

const sidebarLogoutBtn =
    document.getElementById("sidebarLogoutBtn");

const profileLogoutBtn =
    document.getElementById("profileLogoutBtn");

/*=========================================================
    Session Management
=========================================================*/

function clearStudentSession() {

    localStorage.removeItem("studentToken");

    localStorage.removeItem("studentId");

    localStorage.removeItem("studentName");

    localStorage.removeItem("studentEmail");

    localStorage.removeItem("subscriptionStatus");

    localStorage.removeItem("trialActive");

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
    Logout
=========================================================*/

function logoutStudent(event) {

    event.preventDefault();

    clearStudentSession();

    window.location.href =
        "../index.html";

}

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

/*=========================================================
    Load Dashboard
=========================================================*/

async function loadDashboard() {

    if (!requireAuthentication()) {

        return;

    }

    try {

        const response = await fetch(

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

        if (response.status === 401) {

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

        dashboardData = result;

        renderDashboard();

        renderTrialStatus();

        renderRecentActivity();

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
    Render Dashboard
=========================================================*/

function renderDashboard() {

    if (!dashboardData) {

        return;

    }

    const {

        student,

        trial,

        progress,

        subscription

    } = dashboardData;

    /*=========================================
        Student Information
    =========================================*/

    if (welcomeStudentName) {

        welcomeStudentName.textContent =
            student.full_name;

    }

    if (headerStudentName) {

        headerStudentName.textContent =
            student.full_name;

    }

    if (studentPlan) {

        studentPlan.textContent =
            subscription.plan;

    }

    /*=========================================
        Trial Information
    =========================================*/

    if (daysLeft) {

        daysLeft.textContent =
            trial.days_left;

    }

    if (questionsLeft) {

        questionsLeft.textContent =
            trial.questions_remaining;

    }

    /*=========================================
        Learning Progress
    =========================================*/

    if (subjectsStarted) {

        subjectsStarted.textContent =
            progress.subjects_started;

    }

    if (questionsAnswered) {

        questionsAnswered.textContent =
            progress.questions_answered;

    }

    if (successRate) {

        successRate.textContent =
            `${progress.success_rate}%`;

    }

}

/*=========================================================
    Trial Status
=========================================================*/

function renderTrialStatus() {

    if (!dashboardData) {

        return;

    }

    const {

        trial

    } = dashboardData;

    if (trial.upgrade_required) {

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
    Recent Activity
=========================================================*/

function renderRecentActivity() {

    if (!recentActivity) {

        return;

    }

    recentActivity.innerHTML = "";

    if (

        !dashboardData.recent_activity ||

        dashboardData.recent_activity.length === 0

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

    dashboardData.recent_activity.forEach(

        activity => {

            recentActivity.insertAdjacentHTML(

                "beforeend",

                `

                <div class="activity-item">

                    <div
                        class="activity-details">

                        <h4>

                            ${activity.subject}

                        </h4>

                        <p>

                            ${activity.questions_used}
                            Question(s)

                        </p>

                    </div>

                    <div
                        class="activity-score">

                        <span class="correct">

                            ✔ ${activity.correct_answers}

                        </span>

                        <span class="wrong">

                            ✖ ${activity.wrong_answers}

                        </span>

                    </div>

                </div>

                `

            );

        }

    );

}

/*=========================================================
    Initialise Dashboard
=========================================================*/

document.addEventListener(

    "DOMContentLoaded",

    () => {

        loadDashboard();

    }

);