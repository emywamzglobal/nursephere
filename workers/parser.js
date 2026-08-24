"use strict";

/*=========================================================
    PRACTICE QUESTION IMPORT PARSER
    Supports:
        - DOCX
        - XLSX
=========================================================*/

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

const ALLOWED_EXTENSIONS = [
    "docx",
    "xlsx"
];

/*=========================================================
    PUBLIC ENTRY POINT
=========================================================*/

async function parseQuestionFile(file) {

    if (!(file instanceof File)) {

        throw new Error(
            "Invalid question file."
        );

    }

    if (!file.name) {

        throw new Error(
            "Question file name is required."
        );

    }

    if (!file.size) {

        throw new Error(
            "The uploaded question file is empty."
        );

    }

    if (file.size > MAX_FILE_SIZE) {

        throw new Error(
            "Question file must not exceed 10 MB."
        );

    }

    const extension =
        getFileExtension(file.name);

    if (
        !ALLOWED_EXTENSIONS.includes(
            extension
        )
    ) {

        throw new Error(
            "Only DOCX and XLSX files are supported."
        );

    }

    if (extension === "docx") {

        return parseDOCX(file);

    }

    if (extension === "xlsx") {

        return parseXLSX(file);

    }

    throw new Error(
        "Unsupported question file format."
    );

}

/*=========================================================
    FILE EXTENSION
=========================================================*/

function getFileExtension(filename) {

    return String(filename)

        .trim()

        .toLowerCase()

        .split(".")

        .pop();

}

/*=========================================================
    DOCX PARSER
=========================================================*/

async function parseDOCX(file) {

    if (
        typeof mammoth === "undefined"
    ) {

        throw new Error(
            "DOCX parser is not available."
        );

    }

    const arrayBuffer =
        await file.arrayBuffer();

    const result =
        await mammoth.extractRawText({
            arrayBuffer
        });

    if (
        !result ||
        typeof result.value !== "string"
    ) {

        throw new Error(
            "Unable to read the DOCX file."
        );

    }

    const text =
        normalizeText(result.value);

    if (!text) {

        throw new Error(
            "The DOCX file contains no readable text."
        );

    }

    return parseDOCXText(text);

}

/*=========================================================
    DOCX TEXT NORMALIZATION
=========================================================*/

function normalizeText(text) {

    return String(text)

        .replace(/\r\n/g, "\n")

        .replace(/\r/g, "\n")

        .replace(/\u00A0/g, " ")

        .replace(/[ \t]+/g, " ")

        .replace(/\n{3,}/g, "\n\n")

        .trim();

}

/*=========================================================
    DOCX QUESTION PARSER
=========================================================

    Supported structure:

    1. Question text
    A. Option A
    B. Option B
    C. Option C
    D. Option D
    Answer: A
    Explanation: ...

=========================================================*/

function parseDOCXText(text) {

    const lines =
        text
            .split("\n")
            .map(line => line.trim())
            .filter(Boolean);

    const questions = [];

    let current = null;

    function startQuestion(number, text) {

        current = {

            question_number:
                number || null,

            question:
                text || "",

            option_a: "",

            option_b: "",

            option_c: "",

            option_d: "",

            correct_answer: "",

            explanation: "",

            difficulty: "medium",

            image_url: ""

        };

    }

    function saveCurrent() {

        if (!current) {

            return;

        }

        const normalized =
            normalizeQuestion(current);

        if (
            normalized
        ) {

            questions.push(
                normalized
            );

        }

        current = null;

    }

    for (const line of lines) {

        /*-----------------------------------------------
            QUESTION
        -----------------------------------------------*/

        const questionMatch =
            line.match(
                /^(\d+)[.)]\s*(.+)$/i
            );

        if (questionMatch) {

            saveCurrent();

            startQuestion(

                questionMatch[1],

                questionMatch[2]

            );

            continue;

        }

        if (!current) {

            continue;

        }

        /*-----------------------------------------------
            OPTIONS
        -----------------------------------------------*/

        const optionMatch =
            line.match(
                /^([ABCD])[.)]\s*(.+)$/i
            );

        if (optionMatch) {

            const option =
                optionMatch[1]
                    .toUpperCase();

            current[
                `option_${option.toLowerCase()}`
            ] = optionMatch[2].trim();

            continue;

        }

        /*-----------------------------------------------
            ANSWER
        -----------------------------------------------*/

        const answerMatch =
            line.match(
                /^(?:answer|correct\s*answer)\s*[:\-]?\s*([ABCD])\b/i
            );

        if (answerMatch) {

            current.correct_answer =
                answerMatch[1]
                    .toUpperCase();

            continue;

        }

        /*-----------------------------------------------
            EXPLANATION
        -----------------------------------------------*/

        const explanationMatch =
            line.match(
                /^explanation\s*[:\-]?\s*(.*)$/i
            );

        if (explanationMatch) {

            current.explanation =
                explanationMatch[1].trim();

            continue;

        }

        /*-----------------------------------------------
            DIFFICULTY
        -----------------------------------------------*/

        const difficultyMatch =
            line.match(
                /^difficulty\s*[:\-]?\s*(easy|medium|hard)\b/i
            );

        if (difficultyMatch) {

            current.difficulty =
                difficultyMatch[1]
                    .toLowerCase();

            continue;

        }

        /*-----------------------------------------------
            EXPLANATION CONTINUATION
        -----------------------------------------------*/

        if (
            current.explanation &&
            !current.option_a &&
            !current.option_b &&
            !current.option_c &&
            !current.option_d
        ) {

            current.explanation +=
                ` ${line}`;

            continue;

        }

        /*-----------------------------------------------
            QUESTION CONTINUATION
        -----------------------------------------------*/

        if (
            !current.option_a &&
            !current.option_b &&
            !current.option_c &&
            !current.option_d
        ) {

            current.question +=
                ` ${line}`;

        }

    }

    saveCurrent();

    return validateParsedQuestions(
        questions
    );

}

