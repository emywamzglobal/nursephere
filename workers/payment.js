// ======================================================
// NurseSphere Payment Worker
// File: workers/payment.js
// Purpose:
// Secure PayPal Hosted Fields Checkout
// ======================================================

import jwt from "@tsndr/cloudflare-worker-jwt";

// ======================================================
// MAIN PAYMENT HANDLER
// ======================================================

export default async function paymentHandler(request, env) {

    try {

        const url = new URL(request.url);

        // --------------------------------------------------
        // Validate Required Environment Variables
        // --------------------------------------------------

        if (

            !env.JWT_SECRET ||
            !env.PAYPAL_CLIENT_ID ||
            !env.PAYPAL_CLIENT_SECRET ||
            !env.PAYPAL_API_BASE

        ) {

            return jsonResponse(

                {

                    success: false,

                    message:
                        "Payment service is not configured."

                },

                500

            );

        }

        // --------------------------------------------------
        // Create PayPal Order
        // --------------------------------------------------

        if (

            request.method === "POST" &&
            url.pathname === "/api/payments/create-order"

        ) {

            return await createOrder(request, env);

        }

        // --------------------------------------------------
        // Capture PayPal Order
        // --------------------------------------------------

        if (

            request.method === "POST" &&
            url.pathname === "/api/payments/capture-order"

        ) {

            return await captureOrder(request, env);

        }

        // --------------------------------------------------
        // Unknown Route
        // --------------------------------------------------

        return jsonResponse(

            {

                success: false,

                message:
                    "Payment endpoint not found."

            },

            404

        );

    }

    catch (error) {

        console.error(

            "Payment Worker:",

            error

        );

        return jsonResponse(

            {

                success: false,

                message:
                    error.message || "Internal server error."

            },

            500

        );

    }

}

// ======================================================
// JSON RESPONSE
// ======================================================

function jsonResponse(data, status = 200) {

    return Response.json(

        data,

        {

            status

        }

    );

}

// ======================================================
// CURRENT UTC DATE
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
// CALCULATE SUBSCRIPTION EXPIRY
// ======================================================

