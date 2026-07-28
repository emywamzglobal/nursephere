// ======================================================
// NurseSphere Checkout Controller
// File: js/checkout.js
// ======================================================

"use strict";

// ======================================================
// CONFIGURATION
// ======================================================

const API_BASE = "/api";

const ENDPOINTS = {

    plans:
        `${API_BASE}/subscription-plans`,

    createOrder:
        `${API_BASE}/payments/create-order`,

    captureOrder:
        `${API_BASE}/payments/capture-order`

};

// ======================================================
// APPLICATION STATE
// ======================================================

const state = {

    token: null,

    student: null,

    planId: null,

    plan: null,

    useTrial: false,

    orderId: null,

    hostedFields: null,

    isSubmitting: false

};

// ======================================================
// DOM ELEMENTS
// ======================================================

const fullNameInput =
    document.getElementById("fullName");

const emailInput =
    document.getElementById("email");

const planName =
    document.getElementById("planName");

const planDescription =
    document.getElementById("planDescription");

const planDuration =
    document.getElementById("planDuration");

const planPrice =
    document.getElementById("planPrice");

const totalPrice =
    document.getElementById("totalPrice");

const payButton =
    document.getElementById("payButton");

const checkoutForm =
    document.getElementById("checkoutForm");

// ======================================================
// INITIALIZATION
// ======================================================

document.addEventListener(

    "DOMContentLoaded",

    initializeCheckout

);

// ======================================================
// INITIALIZE CHECKOUT
// ======================================================

async function initializeCheckout() {

    try {

        payButton.disabled = true;

        state.token =
            localStorage.getItem("studentToken");

        if (!state.token) {

            alert(
                "Your session has expired. Please log in again."
            );

            location.href = "login.html";

            return;

        }

        const params =
            new URLSearchParams(
                window.location.search
            );

        state.planId =
            params.get("plan");

        state.useTrial =
            params.get("trial") === "true";

        if (!state.planId) {

            alert(
                "No subscription plan was selected."
            );

            location.href = "pricing.html";

            return;

        }

        await loadStudent();

        await loadPlan();

        await initializeHostedFields();

    }

    catch (error) {

        console.error(error);

        alert(

            error.message ||

            "Unable to initialize checkout."

        );

    }

}

// ======================================================
// LOAD STUDENT
// ======================================================

async function loadStudent() {

    const student = JSON.parse(

        localStorage.getItem("student")

    );

    if (!student) {

        throw new Error(

            "Student information is unavailable."

        );

    }

    state.student = student;

    fullNameInput.value =
        student.fullName || "";

    emailInput.value =
        student.email || "";

}

// ======================================================
// LOAD SUBSCRIPTION PLAN
// ======================================================

async function loadPlan() {

    const response =
        await fetch(

            `${ENDPOINTS.plans}/${state.planId}`,

            {

                method: "GET",

                headers: {

                    Authorization:
                        `Bearer ${state.token}`

                }

            }

        );

    const result =
        await response.json();

    if (

        !response.ok ||

        !result.success

    ) {

        throw new Error(

            result.message ||

            "Unable to load subscription."

        );

    }

    state.plan =
        result.plan;

    renderPlanSummary();

}

// ======================================================
// RENDER ORDER SUMMARY
// ======================================================

function renderPlanSummary() {

    planName.textContent =
        state.plan.name;

    planDescription.textContent =
        state.plan.description;

    planDuration.textContent =
        `${state.plan.duration_days} Days`;

    const price =
        Number(
            state.plan.price
        ).toFixed(2);

    planPrice.textContent =
        `$${price}`;

    totalPrice.textContent =
        `$${price}`;

}

// ======================================================
// INITIALIZE PAYPAL HOSTED FIELDS
// ======================================================

