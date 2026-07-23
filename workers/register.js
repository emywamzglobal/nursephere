// ======================================================
// Nursephere Register Worker
// File: workers/register.js
// ======================================================
// ======================================================
// Dependencies
// ======================================================

import bcrypt from "bcryptjs";
import { createNotification } from "../services/notifications.js";
export default async function registerHandler(request, env) {

    try {

        if (request.method !== "POST") {

            return Response.json(

                {

                    success: false,

                    message: "Method Not Allowed"

                },

                {

                    status: 405

                }

            );

        }

        const data = await request.json();

        // ======================================================
// Validate Incoming Data
// ======================================================

const {

    fullName,

    email,

    password

} = data;

if (!fullName || !email || !password) {

    return Response.json(

        {

            success: false,

            message: "All fields are required."

        },

        {

            status: 400

        }

    );

}

if (fullName.trim().length < 3) {

    return Response.json(

        {

            success: false,

            message: "Full name is too short."

        },

        {

            status: 400

        }

    );

}

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

if (!emailPattern.test(email)) {

    return Response.json(

        {

            success: false,

            message: "Invalid email address."

        },

        {

            status: 400

        }

    );

}

if (password.length < 8) {

    return Response.json(

        {

            success: false,

            message: "Password must be at least 8 characters."

        },

        {

            status: 400

        }

    );

}

// ======================================================
// Check Existing Student
// ======================================================

const existingStudent = await env.DB
    .prepare(
        `
        SELECT id
        FROM students
        WHERE email = ?
        `
    )
    .bind(email)
    .first();

if (existingStudent) {

    return Response.json(

        {

            success: false,

            message: "An account with this email already exists."

        },

        {

            status: 409

        }

    );

}

// ======================================================
// Create Student Trial
// ======================================================

const studentId = crypto.randomUUID();

const now = new Date();

const trialStartedAt = now.toISOString();

// ======================================================
// Generate Student Number
// ======================================================

const currentYear = now.getFullYear();

const lastStudent = await env.DB.prepare(

    `
    SELECT student_number

    FROM students

    ORDER BY student_number DESC

    LIMIT 1
    `

)

.first();

let sequence = 1;

if (lastStudent?.student_number) {

    const lastSequence = parseInt(

        lastStudent.student_number.split("-")[2],

        10

    );

    sequence = lastSequence + 1;

}

const studentNumber = `NS-${currentYear}-${String(sequence).padStart(6, "0")}`;

const trialExpiresAt = new Date(

    now.getTime() + (3 * 24 * 60 * 60 * 1000)

).toISOString();

// ======================================================
// Hash Password
// ======================================================

const passwordHash = await bcrypt.hash(password, 10);

// ======================================================
// Save Student
// ======================================================

await env.DB.prepare(

    `
    INSERT INTO students (

    id,
    student_number,
    full_name,
    email,
    password_hash,
    account_status,
    trial_active,
    trial_started_at,
    trial_expires_at,
    subscription_status,
    email_verified,
    created_at,
    updated_at

)

    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `

)

.bind(

    studentId,

    studentNumber,

    fullName,

    email.toLowerCase(),

    passwordHash,

    "active",

    1,

    trialStartedAt,

    trialExpiresAt,

    "trial",

    0,

    trialStartedAt,

    trialStartedAt

)

.run();

/*=========================================
        STUDENT PROGRESS
=========================================*/

await env.DB.prepare(

    `
    INSERT INTO student_progress (

        id,
        student_id,
        subjects_started,
        questions_answered,
        questions_remaining,
        success_rate,
        created_at,
        updated_at

    )

    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `

)

.bind(

    crypto.randomUUID(),

    studentId,

    0,

    0,

    30,

    0,

    trialStartedAt,

    trialStartedAt

)

.run();

await createNotification(env, {

    studentId,

    title: "Welcome to Nursephere!",

    message: "Your FREE 3-day trial has started. You can now practice up to 30 questions.",

    type: "welcome"

});

// ======================================================
// Registration Successful
// ======================================================

return Response.json(

    {

        success: true,

        message: "Registration successful.",

        student: {

            id: studentId,

            studentNumber,

            fullName,

            email,

            trialEnds: trialExpiresAt

        }

    },

    {

        status: 201

    }

);

    }

    catch (error) {

        return Response.json(

            {

                success: false,

                message: error.message

            },

            {

                status: 500

            }

        );

    }

}