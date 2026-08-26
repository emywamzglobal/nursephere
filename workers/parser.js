/*
=========================================================
    NURSEPHERE QUESTION IMPORT WORKER
=========================================================

    Purpose:
        Parse and bulk-import practice questions.

    Supported:
        - DOCX
        - XLSX

    Flow:
        Admin
          ↓
        Upload DOCX/XLSX
          ↓
        Parse
          ↓
        Validate every question
          ↓
        Verify Exam → Subject
          ↓
        Check duplicates
          ↓
        D1 batch insert
          ↓
        Return import result

=========================================================
*/

"use strict";

import * as XLSX from "xlsx";
import mammoth from "mammoth";

const ALLOWED_EXTENSIONS = [
    "docx",
    "xlsx",
    "xls"
];


export default async function parserHandler(
    request,
    env
) {

    try {

        const url =
            new URL(request.url);

        const pathname =
            url.pathname;

        const method =
            request.method;


        /*
        =================================================
        IMPORT QUESTIONS
        POST /api/admin/questions/import
        =================================================
        */

        if (

            method === "POST" &&

            pathname ===
                "/api/admin/questions/import"

        ) {

            const formData =
                await request.formData();


            const file =
                formData.get("file");


            const examId =
                clean(
                    formData.get("exam_id")
                );


            const subjectId =
                clean(
                    formData.get("subject_id")
                );


            if (!file) {

                return Response.json({

                    success: false,

                    message:
                        "No question file was uploaded."

                }, {
                    status: 400
                });

            }


            if (
                !examId
            ) {

                return Response.json({

                    success: false,

                    message:
                        "Exam is required."

                }, {
                    status: 400
                });

            }


            if (
                !subjectId
            ) {

                return Response.json({

                    success: false,

                    message:
                        "Subject is required."

                }, {
                    status: 400
                });

            }


            if (
                typeof file.arrayBuffer !==
                "function"
            ) {

                return Response.json({

                    success: false,

                    message:
                        "Invalid uploaded file."

                }, {
                    status: 400
                });

            }


            const fileName =
                String(
                    file.name || ""
                )
                .trim()
                .toLowerCase();


            const extension =
                fileName
                    .split(".")
                    .pop();


            if (
                !ALLOWED_EXTENSIONS.includes(
                    extension
                )
            ) {

                return Response.json({

                    success: false,

                    message:
                        "Only DOCX, XLSX and XLS files are supported."

                }, {
                    status: 400
                });

            }


            /*
            =================================================
            VERIFY EXAM → SUBJECT
            =================================================
            */

            const subject =
                await env.DB.prepare(

                    `SELECT
                        s.id,
                        s.exam_id,
                        s.status AS subject_status,
                        e.status AS exam_status

                     FROM subjects s

                     INNER JOIN exams e
                        ON s.exam_id = e.id

                     WHERE s.id = ?
                       AND e.id = ?

                     LIMIT 1`

                )
                .bind(
                    subjectId,
                    examId
                )
                .first();


            if (

                !subject ||

                subject.subject_status !==
                    "active" ||

                subject.exam_status !==
                    "active"

            ) {

                return Response.json({

                    success: false,

                    message:
                        "Selected subject does not belong to the selected exam or is inactive."

                }, {
                    status: 404
                });

            }


            /*
            =================================================
            PARSE FILE
            =================================================
            */

            const buffer =
                await file.arrayBuffer();


            let parsedQuestions;


            if (
                extension === "docx"
            ) {

                parsedQuestions =
                    await parseDOCX(
                        buffer
                    );

            }

            else {

                parsedQuestions =
                    await parseXLSX(
                        buffer
                    );

            }


            if (
                !parsedQuestions.length
            ) {

                return Response.json({

                    success: false,

                    message:
                        "No valid questions were found in the uploaded file."

                }, {
                    status: 400
                });

            }


            if (
                parsedQuestions.length >
                MAX_IMPORT_QUESTIONS
            ) {

                return Response.json({

                    success: false,

                    message:
                        `A maximum of ${MAX_IMPORT_QUESTIONS} questions can be imported at once.`

                }, {
                    status: 400
                });

            }


            /*
            =================================================
            VALIDATE ALL QUESTIONS BEFORE INSERTING
            =================================================
            */

            const validation =
                validateQuestions(
                    parsedQuestions
                );


            if (
                !validation.valid
            ) {

                return Response.json({

                    success: false,

                    message:
                        "Question validation failed.",

                    errors:
                        validation.errors,

                    total_questions:
                        parsedQuestions.length

                }, {
                    status: 400
                });

            }


            /*
            =================================================
            DUPLICATE CHECK
            =================================================
            */

            const existing =
                await env.DB.prepare(

                    `SELECT
                        LOWER(TRIM(question)) AS question

                     FROM practice_questions

                     WHERE subject_id = ?`

                )
                .bind(
                    subjectId
                )
                .all();


            const existingQuestions =
                new Set(

                    (existing.results || [])
                        .map(
                            row =>
                                String(
                                    row.question || ""
                                )
                                .trim()
                                .toLowerCase()
                        )

                );


            const seen =
                new Set();

            const importable =
                [];

            const skipped =
                [];


            parsedQuestions.forEach(
                (question, index) => {

                    const key =
                        question.question
                            .trim()
                            .toLowerCase();


                    if (
                        existingQuestions.has(
                            key
                        )
                    ) {

                        skipped.push({

                            question:
                                index + 1,

                            reason:
                                "Question already exists."

                        });

                        return;

                    }


                    if (
                        seen.has(key)
                    ) {

                        skipped.push({

                            question:
                                index + 1,

                            reason:
                                "Duplicate question in uploaded file."

                        });

                        return;

                    }


                    seen.add(key);

                    importable.push(
                        question
                    );

                }
            );


            if (
                !importable.length
            ) {

                return Response.json({

                    success: false,

                    message:
                        "No new questions are available for import.",

                    imported:
                        0,

                    skipped:
                        skipped.length,

                    errors:
                        skipped

                }, {
                    status: 409
                });

            }


            /*
            =================================================
            BUILD D1 BATCH
            =================================================
            */

            const now =
                new Date().toISOString();


            const statements =
                importable.map(
                    question => {

                        const id =
                            crypto.randomUUID();


                        return env.DB.prepare(

                            `INSERT INTO practice_questions (

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
                                difficulty,
                                status,

                                created_at,
                                updated_at

                            )

                            VALUES (

                                ?,
                                ?,

                                ?,
                                ?,

                                ?,
                                ?,
                                ?,
                                ?,

                                ?,
                                ?,
                                ?,
                                ?,

                                ?,
                                ?

                            )`

                        )
                        .bind(

                            id,

                            subjectId,

                            question.question,

                            question.image_url,

                            question.option_a,

                            question.option_b,

                            question.option_c,

                            question.option_d,

                            question.correct_answer,

                            question.explanation,

                            question.difficulty,

                            "active",

                            now,

                            now

                        );

                    }
                );


            /*
            =================================================
            ATOMIC D1 BATCH
            =================================================
            */

            await env.DB.batch(
                statements
            );


            return Response.json({

                success: true,

                message:
                    "Questions imported successfully.",

                total_questions:
                    parsedQuestions.length,

                imported:
                    importable.length,

                skipped:
                    skipped.length,

                errors:
                    skipped

            }, {
                status: 201
            });

        }


        return Response.json({

            success: false,

            message:
                "Endpoint not found."

        }, {
            status: 404
        });

    }

    catch (error) {

        console.error(
            "Question Import Worker Error:",
            error
        );


        return Response.json({

            success: false,

            message:
                "Question import failed.",

            error:
                error?.message ||
                "Unknown error."

        }, {
            status: 500
        });

    }

}


