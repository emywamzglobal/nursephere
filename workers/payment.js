// ======================================================
// NurseSphere Payment Worker
// File: workers/payment.js
// Purpose:
// Subscription Plans
// PayPal Advanced Card Processing
// Payments
// Trials
// Subscription Activation
// ======================================================

import jwt from "@tsndr/cloudflare-worker-jwt";

// ======================================================
// MAIN HANDLER
// ======================================================

export default async function paymentHandler(request, env) {

    try {

        const url = new URL(request.url);
        const pathname = url.pathname;

        // -------------------------------------------------
        // Validate Environment
        // -------------------------------------------------

        const required = [

            "DB",
            "JWT_SECRET"

        ];

        for (const key of required) {

            if (!env[key]) {

                throw new Error(

                    `Missing environment binding: ${key}`

                );

            }

        }

        // -------------------------------------------------
        // Subscription Plans
        // -------------------------------------------------

        if (

            request.method === "GET" &&
            pathname === "/api/subscription-plans"

        ) {

            return await getSubscriptionPlans(env);

        }

        if (

            request.method === "GET" &&
            pathname.startsWith("/api/subscription-plans/")

        ) {

            return await getSubscriptionPlan(
                request,
                env
            );

        }

        // -------------------------------------------------
        // Payments
        // -------------------------------------------------

        if (

            request.method === "POST" &&
            pathname === "/api/payments/create-order"

        ) {

            return await createOrder(
                request,
                env
            );

        }

        if (

            request.method === "POST" &&
            pathname === "/api/payments/capture-order"

        ) {

            return await captureOrder(
                request,
                env
            );

        }

        // -------------------------------------------------
        // Unknown Endpoint
        // -------------------------------------------------

        return jsonResponse({

            success: false,

            message:
                "Endpoint not found."

        }, 404);

    }

    catch (error) {

        console.error(

            "Payment Worker:",

            error

        );

        return jsonResponse({

            success: false,

            message:

                error.message ||

                "Internal server error."

        }, 500);

    }

}

// ======================================================
// JSON RESPONSE
// ======================================================

function jsonResponse(data, status = 200) {

    return new Response(

        JSON.stringify(data),

        {

            status,

            headers: {

                "Content-Type":
                    "application/json"

            }

        }

    );

}

// ======================================================
// CURRENT UTC TIME
// ======================================================

function now() {

    return new Date().toISOString();

}

// ======================================================
// GENERATE UNIQUE IDS
// ======================================================

function generateId(prefix) {

    return `${prefix}_${crypto.randomUUID()}`;

}

// ======================================================
// CALCULATE EXPIRY DATE
// ======================================================

function calculateExpiryDate(days) {

    const expiry = new Date();

    expiry.setUTCDate(

        expiry.getUTCDate() +

        Number(days)

    );

    return expiry.toISOString();

}

// ======================================================
// CALCULATE TRIAL EXPIRY
// ======================================================

function calculateTrialExpiry() {

    return calculateExpiryDate(3);

}

// ======================================================
// AUTHENTICATE STUDENT
// ======================================================

async function authenticateStudent(request, env) {

    const authorization =
        request.headers.get("Authorization");

    if (

        !authorization ||

        !authorization.startsWith("Bearer ")

    ) {

        throw new Error(

            "Authentication required."

        );

    }

    const token =
        authorization.substring(7);

    const verified =
        await jwt.verify(

            token,

            env.JWT_SECRET

        );

    if (!verified) {

        throw new Error(

            "Invalid authentication token."

        );

    }

    const decoded =
        jwt.decode(token);

    const studentId =

        decoded.payload.studentId ||

        decoded.payload.id;

    if (!studentId) {

        throw new Error(

            "Invalid authentication payload."

        );

    }

    const student =
        await env.DB.prepare(

            `
            SELECT

                id,
                student_number,
                full_name,
                email,

                account_status,

                trial_used,
                trial_active,
                trial_started_at,
                trial_expires_at,

                subscription_status,
                subscription_plan_id,
                subscription_expires_at

            FROM students

            WHERE id = ?

            LIMIT 1
            `

        )

        .bind(studentId)

        .first();

    if (!student) {

        throw new Error(

            "Student account not found."

        );

    }

    if (student.account_status !== "active") {

        throw new Error(

            "Student account is inactive."

        );

    }

    return student;

}

