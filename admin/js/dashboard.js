"use strict";

/*
=========================================================
    Nursephere Admin Dashboard
=========================================================
*/

document.addEventListener(

    "DOMContentLoaded",

    async function () {

        Auth.requireAdmin();

        Auth.loadUser("adminName");

        await loadDashboard();

    }

);

/*=========================================================
    Load Dashboard
=========================================================*/

async function loadDashboard() {

    try {

        const response = await API.get(

           "/admin/dashboard"

        );

        populateDashboard(response.data);

    }

    catch (error) {

        console.error(error);

        showDashboardError();

    }

}

/*=========================================================
    Populate Dashboard
=========================================================*/

function populateDashboard(data) {

    document.getElementById(

        "totalStudents"

    ).textContent = Utils.number(

        data.stats.students

    );

    document.getElementById(

        "totalQuestions"

    ).textContent = Utils.number(

        data.stats.questions

    );

    document.getElementById(

        "examAttempts"

    ).textContent = Utils.number(

        data.stats.today_attempts

    );

    document.getElementById(

        "activeSubscriptions"

    ).textContent = Utils.number(

        data.stats.active_subscriptions

    );

    document.getElementById(

        "notificationCount"

    ).textContent = Utils.number(

        data.stats.notifications

    );

    renderRecentActivity(

        data.recent_activity

    );

}

/*=========================================================
    Recent Activity
=========================================================*/

function renderRecentActivity(activity) {

    const container = document.getElementById(

        "recentActivity"

    );

    if (

        !activity ||

        activity.length === 0

    ) {

        return;

    }

    container.innerHTML = "";

    activity.forEach(item => {

        const card = document.createElement(

            "div"

        );

        card.className = "activity-item";

        card.innerHTML = `

            <div class="activity-content">

                <h4>${escapeHtml(item.title)}</h4>

                <p>${escapeHtml(item.message)}</p>

                <small>

                    ${Utils.formatDateTime(item.created_at)}

                </small>

            </div>

        `;

        container.appendChild(card);

    });

}

/*=========================================================
    Dashboard Error
=========================================================*/

function showDashboardError() {

    document.getElementById(

        "totalStudents"

    ).textContent = "--";

    document.getElementById(

        "totalQuestions"

    ).textContent = "--";

    document.getElementById(

        "examAttempts"

    ).textContent = "--";

    document.getElementById(

        "activeSubscriptions"

    ).textContent = "--";

    document.getElementById(

        "notificationCount"

    ).textContent = "0";

    document.getElementById(

        "recentActivity"

    ).innerHTML = `

        <div class="empty-state">

            <i class="fas fa-circle-exclamation"></i>

            <h3>

                Unable to load dashboard.

            </h3>

            <p>

                Please refresh the page.

            </p>

        </div>

    `;

}

/*=========================================================
    Escape HTML
=========================================================*/

function escapeHtml(value) {

    if (!value) {

        return "";

    }

    const div = document.createElement(

        "div"

    );

    div.textContent = value;

    return div.innerHTML;

}