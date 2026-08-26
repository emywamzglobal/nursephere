"use strict";

/*
=========================================================
    NURSEPHERE ADMIN
    PRACTICE QUESTION MANAGEMENT
=========================================================

    Handles:

        ✔ Exam loading
        ✔ Subject loading
        ✔ Manual question creation
        ✔ Question bank loading
        ✔ Question viewing
        ✔ Clear/reset handling

    IMPORTING IS HANDLED BY:

        js/questions-import.js

    IMPORTANT:
        Do NOT add another import submit handler here.

=========================================================
*/


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

    try {

        setSelectLoading(

            examSelect,

            "Loading Exams..."

        );


        const response =
            await fetch(

                QUESTION_API.exams,

                {

                    method:
                        "GET",

                    headers: {

                        "Accept":
                            "application/json"

                    }

                }

            );


        const result =
            await parseJSON(
                response
            );


        if (
            !response.ok ||
            !result.success
        ) {

            throw new Error(

                result.message ||
                "Failed to load exams."

            );

        }


        const exams =

            Array.isArray(
                result.data
            )

                ? result.data

                : Array.isArray(
                    result.exams
                )

                    ? result.exams

                    : [];


        examSelect.innerHTML = `

            <option value="">

                Select Exam

            </option>

        `;


        exams

            .filter(

                exam =>

                    exam.status === undefined ||

                    exam.status === "active"

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
            No exam selected yet,
            therefore no import subjects.
        */

        populateImportSubjects([]);


    }

    catch (error) {

        console.error(

            "Load Exams:",

            error

        );


        setSelectError(

            examSelect,

            "Failed to load exams"

        );


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


    resetSubjectSelect();


    if (!examId) {

        populateImportSubjects([]);

        return;

    }


    await loadSubjects(
        examId
    );

}


/*=========================================================
    LOAD SUBJECTS
=========================================================*/

async function loadSubjects(
    examId
) {

    try {

        setSelectLoading(

            subjectSelect,

            "Loading Subjects..."

        );


        const response =
            await fetch(

                `${QUESTION_API.subjects}?exam_id=${encodeURIComponent(examId)}`,

                {

                    method:
                        "GET",

                    headers: {

                        "Accept":
                            "application/json"

                    }

                }

            );


        const result =
            await parseJSON(
                response
            );


        if (
            !response.ok ||
            !result.success
        ) {

            throw new Error(

                result.message ||
                "Failed to load subjects."

            );

        }


        let subjects =

            Array.isArray(
                result.data
            )

                ? result.data

                : Array.isArray(
                    result.subjects
                )

                    ? result.subjects

                    : [];


        /*
            Some admin endpoints may return
            all subjects.

            Keep only subjects belonging
            to the selected exam.
        */

        subjects =
            subjects.filter(

                subject =>

                    !subject.exam_id ||

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


        subjects

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
            The import form uses the same
            Exam → Subject relationship.
        */

        populateImportSubjects(
            subjects
        );


    }

    catch (error) {

        console.error(

            "Load Subjects:",

            error

        );


        setSelectError(

            subjectSelect,

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


    subjects

        .filter(

            subject =>

                subject.status === undefined ||

                subject.status === "active"

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


    const examId =
        String(
            examSelect.value || ""
        ).trim();


    const subjectId =
        String(
            subjectSelect.value || ""
        ).trim();


    const question =
        String(
            questionText.value || ""
        ).trim();


    const answer =
        String(
            correctAnswer.value || ""
        )
        .trim()
        .toUpperCase();


    const data = {

        exam_id:
            examId,

        subject_id:
            subjectId,

        question:
            question,

        /*
            image_url remains optional.

            The existing admin API expects
            a URL, not a File object.
        */

        image_url:
            "",

        option_a:
            String(
                optionA.value || ""
            ).trim(),

        option_b:
            String(
                optionB.value || ""
            ).trim(),

        option_c:
            String(
                optionC.value || ""
            ).trim(),

        option_d:
            String(
                optionD.value || ""
            ).trim(),

        correct_answer:
            answer,

        explanation:
            String(
                explanation.value || ""
            ).trim(),

        difficulty:
            "medium"

    };


    /*=====================================================
        VALIDATION
    =====================================================*/


    if (!data.exam_id) {

        notifyUser(

            "Please select an exam.",

            "error"

        );

        examSelect.focus();

        return;

    }


    if (!data.subject_id) {

        notifyUser(

            "Please select a subject.",

            "error"

        );

        subjectSelect.focus();

        return;

    }


    if (!data.question) {

        notifyUser(

            "Question is required.",

            "error"

        );

        questionText.focus();

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

        correctAnswer.focus();

        return;

    }


    /*=====================================================
        CREATE QUESTION
    =====================================================*/

    try {

        const submitButton =
            questionForm.querySelector(

                'button[type="submit"]'

            );


        setButtonLoading(

            submitButton,

            "Saving..."

        );


        const response =
            await fetch(

                QUESTION_API.questions,

                {

                    method:
                        "POST",

                    headers: {

                        "Content-Type":
                            "application/json",

                        "Accept":
                            "application/json"

                    },

                    body:
                        JSON.stringify(
                            data
                        )

                }

            );


        const result =
            await parseJSON(
                response
            );


        if (
            !response.ok ||
            !result.success
        ) {

            throw new Error(

                result.message ||
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

            questionForm.querySelector(

                'button[type="submit"]'

            ),

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

        const response =
            await fetch(

                QUESTION_API.questions,

                {

                    method:
                        "GET",

                    headers: {

                        "Accept":
                            "application/json"

                    }

                }

            );


        const result =
            await parseJSON(
                response
            );


        if (
            !response.ok ||
            !result.success
        ) {

            throw new Error(

                result.message ||
                "Failed to load questions."

            );

        }


        const questions =

            Array.isArray(
                result.data
            )

                ? result.data

                : Array.isArray(
                    result.questions
                )

                    ? result.questions

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

    }

}


/*=========================================================
    RENDER QUESTION BANK
=========================================================*/

function renderQuestionBank(
    questions
) {

    if (!questions.length) {

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

                    () =>

                        viewQuestion(

                            button.dataset.id

                        )

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

        const response =
            await fetch(

                `${QUESTION_API.questions}/${encodeURIComponent(questionId)}`,

                {

                    method:
                        "GET",

                    headers: {

                        "Accept":
                            "application/json"

                    }

                }

            );


        const result =
            await parseJSON(
                response
            );


        if (
            !response.ok ||
            !result.success
        ) {

            throw new Error(

                result.message ||
                "Failed to load question."

            );

        }


        const question =
            result.data ||
            result.question;


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


        alert(details);

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

async function parseJSON(
    response
) {

    const text =
        await response.text();


    try {

        return text
            ? JSON.parse(text)
            : {};

    }

    catch {

        throw new Error(

            `Server returned an invalid response (${response.status}).`

        );

    }

}


function setSelectLoading(

    select,

    message

) {

    if (!select) {

        return;

    }


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
        Use existing project notification
        utility when available.
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