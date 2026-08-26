"use strict";

/*
=========================================================
    NURSEPHERE ADMIN
    PRACTICE QUESTION MANAGEMENT
=========================================================

    Handles:

        ✔ Authentication
        ✔ Exam loading
        ✔ Subject loading by selected exam
        ✔ Manual question creation
        ✔ Question bank loading
        ✔ Question viewing
        ✔ Clear/reset handling

    IMPORTING IS HANDLED BY:

        js/questions-import.js

    RELATIONSHIP:

        EXAM
          ↓
        SUBJECT
          ↓
        QUESTION

=========================================================
*/


/*=========================================================
    AUTHENTICATION
=========================================================*/

if (
    window.Auth &&
    typeof Auth.requireAdmin === "function"
) {

    Auth.requireAdmin();

}


/*=========================================================
    CONFIGURATION
=========================================================*/

const QUESTION_API = {

    exams:
        "/api/admin/exams",

    subjects:
        "/api/admin/subjects",

    questions:
        "/api/admin/questions"

};


/*=========================================================
    DOM ELEMENTS
=========================================================*/

const examSelect =
    document.getElementById(
        "examSelect"
    );

const subjectSelect =
    document.getElementById(
        "subjectSelect"
    );

const questionForm =
    document.getElementById(
        "questionForm"
    );

const questionText =
    document.getElementById(
        "questionText"
    );

const questionImage =
    document.getElementById(
        "questionImage"
    );

const optionA =
    document.getElementById(
        "optionA"
    );

const optionB =
    document.getElementById(
        "optionB"
    );

const optionC =
    document.getElementById(
        "optionC"
    );

const optionD =
    document.getElementById(
        "optionD"
    );

const correctAnswer =
    document.getElementById(
        "correctAnswer"
    );

const explanation =
    document.getElementById(
        "explanation"
    );

const questionsTableBody =
    document.getElementById(
        "questionsTableBody"
    );

const importSubject =
    document.getElementById(
        "importSubject"
    );


/*=========================================================
    INITIALIZE
=========================================================*/

document.addEventListener(

    "DOMContentLoaded",

    initializeQuestionManagement

);


async function initializeQuestionManagement() {

    if (
        !examSelect ||
        !subjectSelect
    ) {

        console.error(
            "Question management elements are missing."
        );

        return;

    }


    bindEvents();


    await loadExams();


    await loadQuestions();

}


/*=========================================================
    EVENT BINDINGS
=========================================================*/

function bindEvents() {

    examSelect.addEventListener(

        "change",

        handleExamChange

    );


    questionForm?.addEventListener(

        "submit",

        handleQuestionSubmit

    );


    questionForm?.addEventListener(

        "reset",

        handleQuestionReset

    );

}


/*=========================================================
    LOAD EXAMS
=========================================================*/

async function loadExams() {

    setSelectLoading(

        examSelect,

        "Loading Exams..."

    );


    try {

        /*
        -------------------------------------------------
            IMPORTANT

            Use shared authenticated API helper.

            Do NOT use raw fetch here.
        -------------------------------------------------
        */

        if (
            !window.API ||
            typeof API.get !== "function"
        ) {

            throw new Error(
                "Authenticated API service is unavailable."
            );

        }


        const response =
            await API.get(
                QUESTION_API.exams
            );


        const exams =

            Array.isArray(
                response?.data
            )

                ? response.data

                : [];


        examSelect.innerHTML = `

            <option value="">

                Select Exam

            </option>

        `;


        exams

            .filter(

                exam =>

                    exam &&
                    (
                        exam.status === undefined ||
                        exam.status === "active"
                    )

            )

            .forEach(

                exam => {

                    addOption(

                        examSelect,

                        exam.id,

                        exam.name

                    );

                }

            );


        /*
        -------------------------------------------------
            Reset dependent selections.

            Subjects cannot be selected until an exam
            has been selected.
        -------------------------------------------------
        */

        resetSubjectSelect();


        populateImportSubjects([]);


        /*
        -------------------------------------------------
            No active exams
        -------------------------------------------------
        */

        if (
            examSelect.options.length <= 1
        ) {

            setSelectError(

                examSelect,

                "No active exams available"

            );

        }

    }

    catch (error) {

        console.error(

            "Load Exams:",

            error

        );


        setSelectError(

            examSelect,

            error.message ||
            "Failed to load exams"

        );


        resetSubjectSelect();


        populateImportSubjects([]);

    }

}


