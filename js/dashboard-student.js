/*
=========================================================
    Nursephere Student Dashboard Controller
    File: js/dashboard-student.js
=========================================================
*/

"use strict";

/*=========================================================
    Configuration
=========================================================*/

const API_BASE =
    "https://nursephere.wamalwaemily.workers.dev/api";

/*=========================================================
    Student Session
=========================================================*/

const studentToken = localStorage.getItem("studentToken");

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

/*=========================================================
    Dashboard Data
=========================================================*/

let dashboardData = null;

/*=========================================================
    Authentication
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

    window.location.replace("../login.html");

}

function requireAuthentication() {

    if (!studentToken) {

        redirectToLogin();

        return false;

    }

    return true;

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

            DashboardAPI.dashboard,

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

        const result = await response.json();

        if (!response.ok) {

            throw new Error(

                result.message ||

                "Unable to load dashboard."

            );

        }

        dashboardData = result;

        renderDashboard();

        renderRecentActivity();

        renderTrialStatus();

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
    Initialise
=========================================================*/

document.addEventListener(

    "DOMContentLoaded",

    loadDashboard

);

/*=========================================================
    Render Student Dashboard
=========================================================*/

function renderDashboard() {

    if (!dashboardData) {

        return;

    }

    const {

        student,

        trial,

        progress

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

            dashboardData.subscription.plan;

    }

    /*=========================================
        Trial Statistics
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
    Render Recent Activity
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

                <i class="fas fa-clock"></i>

                <h3>No Activity Yet</h3>

                <p>

                    Your practice history will appear here
                    after completing questions.

                </p>

            </div>

        `;

        return;

    }

    dashboardData.recent_activity.forEach(activity => {

        recentActivity.insertAdjacentHTML(

            "beforeend",

            `

            <div class="activity-item">

                <div class="activity-details">

                    <h4>${activity.subject}</h4>

                    <p>

                        ${activity.questions_used}
                        Question(s)

                    </p>

                </div>

                <div class="activity-score">

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

    });

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

    if (

        trial.upgrade_required

    ) {

        alert(

            "Your free trial has ended. Upgrade your subscription to continue practising."

        );

    }

}