function calculateExpiryDate(durationDays) {

    const expiry = new Date();

    expiry.setUTCDate(

        expiry.getUTCDate() +

        Number(durationDays)

    );

    return expiry.toISOString();

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

    const verified = await jwt.verify(

        token,

        env.JWT_SECRET

    );

    if (!verified) {

        throw new Error(

            "Invalid authentication token."

        );

    }

    const payload = jwt.decode(token);

    const studentId =

        payload.payload.studentId ||

        payload.payload.id;

    if (!studentId) {

        throw new Error(

            "Student ID missing from token."

        );

    }

    const student = await env.DB.prepare(

        `
        SELECT

            id,
            full_name,
            email,
            subscription_status,
            trial_active,
            trial_started_at,
            trial_expires_at

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

    return student;

}

// ======================================================
// PAYPAL ACCESS TOKEN
// ======================================================

async function getPayPalAccessToken(env) {

    const credentials = btoa(

        `${env.PAYPAL_CLIENT_ID}:${env.PAYPAL_CLIENT_SECRET}`

    );

    const response = await fetch(

        `${env.PAYPAL_API_BASE}/v1/oauth2/token`,

        {

            method: "POST",

            headers: {

                Authorization:

                    `Basic ${credentials}`,

                "Content-Type":

                    "application/x-www-form-urlencoded"

            },

            body:

                "grant_type=client_credentials"

        }

    );

    const data = await response.json();

    if (!response.ok) {

        throw new Error(

            data.error_description ||

            "Unable to authenticate with PayPal."

        );

    }

    return data.access_token;

}

// ======================================================
// CREATE PAYPAL ORDER
// POST /api/payments/create-order
// ======================================================

async function createOrder(request, env) {

    // --------------------------------------------------
    // Authenticate Student
    // --------------------------------------------------

    const student = await authenticateStudent(

        request,

        env

    );

    // --------------------------------------------------
    // Read Request
    // --------------------------------------------------

    const body = await request.json();

    const planId = body.planId;

    if (!planId) {

        return jsonResponse(

            {

                success: false,

                message: "Subscription plan is required."

            },

            400

        );

    }

    // --------------------------------------------------
    // Load Subscription Plan
    // --------------------------------------------------

    const plan = await env.DB.prepare(

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

        return jsonResponse(

            {

                success: false,

                message: "Subscription plan not found."

            },

            404

        );

    }

    if (plan.status !== "active") {

        return jsonResponse(

            {

                success: false,

                message:
                    "This subscription plan is unavailable."

            },

            400

        );

    }

    // --------------------------------------------------
    // Prevent Duplicate Active Subscription
    // --------------------------------------------------

    const activeSubscription = await env.DB.prepare(

        `
        SELECT id

        FROM subscriptions

        WHERE

            student_id = ?

        AND

            status = 'active'

        LIMIT 1
        `

    )

    .bind(student.id)

    .first();

    if (activeSubscription) {

        return jsonResponse(

            {

                success: false,

                message:
                    "Student already has an active subscription."

            },

            409

        );

    }

    // --------------------------------------------------
    // Authenticate With PayPal
    // --------------------------------------------------

    const accessToken =

        await getPayPalAccessToken(env);

    // --------------------------------------------------
    // Create PayPal Order
    // --------------------------------------------------

    const paypalResponse = await fetch(

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

                            value:

                                Number(plan.price).toFixed(2)

                        }

                    }

                ]

            })

        }

    );

    const paypalOrder =

        await paypalResponse.json();

    if (!paypalResponse.ok) {

        console.error(paypalOrder);

        return jsonResponse(

            {

                success: false,

                message:
                    "Unable to create PayPal order."

            },

            500

        );

    }

    // --------------------------------------------------
    // Success
    // --------------------------------------------------

    return jsonResponse(

        {

            success: true,

            orderId: paypalOrder.id,

            plan: {

                id: plan.id,

                name: plan.name,

                description: plan.description,

                duration_days: plan.duration_days,

                price: plan.price

            }

        }

    );

}

// ======================================================
// CAPTURE PAYPAL ORDER
// POST /api/payments/capture-order
// ======================================================

async function captureOrder(request, env) {

    // --------------------------------------------------
    // Authenticate Student
    // --------------------------------------------------

    const student = await authenticateStudent(
        request,
        env
    );

    // --------------------------------------------------
    // Read Request
    // --------------------------------------------------

    const { orderId } = await request.json();

    if (!orderId) {

        return jsonResponse({

            success: false,

            message: "Order ID is required."

        }, 400);

    }

    // --------------------------------------------------
    // Authenticate With PayPal
    // --------------------------------------------------

    const accessToken =
        await getPayPalAccessToken(env);

    // --------------------------------------------------
    // Capture PayPal Order
    // --------------------------------------------------

    const response = await fetch(

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
        await response.json();

    if (!response.ok) {

        console.error(capture);

        return jsonResponse({

            success: false,

            message:
                "Unable to capture payment."

        }, 400);

    }

    if (capture.status !== "COMPLETED") {

        return jsonResponse({

            success: false,

            message:
                "Payment was not completed."

        }, 400);

    }

    // --------------------------------------------------
    // Extract PayPal Data
    // --------------------------------------------------

    const purchaseUnit =
        capture.purchase_units[0];

    const captureInfo =
        purchaseUnit.payments.captures[0];

    const planId =
        purchaseUnit.reference_id;

    // --------------------------------------------------
    // Prevent Duplicate Processing
    // --------------------------------------------------

    const existingPayment = await env.DB.prepare(

        `
        SELECT id

        FROM payments

        WHERE gateway_transaction_id = ?

        LIMIT 1
        `

    )

    .bind(captureInfo.id)

    .first();

    if (existingPayment) {

        return jsonResponse({

            success: false,

            message:
                "This payment has already been processed."

        }, 409);

    }

    // --------------------------------------------------
    // Load Subscription Plan
    // --------------------------------------------------

    const plan = await env.DB.prepare(

        `
        SELECT

            id,
            name,
            price,
            duration_days

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

    // --------------------------------------------------
    // Verify Amount
    // --------------------------------------------------

    const capturedAmount =
        Number(captureInfo.amount.value);

    if (

        capturedAmount !==

        Number(plan.price)

    ) {

        return jsonResponse({

            success: false,

            message:
                "Captured payment amount does not match subscription price."

        }, 400);

    }

    // --------------------------------------------------
    // Create Subscription
    // --------------------------------------------------

    const subscriptionId =
        generateId("sub");

    const paymentId =
        generateId("pay");

    const startDate =
        now();

    const endDate =
        calculateExpiryDate(
            plan.duration_days
        );

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

            ?,?,?,?,?,?,?,?,?

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

        startDate,

        startDate

    )

    .run();

    // --------------------------------------------------
    // Create Payment
    // --------------------------------------------------

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

            ?,?,?,?,?,?,?,?,?,?,?,?,?,?

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

        capturedAmount,

        captureInfo.amount.currency_code,

        "card",

        "paid",

        JSON.stringify(capture),

        startDate,

        startDate,

        startDate

    )

    .run();

    // --------------------------------------------------
    // Update Student
    // --------------------------------------------------

    let subscriptionStatus = "monthly";

    if (plan.duration_days >= 365) {

        subscriptionStatus = "yearly";

    } else if (plan.duration_days >= 90) {

        subscriptionStatus = "90day";

    }

    await env.DB.prepare(

        `
        UPDATE students

        SET

            subscription_status = ?,
            subscription_started_at = ?,
            subscription_expires_at = ?,

            trial_active = 0,
            trial_started_at = NULL,
            trial_expires_at = NULL,

            updated_at = ?

        WHERE id = ?
        `

    )

    .bind(

        subscriptionStatus,

        startDate,

        endDate,

        now(),

        student.id

    )

    .run();

    // --------------------------------------------------
    // Success
    // --------------------------------------------------

    return jsonResponse({

        success: true,

        message:
            "Subscription activated successfully.",

        payment: {

            id: paymentId,

            gateway: "paypal",

            transaction:
                captureInfo.id,

            amount:
                capturedAmount,

            currency:
                captureInfo.amount.currency_code,

            paid_at:
                startDate

        },

        subscription: {

            id:
                subscriptionId,

            plan:
                plan.name,

            starts_at:
                startDate,

            expires_at:
                endDate

        }

    });

}