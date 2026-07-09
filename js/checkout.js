// =========================================
// Nursephere Checkout
// =========================================

// Read URL parameter

const params = new URLSearchParams(window.location.search);

const plan = params.get("plan");

// HTML Elements

const planName = document.getElementById("planName");
const planDuration = document.getElementById("planDuration");
const planPrice = document.getElementById("planPrice");
const totalPrice = document.getElementById("totalPrice");

// Plan Configuration

const plans = {

    monthly: {

        name: "Monthly Plan",

        duration: "1 Month Subscription",

        price: "$59.99"

    },

    "90day": {

        name: "90-Day Plan",

        duration: "90 Days Subscription",

        price: "$149.99"

    },

    yearly: {

        name: "Yearly Plan",

        duration: "1 Year Subscription",

        price: "$499.99"

    }

};

// Invalid Plan

if (!plan || !plans[plan]) {

    alert("Please select a subscription plan first.");

    window.location.href = "pricing.html";

}

// Populate Checkout

else {

    planName.textContent = plans[plan].name;

    planDuration.textContent = plans[plan].duration;

    planPrice.textContent = plans[plan].price;

    totalPrice.textContent = plans[plan].price;

}

// Form Submission

document
.getElementById("checkoutForm")
.addEventListener("submit", function (e) {

    e.preventDefault();

    alert("Secure payment gateway will be connected here.");

});