"use strict";

/*
=========================================================
    NURSEPHERE ADMIN
    PRACTICE QUESTION MANAGEMENT
=========================================================

    Responsibilities:

    - Load active exams
    - Load subjects belonging to selected exam
    - Populate manual-question subject selector
    - Populate import subject selector
    - Create questions
    - Load question bank
    - View individual questions

    Import parsing/submission remains in:

        questions-import.js

    API communication uses:

        shared/api.js
=========================================================
*/


/*=========================================================
    API ENDPOINTS
=========================================================*/

const QUESTION_API = {

    exams:
        "/admin/exams",

    subjects:
        "/admin/subjects",

    questions:
        "/admin/questions"

};


/*=========================================================
    DOM ELEMENTS
=========================================================*/

const examSelect =
    document.getElementById("examSelect");

const subjectSelect =
    document.getElementById("subjectSelect");

const questionForm =
    document.getElementById("questionForm");

const questionText =
    document.getElementById("questionText");

const questionImage =
    document.getElementById("questionImage");

const optionA =
    document.getElementById("optionA");

const optionB =
    document.getElementById("optionB");

const optionC =
    document.getElementById("optionC");

const optionD =
    document.getElementById("optionD");

const correctAnswer =
    document.getElementById("correctAnswer");

const explanation =
    document.getElementById("explanation");

const questionsTableBody =
    document.getElementById("questionsTableBody");

const importSubject =
    document.getElementById("importSubject");


/*=========================================================
    INITIALIZATION
=========================================================*/

document.addEventListener(
    "DOMContentLoaded",
    initializeQuestionManagement
);


async function initializeQuestionManagement() {

    /*
        Fail early if the required shared API client
        was not loaded before questions.js.
    */

    if (
        typeof window.API === "undefined" ||
        typeof window.API.get !== "function"
    ) {

        console.error(
            "Shared API client is unavailable."
        );

        notifyQuestionUser(
            "API client could not be loaded.",
            "error"
        );

        return;

    }


    if (!examSelect) {

        console.error(
            "#examSelect was not found."
        );

        return;

    }


    if (!subjectSelect) {

        console.error(
            "#subjectSelect was not found."
        );

        return;

    }


    bindQuestionEvents();


    resetSubjectSelect();


    resetImportSubject();


    await loadExams();


    await loadQuestions();

}


/*=========================================================
    EVENT BINDING
=========================================================*/

function bindQuestionEvents() {

    if (examSelect) {

        examSelect.addEventListener(
            "change",
            handleExamChange
        );

    }


    if (questionForm) {

        questionForm.addEventListener(
            "submit",
            handleQuestionSubmit
        );

        questionForm.addEventListener(
            "reset",
            handleQuestionReset
        );

    }

}


/*=========================================================
    LOAD EXAMS
=========================================================*/

async function loadExams() {

    setSelectMessage(
        examSelect,
        "Loading Exams..."
    );


    try {

        const result =
            await API.get(
                QUESTION_API.exams
            );


        if (
            !result ||
            result.success !== true
        ) {

            throw new Error(
                result?.message ||
                "Failed to load exams."
            );

        }


        const exams =
            Array.isArray(result.data)
                ? result.data
                : [];


        examSelect.innerHTML = "";


        addOption(
            examSelect,
            "",
            "Select Exam"
        );


        exams
            .filter(isActiveRecord)
            .forEach(
                exam => {

                    addOption(
                        examSelect,
                        exam.id,
                        exam.name ||
                        exam.code ||
                        "Unnamed Exam"
                    );

                }
            );


        if (!exams.filter(isActiveRecord).length) {

            setSelectMessage(
                examSelect,
                "No active exams found."
            );

        }

    }

    catch (error) {

        console.error(
            "Load Exams:",
            error
        );


        setSelectMessage(
            examSelect,
            "Failed to load exams."
        );


        resetSubjectSelect();
        resetImportSubject();


        notifyQuestionUser(
            error.message ||
            "Failed to load exams.",
            "error"
        );

    }

}


