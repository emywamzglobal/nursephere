"use strict";

/*=========================================================
    NurseSphere Subscription Controller
    File: js/subscription.js

    Database-driven.
    No hardcoded plan names.
    No hardcoded prices.
    No hardcoded subscription statuses.
=========================================================*/


/*=========================================================
    CONFIGURATION
=========================================================*/

const API_BASE =
    "https://nursephere.wamalwaemily.workers.dev/api";


/*=========================================================
    DOM ELEMENTS
=========================================================*/

const currentPlan =
    document.getElementById("currentPlan");

const subscriptionStatus =
    document.getElementById("subscriptionStatus");

const renewalDate =
    document.getElementById("renewalDate");

const subscriptionStart =
    document.getElementById("subscriptionStart");

const subscriptionRenewal =
    document.getElementById("subscriptionRenewal");

const paymentMethod =
    document.getElementById("paymentMethod");

const lastPayment =
    document.getElementById("lastPayment");

const renewButton =
    document.querySelector(".renew-btn");

const upgradeButtons =
    document.querySelectorAll(".upgrade-btn");


/*=========================================================
    AUTHENTICATION
=========================================================*/

function getStudentToken() {

    return localStorage.getItem(
        "studentToken"
    );

}


/*=========================================================
    VERIFY LOGIN
=========================================================*/

function verifyLogin() {

    const token =
        getStudentToken();


    if (!token) {

        window.location.replace(
            "../login.html"
        );

        return false;

    }


    return true;

}


/*=========================================================
    API REQUEST
=========================================================*/

async function apiRequest(
    endpoint
) {

    const token =
        getStudentToken();


    if (!token) {

        throw new Error(
            "Your session has expired."
        );

    }


    const response =
        await fetch(

            `${API_BASE}${endpoint}`,

            {

                method: "GET",

                headers: {

                    "Authorization":
                        `Bearer ${token}`,

                    "Content-Type":
                        "application/json"

                }

            }

        );


    if (
        response.status ===
        401
    ) {

        localStorage.removeItem(
            "studentToken"
        );

        window.location.replace(
            "../login.html"
        );

        throw new Error(
            "Your session has expired."
        );

    }


    let result = null;


    try {

        result =
            await response.json();

    }

    catch {

        throw new Error(
            "Invalid response from the server."
        );

    }


    if (!response.ok) {

        throw new Error(

            result.message ||

            "Unable to load subscription."

        );

    }


    return result;

}


/*=========================================================
    LOAD SUBSCRIPTION
=========================================================*/

async function loadSubscription() {

    if (!verifyLogin()) {

        return;

    }


    try {

        const result =
            await apiRequest(
                "/subscription"
            );


        if (!result.success) {

            throw new Error(

                result.message ||

                "Unable to load subscription."

            );

        }


        populateSubscription(
            result
        );

    }


    catch (error) {

        console.error(
            "Subscription Error:",
            error
        );


        showSubscriptionError(
            error.message
        );

    }

}


/*=========================================================
    POPULATE SUBSCRIPTION
=========================================================*/

function populateSubscription(
    data
) {

    const subscription =
        data.subscription;

    const plan =
        data.plan;

    const active =
        data.active === true;


    /*-----------------------------------------------------
        NO ACTIVE SUBSCRIPTION
    -----------------------------------------------------*/

    if (
        !active ||
        !subscription ||
        !plan
    ) {

        showNoActiveSubscription();

        return;

    }


    /*-----------------------------------------------------
        CURRENT PLAN
    -----------------------------------------------------*/

    if (currentPlan) {

        currentPlan.textContent =
            plan.name ||
            "No Active Plan";

    }


    /*-----------------------------------------------------
        SUBSCRIPTION STATUS
    -----------------------------------------------------*/

    if (subscriptionStatus) {

        subscriptionStatus.textContent =
            formatStatus(
                subscription.status
            );

    }


    /*-----------------------------------------------------
        START DATE
    -----------------------------------------------------*/

    if (subscriptionStart) {

        subscriptionStart.textContent =
            formatDate(
                subscription.start_date
            );

    }


    /*-----------------------------------------------------
        RENEWAL DATE
    -----------------------------------------------------*/

    if (renewalDate) {

        renewalDate.textContent =
            formatDate(
                subscription.end_date
            );

    }


    if (subscriptionRenewal) {

        subscriptionRenewal.textContent =
            formatDate(
                subscription.end_date
            );

    }


    /*-----------------------------------------------------
        PAYMENT METHOD

        The current API response does not expose the
        actual payment method.

        Therefore we do not invent one.
    -----------------------------------------------------*/

    if (paymentMethod) {

        paymentMethod.textContent =
            "Not Available";

    }


    /*-----------------------------------------------------
        LAST PAYMENT

        The current subscription response does not contain
        a payment transaction date.

        Therefore we do not incorrectly use start_date
        as the last payment date.
    -----------------------------------------------------*/

    if (lastPayment) {

        lastPayment.textContent =
            "Not Available";

    }


    /*-----------------------------------------------------
        RENEW BUTTON
    -----------------------------------------------------*/

    configureRenewButton(
        subscription,
        plan
    );


    /*-----------------------------------------------------
        UPGRADE BUTTONS
    -----------------------------------------------------*/

    configureUpgradeButtons(
        subscription,
        plan
    );

}