/*
=========================================================
HELPERS
=========================================================
*/

function clean(value) {

    return String(
        value ?? ""
    )
    .trim();

}


/*
=========================================================
DOCX
=========================================================
*/

async function parseDOCX(
    buffer
) {

    const result =
        await mammoth.extractRawText({

            arrayBuffer:
                buffer

        });


    const text =
        normalizeText(
            result.value
        );


    if (!text) {

        throw new Error(
            "The DOCX file contains no readable text."
        );

    }


    return parseDOCXText(
        text
    );

}


function parseDOCXText(
    text
) {

    const lines =
        text
            .split("\n")
            .map(
                line =>
                    line.trim()
            )
            .filter(Boolean);


    const questions =
        [];


    let current =
        null;


    function saveCurrent() {

        if (!current) {

            return;

        }


        const normalized =
            normalizeQuestion(
                current
            );


        if (
            normalized
        ) {

            questions.push(
                normalized
            );

        }


        current =
            null;

    }


    for (
        const line
        of lines
    ) {

        const questionMatch =
            line.match(
                /^(\d+)[.)]\s*(.+)$/i
            );


        if (
            questionMatch
        ) {

            saveCurrent();


            current = {

                question_number:
                    questionMatch[1],

                question:
                    questionMatch[2],

                option_a:
                    "",

                option_b:
                    "",

                option_c:
                    "",

                option_d:
                    "",

                correct_answer:
                    "",

                explanation:
                    "",

                difficulty:
                    "medium",

                image_url:
                    ""

            };


            continue;

        }


        if (!current) {

            continue;

        }


        const optionMatch =
            line.match(
                /^([ABCD])[.)]\s*(.+)$/i
            );


        if (
            optionMatch
        ) {

            current[
                `option_${optionMatch[1]
                    .toLowerCase()}`
            ] =
                optionMatch[2].trim();


            continue;

        }


        const answerMatch =
            line.match(

                /^(?:answer|correct\s*answer)\s*[:\-]?\s*([ABCD])\b/i

            );


        if (
            answerMatch
        ) {

            current.correct_answer =
                answerMatch[1]
                    .toUpperCase();


            continue;

        }


        const explanationMatch =
            line.match(

                /^explanation\s*[:\-]?\s*(.*)$/i

            );


        if (
            explanationMatch
        ) {

            current.explanation =
                explanationMatch[1].trim();


            continue;

        }


        const difficultyMatch =
            line.match(

                /^difficulty\s*[:\-]?\s*(easy|medium|hard)\b/i

            );


        if (
            difficultyMatch
        ) {

            current.difficulty =
                difficultyMatch[1]
                    .toLowerCase();


            continue;

        }


        /*
        Continue question text until
        the first option appears.
        */

        if (

            !current.option_a &&
            !current.option_b &&
            !current.option_c &&
            !current.option_d &&
            !current.explanation

        ) {

            current.question +=
                ` ${line}`;

            continue;

        }


        /*
        Continue explanation text.
        */

        if (
            current.explanation
        ) {

            current.explanation +=
                ` ${line}`;

        }

    }


    saveCurrent();


    return questions;

}


