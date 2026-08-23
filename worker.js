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
import parserHandler from "./workers/parser.js";
import progressHandler from "./workers/progress.js";
import documentsHandler from "./workers/documents.js";
import profileHandler from "./workers/profile.js";
import referralHandler from "./workers/referral.js";
import passwordResetHandler from "./workers/password-reset.js";
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
// Student Profile
// -----------------------------
if (
    url.pathname === "/api/profile" &&
    (
        request.method === "GET" ||
        request.method === "PUT"
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

    const response = await paymentHandler(request, env);

    Object.entries(corsHeaders).forEach(([key, value]) => {

        response.headers.set(key, value);

    });

    return response;

}

// -----------------------------
// Student Referral
// -----------------------------
if (
    url.pathname === "/api/referral" &&
     request.method === "GET" ||
    request.method === "POST"
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

// -----------------------------
// Student Avatar Upload
// -----------------------------
if (
    url.pathname === "/api/upload" &&
    request.method === "POST"
) {

    const response =
        await handleStudentAvatarUpload(
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

// -----------------------------
// Admin
// -----------------------------
if (

    url.pathname.startsWith("/api/admin")

) {

    const response = await adminHandler(request, env);

    Object.entries(corsHeaders).forEach(([key, value]) => {

        response.headers.set(key, value);

    });

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

// ======================================================
// Temporary handlers
// (Real code comes next.)
// ======================================================

async function handlePayment(request, env) {

    return Response.json({

        success: true,

        message: "Payment Worker Connected"

    });

}

async function handleStudentAvatarUpload(request, env) {

    try {

        // =============================================
        // AUTHENTICATION
        // =============================================

        const authHeader =
            request.headers.get("Authorization");

        if (
            !authHeader ||
            !authHeader.startsWith("Bearer ")
        ) {

            return Response.json(
                {
                    success: false,
                    message: "Unauthorized."
                },
                {
                    status: 401
                }
            );

        }

        const token =
            authHeader.substring(7);

        const valid =
            await jwt.verify(
                token,
                env.JWT_SECRET
            );

        if (!valid) {

            return Response.json(
                {
                    success: false,
                    message: "Invalid or expired session."
                },
                {
                    status: 401
                }
            );

        }

        const payload =
            jwt.decode(token).payload;

        const studentId =
            payload.studentId;

        if (!studentId) {

            return Response.json(
                {
                    success: false,
                    message: "Student identity missing."
                },
                {
                    status: 401
                }
            );

        }


        // =============================================
        // VERIFY STUDENT
        // =============================================

        const student =
            await env.DB.prepare(`
                SELECT id
                FROM students
                WHERE id = ?
                LIMIT 1
            `)
            .bind(studentId)
            .first();

        if (!student) {

            return Response.json(
                {
                    success: false,
                    message: "Student not found."
                },
                {
                    status: 404
                }
            );

        }


        // =============================================
        // READ UPLOADED FILE
        // =============================================

        const formData =
            await request.formData();

        const file =
            formData.get("file");

        if (
            !file ||
            typeof file.stream !== "function"
        ) {

            return Response.json(
                {
                    success: false,
                    message: "No image file uploaded."
                },
                {
                    status: 400
                }
            );

        }


        // =============================================
        // VALIDATE IMAGE
        // =============================================

        const allowedTypes = {

            "image/jpeg": "jpg",
            "image/png": "png",
            "image/webp": "webp"

        };

        const extension =
            allowedTypes[file.type];

        if (!extension) {

            return Response.json(
                {
                    success: false,
                    message:
                        "Only JPG, PNG and WebP images are allowed."
                },
                {
                    status: 400
                }
            );

        }


        const MAX_SIZE =
            5 * 1024 * 1024;

        if (file.size > MAX_SIZE) {

            return Response.json(
                {
                    success: false,
                    message:
                        "Image must be smaller than 5 MB."
                },
                {
                    status: 413
                }
            );

        }


        // =============================================
        // R2 OBJECT KEY
        // =============================================

        const objectKey =
            `images/students/${studentId}.${extension}`;


        // =============================================
        // UPLOAD TO R2
        // =============================================

        await env.IMAGES.put(
            objectKey,
            file.stream(),
            {
                httpMetadata: {

                    contentType:
                        file.type

                },

                customMetadata: {

                    studentId:
                        String(studentId),

                    type:
                        "student-avatar"

                }

            }
        );


        // =============================================
        // SAVE R2 KEY IN D1
        // =============================================

        await env.DB.prepare(`
            UPDATE students

            SET
                avatar_url = ?,
                updated_at = CURRENT_TIMESTAMP

            WHERE id = ?
        `)
        .bind(
            objectKey,
            studentId
        )
        .run();


        // =============================================
        // SUCCESS
        // =============================================

        return Response.json({

            success: true,

            message:
                "Profile photo uploaded successfully.",

            avatar_url:
                objectKey

        });

    }

        catch (error) {

        console.error(
            "STUDENT AVATAR UPLOAD ERROR:",
            error
        );

                return Response.json(
            {
                success: false,
                message:
                    "Unable to upload profile photo."
            },
            {
                status: 500
            }
        );

    }

}
    }

};