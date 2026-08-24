"use strict";

/*
=========================================================
    Nursephere Admin
    File: admin/js/questions-import.js

    PURPOSE
    -----------------------------------------------------
    Handles bulk practice-question importing.

    Supported:
        - DOCX
        - XLSX
        - XLS

    Flow:
        Admin selects subject
             ↓
        Upload file
             ↓
        /api/admin/questions/import
             ↓
        Server parses DOCX/XLSX
             ↓
        Parsed questions returned
             ↓
        POST /api/admin/questions
             ↓
        Questions become available to students

    IMPORTANT
    -----------------------------------------------------
    Mammoth and XLSX are server-side dependencies.
    They are NOT loaded into this browser file.

=========================================================
*/


/* ======================================================
   CONFIGURATION
====================================================== */

const QUESTIONS_IMPORT_API =
    "https://nursephere.wamalwaemily.workers.dev/api";


/* ======================================================
   DOM ELEMENTS
====================================================== */

const importForm =
    document.getElementById(
        "importForm"
    );

const importSubject =
    document.getElementById(
        "importSubject"
    );

const questionFile =
    document.getElementById(
        "questionFile"
    );


/* ======================================================
   STATE
====================================================== */

const importState = {

    importing: false,

    imported: 0,

    failed: 0

};


/* ======================================================
   INITIALIZATION
====================================================== */

document.addEventListener(
    "DOMContentLoaded",
    initializeQuestionImporter
);


function initializeQuestionImporter() {

    if (!importForm) {

        console.warn(
            "Question import form was not found."
        );

        return;

    }


    importForm.addEventListener(
        "submit",
        handleQuestionImport
    );


    if (questionFile) {

        questionFile.addEventListener(
            "change",
            validateSelectedFile
        );

    }

}


/* ======================================================
   AUTHENTICATION
====================================================== */

function getAdminToken() {

    /*
        Keep compatibility with the existing
        Nursephere authentication/session setup.
    */

    const possibleTokens = [

        localStorage.getItem(
            "adminToken"
        ),

        localStorage.getItem(
            "admin_token"
        ),

        localStorage.getItem(
            "session_token"
        ),

        localStorage.getItem(
            "token"
        ),

        window.authState?.token,

        localStorage.getItem(
            "studentToken"
        )

    ];


    return (

        possibleTokens.find(
            token =>
                typeof token === "string" &&
                token.trim()
        ) || null

    );

}


/* ======================================================
   FILE VALIDATION
====================================================== */

function validateSelectedFile() {

    if (!questionFile) {

        return false;

    }


    const file =
        questionFile.files?.[0];


    if (!file) {

        return false;

    }


    const fileName =
        file.name.toLowerCase();


    const allowedExtensions = [

        ".docx",

        ".xlsx",

        ".xls"

    ];


    const valid =
        allowedExtensions.some(
            extension =>
                fileName.endsWith(
                    extension
                )
        );


    if (!valid) {

        showImportMessage(

            "Please select a DOCX or spreadsheet file.",

            "error"

        );


        questionFile.value = "";


        return false;

    }


    /*
        Prevent unnecessarily large uploads.
        25 MB is more than enough for question-bank
        documents while protecting the endpoint.
    */

    const MAX_FILE_SIZE =
        25 * 1024 * 1024;


    if (
        file.size >
        MAX_FILE_SIZE
    ) {

        showImportMessage(

            "The selected file is too large. Maximum size is 25 MB.",

            "error"

        );


        questionFile.value = "";


        return false;

    }


    clearImportMessage();


    return true;

}


/* ======================================================
   MAIN IMPORT
====================================================== */

