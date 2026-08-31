// ======================================================
// Nursephere Cloudflare Worker
// Main API Router
// Domain: https://nursephere.wamalwaemily.workers.dev
// ======================================================
import registerHandler from "./workers/register.js";
import loginHandler from "./workers/login.js";
import dashboardHandler from "./workers/dashboard.js";
import subscriptionHandler from "./workers/subscription.js";
import practiceHandler from "./workers/practice.js";
import adminHandler from "./workers/admin.js";
import { handleGetExams } from "./workers/exams.js";
import jwt from "@tsndr/cloudflare-worker-jwt";
import paymentHandler from "./workers/payment.js";
import progressHandler from "./workers/progress.js";
import documentsHandler from "./workers/documents.js";
import profileHandler from "./workers/profile.js";
import referralHandler from "./workers/referral.js";
import passwordResetHandler from "./workers/password-reset.js";
import passwordChangeHandler from "./workers/password-change.js";
import settingsHandler from "./workers/settings.js";
import parserHandler from "./workers/parser.js";
import resourcesHandler from "./workers/resources.js";
export default {

    async fetch(request, env, ctx) {

        const url = new URL(request.url);

        const corsHeaders = {

    "Access-Control-Allow-Origin": "*",

    "Access-Control-Allow-Methods":
        "GET, POST, PUT, DELETE, OPTIONS",

    "Access-Control-Allow-Headers":
        "Content-Type, Authorization"

};

if (request.method === "OPTIONS") {

    return new Response(null, {

        headers: corsHeaders

    });

}

        // -----------------------------
        // Health Check
        // -----------------------------
        if (url.pathname === "/") {

            return new Response("Nursephere API is running.", {

                headers: {

                    "Content-Type": "text/plain"

                }

            });

        }

 // ======================================================
// ADMIN REGISTRATION
// ======================================================

if (

    url.pathname === "/api/admin/register" &&

    request.method === "POST"

) {

    const response =
        await adminRegisterHandler(
            request,
            env
        );


    Object.entries(
        corsHeaders
    ).forEach(
        ([key, value]) => {

            response.headers.set(
                key,
                value
            );

        }
    );


    return response;

}



        // -----------------------------
        // Register Student
        // -----------------------------
        if (

    url.pathname === "/api/register" &&

    request.method === "POST"

) {

    const response = await registerHandler(request, env);

Object.entries(corsHeaders).forEach(([key, value]) => {

    response.headers.set(key, value);

});

return response;

}

// -----------------------------
// Verify Student Email
// -----------------------------
if (

    url.pathname === "/api/register/verify" &&

    request.method === "GET"

) {

    const response =
        await registerHandler(
            request,
            env
        );

    Object.entries(corsHeaders).forEach(
        ([key, value]) => {

            response.headers.set(
                key,
                value
            );

        }
    );

    return response;

}

// ======================================================
// PASSWORD RESET
// ======================================================

if (

    (
        url.pathname ===
            "/api/password-reset/request"

        ||

        url.pathname ===
            "/api/password-reset/confirm"
    )

) {

    const response =
        await passwordResetHandler(
            request,
            env
        );

    Object.entries(
        corsHeaders
    ).forEach(
        ([key, value]) => {

            response.headers.set(
                key,
                value
            );

        }
    );

    return response;

}

// ======================================================
// PASSWORD CHANGE
// ======================================================

if (
    url.pathname === "/api/password/change" &&
    request.method === "POST"
) {

    const response =
        await passwordChangeHandler(
            request,
            env
        );

    Object.entries(
        corsHeaders
    ).forEach(
        ([key, value]) => {

            response.headers.set(
                key,
                value
            );

        }
    );

    return response;

}

// ======================================================
// ADMIN LOGIN
// ======================================================

if (

    url.pathname === "/api/admin/login" &&

    request.method === "POST"

) {

    const response =
        await loginHandler(
            request,
            env
        );


    Object.entries(
        corsHeaders
    ).forEach(
        ([key, value]) => {

            response.headers.set(
                key,
                value
            );

        }
    );


    return response;

}

 // -----------------------------
        // Login Student
        // -----------------------------
        if (

    url.pathname === "/api/login" &&

    request.method === "POST"

) {

    const response = await loginHandler(request, env);

    Object.entries(corsHeaders).forEach(([key, value]) => {

        response.headers.set(key, value);

    });

    return response;

}

// -----------------------------
// Student Dashboard
// -----------------------------
if (

    url.pathname === "/api/dashboard"

) {

    const response = await dashboardHandler(request, env);

    Object.entries(corsHeaders).forEach(([key, value]) => {

        response.headers.set(key, value);

    });

    return response;

}

// -----------------------------
// Student Progress
// -----------------------------
if (
    url.pathname === "/api/progress"
) {

    const response =
        await progressHandler(
            request,
            env
        );

    Object.entries(corsHeaders).forEach(
        ([key, value]) => {

            response.headers.set(
                key,
                value
            );

        }
    );

    return response;

}

// -----------------------------
// Download Student Document
// -----------------------------
if (

    url.pathname === "/api/documents/download" &&

    request.method === "GET"

) {

    const response =
        await documentsHandler(
            request,
            env
        );

    Object.entries(corsHeaders).forEach(
        ([key, value]) => {

            response.headers.set(
                key,
                value
            );

        }
    );

    return response;

}

// -----------------------------
// Student Documents
// -----------------------------
if (

    url.pathname === "/api/documents" &&

    (
        request.method === "GET" ||
        request.method === "POST" ||
        request.method === "DELETE"
    )

) {

    const response =
        await documentsHandler(
            request,
            env
        );

    Object.entries(corsHeaders).forEach(
        ([key, value]) => {

            response.headers.set(
                key,
                value
            );

        }
    );

    return response;

}


// -----------------------------
// Student Subscription
// -----------------------------
if (

    url.pathname === "/api/subscription" ||
    url.pathname === "/api/subscription-plans" ||
    url.pathname.startsWith("/api/subscription-plans/")

) {

    const response = await subscriptionHandler(request, env);

    Object.entries(corsHeaders).forEach(([key, value]) => {

        response.headers.set(key, value);

    });

    return response;

}

// -----------------------------
// Student Profile + Avatar
// -----------------------------
if (
    (
        url.pathname === "/api/profile" &&
        (
            request.method === "GET" ||
            request.method === "PUT"
        )
    )
    ||
    (
        url.pathname === "/api/profile/avatar" &&
        request.method === "PUT"
    )
    ||
    (
        url.pathname.startsWith("/api/avatar/") &&
        request.method === "GET"
    )
) {

    const response =
        await profileHandler(
            request,
            env
        );

    Object.entries(corsHeaders).forEach(
        ([key, value]) => {

            response.headers.set(
                key,
                value
            );

        }
    );

    return response;

}

// -----------------------------
// Practice Questions & Study Resources
// -----------------------------
if (

    url.pathname === "/api/practice" ||

    url.pathname === "/api/subjects" ||

    (
        url.pathname.startsWith("/api/subjects/") &&
        url.pathname.endsWith("/resources")
    ) ||

    (
        url.pathname.startsWith("/api/resources/") &&
        url.pathname.endsWith("/download")
    )

) {

    const response = await practiceHandler(request, env);

    Object.entries(corsHeaders).forEach(([key, value]) => {

        response.headers.set(key, value);

    });

    return response;

}

// -----------------------------
// Student Exams
// -----------------------------
if (

    url.pathname === "/api/exams"

) {

    const response = await handleGetExams(request, env);

    Object.entries(corsHeaders).forEach(([key, value]) => {

        response.headers.set(key, value);

    });

    return response;

}

// -----------------------------
// Student Payments
// -----------------------------
if (
    url.pathname.startsWith("/api/payments")
   
) {

    const response =
        await paymentHandler(
            request,
            env
        );

    Object.entries(corsHeaders).forEach(
        ([key, value]) => {

            response.headers.set(
                key,
                value
            );

        }
    );

    return response;

}

// -----------------------------
// Student Referral
// -----------------------------
if (
    url.pathname === "/api/referral" &&
    (
        request.method === "GET" ||
        request.method === "POST"
    )
) {

    const response =
        await referralHandler(
            request,
            env
        );

    Object.entries(corsHeaders).forEach(
        ([key, value]) => {

            response.headers.set(
                key,
                value
            );

        }
    );

    return response;

}

// ======================================================
// STUDENT SETTINGS
// ======================================================

if (
    url.pathname === "/api/settings" &&
    request.method === "GET"
) {

    const response =
        await settingsHandler(
            request,
            env
        );

    Object.entries(corsHeaders).forEach(
        ([key, value]) => {

            response.headers.set(
                key,
                value
            );

        }
    );

    return response;

}

if (
    url.pathname === "/api/settings/email-preferences" &&
    request.method === "PUT"
) {

    const response =
        await settingsHandler(
            request,
            env
        );

    Object.entries(corsHeaders).forEach(
        ([key, value]) => {

            response.headers.set(
                key,
                value
            );

        }
    );

    return response;

}

if (
    url.pathname === "/api/settings/account" &&
    request.method === "DELETE"
) {

    const response =
        await settingsHandler(
            request,
            env
        );

    Object.entries(corsHeaders).forEach(
        ([key, value]) => {

            response.headers.set(
                key,
                value
            );

        }
    );

    return response;

}

// -----------------------------
// Payment Management
// -----------------------------
if (

    url.pathname.startsWith("/api/admin/payments")

) {

    const response = await adminHandler(request, env);

    Object.entries(corsHeaders).forEach(([key, value]) => {

        response.headers.set(key, value);

    });

    return response;

}

// -----------------------------
// Subscription Management
// -----------------------------
if (

    url.pathname.startsWith("/api/admin/subscriptions")

) {

    const response = await adminHandler(request, env);

    Object.entries(corsHeaders).forEach(([key, value]) => {

        response.headers.set(key, value);

    });

    return response;

}

// -----------------------------
// Referral Management
// -----------------------------
if (

    url.pathname.startsWith("/api/admin/referrals")

) {

    const response = await adminHandler(request, env);

    Object.entries(corsHeaders).forEach(([key, value]) => {

        response.headers.set(key, value);

    });

    return response;

}

// -----------------------------
// Question Import Parser
// -----------------------------
if (

    url.pathname === "/api/admin/questions/import" &&

    request.method === "POST"

) {

    const response = await parserHandler(request, env);

    Object.entries(corsHeaders).forEach(([key, value]) => {

        response.headers.set(key, value);

    });

    return response;

}

// ======================================================
// STUDY RESOURCES
// ======================================================

if (

    url.pathname === "/api/admin/resources" ||

    url.pathname.startsWith("/api/admin/resources/") ||

    url.pathname.startsWith("/api/resources/")

) {

    const response =
        await resourcesHandler(
            request,
            env
        );

    Object.entries(
        corsHeaders
    ).forEach(
        ([key, value]) => {

            response.headers.set(
                key,
                value
            );

        }
    );

    return response;

}

// ======================================================
// ADMIN MANAGEMENT
// ======================================================

if (

    url.pathname.startsWith("/api/admin/") ||

    url.pathname.startsWith("/api/account")

) {

    const response =
        await adminHandler(
            request,
            env
        );

    Object.entries(corsHeaders).forEach(
        ([key, value]) => {

            response.headers.set(
                key,
                value
            );

        }
    );

    return response;

}

// -----------------------------
// API Route Not Found
// -----------------------------
return new Response(

    JSON.stringify({

        success: false,

        message: "API route not found."

    }),

    {

        status: 404,

        headers: {

            "Content-Type":
                "application/json"

        }

    }

);

} // closes async fetch()

}; // closes export default