// ======================================================
// GET ALL SUBSCRIPTION PLANS
// GET /api/subscription-plans
// ======================================================

async function getSubscriptionPlans(env) {

    const plans =
        await env.DB.prepare(

            `
            SELECT

                id,
                name,
                description,
                price,
                duration_days,
                display_order

            FROM subscription_plans

            WHERE status = 'active'

            ORDER BY

                display_order ASC,

                price ASC
            `

        )

        .all();

    return jsonResponse({

        success: true,

        plans:

            plans.results || []

    });

}

// ======================================================
// GET SUBSCRIPTION PLAN
// GET /api/subscription-plans/:id
// ======================================================

async function getSubscriptionPlan(request, env) {

    const url =
        new URL(request.url);

    const segments =
        url.pathname.split("/");

    const planId =
        segments[segments.length - 1];

    if (!planId) {

        return jsonResponse({

            success: false,

            message:
                "Subscription plan ID is required."

        }, 400);

    }

    const plan =
        await env.DB.prepare(

            `
            SELECT

                id,
                name,
                description,
                price,
                duration_days,
                status

            FROM subscription_plans

            WHERE id = ?

            LIMIT 1
            `

        )

        .bind(planId)

        .first();

    if (!plan) {

        return jsonResponse({

            success: false,

            message:
                "Subscription plan not found."

        }, 404);

    }

    if (plan.status !== "active") {

        return jsonResponse({

            success: false,

            message:
                "Subscription plan is unavailable."

        }, 400);

    }

    const features =
        await env.DB.prepare(

            `
            SELECT

                f.id,
                f.name,
                f.description

            FROM plan_features pf

            INNER JOIN features f

                ON pf.feature_id = f.id

            WHERE pf.plan_id = ?

            ORDER BY f.name ASC
            `

        )

        .bind(plan.id)

        .all();

    return jsonResponse({

        success: true,

        plan: {

            id:
                plan.id,

            name:
                plan.name,

            description:
                plan.description,

            price:
                Number(plan.price),

            duration_days:
                plan.duration_days,

            features:
                features.results || []

        }

    });

}

// ======================================================
// GET PAYPAL ACCESS TOKEN
// ======================================================

async function getPayPalAccessToken(env) {

    if (

        !env.PAYPAL_CLIENT_ID ||
        !env.PAYPAL_CLIENT_SECRET ||
        !env.PAYPAL_API_BASE

    ) {

        throw new Error(

            "PayPal environment variables are missing."

        );

    }

    const credentials = btoa(

        `${env.PAYPAL_CLIENT_ID}:${env.PAYPAL_CLIENT_SECRET}`

    );

    const response = await fetch(

        `${env.PAYPAL_API_BASE}/v1/oauth2/token`,

        {

            method: "POST",

            headers: {

                Authorization: `Basic ${credentials}`,

                "Content-Type":
                    "application/x-www-form-urlencoded"

            },

            body: "grant_type=client_credentials"

        }

    );

    const data = await response.json();

    if (

        !response.ok ||

        !data.access_token

    ) {

        throw new Error(

            "Unable to obtain PayPal access token."

        );

    }

    return data.access_token;

}

// ======================================================
// CREATE PAYPAL ORDER
// POST /api/payments/create-order
// ======================================================