async function handleQuestionImport(
    event
) {

    event.preventDefault();


    if (
        importState.importing
    ) {

        return;

    }


    clearImportMessage();


    /* --------------------------------------------------
       SUBJECT
    -------------------------------------------------- */

    const subjectId =
        importSubject?.value?.trim();


    if (!subjectId) {

        showImportMessage(

            "Please select a subject.",

            "error"

        );

        importSubject?.focus();

        return;

    }


    /* --------------------------------------------------
       FILE
    -------------------------------------------------- */

    const file =
        questionFile?.files?.[0];


    if (!file) {

        showImportMessage(

            "Please select a question file.",

            "error"

        );

        questionFile?.focus();

        return;

    }


    if (
        !validateSelectedFile()
    ) {

        return;

    }


    /* --------------------------------------------------
       AUTH
    -------------------------------------------------- */

    const token =
        getAdminToken();


    if (!token) {

        showImportMessage(

            "Your admin session has expired. Please log in again.",

            "error"

        );

        return;

    }


    /* --------------------------------------------------
       START
    -------------------------------------------------- */

    importState.importing =
        true;

    importState.imported =
        0;

    importState.failed =
        0;


    const submitButton =
        importForm.querySelector(
            'button[type="submit"]'
        );


    setImportButtonState(
        submitButton,
        true
    );


    try {

        showImportMessage(

            "Uploading and parsing questions...",

            "info"

        );


        /*
        =================================================
        STEP 1
        Send original document to parser worker.

        Mammoth handles DOCX.
        XLSX handles spreadsheet parsing.
        =================================================
        */

        const formData =
            new FormData();


        formData.append(
            "subject_id",
            subjectId
        );


        formData.append(
            "file",
            file,
            file.name
        );


        const parserResponse =
            await fetch(

                `${QUESTIONS_IMPORT_API}/admin/questions/import`,

                {

                    method:
                        "POST",

                    headers: {

                        "Authorization":
                            `Bearer ${token}`,

                        "Accept":
                            "application/json"

                    },

                    body:
                        formData,

                    cache:
                        "no-store"

                }

            );


        const parserResult =
            await parseApiResponse(
                parserResponse
            );


        if (
            parserResponse.status ===
            401
        ) {

            handleSessionExpired();

            return;

        }


        if (
            !parserResponse.ok ||
            parserResult?.success === false
        ) {

            throw new Error(

                parserResult?.message ||

                "The question file could not be parsed."

            );

        }


        /*
        =================================================
        STEP 2
        Extract parsed question collection.

        Supports several safe response structures so
        parser.js can return:

            { questions: [...] }

        or

            { data: [...] }

        or

            { data: { questions: [...] } }
        =================================================
        */

        const questions =
            extractQuestions(
                parserResult
            );


        if (
            !questions.length
        ) {

            throw new Error(

                "No valid questions were found in the uploaded file."

            );

        }


        showImportMessage(

            `${questions.length} question(s) parsed. Publishing...`,

            "info"

        );


        /*
        =================================================
        STEP 3
        Validate and publish each question through the
        EXISTING production question endpoint.

        This preserves your existing worker logic:
            POST /api/admin/questions
        =================================================
        */

        const result =
            await publishQuestions(

                questions,

                subjectId,

                token

            );


        importState.imported =
            result.imported;

        importState.failed =
            result.failed;


        /*
        =================================================
        FINAL RESULT
        =================================================
        */

        if (
            result.imported === 0
        ) {

            throw new Error(

                result.errors?.[0] ||

                "No questions were imported."

            );

        }


        let message =
            `${result.imported} question(s) imported successfully.`;


        if (
            result.failed > 0
        ) {

            message +=

                ` ${result.failed} question(s) were skipped.`;

        }


        showImportMessage(

            message,

            result.failed > 0
                ? "warning"
                : "success"

        );


        /*
        =================================================
        RESET IMPORT FORM
        =================================================
        */

        importForm.reset();


        /*
        =================================================
        REFRESH QUESTION BANK

        questions.js can listen for this event.

        We also use a short reload fallback so the
        question table is guaranteed to show new data.
        =================================================
        */

        window.dispatchEvent(

            new CustomEvent(
                "nursephere:questions-imported",
                {
                    detail: {
                        imported:
                            result.imported,
                        failed:
                            result.failed
                    }
                }
            )

        );


        window.setTimeout(

            () => {

                window.location.reload();

            },

            800

        );

    }

    catch (error) {

        console.error(
            "QUESTION IMPORT ERROR:",
            error
        );


        if (
            error?.message ===
            "SESSION_EXPIRED"
        ) {

            return;

        }


        showImportMessage(

            error?.message ||

            "Question import failed. Please try again.",

            "error"

        );

    }

    finally {

        importState.importing =
            false;


        setImportButtonState(

            submitButton,

            false

        );

    }

}


