// ======================================================
// Nursephere Dashboard Worker
// ======================================================

export default async function dashboardHandler(request, env) {

    try {

        const url = new URL(request.url);

        const studentId = url.searchParams.get("studentId");

        if (!studentId) {

            return Response.json(

                {

                    success: false,

                    message: "Student ID is required."

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

            WHERE id = ?
            `

        )

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

        /*=========================================
                STUDENT PROGRESS
        =========================================*/

        const progress = await env.DB.prepare(

            `
            SELECT *

            FROM student_progress

            WHERE student_id = ?
            `

        )

        .bind(studentId)

        .first();

        /*=========================================
                TRIAL INFORMATION
        =========================================*/

        const now = new Date();

        const expiryDate = new Date(student.trial_expires_at);

        const daysLeft = Math.max(

            0,

            Math.ceil(

                (expiryDate - now) / (1000 * 60 * 60 * 24)

            )

        );

        return Response.json(

            {

                success: true,

                student: {

                    id: student.id,

                    studentNumber: student.student_number,

                    fullName: student.full_name,

                    email: student.email,

                    subscriptionStatus: student.subscription_status

                },

                trial: {

                    active: Boolean(student.trial_active),

                    daysLeft

                },

                progress

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