/*
=========================================================
XLSX / XLS
=========================================================
*/

async function parseXLSX(
    buffer
) {

    const workbook =
        XLSX.read(

            buffer,

            {
                type: "array",
                raw: false
            }

        );


    if (
        !workbook.SheetNames?.length
    ) {

        throw new Error(
            "The spreadsheet contains no worksheets."
        );

    }


    const sheet =
        workbook.Sheets[
            workbook.SheetNames[0]
        ];


    if (!sheet) {

        throw new Error(
            "Unable to read the spreadsheet."
        );

    }


    const rows =
        XLSX.utils.sheet_to_json(

            sheet,

            {
                defval: "",
                raw: false
            }

        );


    if (!rows.length) {

        throw new Error(
            "The spreadsheet contains no questions."
        );

    }


    return rows.map(

        (row, index) =>

            normalizeSpreadsheetQuestion(
                row,
                index + 2
            )

    );

}


function normalizeSpreadsheetQuestion(
    row,
    rowNumber
) {

    const values =
        {};


    Object.keys(row)
        .forEach(
            key => {

                const normalized =
                    String(key)
                        .trim()
                        .toLowerCase()
                        .replace(
                            /[\s_-]+/g,
                            ""
                        );


                values[normalized] =
                    String(
                        row[key] ?? ""
                    ).trim();

            }
        );


    const getValue =
        (...keys) => {

            for (
                const key
                of keys
            ) {

                if (
                    values[key] !==
                        undefined &&
                    values[key] !== ""
                ) {

                    return values[key];

                }

            }


            return "";

        };


    return normalizeQuestion({

        question_number:
            rowNumber,

        question:
            getValue(
                "question",
                "questiontext",
                "text"
            ),

        option_a:
            getValue(
                "optiona",
                "a",
                "choicea",
                "answera"
            ),

        option_b:
            getValue(
                "optionb",
                "b",
                "choiceb",
                "answerb"
            ),

        option_c:
            getValue(
                "optionc",
                "c",
                "choicec",
                "answerc"
            ),

        option_d:
            getValue(
                "optiond",
                "d",
                "choiced",
                "answerd"
            ),

        correct_answer:
            getValue(
                "answer",
                "correctanswer",
                "correct",
                "correctoption"
            ),

        explanation:
            getValue(
                "explanation",
                "answerexplanation",
                "rationale"
            ),

        difficulty:
            getValue(
                "difficulty",
                "level"
            ),

        image_url:
            getValue(
                "image",
                "imageurl",
                "image_url"
            )

    });

}


