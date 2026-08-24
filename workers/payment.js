// ======================================================
// NURSEPHERE PAYMENT WORKER
// File: workers/payment.js
//
// RESPONSIBILITIES
// - Subscription plan retrieval
// - PayPal Live order creation
// - PayPal Live order capture
// - Payment verification
// - Subscription activation
// - Payment recording
//
// ARCHITECTURE
// - worker.js handles imports, routing and CORS
// - This file handles payment business logic only
// - Customers pay by card through PayPal
// - Customers do NOT need a PayPal account
// ======================================================

import jwt from "@tsndr/cloudflare-worker-jwt";

// ======================================================
// CONSTANTS
// ======================================================

const PAYPAL_CURRENCY = "USD";

// ======================================================
// ERROR CLASS
// ======================================================

class PaymentError extends Error {

    constructor(message, status = 400) {

        super(message);

        this.name = "PaymentError";

        this.status = status;

    }

}

// ======================================================
// MAIN HANDLER
// ======================================================

export default async function paymentHandler(
    request,
    env
) {

    try {

        const url = new URL(request.url);

        const pathname = url.pathname;

        validateEnvironment(env);

        // ==================================================
        // GET ALL SUBSCRIPTION PLANS
        // ==================================================

        if (
            request.method === "GET" &&
            pathname === "/api/subscription-plans"
        ) {

            return await getSubscriptionPlans(env);

        }

        // ==================================================
        // GET SINGLE SUBSCRIPTION PLAN
        // ==================================================

        if (
            request.method === "GET" &&
            pathname.startsWith("/api/subscription-plans/")
        ) {

            return await getSubscriptionPlan(
                pathname,
                env
            );

        }

        // ==================================================
        // CREATE PAYPAL ORDER
        // ==================================================

        if (
            request.method === "POST" &&
            pathname === "/api/payments/create-order"
        ) {

            return await createPayPalOrder(
                request,
                env
            );

        }

        // ==================================================
        // CAPTURE PAYPAL ORDER
        // ==================================================

        if (
            request.method === "POST" &&
            pathname === "/api/payments/capture-order"
        ) {

            return await capturePayPalOrder(
                request,
                env
            );

        }

        // ==================================================
        // NOT FOUND
        // ==================================================

        return json({

            success: false,

            message: "Endpoint not found."

        }, 404);

    }

    catch (error) {

        console.error(
            "Payment worker error:",
            error
        );

        if (
            error instanceof PaymentError
        ) {

            return json({

                success: false,

                message:
                    error.message

            }, error.status);

        }

        return json({

            success: false,

            message:
                "Unable to process payment request."

        }, 500);

    }

}

// ======================================================
// ENVIRONMENT VALIDATION
// ======================================================

function validateEnvironment(env) {

    const required = [

        "DB",
        "JWT_SECRET",
        "PAYPAL_API_BASE",
        "PAYPAL_CLIENT_ID",
        "PAYPAL_CLIENT_SECRET"

    ];

    for (
        const key of required
    ) {

        if (!env[key]) {

            throw new Error(
                `Missing environment binding: ${key}`
            );

        }

    }

}

// ======================================================
// JSON RESPONSE
// ======================================================

function json(
    data,
    status = 200
) {

    return new Response(

        JSON.stringify(data),

        {

            status,

            headers: {

                "Content-Type":
                    "application/json",

                "Cache-Control":
                    "no-store"

            }

        }

    );

}

// ======================================================
// CURRENT TIME
// ======================================================

function now() {

    return new Date().toISOString();

}

// ======================================================
// UNIQUE ID
// ======================================================

function id(prefix) {

    return `${prefix}_${crypto.randomUUID()}`;

}

// ======================================================
// READ JSON
// ======================================================

async function readBody(request) {

    try {

        return await request.json();

    }

    catch {

        throw new PaymentError(
            "Invalid request body.",
            400
        );

    }

}

// ======================================================
// AUTHENTICATE STUDENT
// ======================================================