/*=========================================================
    EXAM CHANGE
=========================================================*/

async function handleExamChange() {

    const examId =
        String(
            examSelect?.value || ""
        ).trim();


    resetSubjectSelect();
    resetImportSubject();


    if (!examId) {

        return;

    }


    await loadSubjects(
        examId
    );

}


/*=========================================================
    LOAD SUBJECTS FOR EXAM
=========================================================*/

async function loadSubjects(
    examId
) {

    if (!examId) {

        return;

    }


    setSelectMessage(
        subjectSelect,
        "Loading Subjects..."
    );


    if (importSubject) {

        setSelectMessage(
            importSubject,
            "Loading Subjects..."
        );

    }


    try {

        /*
            IMPORTANT:

            shared/api.js already contains:

            https://nursephere.wamalwaemily.workers.dev/api

            Therefore the endpoint here must be:

            /admin/subjects?exam_id=...

            NOT:

            /api/admin/subjects
        */

        const endpoint =

            `${QUESTION_API.subjects}?exam_id=${encodeURIComponent(
                examId
            )}`;


        const result =
            await API.get(
                endpoint
            );


        if (
            !result ||
            result.success !== true
        ) {

            throw new Error(
                result?.message ||
                "Failed to load subjects."
            );

        }


        let subjects =
            Array.isArray(result.data)
                ? result.data
                : [];


        /*
        -----------------------------------------------------
            SECURITY / DATA INTEGRITY

            The worker already filters by exam_id.

            We additionally verify the returned relationship
            on the client before displaying subjects.
        -----------------------------------------------------
        */

        subjects =
            subjects.filter(
                subject => {

                    return (

                        String(
                            subject.exam_id ?? ""
                        ) ===
                        String(examId)

                    );

                }
            );


        const activeSubjects =
            subjects.filter(
                isActiveRecord
            );


        /*
        -----------------------------------------------------
            MANUAL QUESTION SUBJECT SELECT
        -----------------------------------------------------
        */

        subjectSelect.innerHTML = "";


        addOption(
            subjectSelect,
            "",
            "Select Subject"
        );


        activeSubjects.forEach(
            subject => {

                addOption(
                    subjectSelect,
                    subject.id,
                    subject.name ||
                    "Unnamed Subject"
                );

            }
        );


        if (!activeSubjects.length) {

            setSelectMessage(
                subjectSelect,
                "No active subjects found."
            );

        }


        /*
        -----------------------------------------------------
            IMPORT SUBJECT SELECT
        -----------------------------------------------------
        */

        populateImportSubjects(
            activeSubjects
        );

    }

    catch (error) {

        console.error(
            "Load Subjects:",
            error
        );


        setSelectMessage(
            subjectSelect,
            "Failed to load subjects."
        );


        setSelectMessage(
            importSubject,
            "Failed to load subjects."
        );


        notifyQuestionUser(
            error.message ||
            "Failed to load subjects.",
            "error"
        );

    }

}


/*=========================================================
    IMPORT SUBJECTS
=========================================================*/

function populateImportSubjects(
    subjects
) {

    if (!importSubject) {

        return;

    }


    importSubject.innerHTML = "";


    addOption(
        importSubject,
        "",
        "Select Subject"
    );


    if (!Array.isArray(subjects)) {

        return;

    }


    subjects
        .filter(isActiveRecord)
        .forEach(
            subject => {

                addOption(
                    importSubject,
                    subject.id,
                    subject.name ||
                    "Unnamed Subject"
                );

            }
        );


    if (!subjects.filter(isActiveRecord).length) {

        setSelectMessage(
            importSubject,
            "No active subjects found."
        );

    }

}


/*=========================================================
    MANUAL QUESTION SUBMIT
=========================================================*/

