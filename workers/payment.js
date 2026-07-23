// ======================================================
// NurseSphere Payment Worker
// File: workers/payment.js
// PayPal Advanced Checkout (Hosted Fields)
// ======================================================

export default async function paymentHandler(request, env) {

    try {

        const url = new URL(request.url);
        const pathname = url.pathname;

        // =====================================================
        // ENVIRONMENT VALIDATION
        // =====================================================

        if (!env.PAYPAL_CLIENT_ID || !env.PAYPAL_CLIENT_SECRET) {

            return Response.json({

                success: false,

                message: "PayPal credentials are not configured."

            }, {

                status: 500

            });

        }

        // =====================================================
        // JSON RESPONSE HELPER
        // =====================================================

        const jsonResponse = (data, status = 200) =>

            Response.json(data, { status });

        // =====================================================
        // GENERATE UNIQUE IDS
        // =====================================================

        const generateId = (prefix) => {

            return `${prefix}_${crypto.randomUUID()}`;

        };

        // =====================================================
        // CURRENT UTC DATE/TIME
        // =====================================================

        const now = () => new Date().toISOString();

        // =====================================================
        // CALCULATE SUBSCRIPTION EXPIRY
        // =====================================================

        const calculateExpiryDate = (durationDays) => {

            const expiry = new Date();

            expiry.setUTCDate(expiry.getUTCDate() + Number(durationDays));

            return expiry.toISOString();

        };

        // =====================================================
        // GET PAYPAL ACCESS TOKEN
        // =====================================================

        async function getPayPalAccessToken() {

            const credentials = btoa(

                `${env.PAYPAL_CLIENT_ID}:${env.PAYPAL_CLIENT_SECRET}`

            );

            const response = await fetch(

                `${env.PAYPAL_API_BASE}/v1/oauth2/token`,

                {

                    method: "POST",

                    headers: {

                        Authorization: `Basic ${credentials}`,

                        "Content-Type": "application/x-www-form-urlencoded"

                    },

                    body: "grant_type=client_credentials"

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

        // =====================================================
        // NEXT SECTION BELOW
        // =====================================================

                // =====================================================
        // CREATE PAYPAL ORDER
        // POST /api/payments/create-order
        // =====================================================

        if (

            request.method === "POST" &&
            pathname === "/api/payments/create-order"

        ) {

            const {

                studentId,
                planId

            } = await request.json();

            if (!studentId || !planId) {

                return jsonResponse({

                    success: false,

                    message: "Student ID and Plan ID are required."

                }, 400);

            }

                        // =================================================
            // VERIFY STUDENT
            // =================================================

            const student = await env.DB.prepare(

                `
                SELECT

                    id,
                    full_name,
                    email,
                    subscription_status,
                    subscription_started_at,
                    subscription_expires_at

                FROM students

                WHERE id = ?
                `

            )

            .bind(studentId)

            .first();

            if (!student) {

                return jsonResponse({

                    success: false,

                    message: "Student not found."

                }, 404);

            }

            // =================================================
            // VERIFY PLAN
            // =================================================

            const plan = await env.DB.prepare(

                `
                SELECT

                    id,
                    name,
                    price,
                    duration_days,
                    status

                FROM subscription_plans

                WHERE id = ?
                `

            )

            .bind(planId)

            .first();

            if (!plan) {

                return jsonResponse({

                    success: false,

                    message: "Subscription plan not found."

                }, 404);

            }

            if (plan.status !== "active") {

                return jsonResponse({

                    success: false,

                    message: "This subscription plan is unavailable."

                }, 400);

            }

            // =================================================
            // CHECK FOR EXISTING ACTIVE SUBSCRIPTION
            // =================================================

            const existingSubscription = await env.DB.prepare(

                `
                SELECT id

                FROM subscriptions

                WHERE student_id = ?
                AND status = 'active'

                LIMIT 1
                `

            )

            .bind(studentId)

            .first();

            if (existingSubscription) {

                return jsonResponse({

                    success: false,

                    message: "Student already has an active subscription."

                }, 409);

            }

            // =================================================
            // CREATE PAYPAL ORDER
            // =================================================

            const accessToken = await getPayPalAccessToken();

            const paypalResponse = await fetch(

                `${env.PAYPAL_API_BASE}/v2/checkout/orders`,

                {

                    method: "POST",

                    headers: {

                        Authorization: `Bearer ${accessToken}`,

                        "Content-Type": "application/json"

                    },

                    body: JSON.stringify({

                        intent: "CAPTURE",

                        purchase_units: [

                            {

                                reference_id: plan.id,

                                description: plan.name,

                                amount: {

                                    currency_code: "USD",

                                    value: plan.price.toFixed(2)

                                }

                            }

                        ]

                    })

                }

            );

            const order = await paypalResponse.json();

            if (!paypalResponse.ok) {

                return jsonResponse({

                    success: false,

                    message: "Unable to create PayPal order.",

                    paypal: order

                }, 500);

            }

            return jsonResponse({

                success: true,

                orderId: order.id,

                student: {

                    id: student.id,

                    name: student.full_name,

                    email: student.email

                },

                plan: {

                    id: plan.id,

                    name: plan.name,

                    price: plan.price,

                    duration_days: plan.duration_days

                }

            });

        }

        // =====================================================
        // NEXT SECTION BELOW
        // =====================================================

                // =====================================================
        // CAPTURE PAYPAL PAYMENT
        // POST /api/payments/capture-order
        // =====================================================

        if (

            request.method === "POST" &&
            pathname === "/api/payments/capture-order"

        ) {

            const {

                orderId,
                studentId,
                planId

            } = await request.json();

            if (!orderId || !studentId || !planId) {

                return jsonResponse({

                    success: false,

                    message: "Order ID, Student ID and Plan ID are required."

                }, 400);

            }

            // =================================================
            // GET PAYPAL ACCESS TOKEN
            // =================================================

            const accessToken = await getPayPalAccessToken();

            // =================================================
            // CAPTURE ORDER
            // =================================================

            const captureResponse = await fetch(

                `${env.PAYPAL_API_BASE}/v2/checkout/orders/${orderId}/capture`,

                {

                    method: "POST",

                    headers: {

                        Authorization: `Bearer ${accessToken}`,

                        "Content-Type": "application/json"

                    }

                }

            );

            const capture = await captureResponse.json();

            if (!captureResponse.ok) {

                return jsonResponse({

                    success: false,

                    message: "Payment capture failed.",

                    paypal: capture

                }, 400);

            }

            if (capture.status !== "COMPLETED") {

                return jsonResponse({

                    success: false,

                    message: "Payment has not been completed."

                }, 400);

            }

            // =================================================
            // LOAD PLAN
            // =================================================

            const plan = await env.DB.prepare(

                `
                SELECT

                    id,
                    price,
                    duration_days

                FROM subscription_plans

                WHERE id = ?
                `

            )

            .bind(planId)

            .first();

            if (!plan) {

                return jsonResponse({

                    success: false,

                    message: "Subscription plan not found."

                }, 404);

            }

            // =================================================
            // CREATE SUBSCRIPTION
            // =================================================

            const subscriptionId = generateId("sub");

            const startDate = now();

            const endDate = calculateExpiryDate(plan.duration_days);

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

                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                `

            )

            .bind(

                subscriptionId,
                studentId,
                plan.id,
                startDate,
                endDate,
                "paid",
                "active",
                startDate,
                startDate

            )

            .run();

            // =================================================
            // CREATE PAYMENT RECORD
            // =================================================

            const paymentId = generateId("pay");

            const captureInfo = capture.purchase_units[0].payments.captures[0];

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

                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `

            )

            .bind(

                paymentId,

                studentId,

                subscriptionId,

                "paypal",

                captureInfo.id,

                orderId,

                Number(captureInfo.amount.value),

                captureInfo.amount.currency_code,

                "card",

                "paid",

                JSON.stringify(capture),

                now(),

                now(),

                now()

            )

            .run();

            // =================================================
            // UPDATE STUDENT
            // =================================================

            await env.DB.prepare(

                `
                UPDATE students

                SET

                    subscription_status = ?,
                    updated_at = ?

                WHERE id = ?
                `

            )

            .bind(

                plan.duration_days >= 365
                    ? "yearly"
                    : plan.duration_days >= 90
                    ? "90day"
                    : "monthly",

                now(),

                studentId

            )

            .run();

            return jsonResponse({

                success: true,

                message: "Payment completed successfully.",

                subscriptionId,

                paymentId,

                expiresAt: endDate

            });

        }

        // =====================================================
        // NEXT SECTION BELOW
        // =====================================================

                // =====================================================
        // METHOD NOT ALLOWED
        // =====================================================

        return jsonResponse({

            success: false,

            message: "Method Not Allowed."

        }, 405);

    }

    catch (error) {

        console.error("Payment Worker Error:", error);

        return Response.json({

            success: false,

            message: "Internal Server Error.",

            error: error.message

        }, {

            status: 500

        });

    }

}