/*=========================================================
    XLSX PARSER
=========================================================*/

async function parseXLSX(file) {

    if (
        typeof XLSX === "undefined"
    ) {

        throw new Error(
            "Spreadsheet parser is not available."
        );

    }

    const arrayBuffer =
        await file.arrayBuffer();

    const workbook =
        XLSX.read(
            arrayBuffer,
            {
                type: "array"
            }
        );

    if (
        !workbook.SheetNames ||
        !workbook.SheetNames.length
    ) {

        throw new Error(
            "The spreadsheet contains no worksheets."
        );

    }

    const sheetName =
        workbook.SheetNames[0];

    const sheet =
        workbook.Sheets[sheetName];

    if (!sheet) {

        throw new Error(
            "Unable to read the spreadsheet worksheet."
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

    const questions =
        rows.map(
            (row, index) =>
                normalizeSpreadsheetQuestion(
                    row,
                    index + 2
                )
        );

    return validateParsedQuestions(
        questions
    );

}

/*=========================================================
    XLSX ROW NORMALIZATION
=========================================================*/

function normalizeSpreadsheetQuestion(
    row,
    rowNumber
) {

    const normalizedRow = {};

    Object.keys(row).forEach(key => {

        const normalizedKey =
            String(key)

                .trim()

                .toLowerCase()

                .replace(/[\s_-]+/g, "");

        normalizedRow[
            normalizedKey
        ] = String(
            row[key] ?? ""
        ).trim();

    });

    const getValue =
        (...keys) => {

            for (const key of keys) {

                if (
                    normalizedRow[key] !==
                    undefined &&
                    normalizedRow[key] !== ""
                ) {

                    return normalizedRow[key];

                }

            }

            return "";

        };

    const answer =
        getValue(
            "answer",
            "correctanswer",
            "correct",
            "correctoption"
        );

    const difficulty =
        getValue(
            "difficulty"
        )
        .toLowerCase() || "medium";

    return {

        question_number:
            rowNumber,

        question:
            getValue(
                "question",
                "questiontext"
            ),

        option_a:
            getValue(
                "optiona",
                "a",
                "choicea"
            ),

        option_b:
            getValue(
                "optionb",
                "b",
                "choiceb"
            ),

        option_c:
            getValue(
                "optionc",
                "c",
                "choicec"
            ),

        option_d:
            getValue(
                "optiond",
                "d",
                "choiced"
            ),

        correct_answer:
            normalizeAnswer(answer),

        explanation:
            getValue(
                "explanation",
                "answerexplanation"
            ),

        difficulty,

        image_url:
            getValue(
                "image",
                "imageurl",
                "image_url"
            )

    };

}

/*=========================================================
    ANSWER NORMALIZATION
=========================================================*/

function normalizeAnswer(answer) {

    const value =
        String(answer || "")
            .trim()
            .toUpperCase();

    if (
        /^[ABCD]$/.test(value)
    ) {

        return value;

    }

    const match =
        value.match(
            /^(?:OPTION\s*)?([ABCD])(?:[.)]|\s|$)/i
        );

    return match
        ? match[1].toUpperCase()
        : value;

}

/*=========================================================
    QUESTION NORMALIZATION
=========================================================*/

function normalizeQuestion(question) {

    if (!question) {

        return null;

    }

    return {

        question_number:
            question.question_number || null,

        question:
            String(
                question.question || ""
            ).trim(),

        option_a:
            String(
                question.option_a || ""
            ).trim(),

        option_b:
            String(
                question.option_b || ""
            ).trim(),

        option_c:
            String(
                question.option_c || ""
            ).trim(),

        option_d:
            String(
                question.option_d || ""
            ).trim(),

        correct_answer:
            normalizeAnswer(
                question.correct_answer
            ),

        explanation:
            String(
                question.explanation || ""
            ).trim(),

        difficulty:
            normalizeDifficulty(
                question.difficulty
            ),

        image_url:
            String(
                question.image_url || ""
            ).trim()

    };

}

/*=========================================================
    DIFFICULTY
=========================================================*/

function normalizeDifficulty(
    difficulty
) {

    const value =
        String(
            difficulty || "medium"
        )
        .trim()
        .toLowerCase();

    return [
        "easy",
        "medium",
        "hard"
    ].includes(value)

        ? value

        : "medium";

}

/*=========================================================
    VALIDATE IMPORTED QUESTIONS
=========================================================*/

function validateParsedQuestions(
    questions
) {

    if (!Array.isArray(questions)) {

        throw new Error(
            "Invalid parsed question data."
        );

    }

    if (!questions.length) {

        throw new Error(
            "No questions could be extracted from the file."
        );

    }

    const validQuestions = [];

    const errors = [];

    questions.forEach(
        (question, index) => {

            const row =
                question.question_number ||
                index + 1;

            if (
                !question.question
            ) {

                errors.push(
                    `Question ${row}: question text is missing.`
                );

                return;

            }

            if (
                !question.option_a ||
                !question.option_b ||
                !question.option_c ||
                !question.option_d
            ) {

                errors.push(
                    `Question ${row}: all four answer options are required.`
                );

                return;

            }

            if (
                !["A", "B", "C", "D"]
                    .includes(
                        question.correct_answer
                    )
            ) {

                errors.push(
                    `Question ${row}: correct answer must be A, B, C or D.`
                );

                return;

            }

            validQuestions.push(
                question
            );

        }
    );

    if (!validQuestions.length) {

        throw new Error(
            errors.join(" ")
        );

    }

    return {

        questions:
            validQuestions,

        errors

    };

}

/*=========================================================
    PREPARE QUESTIONS FOR API IMPORT
=========================================================*/

function prepareQuestionsForImport(
    questions,
    subjectId
) {

    if (
        !subjectId ||
        !String(subjectId).trim()
    ) {

        throw new Error(
            "Please select a subject."
        );

    }

    if (
        !Array.isArray(questions) ||
        !questions.length
    ) {

        throw new Error(
            "There are no valid questions to import."
        );

    }

    return questions.map(
        question => ({

            subject_id:
                String(subjectId).trim(),

            question:
                question.question.trim(),

            image_url:
                question.image_url || "",

            option_a:
                question.option_a.trim(),

            option_b:
                question.option_b.trim(),

            option_c:
                question.option_c.trim(),

            option_d:
                question.option_d.trim(),

            correct_answer:
                question.correct_answer
                    .toUpperCase(),

            explanation:
                question.explanation || "",

            difficulty:
                normalizeDifficulty(
                    question.difficulty
                )

        })
    );

}

/*=========================================================
    API IMPORT
=========================================================*/

async function importQuestions(
    questions,
    subjectId
) {

    const payload =
        prepareQuestionsForImport(
            questions,
            subjectId
        );

    const response =
        await fetch(
            "/api/admin/questions/import",
            {
                method: "POST",

                headers: {
                    "Content-Type":
                        "application/json"
                },

                body:
                    JSON.stringify({
                        subject_id:
                            String(subjectId).trim(),

                        questions:
                            payload
                    })
            }
        );

    let result;

    try {

        result =
            await response.json();

    } catch {

        throw new Error(
            "The server returned an invalid response."
        );

    }

    if (!response.ok || !result.success) {

        throw new Error(
            result.message ||
            "Question import failed."
        );

    }

    return result;

}

/*=========================================================
    EXPORT
=========================================================*/

window.QuestionParser = {

    parseQuestionFile,

    parseDOCX,

    parseXLSX,

    parseDOCXText,

    prepareQuestionsForImport,

    importQuestions

};