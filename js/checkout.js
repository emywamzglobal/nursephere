"use strict";

/*=========================================================
    NurseSphere Checkout Controller

    Page:
        checkout.html

    Responsibilities:
        - Verify student authentication
        - Load subscription details
        - Load logged-in student
        - Initialize PayPal Hosted Fields
        - Process subscription payment
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
let hostedFieldsInstance = null;

/*=========================================================
    Authentication
=========================================================*/

function getToken() {

    return localStorage.getItem("studentToken");

}

function verifyLogin() {

    const token = getToken();

    if (!token) {

        window.location.replace("login.html");

        return false;

    }

    return true;

}

/*=========================================================
    URL Helpers
=========================================================*/

function getPlanId() {

    return new URLSearchParams(

        window.location.search

    ).get("plan");

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

    ).format(Number(amount));

}

/*=========================================================
    UI Helpers
=========================================================*/

function showError(message) {

    console.error(message);

    alert(message);

}

function setLoading(isLoading) {

    const button = document.getElementById("payButton");

    if (!button) return;

    button.disabled = isLoading;

    button.innerHTML = isLoading

        ? '<i class="fas fa-spinner fa-spin"></i> Processing Payment...'

        : '<i class="fas fa-lock"></i> Complete Payment';

}

/*=========================================================
    Secure API Helper
=========================================================*/

async function apiRequest(endpoint, options = {}) {

    const response = await fetch(

        `${API_BASE}${endpoint}`,

        {

            ...options,

            headers: {

                "Content-Type": "application/json",

                "Authorization": `Bearer ${getToken()}`,

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

        localStorage.removeItem("studentToken");

        window.location.replace("login.html");

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
    Load Selected Subscription Plan
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

    /*
        Expected backend response

        {
            success: true,
            plan: {
                id,
                name,
                description,
                duration_days,
                price
            }
        }
    */

    if (!result.success || !result.plan) {

        throw new Error(

            result.message ||

            "Subscription plan not found."

        );

    }

    selectedPlan = result.plan;

    populatePlanSummary();

}

/*=========================================================
    Load Logged-in Student
=========================================================*/

async function loadStudent() {

    const result = await apiRequest(

        "/dashboard"

    );

    /*
        Expected backend response

        {
            success: true,
            student: {
                full_name,
                email
            }
        }
    */

    if (!result.success || !result.student) {

        throw new Error(

            result.message ||

            "Unable to load student profile."

        );

    }

    student = result.student;

    populateStudentInformation();

}

/*=========================================================
    Populate Billing Information
=========================================================*/

function populateStudentInformation() {

    const fullNameInput =

        document.getElementById("fullName");

    const emailInput =

        document.getElementById("email");

    if (fullNameInput) {

        fullNameInput.value =

            student.full_name || "";

    }

    if (emailInput) {

        emailInput.value =

            student.email || "";

    }

}

/*=========================================================
    Populate Order Summary
=========================================================*/

function populatePlanSummary() {

    const duration =

        `${selectedPlan.duration_days} Days`;

    const price =

        formatCurrency(selectedPlan.price);

    document.getElementById(

        "planName"

    ).textContent =

        selectedPlan.name;

    document.getElementById(

        "planDescription"

    ).textContent =

        selectedPlan.description || "";

    document.getElementById(

        "planDuration"

    ).textContent =

        duration;

    document.getElementById(

        "planPrice"

    ).textContent =

        price;

    document.getElementById(

        "totalPrice"

    ).textContent =

        price;

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

    /*
        Expected Response

        {
            success: true,
            orderId: "PAYPAL_ORDER_ID"
        }
    */

    if (!result.success || !result.orderId) {

        throw new Error(

            result.message ||

            "Unable to create PayPal order."

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

            "PayPal Hosted Fields unavailable."

        );

    }

    if (!paypal.HostedFields.isEligible()) {

        throw new Error(

            "Card payments are unavailable."

        );

    }

    hostedFieldsInstance =

        await paypal.HostedFields.render({

            createOrder,

            styles: {

                input: {

                    "font-size": "16px",

                    "font-family": "Poppins, sans-serif",

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

                    selector: "#card-number",

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

                    selector: "#cvv",

                    placeholder: "123"

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

    /*
        Expected Response

        {
            success: true,
            subscription: {...}
        }
    */

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

    if (!hostedFieldsInstance) {

        showError(

            "Payment system is not ready."

        );

        return;

    }

    try {

        setLoading(true);

        const submission =

            await hostedFieldsInstance.submit({

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

        setLoading(false);

    }

}

/*=========================================================
    Initialize Checkout Page
=========================================================*/

async function initializeCheckout() {

    if (!verifyLogin()) {

        return;

    }

    await loadSubscriptionPlan();

    await loadStudent();

    await initializeHostedFields();

    const payButton =

        document.getElementById(

            "payButton"

        );

    if (!payButton) {

        throw new Error(

            "Pay button not found."

        );

    }

    payButton.addEventListener(

        "click",

        processPayment

    );

    console.log(

        "Checkout initialized successfully."

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