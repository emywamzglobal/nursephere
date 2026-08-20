// ======================================================
// Nursephere Register Worker
// File: workers/register.js
// ======================================================

// ======================================================
// Dependencies
// ======================================================

import bcrypt from "bcryptjs";


export default async function registerHandler(
    request,
    env
) {

    try {

        if (
            request.method !== "POST"
        ) {

            return Response.json(

                {

                    success: false,

                    message:
                        "Method Not Allowed"

                },

                {

                    status: 405

                }

            );

        }


        const data =
            await request.json();


        // ======================================================
        // Validate Incoming Data
        // ======================================================

        const {

            fullName,

            email,

            password

        } = data;


        if (
            !fullName ||
            !email ||
            !password
        ) {

            return Response.json(

                {

                    success: false,

                    message:
                        "All fields are required."

                },

                {

                    status: 400

                }

            );

        }


        if (
            fullName.trim().length < 3
        ) {

            return Response.json(

                {

                    success: false,

                    message:
                        "Full name is too short."

                },

                {

                    status: 400

                }

            );

        }


        const emailPattern =
            /^[^\s@]+@[^\s@]+\.[^\s@]+$/;


        if (
            !emailPattern.test(email)
        ) {

            return Response.json(

                {

                    success: false,

                    message:
                        "Invalid email address."

                },

                {

                    status: 400

                }

            );

        }


        if (
            password.length < 8
        ) {

            return Response.json(

                {

                    success: false,

                    message:
                        "Password must be at least 8 characters."

                },

                {

                    status: 400

                }

            );

        }


        // ======================================================
        // Check Existing Student
        // ======================================================

        const existingStudent =
            await env.DB

                .prepare(

                    `
                    SELECT id

                    FROM students

                    WHERE email = ?
                    `

                )

                .bind(
                    email.toLowerCase()
                )

                .first();


        if (
            existingStudent
        ) {

            return Response.json(

                {

                    success: false,

                    message:
                        "An account with this email already exists."

                },

                {

                    status: 409

                }

            );

        }


        // ======================================================
        // Create Student Trial
        // ======================================================

        const studentId =
            crypto.randomUUID();


        const now =
            new Date();


        const trialStartedAt =
            now.toISOString();


        // ======================================================
        // Generate Student Number
        // ======================================================

        const currentYear =
            now.getFullYear();


        const lastStudent =
            await env.DB.prepare(

                `
                SELECT student_number

                FROM students

                ORDER BY rowid DESC

                LIMIT 1
                `

            )

            .first();


        let sequence = 1;


        if (
            lastStudent?.student_number
        ) {

            const match =
                lastStudent.student_number.match(
                    /(\d+)$/
                );


            const lastSequence =
                match

                    ? parseInt(
                        match[1],
                        10
                    )

                    : 0;


            sequence =
                lastSequence + 1;

        }


        const studentNumber =

            `NS-${currentYear}-${String(sequence).padStart(6, "0")}`;


        const trialExpiresAt =
            new Date(

                now.getTime() +
                (
                    3 *
                    24 *
                    60 *
                    60 *
                    1000
                )

            ).toISOString();


        // ======================================================
        // REFERRAL CODE
        //
        // Format:
        //
        // EMYWA-XXXXX
        //
        // The Worker generates the code.
        // The UNIQUE INDEX in D1 guarantees uniqueness.
        // ======================================================

        let referralCode = null;

        let referralCodeCreated = false;


        const referralCharacters =
            "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";


        for (
            let attempt = 0;
            attempt < 10;
            attempt++
        ) {

            let suffix = "";


            const randomValues =
                new Uint32Array(5);


            crypto.getRandomValues(
                randomValues
            );


            for (
                let index = 0;
                index < 5;
                index++
            ) {

                suffix +=

                    referralCharacters[
                        randomValues[index] %
                        referralCharacters.length
                    ];

            }


            const candidate =
                `EMYWA-${suffix}`;


            const existingReferralCode =
                await env.DB.prepare(

                    `
                    SELECT id

                    FROM students

                    WHERE referral_code = ?

                    LIMIT 1
                    `

                )

                .bind(
                    candidate
                )

                .first();


            if (
                !existingReferralCode
            ) {

                referralCode =
                    candidate;

                referralCodeCreated =
                    true;

                break;

            }

        }


        if (
            !referralCodeCreated
        ) {

            return Response.json(

                {

                    success: false,

                    message:
                        "Unable to generate a unique referral code. Please try again."

                },

                {

                    status: 500

                }

            );

        }


        // ======================================================
        // Hash Password
        // ======================================================

        const passwordHash =
            await bcrypt.hash(
                password,
                10
            );


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
                updated_at,
                referral_code

            )

            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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

            trialStartedAt,

            referralCode

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


        // ======================================================
        // Registration Successful
        // ======================================================

        return Response.json(

            {

                success: true,

                message:
                    "Registration successful.",

                student: {

                    id:
                        studentId,

                    studentNumber,

                    fullName,

                    email,

                    trialEnds:
                        trialExpiresAt,

                    referralCode

                }

            },

            {

                status: 201

            }

        );

    }


    catch (
        error
    ) {

        console.error(
            "Register Worker Error:",
            error
        );


        return Response.json(

            {

                success: false,

                message:
                    error.message

            },

            {

                status: 500

            }

        );

    }

}