/*
=========================================================
NORMALIZATION
=========================================================
*/

function normalizeQuestion(
    question
) {

    if (!question) {

        return null;

    }


    const answer =
        normalizeAnswer(
            question.correct_answer
        );


    const difficulty =
        normalizeDifficulty(
            question.difficulty
        );


    return {

        question_number:
            question.question_number ||
            null,

        question:
            clean(
                question.question
            ),

        option_a:
            clean(
                question.option_a
            ),

        option_b:
            clean(
                question.option_b
            ),

        option_c:
            clean(
                question.option_c
            ),

        option_d:
            clean(
                question.option_d
            ),

        correct_answer:
            answer,

        explanation:
            clean(
                question.explanation
            ),

        difficulty,

        image_url:
            clean(
                question.image_url
            )

    };

}


function normalizeAnswer(
    value
) {

    const answer =
        clean(value)
            .toUpperCase();


    if (
        /^[ABCD]$/.test(
            answer
        )
    ) {

        return answer;

    }


    const match =
        answer.match(
            /(?:OPTION\s*)?([ABCD])(?:[.)]|\s|$)/
        );


    return match
        ? match[1]
        : answer;

}


function normalizeDifficulty(
    value
) {

    const difficulty =
        clean(value)
            .toLowerCase();


    return [

        "easy",
        "medium",
        "hard"

    ].includes(
        difficulty
    )

        ? difficulty

        : "medium";

}


/*
=========================================================
VALIDATION
=========================================================
*/

function validateQuestions(
    questions
) {

    const errors =
        [];


    questions.forEach(
        (question, index) => {

            const number =
                question.question_number ||
                index + 1;


            if (
                !question.question
            ) {

                errors.push({

                    question:
                        number,

                    error:
                        "Question text is missing."

                });

            }


            if (
                !question.option_a
            ) {

                errors.push({

                    question:
                        number,

                    error:
                        "Option A is missing."

                });

            }


            if (
                !question.option_b
            ) {

                errors.push({

                    question:
                        number,

                    error:
                        "Option B is missing."

                });

            }


            if (
                !question.option_c
            ) {

                errors.push({

                    question:
                        number,

                    error:
                        "Option C is missing."

                });

            }


            if (
                !question.option_d
            ) {

                errors.push({

                    question:
                        number,

                    error:
                        "Option D is missing."

                });

            }


            if (
                ![
                    "A",
                    "B",
                    "C",
                    "D"
                ].includes(
                    question.correct_answer
                )
            ) {

                errors.push({

                    question:
                        number,

                    error:
                        "Correct answer must be A, B, C or D."

                });

            }

        }
    );


    return {

        valid:
            errors.length === 0,

        errors

    };

}


/*
=========================================================
TEXT NORMALIZATION
=========================================================
*/

function normalizeText(
    text
) {

    return String(
        text || ""
    )

    .replace(
        /\r\n/g,
        "\n"
    )

    .replace(
        /\r/g,
        "\n"
    )

    .replace(
        /\u00A0/g,
        " "
    )

    .replace(
        /[ \t]+/g,
        " "
    )

    .replace(
        /\n{3,}/g,
        "\n\n"
    )

    .trim();

}