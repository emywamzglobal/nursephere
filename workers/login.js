// ======================================================
// Nursephere Login Worker
// File: workers/login.js
// ======================================================


// ======================================================
// Dependencies
// ======================================================

import bcrypt from "bcryptjs";

import jwt from "@tsndr/cloudflare-worker-jwt";


// ======================================================
// LOGIN HANDLER
// ======================================================

export default async function loginHandler(
    request,
    env
) {

    try {


        // ======================================================
        // ADMIN LOGIN
        //
        // POST /api/admin/login
        //
        // Allows approved administrators to log in.
        // ======================================================

        if (

            request.method === "POST"

            &&

            new URL(request.url).pathname ===
                "/api/admin/login"

        ) {


            // ==================================================
            // READ REQUEST
            // ==================================================

            const data =
                await request.json();


            const email =
                typeof data.email === "string"

                    ? data.email
                        .trim()
                        .toLowerCase()

                    : "";


            const password =
                typeof data.password === "string"

                    ? data.password

                    : "";


            // ==================================================
            // VALIDATE INPUT
            // ==================================================

            if (

                !email

                ||

                !password

            ) {

                return Response.json(

                    {

                        success: false,

                        message:
                            "Email and password are required."

                    },

                    {

                        status: 400

                    }

                );

            }


            // ==================================================
            // FIND ADMINISTRATOR
            // ==================================================

            const admin =
                await env.DB.prepare(

                    `
                    SELECT

                        id,
                        first_name,
                        last_name,
                        email,
                        password_hash,
                        role,
                        status,
                        approval_status,
                        token_version

                    FROM admins

                    WHERE LOWER(email) =
                        LOWER(?)

                    LIMIT 1
                    `

                )

                .bind(
                    email
                )

                .first();


            // ==================================================
            // ADMIN NOT FOUND
            //
            // Keep this message generic for security.
            // ==================================================

            if (

                !admin

            ) {

                return Response.json(

                    {

                        success: false,

                        message:
                            "Invalid email or password."

                    },

                    {

                        status: 401

                    }

                );

            }


            // ==================================================
            // CHECK PASSWORD EXISTS
            //
            // Administrator must activate their account first.
            // ==================================================

            if (

                !admin.password_hash

            ) {

                return Response.json(

                    {

                        success: false,

                        message:
                            "Your administrator account has not been activated yet."

                    },

                    {

                        status: 403

                    }

                );

            }


            // ==================================================
            // CHECK ACCOUNT STATUS
            // ==================================================

            if (

                admin.status !==
                    "active"

            ) {

                return Response.json(

                    {

                        success: false,

                        message:
                            "This administrator account is inactive."

                    },

                    {

                        status: 403

                    }

                );

            }


            // ==================================================
            // CHECK APPROVAL STATUS
            // ==================================================

            if (

                admin.approval_status !==
                    "approved"

            ) {

                return Response.json(

                    {

                        success: false,

                        message:
                            "This administrator account has not been approved."

                    },

                    {

                        status: 403

                    }

                );

            }


            // ==================================================
            // VERIFY PASSWORD
            // ==================================================

            const validPassword =
                await bcrypt.compare(

                    password,

                    admin.password_hash

                );


            if (

                !validPassword

            ) {

                return Response.json(

                    {

                        success: false,

                        message:
                            "Invalid email or password."

                    },

                    {

                        status: 401

                    }

                );

            }


            // ==================================================
            // CREATE ADMIN JWT
            // ==================================================

            const token =
    await jwt.sign(

        {

            id:
                admin.id,

            email:
                admin.email,

            role:
                admin.role,

            token_version:
                admin.token_version

        },

        env.JWT_SECRET,

        {

            expiresIn:
                "30d"

        }

    );
            // ==================================================
            // UPDATE LAST LOGIN
            // ==================================================

            const now =
                new Date()
                    .toISOString();


            await env.DB.prepare(

                `
                UPDATE admins

                SET

                    last_login_at = ?,

                    updated_at = ?

                WHERE id = ?
                `

            )

            .bind(

                now,

                now,

                admin.id

            )

            .run();


            // ==================================================
            // LOGIN SUCCESSFUL
            // ==================================================

            return Response.json(

                {

                    success: true,

                    message:
                        "Login successful.",

                    token:

                        token,

                    admin: {

                        id:
                            admin.id,

                        firstName:
                            admin.first_name,

                        lastName:
                            admin.last_name,

                        email:
                            admin.email,

                        role:
                            admin.role

                    }

                }

            );

        }


        // ======================================================
        // STUDENT LOGIN
        //
        // POST /api/login
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
        // READ STUDENT LOGIN REQUEST
        // ======================================================

        const {

            email,

            password

        } = await request.json();


        if (

            !email

            ||

            !password

        ) {

            return Response.json(

                {

                    success: false,

                    message:
                        "Email and password are required."

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
            String(
                email
            )
            .trim()
            .toLowerCase();


        // ======================================================
        // FIND STUDENT
        // ======================================================

        const student =
            await env.DB.prepare(

                `
                SELECT *

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

            !student

        ) {

            return Response.json(

                {

                    success: false,

                    message:
                        "Invalid email or password."

                },

                {

                    status: 401

                }

            );

        }


        // ======================================================
        // VERIFY PASSWORD
        // ======================================================

        const validPassword =
            await bcrypt.compare(

                password,

                student.password_hash

            );


        if (

            !validPassword

        ) {

            return Response.json(

                {

                    success: false,

                    message:
                        "Invalid email or password."

                },

                {

                    status: 401

                }

            );

        }


        // ======================================================
        // CREATE STUDENT JWT
        // ======================================================

        const token =
            await jwt.sign(

                {

                    studentId:
                        student.id,

                    email:
                        student.email

                },

                env.JWT_SECRET,

                {

                    expiresIn:
                        "30d"

                }

            );


        // ======================================================
        // LOGIN SUCCESSFUL
        // ======================================================

        return Response.json(

            {

                success: true,

                message:
                    "Login successful.",

                token:

                    token,

                student: {

                    id:
                        student.id,

                    studentNumber:
                        student.student_number,

                    fullName:
                        student.full_name,

                    email:
                        student.email,

                    referralCode:
                        student.referral_code,

                    subscriptionStatus:
                        student.subscription_status,

                    trialActive:
                        student.trial_active

                }

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

            "Login Worker Error:",

            error

        );


        return Response.json(

            {

                success: false,

                message:
                    "Unable to complete login."

            },

            {

                status: 500

            }

        );

    }

}