async function initializeHostedFields() {

    if (!window.paypal) {

        throw new Error(

            "PayPal SDK failed to load."

        );

    }

    if (!paypal.HostedFields) {

        throw new Error(

            "PayPal Hosted Fields are unavailable."

        );

    }

    const eligibility =
        await paypal.HostedFields.isEligible();

    if (!eligibility) {

        throw new Error(

            "Hosted Fields are not supported on this device."

        );

    }

    state.hostedFields =
        await paypal.HostedFields.render({

            createOrder,

            styles: {

                "input": {

                    "font-size": "16px",

                    "font-family":
                        "Arial, sans-serif",

                    "color": "#1f2937"

                },

                ":focus": {

                    "color": "#111827"

                },

                ".invalid": {

                    "color": "#dc2626"

                },

                ".valid": {

                    "color": "#16a34a"

                }

            },

            fields: {

                number: {

                    selector:
                        "#card-number"

                },

                cvv: {

                    selector:
                        "#cvv"

                },

                expirationDate: {

                    selector:
                        "#expiration-date"

                }

            }

        });

    payButton.disabled = false;

    checkoutForm.addEventListener(

        "submit",

        handleCheckout

    );

}

// ======================================================
// CREATE PAYPAL ORDER
// ======================================================

async function createOrder() {

    const response =
        await fetch(

            ENDPOINTS.createOrder,

            {

                method: "POST",

                headers: {

                    "Content-Type":
                        "application/json",

                    Authorization:
                        `Bearer ${state.token}`

                },

                body: JSON.stringify({

                    planId:
                        state.planId,

                    useTrial:
                        state.useTrial

                })

            }

        );

    const result =
        await response.json();

    if (

        !response.ok ||

        !result.success

    ) {

        throw new Error(

            result.message ||

            "Unable to create PayPal order."

        );

    }

    state.orderId =
        result.orderId;

    return result.orderId;

}

// ======================================================
// HANDLE CHECKOUT SUBMISSION
// ======================================================

async function handleCheckout(event) {

    event.preventDefault();

    if (state.isSubmitting) {

        return;

    }

    state.isSubmitting = true;

    payButton.disabled = true;

    payButton.textContent =
        "Processing Payment...";

    try {

        await state.hostedFields.submit({

            cardholderName:
                state.student.fullName

        });

        const response =
            await fetch(

                ENDPOINTS.captureOrder,

                {

                    method: "POST",

                    headers: {

                        "Content-Type":
                            "application/json",

                        Authorization:
                            `Bearer ${state.token}`

                    },

                    body: JSON.stringify({

                        orderId:
                            state.orderId,

                        planId:
                            state.planId,

                        useTrial:
                            state.useTrial

                    })

                }

            );

        const result =
            await response.json();

        if (

            !response.ok ||

            !result.success

        ) {

            throw new Error(

                result.message ||

                "Payment could not be completed."

            );

        }

        alert(

            "Subscription activated successfully!"

        );

        location.href =
            "dashboard.html";

    }

    catch (error) {

        console.error(error);

        alert(

            error.message ||

            "Payment failed."

        );

    }

    finally {

        state.isSubmitting = false;

        payButton.disabled = false;

        payButton.textContent =
            "Complete Secure Payment";

    }

}

// ======================================================
// SESSION HELPERS
// ======================================================

function logoutStudent() {

    localStorage.removeItem("studentToken");

    localStorage.removeItem("student");

    location.href = "login.html";

}

// ======================================================
// AUTHENTICATION ERROR HANDLER
// ======================================================

function handleAuthenticationError() {

    alert(

        "Your session has expired. Please log in again."

    );

    logoutStudent();

}

// ======================================================
// GLOBAL FETCH ERROR HANDLER
// ======================================================

async function parseResponse(response) {

    let result = {};

    try {

        result =
            await response.json();

    }

    catch {

        result = {

            success: false,

            message:
                "Unexpected server response."

        };

    }

    if (response.status === 401) {

        handleAuthenticationError();

        throw new Error(

            "Authentication required."

        );

    }

    if (

        !response.ok ||

        !result.success

    ) {

        throw new Error(

            result.message ||

            "Request failed."

        );

    }

    return result;

}

// ======================================================
// FORMAT USD
// ======================================================

function formatCurrency(amount) {

    return Number(amount).toLocaleString(

        "en-US",

        {

            style: "currency",

            currency: "USD"

        }

    );

}

// ======================================================
// PAGE SAFETY
// ======================================================

window.addEventListener(

    "beforeunload",

    () => {

        if (

            state.isSubmitting

        ) {

            payButton.disabled = true;

        }

    }

);

// ======================================================
// END OF FILE
// ======================================================