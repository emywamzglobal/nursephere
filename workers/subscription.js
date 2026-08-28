// ======================================================
// Nursephere Subscription Worker
// File: workers/subscription.js
//
// DATABASE-DRIVEN SUBSCRIPTION SYSTEM
//
// Student
//     ↓
// subscriptions.student_id
//     ↓
// subscriptions.plan_id
//     ↓
// subscription_plans.id
//     ↓
// plan_features.plan_id
//     ↓
// features.id
//
// Business rules are read from the database.
// No plan names, prices, feature permissions, or
// entitlement rules are hardcoded here.
// ======================================================

import jwt from "@tsndr/cloudflare-worker-jwt";


export default async function subscriptionHandler(
    request,
    env
) {

    try {

        const url =
            new URL(request.url);

        const pathname =
            url.pathname;


        /*=========================================================
            PUBLIC:
            GET ACTIVE SUBSCRIPTION PLANS

            GET /api/subscription-plans
        =========================================================*/

        if (

            request.method === "GET" &&

            pathname ===
                "/api/subscription-plans"

        ) {

            const result =
                await env.DB.prepare(

                    `
                    SELECT

                        id,
                        name,
                        price,
                        currency,
                        duration_days,
                        description,
                        display_order,
                        status

                    FROM subscription_plans

                    WHERE status = 'active'

                    ORDER BY
                        display_order ASC,
                        id ASC
                    `

                ).all();


            return Response.json({

                success: true,

                plans:
                    result.results || []

            });

        }


        /*=========================================================
    PUBLIC:
    GET SINGLE ACTIVE PLAN

    GET /api/subscription-plans/:id
=========================================================*/

if (

    request.method === "GET" &&

    pathname.startsWith(
        "/api/subscription-plans/"
    )

) {

    const planId =
        pathname
            .split("/")
            .pop();


    if (!planId) {

        return Response.json({

            success: false,

            message:
                "Subscription plan ID is required."

        }, {

            status: 400

        });

    }


    const plan =
    await env.DB.prepare(

        `
        SELECT

            id,
            name,
            price,
            currency,
            duration_days,
            description,
            display_order,
            status

        FROM subscription_plans

        WHERE id = ?

        AND status = 'active'

        LIMIT 1
        `

    )

    .bind(
        planId
    )

    .first();


    if (!plan) {

        return Response.json({

            success: false,

            message:
                "Subscription plan not found."

        }, {

            status: 404

        });

    }


    const featureResult =
        await env.DB.prepare(

            `
            SELECT

                f.id,
                f.feature_key,
                f.feature_name,
                f.description,
                f.category,
                pf.access_level

            FROM plan_features pf

            INNER JOIN features f

                ON f.id =
                   pf.feature_id

            WHERE pf.plan_id = ?

            AND f.status = 'active'

            ORDER BY
                f.category ASC,
                f.feature_name ASC
            `

        )

        .bind(plan.id)

        .all();


    const features =
        featureResult.results || [];


    const permissions = {};


    for (
        const feature
        of features
    ) {

        permissions[
            feature.feature_key
        ] =
            feature.access_level;

    }


    return Response.json({

        success: true,

        plan,

        features,

        permissions

    });

}
        /*=========================================================
            STUDENT SUBSCRIPTION

            GET /api/subscription

            Authentication comes from the JWT.

            The browser does NOT determine the student identity.
        =========================================================*/

        if (

            request.method === "GET" &&

            pathname ===
                "/api/subscription"

        ) {

            /*=====================================================
                AUTHENTICATION
            =====================================================*/

            const authHeader =
                request.headers.get(
                    "Authorization"
                );


            if (

                !authHeader ||

                !authHeader.startsWith(
                    "Bearer "
                )

            ) {

                return Response.json({

                    success: false,

                    message:
                        "Unauthorized."

                }, {

                    status: 401

                });

            }


            const token =
                authHeader.substring(7);


            const valid =
                await jwt.verify(
                    token,
                    env.JWT_SECRET
                );


            if (!valid) {

                return Response.json({

                    success: false,

                    message:
                        "Invalid or expired session."

                }, {

                    status: 401

                });

            }


            /*=====================================================
                READ VERIFIED JWT IDENTITY
            =====================================================*/

            const payload =
                jwt.decode(token).payload;


            const studentId =
                payload.studentId;


            if (!studentId) {

                return Response.json({

                    success: false,

                    message:
                        "Student identity missing."

                }, {

                    status: 401

                });

            }


            /*=====================================================
                VERIFY STUDENT EXISTS
            =====================================================*/

            const student =
                await env.DB.prepare(

                    `
                    SELECT

                        id

                    FROM students

                    WHERE id = ?

                    LIMIT 1
                    `

                )

                .bind(studentId)

                .first();


            if (!student) {

                return Response.json({

                    success: false,

                    message:
                        "Student not found."

                }, {

                    status: 404

                });

            }


            /*=====================================================
                FIND ACTIVE STUDENT SUBSCRIPTION

                subscriptions is the source of truth.

                The plan is obtained through:

                subscriptions.plan_id
                    ↓
                subscription_plans.id
            =====================================================*/

            const subscription =
                await env.DB.prepare(

                    `
                    SELECT

                        s.id AS subscription_id,

                        s.student_id,

                        s.plan_id,

                        s.start_date,

                        s.end_date,

                        s.payment_status,

                        s.status AS subscription_status,

                        s.created_at AS subscription_created_at,

                        s.updated_at AS subscription_updated_at,

                        sp.id AS plan_id,

                        sp.name AS plan_name,

                        sp.price AS plan_price,

                        sp.currency AS plan_currency,

                        sp.duration_days AS plan_duration_days,

                        sp.description AS plan_description,

                        sp.display_order AS plan_display_order,

                        sp.status AS plan_status,

                        sp.created_at AS plan_created_at,

                        sp.updated_at AS plan_updated_at

                    FROM subscriptions s

                    INNER JOIN subscription_plans sp

                        ON sp.id =
                           s.plan_id

                    WHERE s.student_id = ?

                    AND s.status = 'active'

                    AND sp.status = 'active'

                    AND datetime(s.end_date)
                        > datetime('now')

                    ORDER BY

                        datetime(s.end_date) DESC,

                        datetime(s.created_at) DESC

                    LIMIT 1
                    `

                )

                .bind(studentId)

                .first();


            /*=====================================================
                NO ACTIVE SUBSCRIPTION

                This is not an error.

                The student simply has no current entitlement.
            =====================================================*/

            if (!subscription) {

                return Response.json({

                    success: true,

                    active: false,

                    subscription: null,

                    plan: null,

                    features: [],

                    permissions: {}

                });

            }


            /*=====================================================
                LOAD PLAN FEATURES
            =====================================================*/

            const featureResult =
                await env.DB.prepare(

                    `
                    SELECT

                        f.id,
                        f.feature_key,
                        f.feature_name,
                        f.description,
                        f.category,
                        pf.access_level

                    FROM plan_features pf

                    INNER JOIN features f

                        ON f.id =
                           pf.feature_id

                    WHERE pf.plan_id = ?

                    AND f.status = 'active'

                    ORDER BY

                        f.category ASC,

                        f.feature_name ASC
                    `

                )

                .bind(
                    subscription.plan_id
                )

                .all();


            const features =
                featureResult.results || [];


            /*=====================================================
                BUILD DATABASE-DRIVEN PERMISSIONS
            =====================================================*/

            const permissions = {};


            for (
                const feature
                of features
            ) {

                permissions[
                    feature.feature_key
                ] =
                    feature.access_level;

            }


            /*=====================================================
                RETURN SUBSCRIPTION
            =====================================================*/

            return Response.json({

                success: true,

                active: true,

                subscription: {

                    id:
                        subscription.subscription_id,

                    student_id:
                        subscription.student_id,

                    plan_id:
                        subscription.plan_id,

                    start_date:
                        subscription.start_date,

                    end_date:
                        subscription.end_date,

                    payment_status:
                        subscription.payment_status,

                    status:
                        subscription.subscription_status,

                    created_at:
                        subscription.subscription_created_at,

                    updated_at:
                        subscription.subscription_updated_at

                },

                plan: {

                    id:
                        subscription.plan_id,

                    name:
                        subscription.plan_name,

                    price:
                        subscription.plan_price,

                    currency:
                        subscription.plan_currency,

                    duration_days:
                        subscription.plan_duration_days,

                    description:
                        subscription.plan_description,

                    display_order:
                        subscription.plan_display_order,

                    status:
                        subscription.plan_status,

                    created_at:
                        subscription.plan_created_at,

                    updated_at:
                        subscription.plan_updated_at

                },

                features,

                permissions

            });

        }


        /*=========================================================
            METHOD NOT ALLOWED
        =========================================================*/

        return Response.json({

            success: false,

            message:
                "Method Not Allowed."

        }, {

            status: 405

        });

    }


    catch (error) {

        console.error(
            "Subscription Worker Error:",
            error
        );


        return Response.json({

            success: false,

            message:
                "Internal Server Error."

        }, {

            status: 500

        });

    }

}