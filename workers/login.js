// ======================================================
// Nursephere Login Worker
// ======================================================

import bcrypt from "bcryptjs";

export default async function loginHandler(request, env) {

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

        const {

            email,

            password

        } = await request.json();

        if (!email || !password) {

            return Response.json(

                {

                    success: false,

                    message: "Email and password are required."

                },

                {

                    status: 400

                }

            );

        }

        const student = await env.DB.prepare(

            `
            SELECT *

            FROM students

            WHERE email = ?
            `

        )

        .bind(email.toLowerCase())

        .first();

        if (!student) {

            return Response.json(

                {

                    success: false,

                    message: "Invalid email or password."

                },

                {

                    status: 401

                }

            );

        }

        const validPassword = await bcrypt.compare(

            password,

            student.password_hash

        );

        if (!validPassword) {

            return Response.json(

                {

                    success: false,

                    message: "Invalid email or password."

                },

                {

                    status: 401

                }

            );

        }

        return Response.json({

            success: true,

            message: "Login successful.",

            student: {

                id: student.id,

                studentNumber: student.student_number,

                fullName: student.full_name,

                email: student.email,

                subscriptionStatus: student.subscription_status,

                trialActive: student.trial_active

            }

        });

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