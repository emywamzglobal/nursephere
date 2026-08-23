// ======================================================
// Nursephere Register Worker
// File: workers/register.js
// ======================================================

// ======================================================
// Dependencies
// ======================================================

import bcrypt from "bcryptjs";

import {
    sendEmail
} from "./email.js";


// ======================================================
// REGISTER HANDLER
// ======================================================

export default async function registerHandler(
    request,
    env
) {

    try {

        // ======================================================
// EMAIL VERIFICATION
//
// GET /api/register/verify?token=TOKEN
//
// Validates the email-verification token,
// marks the student as verified,
// and marks the token as used.
// ======================================================

if (
    request.method === "GET" &&
    new URL(request.url).pathname ===
        "/api/register/verify"
) {

    const url =
        new URL(request.url);


    const verificationToken =
        url.searchParams.get(
            "token"
        );


    if (
        !verificationToken
    ) {

        return Response.json({

            success: false,

            message:
                "Verification token is required."

        }, {

            status: 400

        });

    }


    // ==================================================
    // HASH RECEIVED TOKEN
    // ==================================================

    const tokenBuffer =
        await crypto.subtle.digest(

            "SHA-256",

            new TextEncoder().encode(
                verificationToken
            )

        );


    const tokenHash =
        Array.from(
            new Uint8Array(
                tokenBuffer
            )
        )
        .map(
            byte =>
                byte
                    .toString(16)
                    .padStart(2, "0")
        )
        .join("");


    // ==================================================
    // FIND TOKEN
    // ==================================================

    const verificationRecord =
        await env.DB.prepare(

            `
            SELECT

                id,
                student_id,
                expires_at,
                used_at

            FROM email_verification_tokens

            WHERE token_hash = ?

            LIMIT 1
            `

        )

        .bind(
            tokenHash
        )

        .first();


    if (
        !verificationRecord
    ) {

        return Response.json({

            success: false,

            message:
                "Invalid verification token."

        }, {

            status: 400

        });

    }


    // ==================================================
    // PREVENT TOKEN REUSE
    // ==================================================

    if (
        verificationRecord.used_at
    ) {

        return Response.json({

            success: false,

            message:
                "This verification link has already been used."

        }, {

            status: 400

        });

    }


    // ==================================================
    // CHECK TOKEN EXPIRY
    // ==================================================

    const expiresAt =
        new Date(
            verificationRecord.expires_at
        ).getTime();


    if (
        !Number.isFinite(expiresAt) ||
        expiresAt <= Date.now()
    ) {

        return Response.json({

            success: false,

            message:
                "This verification link has expired."

        }, {

            status: 400

        });

    }


    const verifiedAt =
        new Date()
            .toISOString();


    // ==================================================
    // MARK STUDENT VERIFIED
    // ==================================================

    const verificationUpdate =
    await env.DB.prepare(

        `
        UPDATE students

        SET

            email_verified = 1,

            updated_at = ?

        WHERE id = ?

        AND email_verified = 0
        `

    )

    .bind(

        verifiedAt,

        verificationRecord.student_id

    )

    .run();


if (
    Number(
        verificationUpdate.meta?.changes || 0
    ) === 0
) {

    return Response.json({

        success: true,

        message:
            "Email is already verified."

    });

}

    // ==================================================
    // MARK TOKEN USED
    // ==================================================

    await env.DB.prepare(

        `
        UPDATE email_verification_tokens

        SET used_at = ?

        WHERE id = ?
        `

    )

    .bind(

        verifiedAt,

        verificationRecord.id

    )

    .run();


    return Response.json({

        success: true,

        message:
            "Email verified successfully."

    });

}

        // ======================================================
        // METHOD CHECK
        // ======================================================

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


        // ======================================================
        // READ REQUEST
        // ======================================================

        const data =
            await request.json();


        // ======================================================
        // VALIDATE INCOMING DATA
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
        // NORMALIZE EMAIL
        // ======================================================

        const normalizedEmail =
            email
                .trim()
                .toLowerCase();


        // ======================================================
        // CHECK EXISTING STUDENT
        // ======================================================

        const existingStudent =
            await env.DB

                .prepare(

                    `
                    SELECT id

                    FROM students

                    WHERE email = ?

                    LIMIT 1
                    `

                )

                .bind(
                    normalizedEmail
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
        // CREATE STUDENT TRIAL
        // ======================================================

        const studentId =
            crypto.randomUUID();


        const now =
            new Date();


        const trialStartedAt =
            now.toISOString();


        // ======================================================
        // GENERATE STUDENT NUMBER
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


        let sequence =
            1;


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
        // GENERATE REFERRAL CODE
        //
        // Format:
        //
        // EMYWA-XXXXX
        //
        // The Worker generates the code.
        // D1 uniqueness protects the database.
        // ======================================================

        let referralCode =
            null;


        let referralCodeCreated =
            false;


        const referralCharacters =
            "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";


        for (
            let attempt = 0;
            attempt < 10;
            attempt++
        ) {

            let suffix =
                "";


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
        // HASH PASSWORD
        // ======================================================

        const passwordHash =
            await bcrypt.hash(
                password,
                10
            );


        // ======================================================
        // SAVE STUDENT
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

            normalizedEmail,

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


        // ======================================================
        // STUDENT PROGRESS
        // ======================================================

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
// EMAIL VERIFICATION TOKEN
//
// The student starts unverified.
// Generate a cryptographically secure token,
// store only its SHA-256 hash in D1,
// and keep the raw token for the email link.
//
// Token expires after 24 hours.
// ======================================================

const verificationTokenBytes =
    new Uint8Array(32);

crypto.getRandomValues(
    verificationTokenBytes
);


const verificationToken =
    Array.from(
        verificationTokenBytes
    )
    .map(
        byte =>
            byte.toString(16).padStart(2, "0")
    )
    .join("");


const verificationTokenBuffer =
    await crypto.subtle.digest(

        "SHA-256",

        new TextEncoder().encode(
            verificationToken
        )

    );


const verificationTokenHash =
    Array.from(
        new Uint8Array(
            verificationTokenBuffer
        )
    )
    .map(
        byte =>
            byte.toString(16).padStart(2, "0")
    )
    .join("");


const verificationExpiresAt =
    new Date(

        now.getTime() +

        (
            24 *
            60 *
            60 *
            1000
        )

    ).toISOString();


await env.DB.prepare(

    `
    INSERT INTO email_verification_tokens (

        id,
        student_id,
        token_hash,
        expires_at,
        used_at,
        created_at

    )

    VALUES (?, ?, ?, ?, ?, ?)
    `

)

.bind(

    crypto.randomUUID(),

    studentId,

    verificationTokenHash,

    verificationExpiresAt,

    null,

    trialStartedAt

)

.run();


// ======================================================
// EMAIL VERIFICATION EMAIL
//
// Email content comes from D1.
// Email failure must NOT break registration.
// ======================================================

try {

    const emailResult =
        await sendEmail({

            env,

            studentId,

            recipientEmail:
                normalizedEmail,

            templateKey:
                "email_verification",

            eventKey:
                `email_verification_registration:${studentId}`,

            preferenceKey:
                "email_notifications",

            variables: {

                student_name:
                    fullName,

                email:
                    normalizedEmail,

                verification_token:
                    verificationToken,

                verification_url:
                    `${new URL(request.url).origin}/api/register/verify?token=${encodeURIComponent(verificationToken)}`,
    
                expires_at:
                    verificationExpiresAt,

                current_year:
                    currentYear

            }

        });


    if (
        !emailResult?.success
    ) {

        console.error(

            "Nursephere email verification was not sent:",

            emailResult

        );

    }

}

catch (
    emailError
) {

    console.error(

        "Nursephere email verification error:",

        emailError

    );

}


        // ======================================================
        // WELCOME EMAIL
        //
        // IMPORTANT:
        //
        // The email subject/body/CSS comes from D1.
        // Nothing is hardcoded here.
        //
        // Email failure must NOT break registration.
        // ======================================================

        try {

            const emailResult =
                await sendEmail({

                    env,

                    studentId,

                    recipientEmail:
                        normalizedEmail,

                    templateKey:
                        "welcome_email",

                    eventKey:
                        `welcome_registration:${studentId}`,

                    preferenceKey:
                        "email_notifications",

                    variables: {

                        student_name:
                            fullName,

                        student_number:
                            studentNumber,

                        email:
                            normalizedEmail,

                        trial_ends:
                            trialExpiresAt,

                        referral_code:
                            referralCode,

                        current_year:
                            currentYear

                    }

                });


            if (
                !emailResult?.success
            ) {

                console.error(

                    "Nursephere welcome email was not sent:",

                    emailResult

                );

            }

        }

        catch (
            emailError
        ) {

            console.error(

                "Nursephere welcome email error:",

                emailError

            );

        }


        // ======================================================
        // REGISTRATION SUCCESSFUL
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

                    email:
                        normalizedEmail,

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


    // ======================================================
    // ERROR HANDLER
    // ======================================================

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
                    "Unable to complete registration."

            },

            {

                status: 500

            }

        );

    }

}