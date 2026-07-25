"use strict";

/*=========================================================
    NurseSphere Subscription Controller
    File: js/subscription.js
=========================================================*/

/*=========================================================
    Configuration
=========================================================*/

const API_BASE = "http://127.0.0.1:8787/api";

/*=========================================================
    DOM Elements
=========================================================*/

const currentPlan = document.getElementById("currentPlan");
const subscriptionStatus = document.getElementById("subscriptionStatus");
const renewalDate = document.getElementById("renewalDate");
const subscriptionStart = document.getElementById("subscriptionStart");
const subscriptionRenewal = document.getElementById("subscriptionRenewal");
const paymentMethod = document.getElementById("paymentMethod");
const lastPayment = document.getElementById("lastPayment");
const renewButton = document.querySelector(".renew-btn");
const upgradeButtons = document.querySelectorAll(".upgrade-btn");

/*=========================================================
    Helpers
=========================================================*/

async function apiRequest(endpoint) {

    const response = await fetch(
        `${API_BASE}${endpoint}`,
        {
            headers: {
                "Content-Type": "application/json"
            }
        }
    );

    return response.json();

}

/*=========================================================
    Verify Login
=========================================================*/

function verifyLogin() {

    const token = localStorage.getItem("studentToken");

    if (!token) {

        window.location.replace("../login.html");

        return false;

    }

    return true;

}
/*=========================================================
    Load Subscription
=========================================================*/

async function loadSubscription() {

    if (!verifyLogin()) {
        return;
    }

    try {

        const session = getStudentSession();

        const result = await apiRequest(
            `/subscription?studentId=${session.id}`
        );

        if (!result.success) {

            throw new Error(
                result.message || "Unable to load subscription."
            );

        }

        populateSubscription(result);

    }

    catch (error) {

        console.error("Subscription Error:", error);

    }

}

/*=========================================================
    Initialize
=========================================================*/

document.addEventListener("DOMContentLoaded", async () => {

    await loadSubscription();

    if (renewButton) {

        renewButton.addEventListener("click", () => {

            window.location.href = "../pricing.html";

        });

    }

    upgradeButtons.forEach(button => {

        button.addEventListener("click", () => {

            window.location.href = "../pricing.html";

        });

    });

});

/*=========================================================
    Populate Subscription
=========================================================*/

function populateSubscription(data) {

    const subscription = data.subscription;
    const permissions = data.permissions;

    currentPlan.textContent = formatPlan(
        subscription.subscription_status
    );

    subscriptionStatus.textContent = formatStatus(
        subscription.subscription_status
    );

    const startDate =
        subscription.subscription_started_at ||
        subscription.trial_started_at;

    const endDate =
        subscription.subscription_expires_at ||
        subscription.trial_expires_at;

    subscriptionStart.textContent = formatDate(startDate);

    renewalDate.textContent = formatDate(endDate);

    subscriptionRenewal.textContent = formatDate(endDate);

    paymentMethod.textContent =
        subscription.subscription_status === "trial"
            ? "Free Trial"
            : "PayPal";

    lastPayment.textContent = formatDate(startDate);

    if (renewButton) {

        renewButton.disabled =
            !permissions.subscription.canRenew;

    }

    upgradeButtons.forEach(button => {

        button.disabled =
            !permissions.subscription.canUpgrade;

    });

}

/*=========================================================
    Format Helpers
=========================================================*/

function formatPlan(status) {

    switch (status) {

        case "trial":
            return "Free Trial";

        case "monthly":
            return "Monthly Plan";

        case "90day":
            return "90-Day Plan";

        case "yearly":
            return "Annual Plan";

        default:
            return "No Active Plan";

    }

}

function formatStatus(status) {

    switch (status) {

        case "trial":
            return "Trial Active";

        case "monthly":
        case "90day":
        case "yearly":
            return "Active";

        default:
            return "Inactive";

    }

}

function formatDate(date) {

    if (!date) {

        return "Not Available";

    }

    return new Date(date).toLocaleDateString(
        "en-US",
        {
            year: "numeric",
            month: "long",
            day: "numeric"
        }
    );

}