async function authenticateStudent(
    request,
    env
) {

    const authorization =
        request.headers.get("Authorization");

    if (
        !authorization ||
        !authorization.startsWith("Bearer ")
    ) {

        throw new PaymentError(
            "Authentication required.",
            401
        );

    }

    const token =
        authorization
            .substring(7)
            .trim();

    if (!token) {

        throw new PaymentError(
            "Authentication required.",
            401
        );

    }

    let verified = false;

    try {

        verified =
            await jwt.verify(
                token,
                env.JWT_SECRET
            );

    }

    catch {

        verified = false;

    }

    if (!verified) {

        throw new PaymentError(
            "Invalid or expired session.",
            401
        );

    }

    let decoded;

    try {

        decoded =
            jwt.decode(token);

    }

    catch {

        throw new PaymentError(
            "Invalid authentication token.",
            401
        );

    }

    const payload =
        decoded?.payload || {};

    const studentId =
        payload.studentId ||
        payload.id ||
        payload.sub;

    if (!studentId) {

        throw new PaymentError(
            "Invalid authentication token.",
            401
        );

    }

    const student =
        await env.DB.prepare(`

            SELECT

                id,
                student_number,
                full_name,
                email,
                account_status,

                trial_active,
                trial_used,
                trial_started_at,
                trial_expires_at,

                subscription_status,
                subscription_plan_id,
                subscription_expires_at

            FROM students

            WHERE id = ?

            LIMIT 1

        `)
        .bind(studentId)
        .first();

    if (!student) {

        throw new PaymentError(
            "Student account not found.",
            404
        );

    }

    if (
        student.account_status !== "active"
    ) {

        throw new PaymentError(
            "Student account is inactive.",
            403
        );

    }

    return student;

}

// ======================================================
// GET SUBSCRIPTION PLANS
// ======================================================

async function getSubscriptionPlans(env) {

    const result =
        await env.DB.prepare(`

            SELECT

                id,
                name,
                price,
                duration_days,
                description,
                display_order,
                status,
                currency

            FROM subscription_plans

            WHERE status = 'active'

            ORDER BY
                display_order ASC,
                price ASC

        `)
        .all();

    return json({

        success: true,

        plans:
            result.results || []

    });

}

// ======================================================
// GET SINGLE SUBSCRIPTION PLAN
// ======================================================

async function getSubscriptionPlan(
    pathname,
    env
) {

    const parts =
        pathname.split("/");

    const planId =
        parts[parts.length - 1];

    if (!planId) {

        throw new PaymentError(
            "Subscription plan ID is required.",
            400
        );

    }

    const plan =
        await env.DB.prepare(`

            SELECT

                id,
                name,
                price,
                duration_days,
                description,
                display_order,
                status,
                currency

            FROM subscription_plans

            WHERE id = ?

            LIMIT 1

        `)
        .bind(planId)
        .first();

    if (!plan) {

        throw new PaymentError(
            "Subscription plan not found.",
            404
        );

    }

    if (
        plan.status !== "active"
    ) {

        throw new PaymentError(
            "Subscription plan is unavailable.",
            400
        );

    }

    const features =
        await env.DB.prepare(`

            SELECT

                f.id,
                f.name,
                f.description

            FROM plan_features pf

            INNER JOIN features f

                ON f.id = pf.feature_id

            WHERE pf.plan_id = ?

            ORDER BY f.name ASC

        `)
        .bind(plan.id)
        .all();

    return json({

        success: true,

        plan: {

            id:
                plan.id,

            name:
                plan.name,

            price:
                Number(plan.price),

            duration_days:
                Number(plan.duration_days),

            description:
                plan.description,

            currency:
                plan.currency,

            features:
                features.results || []

        }

    });

}

// ======================================================
// PAYPAL ACCESS TOKEN
// ======================================================

