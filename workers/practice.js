/*
========================================================
    NurseSphere Student Practice Worker
    Production / Secure Version
    File: workers/practice.js
========================================================
*/

import jwt from "@tsndr/cloudflare-worker-jwt";


/* ======================================================
   MAIN HANDLER
====================================================== */

export default async function practiceHandler(request, env) {

    try {

        const url =
            new URL(request.url);

        const method =
            request.method;


        /* ==================================================
           CORS / PREFLIGHT
        ================================================== */

        if (method === "OPTIONS") {

            return new Response(null, {
                status: 204
            });

        }


        /* ==================================================
           AUTHENTICATION
           Every student Practice endpoint requires JWT.
        ================================================== */

        const auth =
            await authenticateStudent(
                request,
                env
            );


        if (!auth.success) {

            return json(
                {
                    success: false,
                    message: auth.message
                },
                auth.status || 401
            );

        }


        const studentId =
            auth.studentId;


        /* ==================================================
           GET /api/exams
           Active examinations published by Admin.
        ================================================== */

        if (
            method === "GET" &&
            url.pathname === "/api/exams"
        ) {

            const { results } =
                await env.DB.prepare(`
                    SELECT
                        id,
                        name,
                        description,
                        image_url,
                        display_order
                    FROM exams
                    WHERE status = 'active'
                    ORDER BY display_order ASC, name ASC
                `)
                .all();


            return json(
                {
                    success: true,
                    exams: results || []
                },
                200,
                {
                    "Cache-Control": "no-store"
                }
            );

        }


        /* ==================================================
           GET /api/subjects?exam_id=...
           ONLY subjects belonging to selected active exam.
        ================================================== */

        if (
            method === "GET" &&
            url.pathname === "/api/subjects"
        ) {

            const examId =
                url.searchParams.get("exam_id");

            const subjectId =
                url.searchParams.get("subject_id");


            /* ----------------------------------------------
               LOAD ONE SUBJECT
            ---------------------------------------------- */

            if (subjectId) {

                const subject =
                    await env.DB.prepare(`
                        SELECT
                            s.id,
                            s.exam_id,
                            s.name,
                            s.description,
                            s.image_url,
                            s.display_order
                        FROM subjects s
                        INNER JOIN exams e
                            ON e.id = s.exam_id
                        WHERE s.id = ?
                          AND s.status = 'active'
                          AND e.status = 'active'
                        LIMIT 1
                    `)
                    .bind(subjectId)
                    .first();


                if (!subject) {

                    return json(
                        {
                            success: false,
                            message:
                                "Subject not found."
                        },
                        404
                    );

                }


                return json(
                    {
                        success: true,
                        subject
                    },
                    200,
                    {
                        "Cache-Control":
                            "no-store"
                    }
                );

            }


            /* ----------------------------------------------
               EXAM ID REQUIRED
            ---------------------------------------------- */

            if (!examId) {

                return json(
                    {
                        success: false,
                        message:
                            "Exam ID is required."
                    },
                    400
                );

            }


            /* ----------------------------------------------
               VERIFY ACTIVE EXAM
            ---------------------------------------------- */

            const exam =
                await env.DB.prepare(`
                    SELECT
                        id,
                        name,
                        description
                    FROM exams
                    WHERE id = ?
                      AND status = 'active'
                    LIMIT 1
                `)
                .bind(examId)
                .first();


            if (!exam) {

                return json(
                    {
                        success: false,
                        message:
                            "Exam not found."
                    },
                    404
                );

            }


            /* ----------------------------------------------
               LOAD ONLY SUBJECTS FOR THIS EXAM
            ---------------------------------------------- */

            const { results } =
                await env.DB.prepare(`
                    SELECT
                        id,
                        exam_id,
                        name,
                        description,
                        image_url,
                        display_order
                    FROM subjects
                    WHERE exam_id = ?
                      AND status = 'active'
                    ORDER BY display_order ASC, name ASC
                `)
                .bind(examId)
                .all();


            return json(
                {
                    success: true,
                    exam,
                    subjects: results || []
                },
                200,
                {
                    "Cache-Control":
                        "no-store"
                }
            );

        }


        /* ==================================================
           GET /api/practice?subject_id=...
           
           IMPORTANT:
           NEVER return correct_answer here.
        ================================================== */

        if (
            method === "GET" &&
            url.pathname === "/api/practice"
        ) {

            const subjectId =
                url.searchParams.get(
                    "subject_id"
                );


            if (!subjectId) {

                return json(
                    {
                        success: false,
                        message:
                            "Subject ID is required."
                    },
                    400
                );

            }


            /* ----------------------------------------------
               VERIFY SUBJECT + EXAM
            ---------------------------------------------- */

            const subject =
                await env.DB.prepare(`
                    SELECT
                        s.id,
                        s.exam_id,
                        s.name,
                        s.description
                    FROM subjects s
                    INNER JOIN exams e
                        ON e.id = s.exam_id
                    WHERE s.id = ?
                      AND s.status = 'active'
                      AND e.status = 'active'
                    LIMIT 1
                `)
                .bind(subjectId)
                .first();


            if (!subject) {

                return json(
                    {
                        success: false,
                        message:
                            "Subject not found."
                    },
                    404
                );

            }


            /* ----------------------------------------------
               LOAD QUESTIONS
               
               correct_answer IS DELIBERATELY EXCLUDED.
            ---------------------------------------------- */

            const { results } =
                await env.DB.prepare(`
                    SELECT
                        id,
                        subject_id,
                        question,
                        image_url,
                        option_a,
                        option_b,
                        option_c,
                        option_d,
                        difficulty
                    FROM practice_questions
                    WHERE subject_id = ?
                      AND status = 'active'
                    ORDER BY RANDOM()
                `)
                .bind(subjectId)
                .all();


            return json(
                {
                    success: true,
                    subject,
                    total_questions:
                        results?.length || 0,
                    questions:
                        results || []
                },
                200,
                {
                    "Cache-Control":
                        "no-store"
                }
            );

        }


        /* ==================================================
           POST /api/practice/answer

           Student submits ONE answer.

           Worker checks correct answer from D1.
        ================================================== */

        if (
            method === "POST" &&
            url.pathname === "/api/practice/answer"
        ) {

            const body =
                await parseJson(request);


            if (!body) {

                return json(
                    {
                        success: false,
                        message:
                            "Invalid request body."
                    },
                    400
                );

            }


            const questionId =
                body.question_id;

            const selectedAnswer =
                normalizeAnswer(
                    body.answer
                );


            if (
                !questionId ||
                !selectedAnswer
            ) {

                return json(
                    {
                        success: false,
                        message:
                            "Question ID and answer are required."
                    },
                    400
                );

            }


            if (
                !["A", "B", "C", "D"]
                    .includes(selectedAnswer)
            ) {

                return json(
                    {
                        success: false,
                        message:
                            "Invalid answer."
                    },
                    400
                );

            }


            /* ----------------------------------------------
               GET ANSWER FROM D1

               Student can NEVER supply the answer key.
            ---------------------------------------------- */

            const question =
                await env.DB.prepare(`
                    SELECT
                        id,
                        subject_id,
                        correct_answer,
                        explanation
                    FROM practice_questions
                    WHERE id = ?
                      AND status = 'active'
                    LIMIT 1
                `)
                .bind(questionId)
                .first();


            if (!question) {

                return json(
                    {
                        success: false,
                        message:
                            "Question not found."
                    },
                    404
                );

            }


            /* ----------------------------------------------
               VERIFY QUESTION'S SUBJECT IS ACTIVE
            ---------------------------------------------- */

            const validSubject =
                await env.DB.prepare(`
                    SELECT
                        s.id
                    FROM subjects s
                    INNER JOIN exams e
                        ON e.id = s.exam_id
                    WHERE s.id = ?
                      AND s.status = 'active'
                      AND e.status = 'active'
                    LIMIT 1
                `)
                .bind(question.subject_id)
                .first();


            if (!validSubject) {

                return json(
                    {
                        success: false,
                        message:
                            "This question is no longer available."
                    },
                    404
                );

            }


            const correctAnswer =
                normalizeAnswer(
                    question.correct_answer
                );


            const isCorrect =
                selectedAnswer ===
                correctAnswer;


            return json(
                {
                    success: true,

                    correct:
                        isCorrect,

                    correct_answer:
                        correctAnswer,

                    explanation:
                        question.explanation || ""
                }
            );

        }


        /* ==================================================
           POST /api/practice

           FINAL RESULT SUBMISSION

           IMPORTANT:
           The browser sends ANSWERS, not a score.

           Worker calculates:
           - total
           - correct
           - wrong
           - score
        ================================================== */

        if (
            method === "POST" &&
            url.pathname === "/api/practice"
        ) {

            const body =
                await parseJson(request);


            if (!body) {

                return json(
                    {
                        success: false,
                        message:
                            "Invalid request body."
                    },
                    400
                );

            }


            const subjectId =
                body.subject_id;


            const answers =
                Array.isArray(body.answers)
                    ? body.answers
                    : null;


            if (
                !subjectId ||
                !answers
            ) {

                return json(
                    {
                        success: false,
                        message:
                            "Subject ID and answers are required."
                    },
                    400
                );

            }


            /* ----------------------------------------------
               VERIFY SUBJECT
            ---------------------------------------------- */

            const subject =
                await env.DB.prepare(`
                    SELECT
                        s.id,
                        s.exam_id,
                        s.name
                    FROM subjects s
                    INNER JOIN exams e
                        ON e.id = s.exam_id
                    WHERE s.id = ?
                      AND s.status = 'active'
                      AND e.status = 'active'
                    LIMIT 1
                `)
                .bind(subjectId)
                .first();


            if (!subject) {

                return json(
                    {
                        success: false,
                        message:
                            "Subject not found."
                    },
                    404
                );

            }


            if (!answers.length) {

                return json(
                    {
                        success: false,
                        message:
                            "No answers were submitted."
                    },
                    400
                );

            }


            /* ----------------------------------------------
               CLEAN ANSWERS
            ---------------------------------------------- */

            const cleanAnswers =
                answers
                    .map(answer => ({

                        question_id:
                            String(
                                answer?.question_id || ""
                            ),

                        answer:
                            normalizeAnswer(
                                answer?.answer
                            )

                    }))
                    .filter(answer =>
                        answer.question_id &&
                        ["A", "B", "C", "D"]
                            .includes(answer.answer)
                    );


            if (!cleanAnswers.length) {

                return json(
                    {
                        success: false,
                        message:
                            "No valid answers were submitted."
                    },
                    400
                );

            }


            /* ----------------------------------------------
               REMOVE DUPLICATE QUESTION IDs
            ---------------------------------------------- */

            const uniqueAnswers =
                new Map();


            for (
                const answer
                of cleanAnswers
            ) {

                uniqueAnswers.set(
                    answer.question_id,
                    answer.answer
                );

            }


            const questionIds =
                Array.from(
                    uniqueAnswers.keys()
                );


            /* ----------------------------------------------
               LOAD OFFICIAL ANSWERS FROM D1
            ---------------------------------------------- */

            const placeholders =
                questionIds
                    .map(() => "?")
                    .join(",");


            const { results: questions } =
                await env.DB.prepare(`
                    SELECT
                        id,
                        subject_id,
                        correct_answer
                    FROM practice_questions
                    WHERE id IN (${placeholders})
                      AND subject_id = ?
                      AND status = 'active'
                `)
                .bind(
                    ...questionIds,
                    subjectId
                )
                .all();


            if (
                !questions ||
                !questions.length
            ) {

                return json(
                    {
                        success: false,
                        message:
                            "No valid questions were found for this subject."
                    },
                    400
                );

            }


            /* ----------------------------------------------
               CALCULATE RESULT SERVER-SIDE
            ---------------------------------------------- */

            let correctAnswers =
                0;


            for (
                const question
                of questions
            ) {

                const submitted =
                    uniqueAnswers.get(
                        String(question.id)
                    );


                const correct =
                    normalizeAnswer(
                        question.correct_answer
                    );


                if (
                    submitted &&
                    submitted === correct
                ) {

                    correctAnswers++;

                }

            }


            const totalQuestions =
                questions.length;


            const wrongAnswers =
                totalQuestions -
                correctAnswers;


            const score =
                totalQuestions > 0
                    ? Math.round(
                        (
                            correctAnswers /
                            totalQuestions
                        ) * 100
                    )
                    : 0;


            /* ----------------------------------------------
               SAVE AUTHORITATIVE RESULT
               
               studentId comes from JWT.
               NEVER from browser.
            ---------------------------------------------- */

            const now =
                new Date().toISOString();


            await env.DB.prepare(`
                INSERT INTO student_progress (
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
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `)
            .bind(
                crypto.randomUUID(),
                studentId,
                subjectId,
                totalQuestions,
                correctAnswers,
                wrongAnswers,
                score,
                now,
                now,
                now
            )
            .run();


            return json({

                success: true,

                message:
                    "Practice results saved successfully.",

                result: {

                    subject_id:
                        subjectId,

                    total_questions:
                        totalQuestions,

                    correct_answers:
                        correctAnswers,

                    wrong_answers:
                        wrongAnswers,

                    score:
                        score

                }

            });

        }


        /* ==================================================
           GET /api/subjects/{subjectId}/resources

           Admin-published active resources only.
        ================================================== */

        if (
            method === "GET" &&
            url.pathname.startsWith(
                "/api/subjects/"
            ) &&
            url.pathname.endsWith(
                "/resources"
            )
        ) {

            const parts =
                url.pathname.split("/");


            const subjectId =
                parts[3];


            if (!subjectId) {

                return json(
                    {
                        success: false,
                        message:
                            "Subject ID is required."
                    },
                    400
                );

            }


            const subject =
                await env.DB.prepare(`
                    SELECT
                        s.id,
                        s.name,
                        s.description
                    FROM subjects s
                    INNER JOIN exams e
                        ON e.id = s.exam_id
                    WHERE s.id = ?
                      AND s.status = 'active'
                      AND e.status = 'active'
                    LIMIT 1
                `)
                .bind(subjectId)
                .first();


            if (!subject) {

                return json(
                    {
                        success: false,
                        message:
                            "Subject not found."
                    },
                    404
                );

            }


            const { results } =
                await env.DB.prepare(`
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


            return json(
                {
                    success: true,
                    subject,
                    resources:
                        results || []
                },
                200,
                {
                    "Cache-Control":
                        "no-store"
                }
            );

        }


        /* ==================================================
           GET /api/resources/{resourceId}/download
        ================================================== */

        if (
            method === "GET" &&
            url.pathname.startsWith(
                "/api/resources/"
            ) &&
            url.pathname.endsWith(
                "/download"
            )
        ) {

            const parts =
                url.pathname.split("/");


            const resourceId =
                parts[3];


            if (!resourceId) {

                return json(
                    {
                        success: false,
                        message:
                            "Resource ID is required."
                    },
                    400
                );

            }


            const resource =
                await env.DB.prepare(`
                    SELECT
                        r.id,
                        r.title,
                        r.file_url
                    FROM study_resources r
                    INNER JOIN subjects s
                        ON s.id = r.subject_id
                    INNER JOIN exams e
                        ON e.id = s.exam_id
                    WHERE r.id = ?
                      AND r.status = 'active'
                      AND s.status = 'active'
                      AND e.status = 'active'
                    LIMIT 1
                `)
                .bind(resourceId)
                .first();


            if (!resource) {

                return json(
                    {
                        success: false,
                        message:
                            "Resource not found."
                    },
                    404
                );

            }


            return json({

                success: true,

                download_url:
                    resource.file_url,

                title:
                    resource.title

            });

        }


        /* ==================================================
           ENDPOINT NOT FOUND
        ================================================== */

        return json(
            {
                success: false,
                message:
                    "Endpoint not found."
            },
            404
        );


    }

    catch (error) {

        console.error(
            "Practice Worker Error:",
            error
        );


        return json(
            {
                success: false,
                message:
                    "Internal Server Error"
            },
            500
        );

    }

}


/* ======================================================
   AUTHENTICATE STUDENT
====================================================== */

async function authenticateStudent(
    request,
    env
) {

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

        return {

            success: false,

            status: 401,

            message:
                "Unauthorized."

        };

    }


    const token =
        authHeader.substring(7).trim();


    if (!token) {

        return {

            success: false,

            status: 401,

            message:
                "Unauthorized."

        };

    }


    let valid;


    try {

        valid =
            await jwt.verify(
                token,
                env.JWT_SECRET
            );

    }

    catch (error) {

        console.error(
            "JWT verification error:",
            error
        );

        valid =
            false;

    }


    if (!valid) {

        return {

            success: false,

            status: 401,

            message:
                "Invalid or expired session."

        };

    }


    let payload;


    try {

        payload =
            jwt.decode(
                token
            ).payload;

    }

    catch {

        return {

            success: false,

            status: 401,

            message:
                "Invalid session."

        };

    }


    const studentId =
        payload?.studentId;


    if (!studentId) {

        return {

            success: false,

            status: 401,

            message:
                "Student identity missing."

        };

    }


    /* ----------------------------------------------
       VERIFY STUDENT STILL EXISTS
    ---------------------------------------------- */

    const student =
        await env.DB.prepare(`
            SELECT
                id
            FROM students
            WHERE id = ?
            LIMIT 1
        `)
        .bind(studentId)
        .first();


    if (!student) {

        return {

            success: false,

            status: 401,

            message:
                "Student account not found."

        };

    }


    return {

        success: true,

        studentId:
            student.id

    };

}


/* ======================================================
   JSON BODY
====================================================== */

async function parseJson(request) {

    try {

        return await request.json();

    }

    catch {

        return null;

    }

}


/* ======================================================
   NORMALIZE ANSWER
====================================================== */

function normalizeAnswer(answer) {

    if (
        answer === null ||
        answer === undefined
    ) {

        return "";

    }


    return String(answer)
        .trim()
        .toUpperCase();

}


/* ======================================================
   JSON RESPONSE
====================================================== */

function json(
    data,
    status = 200,
    headers = {}
) {

    return Response.json(
        data,
        {
            status,
            headers
        }
    );

}