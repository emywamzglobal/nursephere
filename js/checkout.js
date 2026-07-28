"use strict";

/*=========================================================
    NurseSphere Checkout Controller

    Page:
        checkout.html

    Responsibilities

        • Verify authentication
        • Load logged-in student
        • Load selected subscription plan
        • Populate checkout page
        • Initialize PayPal Hosted Fields
        • Create PayPal order
        • Capture PayPal payment
        • Activate subscription
=========================================================*/


/*=========================================================
    API Configuration
=========================================================*/

const API_BASE =
    "https://nursephere.wamalwaemily.workers.dev/api";


/*=========================================================
    Global State
=========================================================*/

let student = null;

let selectedPlan = null;

let hostedFields = null;


/*=========================================================
    DOM Elements
=========================================================*/

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


/*=========================================================
    Authentication
=========================================================*/

function getToken() {

    return localStorage.getItem(
        "studentToken"
    );

}


function verifyLogin() {

    const token = getToken();

    if (!token) {

        window.location.replace(
            "login.html"
        );

        return false;

    }

    return true;

}


/*=========================================================
    URL Helpers
=========================================================*/

function getPlanId() {

    const params = new URLSearchParams(

        window.location.search

    );

    return params.get("plan");

}


/*=========================================================
    Formatting Helpers
=========================================================*/

function formatCurrency(amount) {

    return new Intl.NumberFormat(

        "en-US",

        {

            style: "currency",

            currency: "USD"

        }

    ).format(

        Number(amount)

    );

}


/*=========================================================
    UI Helpers
=========================================================*/

function showError(message) {

    console.error(message);

    alert(message);

}


function setButtonLoading(isLoading) {

    if (!payButton) return;

    payButton.disabled = isLoading;

    if (isLoading) {

        payButton.innerHTML =

            `<i class="fas fa-spinner fa-spin"></i>
             Processing Payment...`;

    }

    else {

        payButton.innerHTML =

            `<i class="fas fa-lock"></i>
             Complete Secure Payment`;

    }

}


/*=========================================================
    Secure API Request
=========================================================*/

async function apiRequest(

    endpoint,

    options = {}

) {

    const response = await fetch(

        `${API_BASE}${endpoint}`,

        {

            ...options,

            headers: {

                "Content-Type":

                    "application/json",

                Authorization:

                    `Bearer ${getToken()}`,

                ...(options.headers || {})

            }

        }

    );

    let data = {};

    try {

        data = await response.json();

    }

    catch {

        data = {};

    }

    if (response.status === 401) {

        localStorage.removeItem(

            "studentToken"

        );

        window.location.replace(

            "login.html"

        );

        return;

    }

    if (!response.ok) {

        throw new Error(

            data.message ||

            "Server request failed."

        );

    }

    return data;

}

/*=========================================================
    Load Logged-in Student
=========================================================*/

async function loadStudent() {

    const result = await apiRequest(

        "/dashboard"

    );

    if (

        !result.success ||

        !result.student

    ) {

        throw new Error(

            result.message ||

            "Unable to load your account."

        );

    }

    student = result.student;

    populateStudentInformation();

}


/*=========================================================
    Load Subscription Plan
=========================================================*/

async function loadSubscriptionPlan() {

    const planId = getPlanId();

    if (!planId) {

        throw new Error(

            "No subscription plan was selected."

        );

    }

    const result = await apiRequest(

        `/subscription-plans/${planId}`

    );

    if (

        !result.success ||

        !result.plan

    ) {

        throw new Error(

            result.message ||

            "Subscription plan not found."

        );

    }

    selectedPlan = result.plan;

    populatePlanSummary();

}


/*=========================================================
    Populate Billing Information
=========================================================*/

function populateStudentInformation() {

    if (!student) return;

    fullNameInput.value =

        student.full_name || "";

    emailInput.value =

        student.email || "";

}


/*=========================================================
    Populate Order Summary
=========================================================*/