/* ======================================================
   PUBLISH QUESTIONS
====================================================== */

async function publishQuestions(

    questions,

    subjectId,

    token

) {

    let imported = 0;

    let failed = 0;

    const errors = [];


    /*
        Publish sequentially.

        This deliberately avoids firing hundreds of
        simultaneous D1 requests.
    */

    for (
        let index = 0;
        index < questions.length;
        index++
    ) {

        const raw =
            questions[index];


        const question =
            normalizeQuestion(
                raw
            );


        const validation =
            validateQuestion(
                question
            );


        if (
            !validation.valid
        ) {

            failed++;

            errors.push(

                `Question ${index + 1}: ${validation.message}`

            );

            continue;

        }


        try {

            const response =
                await fetch(

                    `${QUESTIONS_IMPORT_API}/admin/questions`,

                    {

                        method:
                            "POST",

                        headers: {

                            "Authorization":
                                `Bearer ${token}`,

                            "Content-Type":
                                "application/json",

                            "Accept":
                                "application/json"

                        },

                        body:
                            JSON.stringify({

                                subject_id:
                                    subjectId,

                                question:
                                    question.question,

                                image_url:
                                    question.image_url,

                                option_a:
                                    question.option_a,

                                option_b:
                                    question.option_b,

                                option_c:
                                    question.option_c,

                                option_d:
                                    question.option_d,

                                correct_answer:
                                    question.correct_answer,

                                explanation:
                                    question.explanation,

                                difficulty:
                                    question.difficulty

                            }),

                        cache:
                            "no-store"

                    }

                );


            const result =
                await parseApiResponse(
                    response
                );


            if (
                response.status ===
                401
            ) {

                handleSessionExpired();

                throw new Error(
                    "SESSION_EXPIRED"
                );

            }


            if (
                response.status ===
                409
            ) {

                failed++;

                errors.push(

                    `Question ${index + 1}: ${result?.message || "Duplicate question."}`

                );

                continue;

            }


            if (
                !response.ok ||
                result?.success === false
            ) {

                failed++;

                errors.push(

                    `Question ${index + 1}: ${
                        result?.message ||
                        "Question could not be published."
                    }`

                );

                continue;

            }


            imported++;

        }

        catch (error) {

            if (
                error?.message ===
                "SESSION_EXPIRED"
            ) {

                throw error;

            }


            failed++;

            errors.push(

                `Question ${index + 1}: ${
                    error?.message ||
                    "Network error."
                }`

            );

        }

    }


    return {

        imported,

        failed,

        errors

    };

}


/* ======================================================
   QUESTION NORMALIZATION
====================================================== */

function normalizeQuestion(
    raw
) {

    const source =
        raw && typeof raw === "object"
            ? raw
            : {};


    const value = (
        ...keys
    ) => {

        for (
            const key of keys
        ) {

            if (
                source[key] !== undefined &&
                source[key] !== null
            ) {

                const value =
                    String(
                        source[key]
                    ).trim();


                if (value) {

                    return value;

                }

            }

        }

        return "";

    };


    let correctAnswer =
        value(

            "correct_answer",
            "correctAnswer",
            "answer",
            "correct",
            "correct_option",
            "correctOption"

        ).toUpperCase();


    /*
        Accept:

            A
            B
            C
            D

        and:

            Option A
            Answer: A
            A.
    */

    const answerMatch =
        correctAnswer.match(
            /(?:OPTION\s*)?([ABCD])/
        );


    if (
        answerMatch
    ) {

        correctAnswer =
            answerMatch[1];

    }


    let difficulty =
        value(

            "difficulty",
            "level"

        ).toLowerCase();


    if (
        ![
            "easy",
            "medium",
            "hard"
        ].includes(
            difficulty
        )
    ) {

        difficulty =
            "medium";

    }


    return {

        question:
            value(
                "question",
                "Question",
                "question_text",
                "questionText",
                "text"
            ),

        image_url:
            value(
                "image_url",
                "imageUrl",
                "image"
            ),

        option_a:
            value(
                "option_a",
                "optionA",
                "a",
                "A",
                "answer_a",
                "answerA"
            ),

        option_b:
            value(
                "option_b",
                "optionB",
                "b",
                "B",
                "answer_b",
                "answerB"
            ),

        option_c:
            value(
                "option_c",
                "optionC",
                "c",
                "C",
                "answer_c",
                "answerC"
            ),

        option_d:
            value(
                "option_d",
                "optionD",
                "d",
                "D",
                "answer_d",
                "answerD"
            ),

        correct_answer:
            correctAnswer,

        explanation:
            value(
                "explanation",
                "Explanation",
                "rationale"
            ),

        difficulty

    };

}