async function getPayPalAccessToken(env) {

    const credentials =
        btoa(
            `${env.PAYPAL_CLIENT_ID}:${env.PAYPAL_CLIENT_SECRET}`
        );

    const response =
        await fetch(

            `${env.PAYPAL_API_BASE}/v1/oauth2/token`,

            {

                method: "POST",

                headers: {

                    "Authorization":
                        `Basic ${credentials}`,

                    "Content-Type":
                        "application/x-www-form-urlencoded",

                    "Accept":
                        "application/json"

                },

                body:
                    "grant_type=client_credentials"

            }

        );

    let data;

    try {

        data =
            await response.json();

    }

    catch {

        throw new Error(
            "Invalid response from PayPal."
        );

    }

    if (
        !response.ok ||
        !data?.access_token
    ) {

        console.error(
            "PayPal authentication failed:",
            {
                status:
                    response.status
            }
        );

        throw new Error(
            "Unable to connect to PayPal."
        );

    }

    return data.access_token;

}

// ======================================================
// LOAD ACTIVE PLAN
// ======================================================

async function loadPlan(
    planId,
    env
) {

    if (
        typeof planId !== "string" ||
        !planId.trim()
    ) {

        throw new PaymentError(
            "Subscription plan is required.",
            400
        );

    }

    const plan =
        await env.DB.prepare(`

            SELECT

                id,
                name,
                price,
                duration_days,
                description,
                currency,
                status

            FROM subscription_plans

            WHERE id = ?

            LIMIT 1

        `)
        .bind(planId.trim())
        .first();

    if (!plan) {

        throw new PaymentError(
            "Subscription plan not found.",
            404
        );

    }

    if (
        plan.status !== "active"
    ) {

        throw new PaymentError(
            "Subscription plan is unavailable.",
            400
        );

    }

    const price =
        Number(plan.price);

    if (
        !Number.isFinite(price) ||
        price <= 0
    ) {

        throw new PaymentError(
            "Subscription plan has an invalid price.",
            500
        );

    }

    if (
        Number(plan.duration_days) <= 0
    ) {

        throw new PaymentError(
            "Subscription plan has an invalid duration.",
            500
        );

    }

    if (
        plan.currency !== PAYPAL_CURRENCY
    ) {

        throw new PaymentError(
            "Subscription plan currency is not supported.",
            400
        );

    }

    return {

        ...plan,

        price

    };

}

// ======================================================
// CHECK EXISTING SUBSCRIPTION
// ======================================================

async function ensureNoActiveSubscription(
    studentId,
    env
) {

    const subscription =
        await env.DB.prepare(`

            SELECT

                id,
                status,
                payment_status

            FROM subscriptions

            WHERE student_id = ?

            AND status IN (
                'pending',
                'active'
            )

            LIMIT 1

        `)
        .bind(studentId)
        .first();

    if (subscription) {

        throw new PaymentError(
            "An active or pending subscription already exists.",
            400
        );

    }

}

// ======================================================
// CREATE PAYPAL ORDER
// ======================================================

async function createPayPalOrder(
    request,
    env
) {

    const student =
        await authenticateStudent(
            request,
            env
        );

    const body =
        await readBody(request);

    const plan =
        await loadPlan(
            body.planId,
            env
        );

    // --------------------------------------------------
    // Trial is NOT part of paid checkout.
    // The dashboard/account system owns trial access.
    // --------------------------------------------------

    await ensureNoActiveSubscription(
        student.id,
        env
    );

    const accessToken =
        await getPayPalAccessToken(env);

    const orderPayload = {

        intent:
            "CAPTURE",

        purchase_units: [

            {

                reference_id:
                    plan.id,

                description:
                    plan.name,

                custom_id:
                    `${student.id}:${plan.id}`,

                amount: {

                    currency_code:
                        PAYPAL_CURRENCY,

                    value:
                        plan.price.toFixed(2)

                }

            }

        ]

    };

    const response =
        await fetch(

            `${env.PAYPAL_API_BASE}/v2/checkout/orders`,

            {

                method: "POST",

                headers: {

                    "Authorization":
                        `Bearer ${accessToken}`,

                    "Content-Type":
                        "application/json",

                    "Accept":
                        "application/json",

                    "Prefer":
                        "return=representation"

                },

                body:
                    JSON.stringify(
                        orderPayload
                    )

            }

        );

    let data;

    try {

        data =
            await response.json();

    }

    catch {

        throw new Error(
            "Invalid response from PayPal."
        );

    }

    if (
        !response.ok ||
        !data?.id
    ) {

        console.error(
            "PayPal order creation failed:",
            {
                status:
                    response.status,

                name:
                    data?.name
            }
        );

        throw new PaymentError(
            "Unable to create payment order.",
            400
        );

    }

    return json({

        success: true,

        orderId:
            data.id

    });

}