/*=========================================================
    EXAM CHANGE
=========================================================*/

async function handleExamChange() {

    const examId =
        String(
            examSelect.value || ""
        ).trim();


    /*
    -------------------------------------------------
        Always clear subject first.

        This prevents a subject belonging to the
        previous exam from being submitted under
        the newly selected exam.
    -------------------------------------------------
    */

    resetSubjectSelect();


    populateImportSubjects([]);


    if (!examId) {

        return;

    }


    await loadSubjects(
        examId
    );

}


/*=========================================================
    LOAD SUBJECTS FOR SELECTED EXAM
=========================================================*/

async function loadSubjects(
    examId
) {

    if (!examId) {

        resetSubjectSelect();

        populateImportSubjects([]);

        return;

    }


    setSelectLoading(

        subjectSelect,

        "Loading Subjects..."

    );


    try {

        if (
            !window.API ||
            typeof API.get !== "function"
        ) {

            throw new Error(
                "Authenticated API service is unavailable."
            );

        }


        /*
        -------------------------------------------------
            Backend endpoint:

            GET
            /api/admin/subjects?exam_id=...
        -------------------------------------------------
        */

        const response =
            await API.get(

                `${QUESTION_API.subjects}?exam_id=${encodeURIComponent(examId)}`

            );


        const subjects =

            Array.isArray(
                response?.data
            )

                ? response.data

                : [];


        /*
        -------------------------------------------------
            Only subjects belonging to the selected
            exam are allowed.

            The worker already filters by exam_id,
            but we enforce the relationship client-side
            as an additional safety check.
        -------------------------------------------------
        */

        const examSubjects =
            subjects.filter(

                subject =>

                    subject &&

                    String(
                        subject.exam_id
                    ) ===
                    String(examId)

            );


        subjectSelect.innerHTML = `

            <option value="">

                Select Subject

            </option>

        `;


        examSubjects

            .filter(

                subject =>

                    subject.status === undefined ||

                    subject.status === "active"

            )

            .forEach(

                subject => {

                    addOption(

                        subjectSelect,

                        subject.id,

                        subject.name

                    );

                }

            );


        /*
        -------------------------------------------------
            Import subject selector receives ONLY subjects
            belonging to the selected exam.
        -------------------------------------------------
        */

        populateImportSubjects(
            examSubjects
        );


        if (
            subjectSelect.options.length <= 1
        ) {

            setSelectError(

                subjectSelect,

                "No active subjects for this exam"

            );

        }

    }

    catch (error) {

        console.error(

            "Load Subjects:",

            error

        );


        setSelectError(

            subjectSelect,

            error.message ||
            "Failed to load subjects"

        );


        populateImportSubjects([]);

    }

}


/*=========================================================
    POPULATE IMPORT SUBJECTS
=========================================================*/

