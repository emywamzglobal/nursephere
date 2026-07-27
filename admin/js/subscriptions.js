/*
=========================================================
    NurseSphere Admin
    File: admin/js/subscriptions.js
=========================================================
*/

"use strict";

/*=========================================================
    Initialize
=========================================================*/

document.addEventListener("DOMContentLoaded", init);

async function init() {

    Auth.requireAdmin();

    loadAdmin();

    await loadSubscriptions();

}

/*=========================================================
    Load Logged In Admin
=========================================================*/

function loadAdmin() {

    const admin = Auth.getUser();

    if (!admin) {

        return;

    }

    const adminName = document.getElementById("adminName");

    if (adminName) {

        adminName.textContent =
            admin.first_name && admin.last_name
                ? `${admin.first_name} ${admin.last_name}`
                : admin.name || admin.email || "Administrator";

    }

}

/*=========================================================
    Load Subscriptions
=========================================================*/

async function loadSubscriptions() {

    const tableBody =
        document.getElementById("subscriptionsTableBody");

    if (!tableBody) {

        return;

    }

    tableBody.innerHTML = `

        <tr>

            <td colspan="6" class="text-center">

                Loading subscriptions...

            </td>

        </tr>

    `;

    try {

        const response =
            await API.get("/admin/subscriptions");

        if (!response.success) {

            throw new Error(

                response.message ||

                "Unable to load subscriptions."

            );

        }

        renderSubscriptions(

            response.data || []

        );

    }

    catch (error) {

        console.error(error);

        tableBody.innerHTML = `

            <tr>

                <td colspan="6" class="text-center">

                    Failed to load subscriptions.

                </td>

            </tr>

        `;

    }

}

/*=========================================================
    Render Subscriptions
=========================================================*/

function renderSubscriptions(subscriptions) {

    const tableBody =
        document.getElementById("subscriptionsTableBody");

    if (!subscriptions.length) {

        tableBody.innerHTML = `

            <tr>

                <td colspan="6" class="text-center">

                    No subscriptions found.

                </td>

            </tr>

        `;

        return;

    }

    tableBody.innerHTML = subscriptions.map(subscription => `

        <tr>

            <td>

                ${escapeHtml(
                    `${subscription.first_name} ${subscription.last_name}`.trim()
                )}

            </td>

            <td>

                ${escapeHtml(
                    subscription.email || ""
                )}

            </td>

            <td>

                ${escapeHtml(
                    subscription.plan_name || ""
                )}

            </td>

            <td>

                <span class="status-badge">

                    ${escapeHtml(
                        subscription.status || ""
                    )}

                </span>

            </td>

            <td>

                <span class="status-badge">

                    ${escapeHtml(
                        subscription.payment_status || ""
                    )}

                </span>

            </td>

            <td>

                <button
                    class="action-btn"
                    onclick="viewSubscription('${subscription.id}')">

                    View

                </button>

            </td>

        </tr>

    `).join("");

}

/*=========================================================
    View Subscription
=========================================================*/

async function viewSubscription(subscriptionId) {

    try {

        const response = await API.get(
            `/admin/subscriptions/${subscriptionId}`
        );

        if (!response.success) {

            throw new Error(
                response.message ||
                "Unable to load subscription."
            );

        }

        console.log(response.data);

        Utils.showToast(
            "Subscription loaded.",
            "success"
        );

    }

    catch (error) {

        console.error(error);

        Utils.showToast(
            error.message ||
            "Unable to load subscription.",
            "error"
        );

    }

}

/*=========================================================
    Escape HTML
=========================================================*/

function escapeHtml(value) {

    if (value === null || value === undefined) {

        return "";

    }

    return String(value)

        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");

}