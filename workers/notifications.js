// =====================================================
// Nursephere Notifications Worker
// =====================================================

export default async function notificationsHandler(request, env) {

    try {

        const url = new URL(request.url);

        // ----------------------------------------
        // GET Notifications
        // ----------------------------------------

        if (request.method === "GET") {

            const studentId = url.searchParams.get("studentId");

            if (!studentId) {

                return Response.json({

                    success: false,

                    message: "Student ID is required."

                }, {

                    status: 400

                });

            }

            const { results } = await env.DB.prepare(

                `
                SELECT *

                FROM notifications

                WHERE student_id = ?

                ORDER BY created_at DESC
                `

            )

            .bind(studentId)

            .all();

            return Response.json({

                success: true,

                notifications: results

            });

        }

        // ----------------------------------------
        // MARK NOTIFICATION AS READ
        // ----------------------------------------

        if (request.method === "POST") {

            const { notificationId } = await request.json();

            if (!notificationId) {

                return Response.json({

                    success: false,

                    message: "Notification ID is required."

                }, {

                    status: 400

                });

            }

            await env.DB.prepare(

                `
                UPDATE notifications

                SET is_read = 1

                WHERE id = ?
                `

            )

            .bind(notificationId)

            .run();

            return Response.json({

                success: true,

                message: "Notification marked as read."

            });

        }

        return Response.json({

            success: false,

            message: "Method Not Allowed"

        }, {

            status: 405

        });

    }

    catch (error) {

        return Response.json({

            success: false,

            message: error.message

        }, {

            status: 500

        });

    }

}