function populatePlanSummary() {

    if (!selectedPlan) return;

    planName.textContent =

        selectedPlan.name;

    planDescription.textContent =

        selectedPlan.description || "";

    let durationText = "";

    switch (

        Number(

            selectedPlan.duration_days

        )

    ) {

        case 30:

            durationText =

                "30 Days";

            break;

        case 90:

            durationText =

                "90 Days";

            break;

        case 180:

            durationText =

                "180 Days";

            break;

        case 365:

            durationText =

                "365 Days";

            break;

        default:

            durationText =

                `${selectedPlan.duration_days} Days`;

    }

    planDuration.textContent =

        durationText;

    const formattedPrice =

        formatCurrency(

            selectedPlan.price

        );

    planPrice.textContent =

        formattedPrice;

    totalPrice.textContent =

        formattedPrice;

}

/*=========================================================
    Create PayPal Order
=========================================================*/

async function createOrder() {

    if (!selectedPlan) {

        throw new Error(

            "No subscription plan selected."

        );

    }

    const result = await apiRequest(

        "/payments/create-order",

        {

            method: "POST",

            body: JSON.stringify({

                planId: selectedPlan.id

            })

        }

    );

    if (

        !result.success ||

        !result.orderId

    ) {

        throw new Error(

            result.message ||

            "Unable to create payment order."

        );

    }

    return result.orderId;

}


/*=========================================================
    Initialize PayPal Hosted Fields
=========================================================*/

async function initializeHostedFields() {

    if (!window.paypal) {

        throw new Error(

            "PayPal SDK failed to load."

        );

    }

    if (!paypal.HostedFields) {

        throw new Error(

            "Hosted Fields unavailable."

        );

    }

    if (!paypal.HostedFields.isEligible()) {

        throw new Error(

            "Card payments are unavailable."

        );

    }

    hostedFields =

        await paypal.HostedFields.render({

            createOrder,

            styles: {

                input: {

                    "font-size": "16px",

                    "font-family":

                        "Poppins, sans-serif",

                    color: "#222"

                },

                ":focus": {

                    color: "#000"

                },

                ".invalid": {

                    color: "#dc3545"

                }

            },

            fields: {

                number: {

                    selector:

                        "#card-number",

                    placeholder:

                        "4111 1111 1111 1111"

                },

                expirationDate: {

                    selector:

                        "#expiration-date",

                    placeholder:

                        "MM / YY"

                },

                cvv: {

                    selector:

                        "#cvv",

                    placeholder:

                        "123"

                }

            }

        });

}


/*=========================================================
    Capture PayPal Order
=========================================================*/

async function captureOrder(orderId) {

    const result = await apiRequest(

        "/payments/capture-order",

        {

            method: "POST",

            body: JSON.stringify({

                orderId

            })

        }

    );

    if (!result.success) {

        throw new Error(

            result.message ||

            "Payment could not be completed."

        );

    }

    return result;

}


/*=========================================================
    Process Payment
=========================================================*/

async function processPayment() {

    if (!hostedFields) {

        showError(

            "Payment system is not ready."

        );

        return;

    }

    try {

        setButtonLoading(true);

        const submission =

            await hostedFields.submit({

                cardholderName:

                    student.full_name

            });

        await captureOrder(

            submission.orderId

        );

        alert(

            "Subscription activated successfully."

        );

        window.location.replace(

            "student/dashboard.html"

        );

    }

    catch (error) {

        console.error(error);

        showError(

            error.message ||

            "Payment failed."

        );

    }

    finally {

        setButtonLoading(false);

    }

}


/*=========================================================
    Initialize Checkout
=========================================================*/

async function initializeCheckout() {

    if (

        !verifyLogin()

    ) {

        return;

    }

    await loadStudent();

    await loadSubscriptionPlan();

    await initializeHostedFields();

    payButton.addEventListener(

        "click",

        processPayment

    );

    console.log(

        "Checkout initialized."

    );

}


/*=========================================================
    DOM Ready
=========================================================*/

document.addEventListener(

    "DOMContentLoaded",

    async () => {

        try {

            await initializeCheckout();

        }

        catch (error) {

            console.error(error);

            showError(

                error.message ||

                "Unable to initialize checkout."

            );

        }

    }

);