async function createOrder(request, env) {

    const student =
        await authenticateStudent(
            request,
            env
        );

    const body =
        await request.json();

    const {

        planId,

        useTrial = false

    } = body;

    if (!planId) {

        return jsonResponse({

            success: false,

            message:
                "Subscription plan is required."

        }, 400);

    }

    const plan =
        await env.DB.prepare(

            `
            SELECT

                id,
                name,
                price,
                duration_days,
                status

            FROM subscription_plans

            WHERE id = ?

            LIMIT 1
            `

        )

        .bind(planId)

        .first();

    if (!plan) {

        return jsonResponse({

            success: false,

            message:
                "Subscription plan not found."

        }, 404);

    }

    if (plan.status !== "active") {

        return jsonResponse({

            success: false,

            message:
                "Selected subscription plan is unavailable."

        }, 400);

    }

    if (

        useTrial &&

        student.trial_used

    ) {

        return jsonResponse({

            success: false,

            message:
                "Free trial has already been used."

        }, 400);

    }

    const existingSubscription =
        await env.DB.prepare(

            `
            SELECT id

            FROM subscriptions

            WHERE student_id = ?

            AND status IN ('active','pending')

            LIMIT 1
            `

        )

        .bind(student.id)

        .first();

    if (existingSubscription) {

        return jsonResponse({

            success: false,

            message:
                "An active subscription already exists."

        }, 400);

    }

    const accessToken =
        await getPayPalAccessToken(env);

    const amount =
        Number(plan.price).toFixed(2);

    const orderResponse =
        await fetch(

            `${env.PAYPAL_API_BASE}/v2/checkout/orders`,

            {
                method: "POST",

                headers: {

                    Authorization:
                        `Bearer ${accessToken}`,

                    "Content-Type":
                        "application/json"

                },

                body: JSON.stringify({

                    intent: "CAPTURE",

                    purchase_units: [

                        {

                            reference_id:
                                plan.id,

                            description:
                                plan.name,

                            amount: {

                                currency_code: "USD",

                                value: amount

                            }

                        }

                    ]

                })

            }

        );

    const order =
        await orderResponse.json();

        
    if (

        !orderResponse.ok ||

        !order.id

    ) {

        console.error(

            "PayPal Order Error:",

            order

        );

        return jsonResponse({

            success: false,

            message:
                "Unable to create PayPal order."

        }, 500);

    }

    return jsonResponse({

        success: true,

        orderId:
            order.id,

        plan: {

            id:
                plan.id,

            name:
                plan.name,

            price:
                Number(plan.price),

            duration_days:
                plan.duration_days

        },

        trial: {

            enabled:
                Boolean(useTrial)

        }

    });

}

// ======================================================
// CAPTURE PAYPAL ORDER
// POST /api/payments/capture-order
// ======================================================

