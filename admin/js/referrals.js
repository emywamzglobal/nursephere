/*
=========================================================
    NurseSphere Admin
    File: admin/js/referrals.js
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

    await loadReferrals();

}

/*=========================================================
    Load Logged In Admin
=========================================================*/

function loadAdmin() {

    const admin = Auth.getUser();

    if (!admin) {

        return;

    }

    const adminName =
        document.getElementById("adminName");

    if (adminName) {

        adminName.textContent =

            admin.first_name && admin.last_name

                ? `${admin.first_name} ${admin.last_name}`

                : admin.name ||

                admin.email ||

                "Administrator";

    }

}

/*=========================================================
    Load Referrals
=========================================================*/

async function loadReferrals() {

    const tableBody =

        document.getElementById(

            "referralsTableBody"

        );

    if (!tableBody) {

        return;

    }

    tableBody.innerHTML = `

        <tr>

            <td colspan="7" class="text-center">

                Loading referrals...

            </td>

        </tr>

    `;

    try {

        const response =

            await API.get(

                "/api/admin/referrals"

            );

        if (!response.success) {

            throw new Error(

                response.message ||

                "Unable to load referrals."

            );

        }

        renderReferrals(

            response.data || []

        );

    }

    catch (error) {

        console.error(error);

        tableBody.innerHTML = `

            <tr>

                <td colspan="7"

                    class="text-center">

                    Failed to load referrals.

                </td>

            </tr>

        `;

    }

}

/*=========================================================
    Render Referrals
=========================================================*/

function renderReferrals(referrals) {

    const tableBody =

        document.getElementById(

            "referralsTableBody"

        );

    if (!referrals.length) {

        tableBody.innerHTML = `

            <tr>

                <td colspan="7"

                    class="text-center">

                    No referrals found.

                </td>

            </tr>

        `;

        return;

    }

    tableBody.innerHTML = referrals.map(referral => `

        <tr>

            <td>

                ${escapeHtml(

                    referral.referrer_name || ""

                )}

            </td>

            <td>

                ${escapeHtml(

                    referral.referred_name ||

                    referral.referred_email ||

                    ""

                )}

            </td>

            <td>

                ${escapeHtml(

                    referral.exam_name || ""

                )}

            </td>

            <td>

                ${formatDate(

                    referral.created_at

                )}

            </td>

            <td>

                ${formatReward(

                    referral.reward_qualified

                )}

            </td>

            <td>

                <span class="status-badge">

                    ${escapeHtml(

                        referral.status || ""

                    )}

                </span>

            </td>

            <td>

                <button

                    class="action-btn"

                    onclick="viewReferral('${referral.id}')">

                    View

                </button>

            </td>

        </tr>

    `).join("");

}

/*=========================================================
    View Referral
=========================================================*/

async function viewReferral(referralId) {

    try {

        const response = await API.get(

            `/api/admin/referrals/${referralId}`

        );

        if (!response.success) {

            throw new Error(

                response.message ||

                "Unable to load referral."

            );

        }

        console.log(response.data);

        Utils.showToast(

            "Referral loaded.",

            "success"

        );

    }

    catch (error) {

        console.error(error);

        Utils.showToast(

            error.message ||

            "Unable to load referral.",

            "error"

        );

    }

}

/*=========================================================
    Reward Status
=========================================================*/

function formatReward(value) {

    return value == 1

        ? "Qualified"

        : "Pending";

}

/*=========================================================
    Format Date
=========================================================*/

function formatDate(date) {

    if (!date) {

        return "";

    }

    return new Date(date)

        .toLocaleDateString();

}

/*=========================================================
    Escape HTML
=========================================================*/

function escapeHtml(value) {

    if (

        value === null ||

        value === undefined

    ) {

        return "";

    }

    return String(value)

        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");

}