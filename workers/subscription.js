// ======================================================
// NurseSphere Subscription Worker
// File: workers/subscription.js
// ======================================================

export default async function subscriptionHandler(request, env) {

    try {

        const url = new URL(request.url);
        const pathname = url.pathname;

        // =====================================================
        // GET ALL ACTIVE SUBSCRIPTION PLANS
        // GET /api/subscription-plans
        // =====================================================

        if (

            request.method === "GET" &&
            pathname === "/api/subscription-plans"

        ) {

            const plans = await env.DB.prepare(

                `
                SELECT

                    id,
                    name,
                    price,
                    duration_days,
                    description,
                    display_order

                FROM subscription_plans

                WHERE status = 'active'

                ORDER BY display_order ASC, price ASC
                `

            ).all();

            return Response.json({

                success: true,

                plans: plans.results || []

            });

        }

        // =====================================================
        // NEXT SECTION BELOW
        // =====================================================

                // =====================================================
        // GET SINGLE SUBSCRIPTION PLAN
        // GET /api/subscription-plans/:id
        // =====================================================

        if (

            request.method === "GET" &&
            pathname.startsWith("/api/subscription-plans/")

        ) {

            const planId = pathname.split("/").pop();

            if (!planId) {

                return Response.json({

                    success: false,

                    message: "Subscription Plan ID is required."

                }, {

                    status: 400

                });

            }

            const plan = await env.DB.prepare(

                `
                SELECT

                    id,
                    name,
                    price,
                    duration_days,
                    description,
                    display_order,
                    status,
                    created_at,
                    updated_at

                FROM subscription_plans

                WHERE id = ?
                `

            )

            .bind(planId)

            .first();

            if (!plan) {

                return Response.json({

                    success: false,

                    message: "Subscription plan not found."

                }, {

                    status: 404

                });

            }

            if (plan.status !== "active") {

                return Response.json({

                    success: false,

                    message: "This subscription plan is currently unavailable."

                }, {

                    status: 403

                });

            }

            return Response.json({

                success: true,

                plan

            });

        }

        // =====================================================
        // NEXT SECTION BELOW
        // =====================================================

                // =====================================================
        // GET STUDENT SUBSCRIPTION
        // GET /api/subscription?studentId=xxxxx
        // =====================================================

        if (

            request.method === "GET" &&
            pathname === "/api/subscription"

        ) {

            const studentId = url.searchParams.get("studentId");

            if (!studentId) {

                return Response.json({

                    success: false,

                    message: "Student ID is required."

                }, {

                    status: 400

                });

            }

            const student = await env.DB.prepare(

                `
                SELECT

                    subscription_status,
                    subscription_started_at,
                    subscription_expires_at,
                    trial_started_at,
                    trial_expires_at

                FROM students

                WHERE id = ?
                `

            )

            .bind(studentId)

            .first();

            if (!student) {

                return Response.json({

                    success: false,

                    message: "Student not found."

                }, {

                    status: 404

                });

            }

            let permissions;

            switch (student.subscription_status) {

                case "trial":

                    permissions = {

                        subscription: {

                            plan: "trial",

                            canUpgrade: true,

                            canRenew: false

                        },

                        practice: {

                            enabled: true,

                            maxSubjects: 3,

                            maxQuestionsPerSubject: 10,

                            maxQuestions: 30,

                            simulations: false,

                            reason: "Upgrade to unlock unlimited practice."

                        },

                        progress: {

                            enabled: true,

                            analytics: true

                        },

                        studyResources: {

                            view: false,

                            download: false,

                            reason: "Upgrade to the 90-Day or Annual Plan."

                        },

                        documents: {

                            enabled: false,

                            reason: "Available only on the Annual Plan."

                        }

                    };

                    break;

                case "monthly":

                    permissions = {

                        subscription: {

                            plan: "monthly",

                            canUpgrade: true,

                            canRenew: true

                        },

                        practice: {

                            enabled: true,

                            maxSubjects: null,

                            maxQuestionsPerSubject: null,

                            maxQuestions: null,

                            simulations: false,

                            reason: "Upgrade to the 90-Day Plan."

                        },

                        progress: {

                            enabled: true,

                            analytics: true

                        },

                        studyResources: {

                            view: false,

                            download: false,

                            reason: "Upgrade to the 90-Day or Annual Plan."

                        },

                        documents: {

                            enabled: false,

                            reason: "Available only on the Annual Plan."

                        }

                    };

                    break;

                case "90day":

                    permissions = {

                        subscription: {

                            plan: "90day",

                            canUpgrade: true,

                            canRenew: true

                        },

                        practice: {

                            enabled: true,

                            maxSubjects: null,

                            maxQuestionsPerSubject: null,

                            maxQuestions: null,

                            simulations: true

                        },

                        progress: {

                            enabled: true,

                            analytics: true

                        },

                        studyResources: {

                            view: true,

                            download: false,

                            reason: "Upgrade to the Annual Plan."

                        },

                        documents: {

                            enabled: false,

                            reason: "Available only on the Annual Plan."

                        }

                    };

                    break;

                case "yearly":

                    permissions = {

                        subscription: {

                            plan: "yearly",

                            canUpgrade: false,

                            canRenew: true

                        },

                        practice: {

                            enabled: true,

                            maxSubjects: null,

                            maxQuestionsPerSubject: null,

                            maxQuestions: null,

                            simulations: true

                        },

                        progress: {

                            enabled: true,

                            analytics: true

                        },

                        studyResources: {

                            view: true,

                            download: true

                        },

                        documents: {

                            enabled: true

                        }

                    };

                    break;

                default:

                    permissions = {

                        subscription: {

                            plan: "none",

                            canUpgrade: true,

                            canRenew: false

                        },

                        practice: {

                            enabled: false

                        },

                        progress: {

                            enabled: false,

                            analytics: false

                        },

                        studyResources: {

                            view: false,

                            download: false

                        },

                        documents: {

                            enabled: false

                        }

                    };

            }

            return Response.json({

                success: true,

                subscription: student,

                permissions

            });

        }

        // =====================================================
        // NEXT SECTION BELOW
        // =====================================================

                // =====================================================
        // METHOD NOT ALLOWED
        // =====================================================

        return Response.json({

            success: false,

            message: "Method Not Allowed."

        }, {

            status: 405

        });

    }

    catch (error) {

        console.error("Subscription Worker Error:", error);

        return Response.json({

            success: false,

            message: "Internal Server Error.",

            error: error.message

        }, {

            status: 500

        });

    }

}