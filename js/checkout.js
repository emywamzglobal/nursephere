"use strict";

// =====================================================
// NurseSphere Checkout
// checkout.js
// Bit 1 - Setup & Authentication
// =====================================================

const API_BASE = "https://www.nursephere.com/api";

let student = null;
let selectedPlan = null;
let paypalHostedFields = null;

// =====================================================
// Helpers
// =====================================================

function getToken() {

    return localStorage.getItem("token");

}

function getStudentId() {

    return localStorage.getItem("studentId");

}

function getPlanId() {

    const params = new URLSearchParams(window.location.search);

    return params.get("plan");

}

function formatCurrency(amount) {

    return new Intl.NumberFormat("en-US", {

        style: "currency",

        currency: "USD"

    }).format(amount);

}

// =====================================================
// API Helper
// =====================================================

async function apiRequest(endpoint, options = {}) {

    const token = getToken();

    const response = await fetch(`${API_BASE}${endpoint}`, {

        ...options,

        headers: {

            "Content-Type": "application/json",

            "Authorization": `Bearer ${token}`,

            ...(options.headers || {})

        }

    });

    const data = await response.json();

    if (!response.ok) {

        throw new Error(data.message || "Request failed.");

    }

    return data;

}

// =====================================================
// Verify Login
// =====================================================

function verifyLogin() {

    const token = getToken();
    const studentId = getStudentId();

    if (!token || !studentId) {

        alert("Please log in first.");

        window.location.href = "login.html";

        return false;

    }

    return true;

}

// =====================================================
// Initialize Checkout
// =====================================================

document.addEventListener("DOMContentLoaded", () => {

    if (!verifyLogin()) {

        return;

    }

    console.log("Checkout initialized.");

});

// =====================================================
// Load Selected Subscription Plan
// =====================================================

async function loadSubscriptionPlan() {

    try {

        const planId = getPlanId();

        if (!planId) {

            alert("No subscription plan selected.");

            window.location.href = "subscriptions.html";

            return;

        }

        const result = await apiRequest(

            `/subscription-plans/${planId}`

        );

        if (!result.success) {

            throw new Error(result.message);

        }

        selectedPlan = result.plan;

        // ---------------------------------
        // Populate Checkout Summary
        // ---------------------------------

        const planName = document.getElementById("planName");
        const planDescription = document.getElementById("planDescription");
        const planDuration = document.getElementById("planDuration");
        const planPrice = document.getElementById("planPrice");

        if (planName) {

            planName.textContent = selectedPlan.name;

        }

        if (planDescription) {

            planDescription.textContent =
                selectedPlan.description || "";

        }

        if (planDuration) {

            planDuration.textContent =
                `${selectedPlan.duration_days} Days`;

        }

        if (planPrice) {

            planPrice.textContent =
                formatCurrency(selectedPlan.price);

        }

        console.log("Subscription plan loaded.", selectedPlan);

    }

    catch (error) {

        console.error(error);

        alert(error.message);

        window.location.href = "subscriptions.html";

    }

}

// =====================================================
// Load Student Details
// =====================================================

async function loadStudent() {

    try {

        const result = await apiRequest(

            `/dashboard?studentId=${getStudentId()}`

        );

        if (!result.success) {

            throw new Error(result.message);

        }

        student = result.student;

        // ---------------------------------
        // Populate Billing Information
        // ---------------------------------

        const fullName = document.getElementById("fullName");
        const email = document.getElementById("email");

        if (fullName) {

            fullName.value = student.full_name || "";

        }

        if (email) {

            email.value = student.email || "";

        }

        console.log("Student loaded.", student);

    }

    catch (error) {

        console.error(error);

        alert(error.message);

        window.location.href = "login.html";

    }

}

// =====================================================
// Create PayPal Order
// =====================================================

async function createOrder() {

    const result = await apiRequest(

        "/payments/create-order",

        {

            method: "POST",

            body: JSON.stringify({

                studentId: student.id,

                planId: selectedPlan.id

            })

        }

    );

    if (!result.success) {

        throw new Error(result.message);

    }

    return result.orderId;

}

