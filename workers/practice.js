export default async function practiceHandler(request, env) {

    try {

        const url = new URL(request.url);

        // =====================================
// GET STUDY RESOURCES
// GET /api/subjects/:subjectId/resources
// =====================================

if (
    request.method === "GET" &&
    url.pathname.startsWith("/api/subjects/") &&
    url.pathname.endsWith("/resources")
) {

    const parts = url.pathname.split("/");
    const subjectId = parts[3];

    const subject = await env.DB.prepare(`
        SELECT
            id,
            name,
            description
        FROM subjects
        WHERE id = ?
        AND status = 'active'
    `)
    .bind(subjectId)
    .first();

    if (!subject) {

        return Response.json({
            success: false,
            message: "Subject not found."
        }, {
            status: 404
        });

    }

    const { results } = await env.DB.prepare(`
        SELECT
            id,
            title,
            description,
            file_url,
            cover_image,
            file_type AS type
        FROM study_resources
        WHERE subject_id = ?
        AND status = 'active'
        ORDER BY created_at DESC
    `)
    .bind(subjectId)
    .all();

    return Response.json({

        success: true,

        subject,

        resources: results

    });

}

        // =====================================
        // GET PRACTICE QUESTIONS
        // =====================================

        if (request.method === "GET") {

            const subjectId = url.searchParams.get("subject_id");

            if (!subjectId) {

                return Response.json({

                    success: false,

                    message: "Subject ID is required."

                }, {

                    status: 400

                });

            }

            const { results } = await env.DB.prepare(

                `SELECT
                    id,
                    subject_id,
                    question,
                    image_url,
                    option_a,
                    option_b,
                    option_c,
                    option_d,
                    correct_answer,
                    explanation
                 FROM practice_questions
                 WHERE subject_id = ?
                 AND status = 'active'
                 ORDER BY RANDOM();`

            )

            .bind(subjectId)

            .all();

            return Response.json({

                success: true,

                questions: results

            });

        }

        // =====================================
        // SUBMIT PRACTICE
        // =====================================

        if (request.method === "POST") {

            const body = await request.json();

            const {

                student_id,

                subject_id,

                total_questions,

                correct_answers,

                wrong_answers,

                score

            } = body;

            await env.DB.prepare(

                `INSERT INTO student_progress (

                    id,

                    student_id,

                    subject_id,

                    total_questions,

                    correct_answers,

                    wrong_answers,

                    score,

                    last_attempt,

                    created_at,

                    updated_at

                )

                VALUES (

                    ?,?,?,?,?,?,?,?,?,?

                )`

            )

            .bind(

                crypto.randomUUID(),

                student_id,

                subject_id,

                total_questions,

                correct_answers,

                wrong_answers,

                score,

                new Date().toISOString(),

                new Date().toISOString(),

                new Date().toISOString()

            )

            .run();

            return Response.json({

                success: true,

                message: "Practice submitted successfully."

            });

        }

        return Response.json({

            success: false,

            message: "Method Not Allowed."

        }, {

            status: 405

        });

    }

    catch (error) {

        console.error(error);

        return Response.json({

            success: false,

            message: error.message

        }, {

            status: 500

        });

    }

}