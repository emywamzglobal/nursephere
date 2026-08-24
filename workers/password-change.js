// ======================================================
// Nursephere Password Change Worker
// File: workers/password-change.js
//
// PASSWORD CHANGE SYSTEM
//
// POST /api/password/change
//
// Authenticated student
//     ↓
// Verify JWT
//     ↓
// Get studentId from verified JWT
//     ↓
// Read current password_hash from students
//     ↓
// Verify current password with bcrypt
//     ↓
// Validate new password
//     ↓
// Hash new password with bcrypt
//     ↓
// Update students.password_hash
//     ↓
// Update students.updated_at
// ======================================================

import bcrypt from "bcryptjs";

import jwt from "@tsndr/cloudflare-worker-jwt";


export default async function passwordChangeHandler(
    request,
    env
) {

    try {

        const url =
            new URL(request.url);

        const pathname =
            url.pathname;


        // ==================================================
        // METHOD + ROUTE
        // ==================================================

        if (

            request.method !== "POST" ||

            pathname !==
                "/api/password/change"

        ) {

            return Response.json({

                success: false,

                message:
                    "Route not found."

            }, {

                status: 404

            });

        }


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
            authHeader.substring(7).trim();


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
        // READ REQUEST BODY
        // ==================================================

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
        // READ PASSWORDS
        // ==================================================

        const currentPassword =
            String(
                data?.currentPassword || ""
            );


        const newPassword =
            String(
                data?.newPassword || ""
            );


        const confirmPassword =
            String(
                data?.confirmPassword || ""
            );


        // ==================================================
        // REQUIRED FIELDS
        // ==================================================

        if (

            !currentPassword ||

            !newPassword ||

            !confirmPassword

        ) {

            return Response.json({

                success: false,

                message:
                    "Current password, new password, and confirmation are required."

            }, {

                status: 400

            });

        }


        // ==================================================
        // NEW PASSWORD VALIDATION
        // ==================================================

        if (
            newPassword.length < 8
        ) {

            return Response.json({

                success: false,

                message:
                    "New password must be at least 8 characters."

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
                    "New password must contain at least one uppercase letter."

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
                    "New password must contain at least one lowercase letter."

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
                    "New password must contain at least one number."

            }, {

                status: 400

            });

        }


        // ==================================================
        // CONFIRM PASSWORD
        // ==================================================

        if (
            newPassword !==
            confirmPassword
        ) {

            return Response.json({

                success: false,

                message:
                    "New passwords do not match."

            }, {

                status: 400

            });

        }


        // ==================================================
        // GET STUDENT
        //
        // Identity comes ONLY from the verified JWT.
        // ==================================================

        const student =
            await env.DB.prepare(

                `
                SELECT

                    id,
                    password_hash,
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
        // VERIFY CURRENT PASSWORD
        // ==================================================

        const currentPasswordValid =
            await bcrypt.compare(

                currentPassword,

                student.password_hash

            );


        if (
            !currentPasswordValid
        ) {

            return Response.json({

                success: false,

                message:
                    "Current password is incorrect."

            }, {

                status: 401

            });

        }


        // ==================================================
        // PREVENT SAME PASSWORD
        // ==================================================

        const samePassword =
            await bcrypt.compare(

                newPassword,

                student.password_hash

            );


        if (
            samePassword
        ) {

            return Response.json({

                success: false,

                message:
                    "Your new password must be different from your current password."

            }, {

                status: 400

            });

        }


        // ==================================================
        // HASH NEW PASSWORD
        // ==================================================

        const newPasswordHash =
            await bcrypt.hash(

                newPassword,

                12

            );


        // ==================================================
        // UPDATE PASSWORD
        // ==================================================

        const updatedAt =
            new Date().toISOString();


        const updateResult =
            await env.DB.prepare(

                `
                UPDATE students

                SET

                    password_hash = ?,

                    updated_at = ?

                WHERE id = ?

                `

            )

            .bind(

                newPasswordHash,

                updatedAt,

                studentId

            )

            .run();


        // ==================================================
        // VERIFY DATABASE UPDATE
        // ==================================================

        if (
            !updateResult.success ||
            updateResult.meta?.changes !== 1
        ) {

            console.error(

                "Password update failed:",

                updateResult

            );


            return Response.json({

                success: false,

                message:
                    "Unable to update your password."

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
                "Your password has been changed successfully."

        }, {

            status: 200

        });

    }


    // ======================================================
    // UNEXPECTED ERROR
    // ======================================================

    catch (error) {

        console.error(

            "Password Change Worker Error:",

            error

        );


        return Response.json({

            success: false,

            message:
                "An unexpected error occurred while changing your password."

        }, {

            status: 500

        });

    }

}