async function handleQuestionSubmit(
    event
) {

    event.preventDefault();


    if (!questionForm) {

        return;

    }


    /*
    -----------------------------------------------------
        READ EXAM
    -----------------------------------------------------
    */

    const examId =
        String(
            examSelect?.value || ""
        ).trim();


    /*
    -----------------------------------------------------
        READ SUBJECT
    -----------------------------------------------------
    */

    const subjectId =
        String(
            subjectSelect?.value || ""
        ).trim();


    /*
    -----------------------------------------------------
        READ QUESTION
    -----------------------------------------------------
    */

    const question =
        String(
            questionText?.value || ""
        ).trim();


    /*
    -----------------------------------------------------
        READ ANSWER
    -----------------------------------------------------
    */

    const answer =
        String(
            correctAnswer?.value || ""
        )
        .trim()
        .toUpperCase();


    /*
    -----------------------------------------------------
        VALIDATE EXAM
    -----------------------------------------------------
    */

    if (!examId) {

        notifyQuestionUser(
            "Please select an exam.",
            "error"
        );

        examSelect?.focus();

        return;

    }


    /*
    -----------------------------------------------------
        VALIDATE SUBJECT
    -----------------------------------------------------
    */

    if (!subjectId) {

        notifyQuestionUser(
            "Please select a subject.",
            "error"
        );

        subjectSelect?.focus();

        return;

    }


    /*
    -----------------------------------------------------
        VALIDATE QUESTION
    -----------------------------------------------------
    */

    if (!question) {

        notifyQuestionUser(
            "Question is required.",
            "error"
        );

        questionText?.focus();

        return;

    }


    /*
    -----------------------------------------------------
        BUILD PAYLOAD
    -----------------------------------------------------

        practice_questions stores subject_id.

        exam_id is sent so the worker can verify that
        the selected subject belongs to that exam.
    */

    const data = {

        exam_id:
            examId,

        subject_id:
            subjectId,

        question:
            question,

        image_url:
            "",

        option_a:
            String(
                optionA?.value || ""
            ).trim(),

        option_b:
            String(
                optionB?.value || ""
            ).trim(),

        option_c:
            String(
                optionC?.value || ""
            ).trim(),

        option_d:
            String(
                optionD?.value || ""
            ).trim(),

        correct_answer:
            answer,

        explanation:
            String(
                explanation?.value || ""
            ).trim(),

        difficulty:
            "medium"

    };


    /*
    -----------------------------------------------------
        VALIDATE OPTIONS
    -----------------------------------------------------
    */

    if (

        !data.option_a ||
        !data.option_b ||
        !data.option_c ||
        !data.option_d

    ) {

        notifyQuestionUser(
            "All answer options are required.",
            "error"
        );

        return;

    }


    /*
    -----------------------------------------------------
        VALIDATE CORRECT ANSWER
    -----------------------------------------------------
    */

    if (
        !["A", "B", "C", "D"].includes(
            data.correct_answer
        )
    ) {

        notifyQuestionUser(
            "Correct answer must be A, B, C or D.",
            "error"
        );

        correctAnswer?.focus();

        return;

    }


    const submitButton =
        questionForm.querySelector(
            'button[type="submit"]'
        );


    try {

        setQuestionButtonLoading(
            submitButton,
            "Saving..."
        );


        /*
        -------------------------------------------------
            IMPORTANT

            API.post automatically:

            - uses the shared BASE_URL
            - adds JSON headers
            - adds Authorization token
            - parses JSON
            - throws on HTTP errors
        -------------------------------------------------
        */

        const result =
            await API.post(
                QUESTION_API.questions,
                data
            );


        if (
            !result ||
            result.success !== true
        ) {

            throw new Error(
                result?.message ||
                "Failed to create question."
            );

        }


        notifyQuestionUser(
            result.message ||
            "Question created successfully.",
            "success"
        );


        /*
        -------------------------------------------------
            RESET QUESTION CONTENT
        -------------------------------------------------
        */

        questionForm.reset();


        resetSubjectSelect();


        /*
        -------------------------------------------------
            KEEP THE SELECTED EXAM

            Reload its subjects so another question can
            immediately be added under the same exam.
        -------------------------------------------------
        */

        if (examSelect?.value) {

            await loadSubjects(
                examSelect.value
            );

        }


        /*
        -------------------------------------------------
            REFRESH QUESTION BANK
        -------------------------------------------------
        */

        await loadQuestions();

    }

    catch (error) {

        console.error(
            "Create Question:",
            error
        );


        notifyQuestionUser(
            error.message ||
            "Failed to create question.",
            "error"
        );

    }

    finally {

        restoreQuestionButton(
            submitButton,
            "Save Question"
        );

    }

}


