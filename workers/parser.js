/*
=========================================================
    NurseSphere Question Parser Worker
    File: workers/parser.js

    Purpose:
    Parses uploaded Practice Question files and
    converts them into structured questions ready
    for preview before importing.

    Supported Formats

        - DOCX
        - XLSX

=========================================================
*/

"use strict";

/*=========================================================
    IMPORTS
=========================================================*/

import * as XLSX from "xlsx";
import mammoth from "mammoth";

/*=========================================================
    WORKER
=========================================================*/

export default {

    async fetch(request, env) {

        try {

            const url = new URL(request.url);

            const pathname = url.pathname;

            const method = request.method;

            /*=========================================
                    PARSE QUESTIONS
                    POST /api/parser
            =========================================*/

            if (

                method === "POST" &&

                pathname === "/api/parser"

            ) {

                const formData = await request.formData();

                const file = formData.get("file");

                if (!file) {

                    return Response.json({

                        success: false,

                        message: "No file uploaded."

                    }, {

                        status: 400

                    });

                }

                const fileName = file.name.toLowerCase();

                const extension =

                    fileName.substring(

                        fileName.lastIndexOf(".") + 1

                    );

                const supportedFormats = [

                    "docx",

                    "xlsx"

                ];

                if (

                    !supportedFormats.includes(extension)

                ) {

                    return Response.json({

                        success: false,

                        message:

                            "Only DOCX and XLSX files are supported."

                    }, {

                        status: 400

                    });

                }

                let parsedQuestions = [];

                /*=====================================
                        DOCX
                =====================================*/

                if (extension === "docx") {

                    const buffer =

                        await file.arrayBuffer();

                    parsedQuestions =

                        await parseDOCX(buffer);

                }

                /*=====================================
                        XLSX
                =====================================*/

                else if (extension === "xlsx") {

                    const buffer =

                        await file.arrayBuffer();

                    parsedQuestions =

                        await parseExcel(buffer);

                }

                return Response.json({

                    success: true,

                    message:

                        "Questions parsed successfully.",

                    total_questions:

                        parsedQuestions.length,

                    questions:

                        parsedQuestions

                });

            }

            /*=========================================
                    ENDPOINT NOT FOUND
            =========================================*/

            return Response.json({

                success: false,

                message: "Endpoint not found."

            }, {

                status: 404

            });

        }

        catch (error) {

            console.error(

                "Parser Worker Error:",

                error

            );

            return Response.json({

                success: false,

                message: "Internal Server Error.",

                error: error.message

            }, {

                status: 500

            });

        }

    }

};

/*=========================================================

    PARSER FUNCTIONS

    Part 2 begins here.

        ✔ parseDOCX()

        ✔ parseExcel()

=========================================================*/

/*=========================================================
    DOCX PARSER
=========================================================*/

async function parseDOCX(buffer) {

    const { value } = await mammoth.extractRawText({

        arrayBuffer: buffer

    });

    const text = value.replace(/\r/g, "");

    const lines = text

        .split("\n")

        .map(line => line.trim())

        .filter(line => line.length > 0);

    const questions = [];

    let current = null;

    for (const line of lines) {

        /*=========================================
                NEW QUESTION
        =========================================*/

        if (/^\d+[\.\)]\s*/.test(line)) {

            if (current) {

                questions.push(current);

            }

            current = {

                question: line.replace(/^\d+[\.\)]\s*/, "").trim(),

                options: {

                    A: "",

                    B: "",

                    C: "",

                    D: ""

                },

                answer: "",

                explanation: "",

                image_url: ""

            };

        }

        /*=========================================
                OPTION A
        =========================================*/

        else if (/^A[\.\)]\s*/i.test(line) && current) {

            current.options.A =

                line.replace(/^A[\.\)]\s*/i, "").trim();

        }

        /*=========================================
                OPTION B
        =========================================*/

        else if (/^B[\.\)]\s*/i.test(line) && current) {

            current.options.B =

                line.replace(/^B[\.\)]\s*/i, "").trim();

        }

        /*=========================================
                OPTION C
        =========================================*/

        else if (/^C[\.\)]\s*/i.test(line) && current) {

            current.options.C =

                line.replace(/^C[\.\)]\s*/i, "").trim();

        }

        /*=========================================
                OPTION D
        =========================================*/

        else if (/^D[\.\)]\s*/i.test(line) && current) {

            current.options.D =

                line.replace(/^D[\.\)]\s*/i, "").trim();

        }

        /*=========================================
                ANSWER
        =========================================*/

        else if (/^Answer\s*:/i.test(line) && current) {

            current.answer =

                line

                    .replace(/^Answer\s*:/i, "")

                    .trim()

                    .toUpperCase();

        }

        /*=========================================
                EXPLANATION
        =========================================*/

        else if (/^Explanation\s*:/i.test(line) && current) {

            current.explanation =

                line

                    .replace(/^Explanation\s*:/i, "")

                    .trim();

        }

        /*=========================================
                CONTINUATION
        =========================================*/

        else if (current) {

            current.question += " " + line;

        }

    }

    if (current) {

        questions.push(current);

    }

    return questions;

}