// =====================================================
// Initialize PayPal Hosted Fields
// =====================================================

async function initializeHostedFields() {

    if (!window.paypal) {

        throw new Error("PayPal SDK not loaded.");

    }

    if (!paypal.HostedFields.isEligible()) {

        throw new Error("Hosted Fields are not eligible on this device.");

    }

    paypalHostedFields = await paypal.HostedFields.render({

        createOrder,

        styles: {

            "input": {

                "font-size": "16px",
                "font-family": "Arial, sans-serif",
                "color": "#222"

            },

            ":focus": {

                "color": "#000"

            },

            ".invalid": {

                "color": "#dc3545"

            }

        },

        fields: {

            number: {

                selector: "#card-number",
                placeholder: "4111 1111 1111 1111"

            },

            cvv: {

                selector: "#cvv",
                placeholder: "123"

            },

            expirationDate: {

                selector: "#expiration-date",
                placeholder: "MM/YY"

            }

        }

    });

    console.log("PayPal Hosted Fields initialized.");

}

// =====================================================
// Create PayPal Order
// =====================================================

async function createOrder() {

    const result = await apiRequest(

        "/payments/create-order",

        {

            method: "POST",

            body: JSON.stringify({

                studentId: student.id,

                planId: selectedPlan.id

            })

        }

    );

    if (!result.success) {

        throw new Error(result.message);

    }

    return result.orderId;

}

// =====================================================
// Capture Successful Payment
// =====================================================

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

        throw new Error(result.message);

    }

    return result;

}

// =====================================================
// Toggle Checkout Button
// =====================================================

function setLoading(isLoading) {

    const button = document.getElementById("payButton");

    if (!button) {

        return;

    }

    button.disabled = isLoading;

    button.textContent = isLoading

        ? "Processing Payment..."

        : "Pay Now";

}

// =====================================================
// Initialize Hosted Fields
// =====================================================

async function initializeHostedFields() {

    if (!window.paypal) {

        throw new Error("PayPal SDK not loaded.");

    }

    if (!paypal.HostedFields.isEligible()) {

        throw new Error("Hosted Fields are not available.");

    }

    paypalHostedFields = await paypal.HostedFields.render({

        createOrder,

        styles: {

            input: {

                "font-size": "16px",
                color: "#333",
                "font-family": "Arial, sans-serif"

            },

            ".invalid": {

                color: "#dc3545"

            },

            ":focus": {

                color: "#000"

            }

        },

        fields: {

            number: {

                selector: "#card-number",
                placeholder: "4111 1111 1111 1111"

            },

            expirationDate: {

                selector: "#expiration-date",
                placeholder: "MM / YY"

            },

            cvv: {

                selector: "#cvv",
                placeholder: "123"

            }

        }

    });

    console.log("Hosted Fields Ready.");

}

// =====================================================
// Pay Button
// =====================================================

async function processPayment() {

    try {

        setLoading(true);

        const submitResult = await paypalHostedFields.submit({

            cardholderName: student.full_name

        });

        const capture = await captureOrder(

            submitResult.orderId

        );

        alert("Payment Successful!");

        window.location.href =
            `payment-success.html?subscription=${capture.subscriptionId}`;

    }

    catch (error) {

        console.error(error);

        alert(

            error.message ||

            "Payment could not be completed."

        );

    }

    finally {

        setLoading(false);

    }

}

// =====================================================
// Event Listeners
// =====================================================

document.addEventListener("DOMContentLoaded", async () => {

    try {

        if (!verifyLogin()) {

            return;

        }

        await loadSubscriptionPlan();

        await loadStudent();

        await initializeHostedFields();

        const button = document.getElementById("payButton");

        if (button) {

            button.addEventListener(

                "click",

                processPayment

            );

        }

        console.log("Checkout Ready.");

    }

    catch (error) {

        console.error(error);

        alert(error.message);

    }

});