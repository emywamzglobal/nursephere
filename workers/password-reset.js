// ======================================================
// Nursephere Password Reset Worker
// File: workers/password-reset.js
//
// PASSWORD RESET SYSTEM
//
// POST /api/password-reset/request
//     ↓
// Find student by email
//     ↓
// Generate secure reset token
//     ↓
// Store SHA-256 token hash in D1
//     ↓
// Send password_reset email
//
// POST /api/password-reset/confirm
//     ↓
// Validate token
//     ↓
// Hash new password with bcrypt
//     ↓
// Update students.password_hash
//     ↓
// Mark token as used
// ======================================================

import bcrypt from "bcryptjs";

import {
    sendEmail
} from "./email.js";


export default async function passwordResetHandler(
    request,
    env
) {

    try {

        const url =
            new URL(request.url);

        const pathname =
            url.pathname;


        // ======================================================
        // REQUEST PASSWORD RESET
        //
        // POST /api/password-reset/request
        // ======================================================

        if (

            request.method === "POST" &&

            pathname ===
                "/api/password-reset/request"

        ) {

            let data;


            try {

                data =
                    await request.json();

            }

            catch {

                return Response.json({

                    success: false,

                    message:
                        "Invalid request."

                }, {

                    status: 400

                });

            }


            const email =
                String(
                    data?.email || ""
                )
                .trim()
                .toLowerCase();


            if (!email) {

                return Response.json({

                    success: false,

                    message:
                        "Email address is required."

                }, {

                    status: 400

                });

            }


            const emailPattern =
                /^[^\s@]+@[^\s@]+\.[^\s@]+$/;


            if (
                !emailPattern.test(email)
            ) {

                return Response.json({

                    success: false,

                    message:
                        "Please enter a valid email address."

                }, {

                    status: 400

                });

            }


            // ==================================================
            // FIND STUDENT
            // ==================================================

            const student =
                await env.DB.prepare(

                    `
                    SELECT

                        id,
                        full_name,
                        email,
                        account_status

                    FROM students

                    WHERE email = ?

                    LIMIT 1
                    `

                )

                .bind(
                    email
                )

                .first();


            // ==================================================
            // DO NOT REVEAL WHETHER THE EMAIL EXISTS
            //
            // This prevents account/email enumeration.
            // ==================================================

            if (!student) {

                return Response.json({

                    success: true,

                    message:
                        "If an account exists for this email, a password reset link has been sent."

                });

            }


            if (

                String(
                    student.account_status || ""
                ).toLowerCase() !==
                "active"

            ) {

                return Response.json({

                    success: true,

                    message:
                        "If an account exists for this email, a password reset link has been sent."

                });

            }


            // ==================================================
            // PASSWORD RESET URL
            //
            // This must point to the actual frontend
            // reset-password page.
            // ==================================================

            const passwordResetUrl =
                String(
                    env.PASSWORD_RESET_URL || ""
                ).trim();


            if (!passwordResetUrl) {

                console.error(

                    "PASSWORD_RESET_URL is not configured."

                );


                return Response.json({

                    success: false,

                    message:
                        "Password reset service is not configured."

                }, {

                    status: 500

                });

            }


            // ==================================================
            // INVALIDATE PREVIOUS UNUSED TOKENS
            //
            // Only the newest reset request remains valid.
            // ==================================================

            const invalidatedAt =
                new Date()
                    .toISOString();


            await env.DB.prepare(

                `
                UPDATE password_reset_tokens

                SET used_at = ?

                WHERE student_id = ?

                AND used_at IS NULL
                `

            )

            .bind(

                invalidatedAt,

                student.id

            )

            .run();


            // ==================================================
            // GENERATE SECURE RESET TOKEN
            // ==================================================

            const tokenBytes =
                new Uint8Array(32);


            crypto.getRandomValues(
                tokenBytes
            );


            const resetToken =
                Array.from(
                    tokenBytes
                )
                .map(

                    byte =>
                        byte
                            .toString(16)
                            .padStart(2, "0")

                )
                .join("");


            // ==================================================
            // HASH TOKEN
            //
            // The raw token is never stored in D1.
            // ==================================================

            const tokenBuffer =
                await crypto.subtle.digest(

                    "SHA-256",

                    new TextEncoder().encode(
                        resetToken
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
            // TOKEN EXPIRY
            //
            // Password reset links are valid for 1 hour.
            // ==================================================

            const now =
                new Date();


            const createdAt =
                now.toISOString();


            const expiresAt =
                new Date(

                    now.getTime() +

                    (
                        60 *
                        60 *
                        1000
                    )

                ).toISOString();


            // ==================================================
            // SAVE RESET TOKEN
            // ==================================================

            await env.DB.prepare(

                `
                INSERT INTO password_reset_tokens (

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

                student.id,

                tokenHash,

                expiresAt,

                null,

                createdAt

            )

            .run();


            // ==================================================
            // BUILD RESET URL
            // ==================================================

            const resetUrl =
                new URL(
                    passwordResetUrl
                );


            resetUrl.searchParams.set(
                "token",
                resetToken
            );


            // ==================================================
            // SEND PASSWORD RESET EMAIL
            //
            // Email subject/body/CSS comes from D1.
            // Nothing is hardcoded here.
            //
            // Email failure does NOT expose whether
            // the account exists.
            // ==================================================

            try {

                const emailResult =
                    await sendEmail({

                        env,

                        studentId:
                            student.id,

                        recipientEmail:
                            student.email,

                        templateKey:
                            "password_reset",

                        eventKey:
                            `password_reset_request:${crypto.randomUUID()}`,

                        preferenceKey:
                            "email_notifications",

                        variables: {

                            student_name:
                                student.full_name,

                            email:
                                student.email,

                            reset_token:
                                resetToken,

                            reset_url:
                                resetUrl.toString(),

                            expires_at:
                                expiresAt,

                            current_year:
                                now.getFullYear()

                        }

                    });


                if (
                    !emailResult?.success
                ) {

                    console.error(

                        "Nursephere password reset email was not sent:",

                        emailResult

                    );

                }

            }

            catch (
                emailError
            ) {

                console.error(

                    "Nursephere password reset email error:",

                    emailError

                );

            }


            // ==================================================
            // GENERIC SUCCESS RESPONSE
            // ==================================================

            return Response.json({

                success: true,

                message:
                    "If an account exists for this email, a password reset link has been sent."

            });

        }


        // ======================================================
        // CONFIRM PASSWORD RESET
        //
        // POST /api/password-reset/confirm
        // ======================================================

        if (

            request.method === "POST" &&

            pathname ===
                "/api/password-reset/confirm"

        ) {

            let data;


            try {

                data =
                    await request.json();

            }

            catch {

                return Response.json({

                    success: false,

                    message:
                        "Invalid request."

                }, {

                    status: 400

                });

            }


            const resetToken =
                String(
                    data?.token || ""
                ).trim();


            const newPassword =
                String(
                    data?.newPassword || ""
                );


            if (

                !resetToken ||

                !newPassword

            ) {

                return Response.json({

                    success: false,

                    message:
                        "Reset token and new password are required."

                }, {

                    status: 400

                });

            }


            // ==================================================
            // PASSWORD VALIDATION
            //
            // Matches the registration password policy.
            // ==================================================

            if (
                newPassword.length < 8
            ) {

                return Response.json({

                    success: false,

                    message:
                        "Password must be at least 8 characters."

                }, {

                    status: 400

                });

            }


            if (
                !/[A-Z]/.test(
                    newPassword
                )
            ) {

                return Response.json({

                    success: false,

                    message:
                        "Password must contain at least one uppercase letter."

                }, {

                    status: 400

                });

            }


            if (
                !/[a-z]/.test(
                    newPassword
                )
            ) {

                return Response.json({

                    success: false,

                    message:
                        "Password must contain at least one lowercase letter."

                }, {

                    status: 400

                });

            }


            if (
                !/[0-9]/.test(
                    newPassword
                )
            ) {

                return Response.json({

                    success: false,

                    message:
                        "Password must contain at least one number."

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
                        resetToken
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
            // FIND RESET TOKEN
            // ==================================================

            const resetRecord =
                await env.DB.prepare(

                    `
                    SELECT

                        id,
                        student_id,
                        expires_at,
                        used_at

                    FROM password_reset_tokens

                    WHERE token_hash = ?

                    LIMIT 1
                    `

                )

                .bind(
                    tokenHash
                )

                .first();


            if (
                !resetRecord
            ) {

                return Response.json({

                    success: false,

                    message:
                        "Invalid or expired password reset link."

                }, {

                    status: 400

                });

            }


            // ==================================================
            // PREVENT TOKEN REUSE
            // ==================================================

            if (
                resetRecord.used_at
            ) {

                return Response.json({

                    success: false,

                    message:
                        "Invalid or expired password reset link."

                }, {

                    status: 400

                });

            }


            // ==================================================
            // CHECK EXPIRY
            // ==================================================

            const expiresAt =
                new Date(
                    resetRecord.expires_at
                ).getTime();


            if (

                !Number.isFinite(
                    expiresAt
                ) ||

                expiresAt <= Date.now()

            ) {

                return Response.json({

                    success: false,

                    message:
                        "Invalid or expired password reset link."

                }, {

                    status: 400

                });

            }


            // ==================================================
            // HASH NEW PASSWORD
            // ==================================================

            const passwordHash =
                await bcrypt.hash(

                    newPassword,

                    10

                );


            const updatedAt =
                new Date()
                    .toISOString();


            // ==================================================
            // UPDATE PASSWORD
            // ==================================================

            const passwordUpdate =
                await env.DB.prepare(

                    `
                    UPDATE students

                    SET

                        password_hash = ?,

                        updated_at = ?

                    WHERE id = ?

                    AND account_status = 'active'
                    `

                )

                .bind(

                    passwordHash,

                    updatedAt,

                    resetRecord.student_id

                )

                .run();


            if (
                Number(
                    passwordUpdate.meta?.changes || 0
                ) !== 1
            ) {

                return Response.json({

                    success: false,

                    message:
                        "Unable to reset password."

                }, {

                    status: 400

                });

            }


            // ==================================================
            // MARK TOKEN USED
            // ==================================================

            await env.DB.prepare(

                `
                UPDATE password_reset_tokens

                SET used_at = ?

                WHERE id = ?

                AND used_at IS NULL
                `

            )

            .bind(

                updatedAt,

                resetRecord.id

            )

            .run();


            // ==================================================
            // INVALIDATE ANY OTHER RESET TOKENS
            // ==================================================

            await env.DB.prepare(

                `
                UPDATE password_reset_tokens

                SET used_at = ?

                WHERE student_id = ?

                AND used_at IS NULL
                `

            )

            .bind(

                updatedAt,

                resetRecord.student_id

            )

            .run();


            // ==================================================
            // PASSWORD RESET SUCCESSFUL
            // ==================================================

            return Response.json({

                success: true,

                message:
                    "Password reset successfully."

            });

        }


        // ======================================================
        // METHOD NOT ALLOWED
        // ======================================================

        return Response.json({

            success: false,

            message:
                "Method Not Allowed."

        }, {

            status: 405

        });

    }


    // ======================================================
    // ERROR HANDLER
    // ======================================================

    catch (
        error
    ) {

        console.error(

            "Password Reset Worker Error:",

            error

        );


        return Response.json({

            success: false,

            message:
                "Unable to process password reset."

        }, {

            status: 500

        });

    }

}