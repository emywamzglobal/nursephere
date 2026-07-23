/*
=========================================================
    Nursephere Notifications Controller
    File: js/notifications.js
=========================================================
*/

"use strict";

/*=========================================================
    Configuration
=========================================================*/

const NotificationAPI = {

    notifications: "http://127.0.0.1:8787/api/notifications"

};

/*=========================================================
    DOM Elements
=========================================================*/

const notificationBtn = document.getElementById("notificationBtn");

const notificationCount = document.getElementById("notificationCount");

/*
    We'll create these in the next step.
*/

let notificationDropdown = null;

let notificationList = null;

/*=========================================================
    Create Notification Dropdown
=========================================================*/

function createNotificationDropdown() {

    notificationDropdown = document.createElement("div");

    notificationDropdown.className = "notification-dropdown";

    notificationDropdown.innerHTML = `

        <div class="notification-header">

            <h3>Notifications</h3>

        </div>

        <div
            class="notification-list"
            id="notificationList">

            <div class="notification-empty">

                Loading notifications...

            </div>

        </div>

    `;

    notificationBtn.parentElement.appendChild(notificationDropdown);

    notificationList = document.getElementById("notificationList");

}

/*=========================================================
    Load Notifications
=========================================================*/

async function loadNotifications(studentId) {

    try {

        const response = await fetch(

            `${NotificationAPI.notifications}?studentId=${studentId}`

        );

        const result = await response.json();

        if (!result.success) {

            throw new Error(result.message);

        }

        renderNotifications(result.notifications);

    }

    catch (error) {

        notificationList.innerHTML = `

            <div class="notification-empty">

                Failed to load notifications.

            </div>

        `;

        console.error(error);

    }

}

/*=========================================================
    Render Notifications
=========================================================*/

function renderNotifications(notifications) {

    if (!notifications.length) {

        notificationCount.textContent = "0";

        notificationList.innerHTML = `

            <div class="notification-empty">

                No notifications available.

            </div>

        `;

        return;

    }

    const unread = notifications.filter(

        notification => notification.is_read === 0

    ).length;

    notificationCount.textContent = unread;

    notificationList.innerHTML = notifications.map(notification => `

    <div
        class="notification-item"
        data-id="${notification.id}">

        <div class="notification-title">

            ${notification.title}

        </div>

        <div class="notification-message">

            ${notification.message}

        </div>

    </div>

`).join("");

document.querySelectorAll(".notification-item").forEach(item => {

    item.addEventListener("click", async () => {

        const notificationId = item.dataset.id;

        await fetch(NotificationAPI.notifications, {

            method: "POST",

            headers: {

                "Content-Type": "application/json"

            },

            body: JSON.stringify({

                notificationId

            })

        });

        loadNotifications(

            localStorage.getItem("studentId")

        );

    });

});

/*=========================================================
    Initialize Notifications
=========================================================*/

document.addEventListener("DOMContentLoaded", () => {

    createNotificationDropdown();

    notificationBtn.addEventListener("click", (event) => {

        event.stopPropagation();

        notificationDropdown.classList.toggle("active");

    });

    document.addEventListener("click", () => {

        notificationDropdown.classList.remove("active");

    });

    notificationDropdown.addEventListener("click", (event) => {

        event.stopPropagation();

    });

    const studentId = localStorage.getItem("studentId");

    if (studentId) {

        loadNotifications(studentId);

    }

});

}