/*=========================================================
    LOAD QUESTION BANK
=========================================================*/

async function loadQuestions() {

    if (!questionsTableBody) {

        return;

    }


    questionsTableBody.innerHTML = `

        <tr>

            <td colspan="6">

                Loading questions...

            </td>

        </tr>

    `;


    try {

        const result =
            await API.get(
                QUESTION_API.questions
            );


        if (
            !result ||
            result.success !== true
        ) {

            throw new Error(
                result?.message ||
                "Failed to load questions."
            );

        }


        const questions =
            Array.isArray(result.data)
                ? result.data
                : [];


        renderQuestionBank(
            questions
        );

    }

    catch (error) {

        console.error(
            "Load Questions:",
            error
        );


        questionsTableBody.innerHTML = `

            <tr>

                <td colspan="6">

                    Failed to load questions.

                </td>

            </tr>

        `;


        notifyQuestionUser(
            error.message ||
            "Failed to load questions.",
            "error"
        );

    }

}


/*=========================================================
    RENDER QUESTION BANK
=========================================================*/

function renderQuestionBank(
    questions
) {

    if (!questionsTableBody) {

        return;

    }


    if (!Array.isArray(questions) || !questions.length) {

        questionsTableBody.innerHTML = `

            <tr>

                <td colspan="6">

                    No questions found.

                </td>

            </tr>

        `;

        return;

    }


    questionsTableBody.innerHTML = "";


    questions.forEach(
        (question, index) => {

            const row =
                document.createElement(
                    "tr"
                );


            row.innerHTML = `

                <td>
                    ${index + 1}
                </td>

                <td>
                    ${escapeQuestionHTML(
                        question.question
                    )}
                </td>

                <td>
                    ${escapeQuestionHTML(
                        question.exam_name
                    )}
                </td>

                <td>
                    ${escapeQuestionHTML(
                        question.subject_name
                    )}
                </td>

                <td>
                    ${escapeQuestionHTML(
                        question.correct_answer
                    )}
                </td>

                <td>

                    <button
                        type="button"
                        class="btn btn-secondary question-view-btn"
                        data-id="${escapeQuestionAttribute(
                            question.id
                        )}">

                        View

                    </button>

                </td>

            `;


            questionsTableBody.appendChild(
                row
            );

        }
    );


    questionsTableBody
        .querySelectorAll(
            ".question-view-btn"
        )
        .forEach(
            button => {

                button.addEventListener(
                    "click",
                    () => {

                        viewQuestion(
                            button.dataset.id
                        );

                    }
                );

            }
        );

}


/*=========================================================
    VIEW QUESTION
=========================================================*/

