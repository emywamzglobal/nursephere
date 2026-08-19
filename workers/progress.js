// ======================================================
// Nursephere Progress Worker
// File: workers/progress.js
// ======================================================

import jwt from "@tsndr/cloudflare-worker-jwt";

export default async function progressHandler(
    request,
    env
) {

    try {

        /*=========================================
                VERIFY REQUEST METHOD
        =========================================*/

        if (request.method !== "GET") {

            return Response.json(

                {
                    success: false,
                    message:
                        "Method Not Allowed."
                },

                {
                    status: 405
                }

            );

        }


        /*=========================================
                VERIFY JWT
        =========================================*/

        const authHeader =
            request.headers.get(
                "Authorization"
            );

        if (
            !authHeader ||
            !authHeader.startsWith("Bearer ")
        ) {

            return Response.json(

                {
                    success: false,
                    message:
                        "Unauthorized."
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
                    message:
                        "Invalid or expired session."
                },

                {
                    status: 401
                }

            );

        }


        /*=========================================
                GET STUDENT ID
        =========================================*/

        const payload =
            jwt.decode(token).payload;


        const studentId =
            payload.studentId;


        if (!studentId) {

            return Response.json(

                {
                    success: false,
                    message:
                        "Student identity missing."
                },

                {
                    status: 401
                }

            );

        }


        /*=========================================
                VERIFY STUDENT
        =========================================*/

        const student =
            await env.DB.prepare(

                `
                SELECT

                    id,
                    full_name,
                    email,
                    subscription_status

                FROM students

                WHERE id = ?

                LIMIT 1
                `

            )
            .bind(studentId)
            .first();


        if (!student) {

            return Response.json(

                {
                    success: false,
                    message:
                        "Student not found."
                },

                {
                    status: 404
                }

            );

        }


        /*=========================================
                FETCH STUDENT PROGRESS
        =========================================*/

        const progress =
            await env.DB.prepare(

                `
                SELECT

                    subjects_started,
                    questions_answered,
                    questions_remaining,
                    success_rate,
                    exams_completed

                FROM student_progress

                WHERE student_id = ?

                LIMIT 1
                `

            )
            .bind(studentId)
            .first();


        /*=========================================
                PROGRESS NOT FOUND
        =========================================*/

        if (!progress) {

            return Response.json(

                {
                    success: false,
                    message:
                        "Student progress not found."
                },

                {
                    status: 404
                }

            );

        }


        /*=========================================
                NORMALIZE PROGRESS
        =========================================*/

        const subjectsStarted =
            Number(
                progress.subjects_started ?? 0
            );


        const questionsAnswered =
            Number(
                progress.questions_answered ?? 0
            );


        const questionsRemaining =
            Number(
                progress.questions_remaining ?? 0
            );


        const successRate =
            Number(
                progress.success_rate ?? 0
            );


        const examsCompleted =
            Number(
                progress.exams_completed ?? 0
            );


        /*=========================================
                SUCCESS RESPONSE
        =========================================*/

        return Response.json(

            {

                success: true,

                student: {

                    id:
                        student.id,

                    full_name:
                        student.full_name,

                    email:
                        student.email,

                    subscription_status:
                        student.subscription_status

                },

                progress: {

                    questions_answered:
                        questionsAnswered,

                    exams_completed:
                        examsCompleted,

                    subjects_started:
                        subjectsStarted,

                    success_rate:
                        successRate,

                    questions_remaining:
                        questionsRemaining

                }

            },

            {

                status: 200

            }

        );

    }


    /*=========================================
            SERVER ERROR
    =========================================*/

    catch (error) {

        console.error(

            "PROGRESS WORKER ERROR:",

            error

        );


        return Response.json(

            {

                success: false,

                message:
                    "Failed to load student progress."

            },

            {

                status: 500

            }

        );

    }

}