/*=========================================================
    EXCEL PARSER
=========================================================*/

async function parseExcel(buffer) {

    const workbook = XLSX.read(buffer, {

        type: "array"

    });

    const sheetName =

        workbook.SheetNames[0];

    const worksheet =

        workbook.Sheets[sheetName];

    const rows =

        XLSX.utils.sheet_to_json(

            worksheet,

            {

                defval: ""

            }

        );

    const questions = [];

    for (const row of rows) {

        questions.push({

            question:

                String(

                    row.Question || ""

                ).trim(),

            options: {

                A: String(

                    row.OptionA || ""

                ).trim(),

                B: String(

                    row.OptionB || ""

                ).trim(),

                C: String(

                    row.OptionC || ""

                ).trim(),

                D: String(

                    row.OptionD || ""

                ).trim()

            },

            answer:

                String(

                    row.Answer || ""

                )

                .trim()

                .toUpperCase(),

            explanation:

                String(

                    row.Explanation || ""

                ).trim(),

            image_url:

                String(

                    row.Image || ""

                ).trim()

        });

    }

    return questions;

}

/*=========================================================
    QUESTION VALIDATOR
=========================================================*/

function validateQuestions(questions) {

    const errors = [];

    const validAnswers = [

        "A",

        "B",

        "C",

        "D"

    ];

    questions.forEach((question, index) => {

        const number = index + 1;

        /*=========================================
                QUESTION
        =========================================*/

        if (!question.question) {

            errors.push({

                question: number,

                error: "Question text is missing."

            });

        }

        /*=========================================
                OPTION A
        =========================================*/

        if (!question.options.A) {

            errors.push({

                question: number,

                error: "Option A is missing."

            });

        }

        /*=========================================
                OPTION B
        =========================================*/

        if (!question.options.B) {

            errors.push({

                question: number,

                error: "Option B is missing."

            });

        }

        /*=========================================
                OPTION C
        =========================================*/

        if (!question.options.C) {

            errors.push({

                question: number,

                error: "Option C is missing."

            });

        }

        /*=========================================
                OPTION D
        =========================================*/

        if (!question.options.D) {

            errors.push({

                question: number,

                error: "Option D is missing."

            });

        }

        /*=========================================
                ANSWER
        =========================================*/

        if (

            !validAnswers.includes(

                question.answer

            )

        ) {

            errors.push({

                question: number,

                error: "Correct answer must be A, B, C or D."

            });

        }

    });

    return {

        valid: errors.length === 0,

        errors

    };

}

/*=========================================================
    PREPARE QUESTIONS FOR DATABASE
=========================================================*/

function prepareQuestionsForImport(
    questions,
    subjectId
) {

    const timestamp =
        new Date().toISOString();

    return questions.map(question => ({

        id:
            crypto.randomUUID(),

        subject_id:
            subjectId,

        question:
            question.question,

        image_url:
            question.image_url || null,

        option_a:
            question.options.A,

        option_b:
            question.options.B,

        option_c:
            question.options.C,

        option_d:
            question.options.D,

        correct_answer:
            question.answer,

        explanation:
            question.explanation || null,

        created_at:
            timestamp,

        updated_at:
            timestamp

    }));

}

/*=========================================================
    BULK IMPORT QUESTIONS
=========================================================*/

async function importQuestions(
    env,
    questions
) {

    const statements = [];

    for (const question of questions) {

        statements.push(

            env.DB.prepare(`

                INSERT INTO practice_questions (

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

                    created_at,

                    updated_at

                )

                VALUES (

                    ?,?,?,?,?,?,?,?,?,?,?,?

                )

            `).bind(

                question.id,

                question.subject_id,

                question.question,

                question.image_url,

                question.option_a,

                question.option_b,

                question.option_c,

                question.option_d,

                question.correct_answer,

                question.explanation,

                question.created_at,

                question.updated_at

            )

        );

    }

    await env.DB.batch(

        statements

    );

    return {

        success: true,

        imported: questions.length

    };

}