// ======================================================
// VERIFY PAYPAL ORDER
// ======================================================

async function verifyPayPalOrder(
    order,
    plan,
    student
) {

    if (
        !order ||
        !order.id
    ) {

        throw new PaymentError(
            "Invalid PayPal order.",
            400
        );

    }

    if (
        order.intent !== "CAPTURE"
    ) {

        throw new PaymentError(
            "Invalid PayPal payment intent.",
            400
        );

    }

    const purchaseUnit =
        order.purchase_units?.[0];

    if (!purchaseUnit) {

        throw new PaymentError(
            "PayPal order contains no purchase information.",
            400
        );

    }

    if (
        purchaseUnit.reference_id !==
        plan.id
    ) {

        throw new PaymentError(
            "Payment does not match the selected plan.",
            400
        );

    }

    if (
        purchaseUnit.custom_id !==
        `${student.id}:${plan.id}`
    ) {

        throw new PaymentError(
            "Payment does not belong to this account.",
            400
        );

    }

    const amount =
        purchaseUnit.amount;

    if (
        !amount
    ) {

        throw new PaymentError(
            "PayPal order amount is missing.",
            400
        );

    }

    if (
        amount.currency_code !==
        PAYPAL_CURRENCY
    ) {

        throw new PaymentError(
            "Payment currency is invalid.",
            400
        );

    }

    const orderAmount =
        Number(amount.value);

    if (
        !Number.isFinite(orderAmount)
    ) {

        throw new PaymentError(
            "Payment amount is invalid.",
            400
        );

    }

    if (
        orderAmount.toFixed(2) !==
        plan.price.toFixed(2)
    ) {

        throw new PaymentError(
            "Payment amount does not match the subscription price.",
            400
        );

    }

}

// ======================================================
// CAPTURE PAYPAL ORDER
// ======================================================

