/******************************************************************************
 * NurseSphere
 * pricing.js
 ******************************************************************************/

/* ==========================================================================
   Configuration
   ========================================================================== */

const API_BASE = "https://nursephere.wamalwaemily.workers.dev/api";


/* ==========================================================================
   Cached DOM Elements
   ========================================================================== */

const pricingGrid = document.getElementById("pricingGrid");


/* ==========================================================================
   Application State
   ========================================================================== */

let subscriptionPlans = [];


/* ==========================================================================
   Helper Functions
   ========================================================================== */

function formatCurrency(amount) {

    return new Intl.NumberFormat("en-US", {

        style: "currency",

        currency: "USD",

        minimumFractionDigits: 2

    }).format(Number(amount));

}


function getDurationLabel(days) {

    const value = Number(days);

    if (value === 30) {

        return "Billed Monthly";

    }

    if (value === 90) {

        return "Billed Every 90 Days";

    }

    if (value === 365) {

        return "Billed Annually";

    }

    return `${value} Days`;

}


function escapeHtml(value) {

    const div = document.createElement("div");

    div.textContent = value ?? "";

    return div.innerHTML;

}


/* ==========================================================================
   UI Helpers
   ========================================================================== */

function showLoadingState() {

    pricingGrid.innerHTML = `

        <div class="pricing-loading">

            <h3>

                Loading subscription plans...

            </h3>

        </div>

    `;

}


function showErrorState(message) {

    pricingGrid.innerHTML = `

        <div class="pricing-error">

            <h3>

                Unable to load subscription plans

            </h3>

            <p>

                ${escapeHtml(message)}

            </p>

        </div>

    `;

}


/* ==========================================================================
   API Request
   ========================================================================== */

async function apiRequest(endpoint, options = {}) {

    const response = await fetch(

        `${API_BASE}${endpoint}`,

        {

            headers: {

                "Content-Type": "application/json"

            },

            ...options

        }

    );

    const result = await response.json();

    if (!response.ok) {

        throw new Error(

            result.message ||

            "Request failed."

        );

    }

    return result;

}

/* ==========================================================================
   Load Subscription Plans
   ========================================================================== */

async function loadSubscriptionPlans() {

    try {

        showLoadingState();

        const result = await apiRequest(

            "/subscription-plans"

        );

        subscriptionPlans = result.plans || [];

        renderPricingCards();

    }

    catch (error) {

        console.error(error);

        showErrorState(error.message);

    }

}


/* ==========================================================================
   Render Pricing Cards
   ========================================================================== */

function renderPricingCards() {

    if (!subscriptionPlans.length) {

        pricingGrid.innerHTML = `

            <div class="pricing-empty">

                <h3>

                    No subscription plans available.

                </h3>

            </div>

        `;

        return;

    }

    pricingGrid.innerHTML = subscriptionPlans.map(plan => {

        const badge = plan.featured
            ? `
                <div class="pricing-badge">

                    Most Popular

                </div>
              `
            : "";

        const features = Array.isArray(plan.features)

            ? plan.features.map(feature => `

                    <li>

                        <i class="fas fa-check"></i>

                        ${escapeHtml(feature)}

                    </li>

                `).join("")

            : "";

        return `

            <div class="pricing-card ${plan.featured ? "featured" : ""}">

                ${badge}

                <h3>

                    ${escapeHtml(plan.name)}

                </h3>

                <div class="price">

                    ${formatCurrency(plan.price)}

                </div>

                <p class="billing-cycle">

                    ${getDurationLabel(plan.duration_days)}

                </p>

                <p class="plan-description">

                    ${escapeHtml(plan.description)}

                </p>

                <ul class="plan-features">

                    ${features}

                </ul>

                <button

                    class="btn-primary choose-plan-btn"

                    data-plan-id="${escapeHtml(plan.id)}">

                    Choose Plan

                </button>

            </div>

        `;

    }).join("");

}

/* ==========================================================================
   Handle Plan Selection
   ========================================================================== */

function handlePlanSelection(event) {

    const button = event.target.closest(".choose-plan-btn");

    if (!button) {

        return;

    }

    const planId = button.dataset.planId;

    if (!planId) {

        alert("Invalid subscription plan.");

        return;

    }

    window.location.href =
        `checkout.html?plan=${encodeURIComponent(planId)}`;

}


/* ==========================================================================
   Initialize Pricing Page
   ========================================================================== */

async function initializePricingPage() {

    pricingGrid.addEventListener(

        "click",

        handlePlanSelection

    );

    await loadSubscriptionPlans();

}


/* ==========================================================================
   DOM Ready
   ========================================================================== */

document.addEventListener(

    "DOMContentLoaded",

    initializePricingPage

);