async function captureOrder(request, env) {

    const student =
        await authenticateStudent(
            request,
            env
        );

    const body =
        await request.json();

    const {

        orderId,

        planId,

        useTrial = false

    } = body;

    if (!orderId || !planId) {

        return jsonResponse({

            success: false,

            message:
                "Order ID and subscription plan are required."

        }, 400);

    }

    const plan =
        await env.DB.prepare(

            `
            SELECT

                id,
                name,
                price,
                duration_days,
                status

            FROM subscription_plans

            WHERE id = ?

            LIMIT 1
            `

        )

        .bind(planId)

        .first();

    if (!plan) {

        return jsonResponse({

            success: false,

            message:
                "Subscription plan not found."

        }, 404);

    }

    if (plan.status !== "active") {

        return jsonResponse({

            success: false,

            message:
                "Selected subscription plan is unavailable."

        }, 400);

    }

    const accessToken =
        await getPayPalAccessToken(env);

    const captureResponse =
        await fetch(

            `${env.PAYPAL_API_BASE}/v2/checkout/orders/${orderId}/capture`,

            {

                method: "POST",

                headers: {

                    Authorization:
                        `Bearer ${accessToken}`,

                    "Content-Type":
                        "application/json"

                }

            }

        );

    const capture =
        await captureResponse.json();

    if (

        !captureResponse.ok ||

        capture.status !== "COMPLETED"

    ) {

        console.error(

            "PayPal Capture Error:",

            capture

        );

        return jsonResponse({

            success: false,

            message:
                "Payment capture failed."

        }, 400);

    }

    const captureInfo =
        capture.purchase_units?.[0]
            ?.payments?.captures?.[0];

    if (!captureInfo) {

        return jsonResponse({

            success: false,

            message:
                "Unable to verify captured payment."

        }, 400);

    }

    const expectedAmount =
        Number(plan.price).toFixed(2);

    if (

        Number(captureInfo.amount.value).toFixed(2) !==

        expectedAmount

    ) {

        return jsonResponse({

            success: false,

            message:
                "Captured amount does not match subscription price."

        }, 400);

    }

    const existingSubscription =
        await env.DB.prepare(

            `
            SELECT id

            FROM subscriptions

            WHERE student_id = ?

            AND status = 'active'

            LIMIT 1
            `

        )

        .bind(student.id)

        .first();

    if (existingSubscription) {

        return jsonResponse({

            success: false,

            message:
                "Student already has an active subscription."

        }, 400);

    }    const subscriptionId =
        generateId("sub");

    const paymentId =
        generateId("pay");

    const currentTime =
        now();

    const startDate =
        currentTime;

    const endDate =
        calculateExpiryDate(
            plan.duration_days
        );

    let trialUsed =
        student.trial_used;

    let trialActive =
        student.trial_active;

    let trialStartedAt =
        student.trial_started_at;

    let trialExpiresAt =
        student.trial_expires_at;

    if (useTrial) {

        trialUsed = 1;

        trialActive = 1;

        trialStartedAt =
            currentTime;

        trialExpiresAt =
            calculateTrialExpiry();

    }

    await env.DB.prepare(

        `
        INSERT INTO subscriptions (

            id,
            student_id,
            plan_id,

            start_date,
            end_date,

            payment_status,
            status,

            created_at,
            updated_at

        )

        VALUES (

            ?, ?, ?,
            ?, ?,
            ?, ?,
            ?, ?

        )
        `

    )

    .bind(

        subscriptionId,

        student.id,

        plan.id,

        startDate,

        endDate,

        "paid",

        "active",

        currentTime,

        currentTime

    )

    .run();

    await env.DB.prepare(

        `
        INSERT INTO payments (

            id,

            student_id,

            subscription_id,

            gateway,

            gateway_transaction_id,

            transaction_reference,

            amount,

            currency,

            payment_method,

            payment_status,

            gateway_response,

            paid_at,

            created_at,

            updated_at

        )

        VALUES (

            ?, ?, ?,

            ?, ?, ?,

            ?, ?, ?,

            ?, ?, ?, ?, ?

        )
        `

    )

    .bind(

        paymentId,

        student.id,

        subscriptionId,

        "paypal",

        captureInfo.id,

        orderId,

        Number(captureInfo.amount.value),

        captureInfo.amount.currency_code,

        "card",

        "paid",

        JSON.stringify(capture),

        currentTime,

        currentTime,

        currentTime

    )

    .run();

        await env.DB.prepare(

        `
        UPDATE students

        SET

            subscription_status = ?,

            subscription_plan_id = ?,

            subscription_expires_at = ?,

            trial_used = ?,

            trial_active = ?,

            trial_started_at = ?,

            trial_expires_at = ?,

            updated_at = ?

        WHERE id = ?
        `

    )

    .bind(

        "active",

        plan.id,

        endDate,

        trialUsed,

        trialActive,

        trialStartedAt,

        trialExpiresAt,

        currentTime,

        student.id

    )

    .run();

    return jsonResponse({

        success: true,

        message:
            "Subscription activated successfully.",

        subscription: {

            id:
                subscriptionId,

            planId:
                plan.id,

            planName:
                plan.name,

            startDate,

            endDate,

            status:
                "active"

        },

        payment: {

            id:
                paymentId,

            gateway:
                "paypal",

            transactionId:
                captureInfo.id,

            orderId,

            amount:
                Number(captureInfo.amount.value),

            currency:
                captureInfo.amount.currency_code,

            status:
                "paid"

        },

        trial: {

            enabled:
                Boolean(useTrial),

            used:
                Boolean(trialUsed),

            active:
                Boolean(trialActive),

            startedAt:
                trialStartedAt,

            expiresAt:
                trialExpiresAt

        }

    });

}