/*=========================================================
    NO ACTIVE SUBSCRIPTION
=========================================================*/

function showNoActiveSubscription() {

    if (currentPlan) {

        currentPlan.textContent =
            "No Active Plan";

    }


    if (subscriptionStatus) {

        subscriptionStatus.textContent =
            "Inactive";

    }


    if (renewalDate) {

        renewalDate.textContent =
            "Not Available";

    }


    if (subscriptionStart) {

        subscriptionStart.textContent =
            "Not Available";

    }


    if (subscriptionRenewal) {

        subscriptionRenewal.textContent =
            "Not Available";

    }


    if (paymentMethod) {

        paymentMethod.textContent =
            "Not Available";

    }


    if (lastPayment) {

        lastPayment.textContent =
            "Not Available";

    }


    /*-----------------------------------------------------
        A student without an active subscription should
        be directed to the public pricing page.
    -----------------------------------------------------*/

    configureRenewButton(
    null,
    null
);


configureUpgradeButtons(
    null,
    null
);

}


/*=========================================================
    SUBSCRIPTION ERROR
=========================================================*/

function showSubscriptionError(
    message
) {

    if (currentPlan) {

        currentPlan.textContent =
            "Unable to Load";

    }


    if (subscriptionStatus) {

        subscriptionStatus.textContent =
            "Unavailable";

    }


    if (renewalDate) {

        renewalDate.textContent =
            "Not Available";

    }


    if (subscriptionStart) {

        subscriptionStart.textContent =
            "Not Available";

    }


    if (subscriptionRenewal) {

        subscriptionRenewal.textContent =
            "Not Available";

    }


    if (paymentMethod) {

        paymentMethod.textContent =
            "Not Available";

    }


    if (lastPayment) {

        lastPayment.textContent =
            "Not Available";

    }


    console.error(
        "Subscription Page Error:",
        message
    );

}


/*=========================================================
    RENEW BUTTON
=========================================================*/

function configureRenewButton(
    subscription,
    plan
) {

    if (!renewButton) {

        return;

    }

    renewButton.disabled = false;

    renewButton.onclick =
        function () {

            if (
                !plan ||
                !plan.name
            ) {

                window.location.href =
                    "/pricing";

                return;

            }

            window.location.href =
                "/pricing";

        };

}


/*=========================================================
    UPGRADE BUTTONS
=========================================================*/

function configureUpgradeButtons(
    subscription,
    plan
) {

    upgradeButtons.forEach(
        button => {

            button.disabled = false;

            button.onclick =
                function () {

                    window.location.href =
                        "/pricing";

                };

        }
    );

}
/*=========================================================
    FORMAT STATUS
=========================================================*/

function formatStatus(
    status
) {

    if (!status) {

        return "Inactive";

    }


    const normalized =
        String(status)
            .trim()
            .toLowerCase();


    if (
        normalized ===
        "active"
    ) {

        return "Active";

    }


    if (
        normalized ===
        "trial"
    ) {

        return "Trial Active";

    }


    if (
        normalized ===
        "pending"
    ) {

        return "Pending";

    }


    if (
        normalized ===
        "expired"
    ) {

        return "Expired";

    }


    if (
        normalized ===
        "cancelled"
    ) {

        return "Cancelled";

    }


    return status;

}


/*=========================================================
    FORMAT DATE
=========================================================*/

function formatDate(
    date
) {

    if (!date) {

        return "Not Available";

    }


    const parsedDate =
        new Date(date);


    if (
        Number.isNaN(
            parsedDate.getTime()
        )
    ) {

        return "Not Available";

    }


    return parsedDate.toLocaleDateString(

        "en-US",

        {

            year:
                "numeric",

            month:
                "long",

            day:
                "numeric"

        }

    );

}


/*=========================================================
    INITIALIZE
=========================================================*/

document.addEventListener(
    "DOMContentLoaded",
    async function () {

        await loadSubscription();

    }
);