/* ======================================================
   QUESTION VALIDATION
====================================================== */

function validateQuestion(
    question
) {

    if (
        !question.question
    ) {

        return {

            valid:
                false,

            message:
                "Question text is missing."

        };

    }


    if (
        !question.option_a ||
        !question.option_b ||
        !question.option_c ||
        !question.option_d
    ) {

        return {

            valid:
                false,

            message:
                "All four answer options are required."

        };

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

        return {

            valid:
                false,

            message:
                "Correct answer must be A, B, C or D."

        };

    }


    return {

        valid:
            true

    };

}


/* ======================================================
   EXTRACT QUESTIONS FROM PARSER RESPONSE
====================================================== */

function extractQuestions(
    result
) {

    const candidates = [

        result?.questions,

        result?.data?.questions,

        result?.data?.results,

        result?.data,

        result?.results

    ];


    for (
        const candidate
        of candidates
    ) {

        if (
            Array.isArray(
                candidate
            )
        ) {

            return candidate;

        }

    }


    return [];

}


/* ======================================================
   API RESPONSE PARSER
====================================================== */

async function parseApiResponse(
    response
) {

    let result = null;


    try {

        result =
            await response.json();

    }

    catch {

        if (
            response.status ===
            401
        ) {

            return {

                success:
                    false,

                message:
                    "Your session has expired."

            };

        }


        throw new Error(

            "The server returned an invalid response."

        );

    }


    return result;

}


/* ======================================================
   SESSION EXPIRY
====================================================== */

function handleSessionExpired() {

    localStorage.removeItem(
        "studentToken"
    );

    localStorage.removeItem(
        "student"
    );


    showImportMessage(

        "Your session has expired. Please log in again.",

        "error"

    );


    window.setTimeout(

        () => {

            window.location.replace(
                "login.html"
            );

        },

        700

    );

}


/* ======================================================
   BUTTON STATE
====================================================== */

function setImportButtonState(
    button,
    loading
) {

    if (!button) {

        return;

    }


    if (loading) {

        button.disabled =
            true;

        button.dataset.originalText =
            button.textContent;

        button.textContent =
            "Importing Questions...";

    }

    else {

        button.disabled =
            false;

        button.textContent =

            button.dataset.originalText ||

            "Import Questions";

    }

}


/* ======================================================
   MESSAGE
====================================================== */

function showImportMessage(
    message,
    type = "info"
) {

    let element =
        document.getElementById(
            "questionImportMessage"
        );


    /*
        Your current HTML does not contain a dedicated
        message element, so create one only when needed.
    */

    if (!element) {

        element =
            document.createElement(
                "div"
            );

        element.id =
            "questionImportMessage";

        element.setAttribute(
            "role",
            "status"
        );


        importForm?.prepend(
            element
        );

    }


    element.textContent =
        message;


    element.style.marginBottom =
        "15px";

    element.style.padding =
        "10px 14px";

    element.style.borderRadius =
        "8px";

    element.style.fontSize =
        "13px";


    if (
        type === "success"
    ) {

        element.style.background =
            "#eefaf1";

        element.style.color =
            "#26733b";

    }

    else if (
        type === "error"
    ) {

        element.style.background =
            "#fff1f1";

        element.style.color =
            "#a52d2d";

    }

    else if (
        type === "warning"
    ) {

        element.style.background =
            "#fff8e6";

        element.style.color =
            "#8a6500";

    }

    else {

        element.style.background =
            "#eef5fb";

        element.style.color =
            "#1769aa";

    }

}


/* ======================================================
   CLEAR MESSAGE
====================================================== */

function clearImportMessage() {

    const element =
        document.getElementById(
            "questionImportMessage"
        );


    if (element) {

        element.remove();

    }

}