async function viewQuestion(
    questionId
) {

    if (!questionId) {

        return;

    }


    try {

        const result =
            await API.get(
                `${QUESTION_API.questions}/${encodeURIComponent(
                    questionId
                )}`
            );


        if (
            !result ||
            result.success !== true
        ) {

            throw new Error(
                result?.message ||
                "Failed to load question."
            );

        }


        const question =
            result.data;


        const message =

            `Exam: ${
                question?.exam_name || "—"
            }\n\n` +

            `Subject: ${
                question?.subject_name || "—"
            }\n\n` +

            `Question:\n${
                question?.question || ""
            }\n\n` +

            `A: ${
                question?.option_a || ""
            }\n` +

            `B: ${
                question?.option_b || ""
            }\n` +

            `C: ${
                question?.option_c || ""
            }\n` +

            `D: ${
                question?.option_d || ""
            }\n\n` +

            `Correct Answer: ${
                question?.correct_answer || ""
            }\n\n` +

            `Explanation:\n${
                question?.explanation || ""
            }`;


        window.alert(
            message
        );

    }

    catch (error) {

        console.error(
            "View Question:",
            error
        );


        notifyQuestionUser(
            error.message ||
            "Failed to load question.",
            "error"
        );

    }

}


/*=========================================================
    FORM RESET
=========================================================*/

function handleQuestionReset() {

    window.setTimeout(
        () => {

            resetSubjectSelect();

        },
        0
    );

}


/*=========================================================
    RESET SUBJECT
=========================================================*/

function resetSubjectSelect() {

    if (!subjectSelect) {

        return;

    }


    subjectSelect.innerHTML = "";


    addOption(
        subjectSelect,
        "",
        "Select Subject"
    );

}


/*=========================================================
    RESET IMPORT SUBJECT
=========================================================*/

function resetImportSubject() {

    if (!importSubject) {

        return;

    }


    importSubject.innerHTML = "";


    addOption(
        importSubject,
        "",
        "Select Subject"
    );

}


/*=========================================================
    SELECT HELPERS
=========================================================*/

function addOption(
    select,
    value,
    label
) {

    if (!select) {

        return;

    }


    const option =
        document.createElement(
            "option"
        );


    option.value =
        String(
            value ?? ""
        );


    option.textContent =
        String(
            label ?? ""
        );


    select.appendChild(
        option
    );

}


function setSelectMessage(
    select,
    message
) {

    if (!select) {

        return;

    }


    select.innerHTML = "";


    addOption(
        select,
        "",
        message
    );

}


/*=========================================================
    RECORD STATUS
=========================================================*/

function isActiveRecord(
    record
) {

    /*
        The admin endpoints normally return status.

        Treat missing status as active so this frontend
        remains compatible with a valid endpoint response
        that does not include the field.
    */

    return (

        !record ||
        record.status === undefined ||
        record.status === null ||
        record.status === "active"

    );

}


/*=========================================================
    BUTTON HELPERS
=========================================================*/

function setQuestionButtonLoading(
    button,
    text
) {

    if (!button) {

        return;

    }


    if (!button.dataset.originalText) {

        button.dataset.originalText =
            button.textContent;

    }


    button.disabled =
        true;


    button.textContent =
        text;

}


function restoreQuestionButton(
    button,
    fallbackText
) {

    if (!button) {

        return;

    }


    button.disabled =
        false;


    button.textContent =

        button.dataset.originalText ||
        fallbackText;

}


/*=========================================================
    NOTIFICATION HELPER
=========================================================*/

function notifyQuestionUser(
    message,
    type
) {

    /*
        Use the application's existing notification
        system when available.
    */

    if (
        typeof window.notifyUser === "function"
    ) {

        window.notifyUser(
            message,
            type
        );

        return;

    }


    /*
        Safe fallback if the shared notification helper
        is unavailable.
    */

    if (type === "error") {

        console.error(
            message
        );

    }

    else {

        console.log(
            message
        );

    }

}


/*=========================================================
    HTML ESCAPING
=========================================================*/

function escapeQuestionHTML(
    value
) {

    return String(
        value ?? ""
    )

    .replace(
        /&/g,
        "&amp;"
    )

    .replace(
        /</g,
        "&lt;"
    )

    .replace(
        />/g,
        "&gt;"
    )

    .replace(
        /"/g,
        "&quot;"
    )

    .replace(
        /'/g,
        "&#039;"
    );

}


function escapeQuestionAttribute(
    value
) {

    return escapeQuestionHTML(
        value
    );

}