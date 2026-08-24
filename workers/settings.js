// ======================================================
// Nursephere Settings Worker
// File: workers/settings.js
//
// SETTINGS SYSTEM
//
// GET    /api/settings
// PUT    /api/settings/email-preferences
// DELETE /api/settings/account
//
// Authenticated student
//     ↓
// Verify JWT
//     ↓
// Get studentId from verified JWT
//     ↓
// Settings / Preferences / Account deletion
//
// Password changes are handled separately by:
// workers/password-change.js
// ======================================================

import jwt from "@tsndr/cloudflare-worker-jwt";


// ======================================================
// MAIN HANDLER
// ======================================================

export default async function settingsHandler(
    request,
    env
) {

    try {

        const url =
            new URL(request.url);

        const pathname =
            url.pathname;


        // ==================================================
        // AUTHENTICATION
        // ==================================================

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
            authHeader
                .substring(7)
                .trim();


        if (!token) {

            return Response.json({

                success: false,

                message:
                    "Unauthorized."

            }, {

                status: 401

            });

        }


        // ==================================================
        // VERIFY JWT
        // ==================================================

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


        // ==================================================
        // READ VERIFIED JWT IDENTITY
        // ==================================================

        const decoded =
            jwt.decode(token);


        const payload =
            decoded?.payload;


        const studentId =
            payload?.studentId;


        if (!studentId) {

            return Response.json({

                success: false,

                message:
                    "Student identity missing."

            }, {

                status: 401

            });

        }


        // ==================================================
        // VERIFY STUDENT ACCOUNT
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

                WHERE id = ?

                LIMIT 1
                `

            )

            .bind(
                studentId
            )

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


        // ==================================================
        // ACCOUNT STATUS
        // ==================================================

        if (
            String(
                student.account_status || ""
            ).toLowerCase() !==
            "active"
        ) {

            return Response.json({

                success: false,

                message:
                    "Your account is not active."

            }, {

                status: 403

            });

        }


        // ==================================================
        // GET SETTINGS
        //
        // GET /api/settings
        // ==================================================

        if (

            request.method === "GET" &&

            pathname ===
                "/api/settings"

        ) {

            // ----------------------------------------------
            // Get email preferences
            // ----------------------------------------------

            const preferences =
                await env.DB.prepare(

                    `
                    SELECT

                        email_notifications,
                        exam_reminders,
                        subscription_updates,
                        referral_notifications,
                        updated_at

                    FROM email_preferences

                    WHERE student_id = ?

                    LIMIT 1
                    `

                )

                .bind(
                    studentId
                )

                .first();


            return Response.json({

                success: true,

                student: {

                    id:
                        student.id,

                    full_name:
                        student.full_name,

                    email:
                        student.email

                },

                preferences: {

                    email_notifications:
                        Number(
                            preferences
                                ?.email_notifications ?? 1
                        ) === 1,

                    exam_reminders:
                        Number(
                            preferences
                                ?.exam_reminders ?? 1
                        ) === 1,

                    subscription_updates:
                        Number(
                            preferences
                                ?.subscription_updates ?? 1
                        ) === 1,

                    referral_notifications:
                        Number(
                            preferences
                                ?.referral_notifications ?? 1
                        ) === 1

                }

            });

        }


        // ==================================================
        // UPDATE EMAIL PREFERENCES
        //
        // PUT /api/settings/email-preferences
        // ==================================================

        if (

            request.method === "PUT" &&

            pathname ===
                "/api/settings/email-preferences"

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
                        "Invalid request body."

                }, {

                    status: 400

                });

            }


            // ==================================================
            // VALIDATE BOOLEAN VALUES
            // ==================================================

            const preferenceKeys = [

                "email_notifications",

                "exam_reminders",

                "subscription_updates",

                "referral_notifications"

            ];


            for (
                const key of preferenceKeys
            ) {

                if (
                    typeof data?.[key] !==
                    "boolean"
                ) {

                    return Response.json({

                        success: false,

                        message:
                            `${key} must be true or false.`

                    }, {

                        status: 400

                    });

                }

            }


            const emailNotifications =
                data.email_notifications
                    ? 1
                    : 0;


            const examReminders =
                data.exam_reminders
                    ? 1
                    : 0;


            const subscriptionUpdates =
                data.subscription_updates
                    ? 1
                    : 0;


            const referralNotifications =
                data.referral_notifications
                    ? 1
                    : 0;


            const updatedAt =
                new Date()
                    .toISOString();


            // ==================================================
            // UPSERT PREFERENCES
            //
            // student_id is UNIQUE.
            // ==================================================

            await env.DB.prepare(

                `
                INSERT INTO email_preferences (

                    id,
                    student_id,
                    email_notifications,
                    exam_reminders,
                    subscription_updates,
                    referral_notifications,
                    updated_at

                )

                VALUES (?, ?, ?, ?, ?, ?, ?)

                ON CONFLICT(student_id)

                DO UPDATE SET

                    email_notifications =
                        excluded.email_notifications,

                    exam_reminders =
                        excluded.exam_reminders,

                    subscription_updates =
                        excluded.subscription_updates,

                    referral_notifications =
                        excluded.referral_notifications,

                    updated_at =
                        excluded.updated_at
                `

            )

            .bind(

                crypto.randomUUID(),

                studentId,

                emailNotifications,

                examReminders,

                subscriptionUpdates,

                referralNotifications,

                updatedAt

            )

            .run();


            // ==================================================
            // RETURN UPDATED SETTINGS
            // ==================================================

            return Response.json({

                success: true,

                message:
                    "Email preferences updated successfully.",

                preferences: {

                    email_notifications:
                        Boolean(
                            emailNotifications
                        ),

                    exam_reminders:
                        Boolean(
                            examReminders
                        ),

                    subscription_updates:
                        Boolean(
                            subscriptionUpdates
                        ),

                    referral_notifications:
                        Boolean(
                            referralNotifications
                        )

                }

            });

        }


        // ==================================================
        // DELETE ACCOUNT
        //
        // DELETE /api/settings/account
        //
        // student_progress does NOT have
        // ON DELETE CASCADE.
        //
        // Therefore it must be deleted first.
        //
        // Other confirmed student relationships:
        //
        // notifications
        // email_preferences
        // password_reset_tokens
        // email_verification_tokens
        //
        // use ON DELETE CASCADE.
        // ==================================================

        if (

            request.method === "DELETE" &&

            pathname ===
                "/api/settings/account"

        ) {

            let data = {};


            try {

                data =
                    await request.json();

            }

            catch {

                return Response.json({

                    success: false,

                    message:
                        "Invalid request body."

                }, {

                    status: 400

                });

            }


            // ==================================================
            // DELETE CONFIRMATION
            // ==================================================

            const confirmation =
                String(
                    data?.confirmation || ""
                )
                    .trim()
                    .toUpperCase();


            if (
                confirmation !==
                "DELETE"
            ) {

                return Response.json({

                    success: false,

                    message:
                        "Please type DELETE to confirm account deletion."

                }, {

                    status: 400

                });

            }


            // ==================================================
            // DELETE STUDENT PROGRESS
            //
            // This table does NOT cascade automatically.
            // ==================================================

            await env.DB.prepare(

                `
                DELETE FROM student_progress

                WHERE student_id = ?
                `

            )

            .bind(
                studentId
            )

            .run();


            // ==================================================
            // DELETE STUDENT
            //
            // Database CASCADE handles the confirmed
            // student-owned records.
            // ==================================================

            const deleteResult =
                await env.DB.prepare(

                    `
                    DELETE FROM students

                    WHERE id = ?

                    AND account_status = 'active'
                    `

                )

                .bind(
                    studentId
                )

                .run();


            // ==================================================
            // VERIFY DELETE
            // ==================================================

            if (
                !deleteResult.success ||
                Number(
                    deleteResult.meta?.changes || 0
                ) !== 1
            ) {

                console.error(

                    "Account deletion failed:",

                    deleteResult

                );


                return Response.json({

                    success: false,

                    message:
                        "Unable to delete your account."

                }, {

                    status: 500

                });

            }


            // ==================================================
            // SUCCESS
            // ==================================================

            return Response.json({

                success: true,

                message:
                    "Your Nursephere account has been deleted successfully."

            }, {

                status: 200

            });

        }


        // ==================================================
        // METHOD NOT ALLOWED
        // ==================================================

        return Response.json({

            success: false,

            message:
                "Method Not Allowed."

        }, {

            status: 405

        });

    }


    // ======================================================
    // UNEXPECTED ERROR
    // ======================================================

    catch (error) {

        console.error(

            "Settings Worker Error:",

            error

        );


        return Response.json({

            success: false,

            message:
                "An unexpected error occurred while processing your settings."

        }, {

            status: 500

        });

    }

}