async function capturePayPalOrder(
    request,
    env
) {

    const student =
        await authenticateStudent(
            request,
            env
        );

    const body =
        await readBody(request);

    const orderId =
        typeof body.orderId === "string"
            ? body.orderId.trim()
            : "";

    const planId =
        typeof body.planId === "string"
            ? body.planId.trim()
            : "";

    if (
        !orderId ||
        !planId
    ) {

        throw new PaymentError(
            "Order ID and subscription plan are required.",
            400
        );

    }

    const plan =
        await loadPlan(
            planId,
            env
        );

    // --------------------------------------------------
    // FIRST: check whether this PayPal capture was
    // already processed.
    // --------------------------------------------------

    const existingPayment =
        await env.DB.prepare(`

            SELECT

                id,
                subscription_id,
                payment_status,
                amount,
                currency

            FROM payments

            WHERE gateway_transaction_id = ?

            LIMIT 1

        `)
        .bind(orderId)
        .first();

    // gateway_transaction_id is the PayPal capture ID,
    // not normally the order ID. This check is therefore
    // supplemental. The capture response is checked below.

    // --------------------------------------------------
    // AUTHORIZED PAYPAL API
    // --------------------------------------------------

    const accessToken =
        await getPayPalAccessToken(env);

    // --------------------------------------------------
    // GET ORDER
    // --------------------------------------------------

    const orderResponse =
        await fetch(

            `${env.PAYPAL_API_BASE}/v2/checkout/orders/${encodeURIComponent(orderId)}`,

            {

                method:
                    "GET",

                headers: {

                    "Authorization":
                        `Bearer ${accessToken}`,

                    "Accept":
                        "application/json"

                }

            }

        );

    let order;

    try {

        order =
            await orderResponse.json();

    }

    catch {

        throw new Error(
            "Invalid response from PayPal."
        );

    }

    if (
        !orderResponse.ok
    ) {

        console.error(
            "PayPal order lookup failed:",
            {
                status:
                    orderResponse.status
            }
        );

        throw new PaymentError(
            "Unable to verify payment order.",
            400
        );

    }

    await verifyPayPalOrder(
        order,
        plan,
        student
    );

    // --------------------------------------------------
    // CAPTURE
    // --------------------------------------------------

    const captureResponse =
        await fetch(

            `${env.PAYPAL_API_BASE}/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`,

            {

                method:
                    "POST",

                headers: {

                    "Authorization":
                        `Bearer ${accessToken}`,

                    "Content-Type":
                        "application/json",

                    "Accept":
                        "application/json",

                    "Prefer":
                        "return=representation"

                }

            }

        );

    let capture;

    try {

        capture =
            await captureResponse.json();

    }

    catch {

        throw new Error(
            "Invalid response from PayPal."
        );

    }

    // --------------------------------------------------
    // PAYPAL MAY REPORT ALREADY-CAPTURED
    // --------------------------------------------------

    if (
        !captureResponse.ok
    ) {

        console.error(
            "PayPal capture failed:",
            {
                status:
                    captureResponse.status,

                name:
                    capture?.name
            }
        );

        throw new PaymentError(
            "Payment could not be completed.",
            400
        );

    }

    if (
        capture.status !== "COMPLETED"
    ) {

        throw new PaymentError(
            "Payment was not completed.",
            400
        );

    }

    // --------------------------------------------------
    // CAPTURE RECORD
    // --------------------------------------------------

    const purchaseUnit =
        capture.purchase_units?.[0];

    const captureInfo =
        purchaseUnit
            ?.payments
            ?.captures?.[0];

    if (
        !captureInfo
    ) {

        throw new PaymentError(
            "Unable to verify captured payment.",
            400
        );

    }

    if (
        captureInfo.status !== "COMPLETED"
    ) {

        throw new PaymentError(
            "Payment capture was not completed.",
            400
        );

    }

    if (
        captureInfo.amount?.currency_code !==
        PAYPAL_CURRENCY
    ) {

        throw new PaymentError(
            "Captured payment currency is invalid.",
            400
        );

    }

    const capturedAmount =
        Number(
            captureInfo.amount?.value
        );

    if (
        !Number.isFinite(capturedAmount)
    ) {

        throw new PaymentError(
            "Captured payment amount is invalid.",
            400
        );

    }

    if (
        capturedAmount.toFixed(2) !==
        plan.price.toFixed(2)
    ) {

        throw new PaymentError(
            "Captured payment amount does not match the subscription price.",
            400
        );

    }

    // --------------------------------------------------
    // IDEMPOTENCY CHECK USING PAYPAL CAPTURE ID
    // --------------------------------------------------

    const existingCapture =
        await env.DB.prepare(`

            SELECT

                id,
                subscription_id,
                payment_status

            FROM payments

            WHERE gateway_transaction_id = ?

            LIMIT 1

        `)
        .bind(captureInfo.id)
        .first();

    if (existingCapture) {

        return json({

            success: true,

            message:
                "Payment has already been processed.",

            subscription: {

                id:
                    existingCapture.subscription_id,

                status:
                    "active"

            },

            payment: {

                id:
                    existingCapture.id,

                status:
                    existingCapture.payment_status

            }

        });

    }

    // --------------------------------------------------
    // RECHECK ACCOUNT BEFORE DATABASE WRITE
    // --------------------------------------------------

    await ensureNoActiveSubscription(
        student.id,
        env
    );

    // --------------------------------------------------
    // CREATE SUBSCRIPTION
    // --------------------------------------------------

    const subscriptionId =
        id("sub");

    const paymentId =
        id("pay");

    const timestamp =
        now();

    const endDate =
        new Date(
            Date.now() +
            (
                Number(plan.duration_days) *
                24 *
                60 *
                60 *
                1000
            )
        ).toISOString();

    // --------------------------------------------------
    // CREATE SUBSCRIPTION AS ACTIVE
    // --------------------------------------------------

    await env.DB.prepare(`

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
            ?, ?, ?,
            ?, ?, ?

        )

    `)
    .bind(

        subscriptionId,

        student.id,

        plan.id,

        timestamp,

        endDate,

        "paid",

        "active",

        timestamp,

        timestamp

    )
    .run();

    // --------------------------------------------------
    // CREATE PAYMENT RECORD
    // --------------------------------------------------

    try {

        await env.DB.prepare(`

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

                ?, ?, ?, ?,
                ?, ?, ?, ?,
                ?, ?, ?, ?,
                ?, ?

            )

        `)
        .bind(

            paymentId,

            student.id,

            subscriptionId,

            "paypal",

            captureInfo.id,

            orderId,

            capturedAmount,

            PAYPAL_CURRENCY,

            "card",

            "paid",

            JSON.stringify({

                orderId:
                    orderId,

                captureId:
                    captureInfo.id,

                status:
                    capture.status

            }),

            timestamp,

            timestamp,

            timestamp

        )
        .run();

    }

    catch (error) {

        console.error(
            "Payment record creation failed:",
            error
        );

        // Remove the subscription if payment
        // recording fails.

        try {

            await env.DB.prepare(`

                DELETE FROM subscriptions

                WHERE id = ?

            `)
            .bind(subscriptionId)
            .run();

        }

        catch (rollbackError) {

            console.error(
                "Subscription rollback failed:",
                rollbackError
            );

        }

        throw new Error(
            "Payment was received but could not be recorded. Please contact support."
        );

    }

    // --------------------------------------------------
    // UPDATE STUDENT
    // --------------------------------------------------

    try {

        await env.DB.prepare(`

            UPDATE students

            SET

                subscription_status = ?,

                subscription_plan_id = ?,

                subscription_expires_at = ?,

                updated_at = ?

            WHERE id = ?

        `)
        .bind(

            "active",

            plan.id,

            endDate,

            timestamp,

            student.id

        )
        .run();

    }

    catch (error) {

        console.error(
            "Student subscription update failed:",
            error
        );

        // Roll back local records if the student
        // account could not be updated.

        try {

            await env.DB.prepare(`

                DELETE FROM payments

                WHERE id = ?

            `)
            .bind(paymentId)
            .run();

        }

        catch (rollbackError) {

            console.error(
                "Payment rollback failed:",
                rollbackError
            );

        }

        try {

            await env.DB.prepare(`

                DELETE FROM subscriptions

                WHERE id = ?

            `)
            .bind(subscriptionId)
            .run();

        }

        catch (rollbackError) {

            console.error(
                "Subscription rollback failed:",
                rollbackError
            );

        }

        throw new Error(
            "Payment was received but the subscription could not be activated. Please contact support."
        );

    }

    // --------------------------------------------------
    // SUCCESS
    // --------------------------------------------------

    return json({

        success: true,

        message:
            "Payment completed successfully.",

        subscription: {

            id:
                subscriptionId,

            planId:
                plan.id,

            planName:
                plan.name,

            startDate:
                timestamp,

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
                capturedAmount,

            currency:
                PAYPAL_CURRENCY,

            method:
                "card",

            status:
                "paid"

        }

    });

}