function populateImportSubjects(
    subjects
) {

    if (!importSubject) {

        return;

    }


    importSubject.innerHTML = `

        <option value="">

            Select Subject

        </option>

    `;


    if (
        !Array.isArray(subjects)
    ) {

        return;

    }


    subjects

        .filter(

            subject =>

                subject &&

                (
                    subject.status === undefined ||

                    subject.status === "active"
                )

        )

        .forEach(

            subject => {

                addOption(

                    importSubject,

                    subject.id,

                    subject.name

                );

            }

        );

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
    -------------------------------------------------
        READ CURRENT EXAM
    -------------------------------------------------
    */

    const examId =
        String(
            examSelect?.value || ""
        ).trim();


    /*
    -------------------------------------------------
        READ CURRENT SUBJECT
    -------------------------------------------------
    */

    const subjectId =
        String(
            subjectSelect?.value || ""
        ).trim();


    const question =
        String(
            questionText?.value || ""
        ).trim();


    const answer =
        String(
            correctAnswer?.value || ""
        )
        .trim()
        .toUpperCase();


    /*
    -------------------------------------------------
        VALIDATE EXAM FIRST
    -------------------------------------------------
    */

    if (!examId) {

        notifyUser(

            "Please select an exam.",

            "error"

        );

        examSelect?.focus();

        return;

    }


    /*
    -------------------------------------------------
        VALIDATE SUBJECT SECOND
    -------------------------------------------------
    */

    if (!subjectId) {

        notifyUser(

            "Please select a subject.",

            "error"

        );

        subjectSelect?.focus();

        return;

    }


    const data = {

        exam_id:
            examId,

        subject_id:
            subjectId,

        question:
            question,

        /*
            Image URL remains optional.
        */

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


    /*=====================================================
        QUESTION VALIDATION
    =====================================================*/


    if (!data.question) {

        notifyUser(

            "Question is required.",

            "error"

        );

        questionText?.focus();

        return;

    }


    if (

        !data.option_a ||

        !data.option_b ||

        !data.option_c ||

        !data.option_d

    ) {

        notifyUser(

            "All answer options are required.",

            "error"

        );

        return;

    }


    if (

        !["A", "B", "C", "D"].includes(

            data.correct_answer

        )

    ) {

        notifyUser(

            "Select a valid correct answer.",

            "error"

        );

        correctAnswer?.focus();

        return;

    }


    /*=====================================================
        CREATE QUESTION
    =====================================================*/

    const submitButton =
        questionForm.querySelector(

            'button[type="submit"]'

        );


    try {

        setButtonLoading(

            submitButton,

            "Saving..."

        );


        if (
            !window.API ||
            typeof API.post !== "function"
        ) {

            throw new Error(
                "Authenticated API service is unavailable."
            );

        }


        /*
        -------------------------------------------------
            API helper handles authentication.
        -------------------------------------------------
        */

        const result =
            await API.post(

                QUESTION_API.questions,

                data

            );


        if (
            !result ||
            result.success === false
        ) {

            throw new Error(

                result?.message ||

                "Failed to save question."

            );

        }


        notifyUser(

            result.message ||

            "Question created successfully.",

            "success"

        );


        questionForm.reset();


        resetSubjectSelect();


        /*
        -------------------------------------------------
            Re-load exams so the normal workflow starts
            cleanly again.
        -------------------------------------------------
        */

        await loadExams();


        await loadQuestions();

    }

    catch (error) {

        console.error(

            "Create Question:",

            error

        );


        notifyUser(

            error.message ||

            "Failed to save question.",

            "error"

        );

    }

    finally {

        restoreButton(

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

        if (
            !window.API ||
            typeof API.get !== "function"
        ) {

            throw new Error(
                "Authenticated API service is unavailable."
            );

        }


        const response =
            await API.get(

                QUESTION_API.questions

            );


        const questions =

            Array.isArray(
                response?.data
            )

                ? response.data

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

                    ${escapeHTML(

                        error.message ||

                        "Failed to load questions."

                    )}

                </td>

            </tr>

        `;

    }

}


/*=========================================================
    RENDER QUESTION BANK
=========================================================*/

function renderQuestionBank(
    questions
) {

    if (
        !Array.isArray(questions) ||
        !questions.length
    ) {

        questionsTableBody.innerHTML = `

            <tr>

                <td colspan="6">

                    No questions found.

                </td>

            </tr>

        `;

        return;

    }


    questionsTableBody.innerHTML =
        "";


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

                    ${escapeHTML(
                        question.question || ""
                    )}

                </td>

                <td>

                    ${escapeHTML(
                        question.exam_name || ""
                    )}

                </td>

                <td>

                    ${escapeHTML(
                        question.subject_name || ""
                    )}

                </td>

                <td>

                    ${escapeHTML(
                        question.correct_answer || ""
                    )}

                </td>

                <td>

                    <button

                        type="button"

                        class="btn btn-secondary question-view-btn"

                        data-id="${escapeHTML(
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

        if (
            !window.API ||
            typeof API.get !== "function"
        ) {

            throw new Error(
                "Authenticated API service is unavailable."
            );

        }


        const result =
            await API.get(

                `${QUESTION_API.questions}/${encodeURIComponent(questionId)}`

            );


        const question =
            result?.data ||
            result?.question;


        if (!question) {

            throw new Error(
                "Question data was not returned."
            );

        }


        const details = [

            `Question:\n${question.question || ""}`,

            `Option A:\n${question.option_a || ""}`,

            `Option B:\n${question.option_b || ""}`,

            `Option C:\n${question.option_c || ""}`,

            `Option D:\n${question.option_d || ""}`,

            `Correct Answer:\n${question.correct_answer || ""}`,

            `Explanation:\n${question.explanation || ""}`

        ].join(
            "\n\n"
        );


        alert(
            details
        );

    }

    catch (error) {

        console.error(

            "View Question:",

            error

        );


        notifyUser(

            error.message ||

            "Unable to load question.",

            "error"

        );

    }

}


/*=========================================================
    RESET
=========================================================*/

function handleQuestionReset() {

    window.setTimeout(

        () => {

            resetSubjectSelect();

            populateImportSubjects([]);

        },

        0

    );

}


function resetSubjectSelect() {

    if (!subjectSelect) {

        return;

    }


    subjectSelect.innerHTML = `

        <option value="">

            Select Subject

        </option>

    `;

}


/*=========================================================
    HELPERS
=========================================================*/

function setSelectLoading(

    select,

    message

) {

    if (!select) {

        return;

    }


    select.disabled =
        true;


    select.innerHTML = `

        <option value="">

            ${escapeHTML(
                message
            )}

        </option>

    `;

}


function setSelectError(

    select,

    message

) {

    if (!select) {

        return;

    }


    select.disabled =
        true;


    select.innerHTML = `

        <option value="">

            ${escapeHTML(
                message
            )}

        </option>

    `;

}


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


    /*
        Once real options are available,
        allow selection.
    */

    select.disabled =
        false;

}


function setButtonLoading(

    button,

    text

) {

    if (!button) {

        return;

    }


    if (
        !button.dataset.originalText
    ) {

        button.dataset.originalText =
            button.textContent.trim();

    }


    button.disabled =
        true;


    button.textContent =
        text;

}


function restoreButton(

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


    delete button.dataset.originalText;

}


function escapeHTML(
    value
) {

    const div =
        document.createElement(
            "div"
        );


    div.textContent =
        String(
            value ?? ""
        );


    return div.innerHTML;

}


function notifyUser(

    message,

    type = "info"

) {

    /*
    -------------------------------------------------
        Prefer existing project notification system.
    -------------------------------------------------
    */

    if (

        window.Utils &&

        typeof window.Utils.showToast ===
        "function"

    ) {

        window.Utils.showToast(

            message,

            type

        );

        return;

    }


    if (
        type === "error"
    ) {

        console.error(
            message
        );

    }

    else {

        console.log(
            message
        );

    }


    alert(
        message
    );

}


/*=========================================================
    OPTIONAL GLOBAL ACCESS
=========================================================*/

/*
    questions-import.js can refresh the question bank
    after a successful import without requiring another
    duplicate import implementation.
*/

window.loadQuestions =
    loadQuestions;