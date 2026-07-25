/*
========================================================
    NurseSphere Student Practice Worker
    File: workers/practice.js
========================================================*/

export default async function practiceHandler(request, env) {

    try {

        const url = new URL(request.url);

        const method = request.method;

        /*==================================================
            ROUTE:
            GET /api/exams
        ==================================================*/

        if (

            method === "GET" &&
            url.pathname === "/api/exams"

        ) {

            const { results } = await env.DB.prepare(`

                SELECT

                    id,
                    name,
                    description,
                    image_url,
                    display_order

                FROM exams

                WHERE status='active'

                ORDER BY display_order ASC, name ASC

            `).all();

            return Response.json({

                success: true,

                exams: results

            });

        }

        /*==================================================
            ROUTE:
            GET /api/subjects
            ?exam_id=...
            ?subject_id=...
        ==================================================*/

        if (

            method === "GET" &&
            url.pathname === "/api/subjects"

        ) {

            const examId = url.searchParams.get("exam_id");

            const subjectId = url.searchParams.get("subject_id");

            /*
            ------------------------------------------
            Load ONE Subject
            Used by questions.js
            ------------------------------------------
            */

            if (subjectId) {

                const subject = await env.DB.prepare(`

                    SELECT

                        id,
                        exam_id,
                        name,
                        description,
                        image_url

                    FROM subjects

                    WHERE id=?
                    AND status='active'

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

                return Response.json({

                    success: true,

                    subject

                });

            }

            /*
            ------------------------------------------
            Load Subjects for an Exam
            Used by practice.js
            ------------------------------------------
            */

            if (!examId) {

                return Response.json({

                    success: false,

                    message: "Exam ID is required."

                }, {

                    status: 400

                });

            }

            const exam = await env.DB.prepare(`

                SELECT

                    id,
                    name,
                    description

                FROM exams

                WHERE id=?
                AND status='active'

            `)

            .bind(examId)

            .first();

            if (!exam) {

                return Response.json({

                    success: false,

                    message: "Exam not found."

                }, {

                    status: 404

                });

            }

            const { results } = await env.DB.prepare(`

                SELECT

                    id,
                    exam_id,
                    name,
                    description,
                    image_url,
                    display_order

                FROM subjects

                WHERE exam_id=?
                AND status='active'

                ORDER BY display_order ASC, name ASC

            `)

            .bind(examId)

            .all();

            return Response.json({

                success: true,

                exam,

                subjects: results

            });

        }

                /*==================================================
            ROUTE:
            GET /api/practice?subject_id=...
        ==================================================*/

        if (

            method === "GET" &&
            url.pathname === "/api/practice"

        ) {

            const subjectId = url.searchParams.get("subject_id");

            if (!subjectId) {

                return Response.json({

                    success: false,

                    message: "Subject ID is required."

                }, {

                    status: 400

                });

            }

            const subject = await env.DB.prepare(`

                SELECT

                    id,
                    exam_id,
                    name,
                    description

                FROM subjects

                WHERE id=?
                AND status='active'

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
                    subject_id,
                    question,
                    image_url,
                    option_a,
                    option_b,
                    option_c,
                    option_d,
                    correct_answer,
                    explanation,
                    difficulty

                FROM practice_questions

                WHERE subject_id=?
                AND status='active'

                ORDER BY RANDOM()

            `)

            .bind(subjectId)

            .all();

            return Response.json({

                success: true,

                subject,

                total_questions: results.length,

                questions: results

            });

        }

        /*==================================================
            ROUTE:
            POST /api/practice
        ==================================================*/

        if (

            method === "POST" &&
            url.pathname === "/api/practice"

        ) {

            const body = await request.json();

            const {

                student_id,
                subject_id,
                total_questions,
                correct_answers,
                wrong_answers,
                score

            } = body;

            if (

                !student_id ||
                !subject_id ||
                total_questions === undefined ||
                correct_answers === undefined ||
                wrong_answers === undefined ||
                score === undefined

            ) {

                return Response.json({

                    success: false,

                    message: "Missing required fields."

                }, {

                    status: 400

                });

            }

            const now = new Date().toISOString();

            await env.DB.prepare(`

                INSERT INTO student_progress(

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

                VALUES(

                    ?,?,?,?,?,?,?,?,?,?

                )

            `)

            .bind(

                crypto.randomUUID(),

                student_id,

                subject_id,

                total_questions,

                correct_answers,

                wrong_answers,

                score,

                now,

                now,

                now

            )

            .run();

            return Response.json({

                success: true,

                message: "Practice results saved successfully."

            });

        }

                /*==================================================
            ROUTE:
            GET /api/subjects/{subjectId}/resources
        ==================================================*/

        if (

            method === "GET" &&
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

                WHERE id=?
                AND status='active'

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

                WHERE subject_id=?
                AND status='active'

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

        /*==================================================
            ROUTE:
            GET /api/resources/{resourceId}/download
        ==================================================*/

        if (

            method === "GET" &&
            url.pathname.startsWith("/api/resources/") &&
            url.pathname.endsWith("/download")

        ) {

            const parts = url.pathname.split("/");

            const resourceId = parts[3];

            const resource = await env.DB.prepare(`

                SELECT

                    id,
                    title,
                    file_url

                FROM study_resources

                WHERE id=?
                AND status='active'

            `)

            .bind(resourceId)

            .first();

            if (!resource) {

                return Response.json({

                    success: false,

                    message: "Resource not found."

                }, {

                    status: 404

                });

            }

            return Response.json({

                success: true,

                download_url: resource.file_url,

                title: resource.title

            });

        }

        /*==================================================
            ENDPOINT NOT FOUND
        ==================================================*/

        return Response.json({

            success: false,

            message: "Endpoint not found."

        }, {

            status: 404

        });

    }

    catch (error) {

        console.error(

            "Practice Worker Error:",

            error

        );

        return Response.json({

            success: false,

            message:

                error.message ||

                "Internal Server Error"

        }, {

            status: 500

        });

    }

}