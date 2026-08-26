"use strict";

/*
=========================================================
    NURSEPHERE ADMIN
    PRACTICE QUESTION MANAGEMENT
=========================================================

    Handles:

        ✔ Exam loading
        ✔ Exam → Subject relationship
        ✔ Manual question creation
        ✔ Question bank loading
        ✔ Question viewing
        ✔ Form reset

    IMPORTING IS HANDLED BY:

        js/questions-import.js

    IMPORTANT:
        Do NOT add importForm handling here.
=========================================================
*/


/*=========================================================
    API
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
    DOM
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
        !subjectSelect ||
        !questionForm
    ) {

        console.error(
            "Required question management elements are missing."
        );

        return;

    }


    bindEvents();


    resetSubjectSelect();


    await loadExams();


    await loadQuestions();

}


/*=========================================================
    EVENTS
=========================================================*/

function bindEvents() {

    examSelect.addEventListener(

        "change",

        handleExamChange

    );


    questionForm.addEventListener(

        "submit",

        handleQuestionSubmit

    );


    questionForm.addEventListener(

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
            await parseQuestionJSON(
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
            Array.isArray(result.data)

                ? result.data

                : Array.isArray(result.exams)

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

                    addSelectOption(

                        examSelect,

                        exam.id,

                        exam.name ||
                        exam.code ||
                        "Unnamed Exam"

                    );

                }

            );


        /*
            Import subject selector must remain empty
            until an exam is selected.
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


    populateImportSubjects([]);


    if (!examId) {

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

    if (!examId) {

        return;

    }


    setSelectLoading(

        subjectSelect,

        "Loading Subjects..."

    );


    try {

        const url =

            `${QUESTION_API.subjects}?exam_id=${encodeURIComponent(
                examId
            )}`;


        const response =
            await fetch(

                url,

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
            await parseQuestionJSON(
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

            Array.isArray(result.data)

                ? result.data

                : Array.isArray(result.subjects)

                    ? result.subjects

                    : [];


        /*
        -----------------------------------------------------
            IMPORTANT

            Only allow subjects belonging to the selected
            exam.

            This protects the UI even if the API returns
            all subjects.
        -----------------------------------------------------
        */

        subjects =
            subjects.filter(

                subject =>

                    String(
                        subject.exam_id ?? ""
                    ) ===
                    String(examId)

            );


        /*
            If the endpoint does not return exam_id,
            do NOT blindly display unrelated subjects.

            The worker should return exam_id for subjects
            requested through ?exam_id=.
        */


        const activeSubjects =
            subjects.filter(

                subject =>

                    subject.status === undefined ||

                    subject.status === "active"

            );


        subjectSelect.innerHTML = `

            <option value="">

                Select Subject

            </option>

        `;


        activeSubjects.forEach(

            subject => {

                addSelectOption(

                    subjectSelect,

                    subject.id,

                    subject.name ||
                    subject.title ||
                    "Unnamed Subject"

                );

            }

        );


        if (
            !activeSubjects.length
        ) {

            subjectSelect.innerHTML = `

                <option value="">

                    No active subjects found

                </option>

            `;

        }


        /*
        -----------------------------------------------------
            IMPORT FORM

            Same Exam → Subject relationship.
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


        setSelectError(

            subjectSelect,

            "Failed to load subjects"

        );


        populateImportSubjects([]);

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

                subject.status === undefined ||

                subject.status === "active"

        )

        .forEach(

            subject => {

                addSelectOption(

                    importSubject,

                    subject.id,

                    subject.name ||
                    subject.title ||
                    "Unnamed Subject"

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
            questionText?.value || ""
        ).trim();


    const answer =
        String(
            correctAnswer?.value || ""
        )
        .trim()
        .toUpperCase();


    /*
    -----------------------------------------------------
        EXAM
    -----------------------------------------------------
    */

    if (!examId) {

        notifyUser(

            "Please select an exam.",

            "error"

        );

        examSelect.focus();

        return;

    }


    /*
    -----------------------------------------------------
        SUBJECT
    -----------------------------------------------------
    */

    if (!subjectId) {

        notifyUser(

            "Please select a subject.",

            "error"

        );

        subjectSelect.focus();

        return;

    }


    /*
    -----------------------------------------------------
        QUESTION
    -----------------------------------------------------
    */

    if (!question) {

        notifyUser(

            "Question is required.",

            "error"

        );

        questionText?.focus();

        return;

    }


    const data = {

        /*
            Worker requires BOTH.

            exam_id is validated against the subject's
            actual exam_id.
        */

        exam_id:
            examId,

        subject_id:
            subjectId,

        question:
            question,

        /*
            The current worker expects image_url,
            not a File object.

            Therefore do not send questionImage.files[0].
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


    /*
    -----------------------------------------------------
        CLIENT VALIDATION
    -----------------------------------------------------
    */

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

            "Please select a valid correct answer.",

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
                        JSON.stringify(data)

                }

            );


        const result =
            await parseQuestionJSON(
                response
            );


        if (
            !response.ok ||
            !result.success
        ) {

            throw new Error(

                result.message ||
                "Failed to create question."

            );

        }


        notifyUser(

            result.message ||
            "Question created successfully.",

            "success"

        );


        questionForm.reset();


        /*
            Reset subject after form reset.

            Exam is intentionally preserved because
            the administrator may want to add another
            question to the same exam.
        */

        resetSubjectSelect();


        /*
            Re-load subjects for the currently selected
            exam so the administrator can immediately
            create another question.
        */

        if (examSelect.value) {

            await loadSubjects(
                examSelect.value
            );

        }


        await loadQuestions();

    }

    catch (error) {

        console.error(

            "Create Question:",

            error

        );


        notifyUser(

            error.message ||
            "Failed to create question.",

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
            await parseQuestionJSON(
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

            Array.isArray(result.data)

                ? result.data

                : Array.isArray(result.questions)

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

                    ${escapeQuestionHTML(
                        question.question || ""
                    )}

                </td>

                <td>

                    ${escapeQuestionHTML(
                        question.exam_name || ""
                    )}

                </td>

                <td>

                    ${escapeQuestionHTML(
                        question.subject_name || ""
                    )}

                </td>

                <td>

                    ${escapeQuestionHTML(
                        question.correct_answer || ""
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

        const response =
            await fetch(

                `${QUESTION_API.questions}/${encodeURIComponent(
                    questionId
                )}`,

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
            await parseQuestionJSON(
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
            result.data;


        /*
        -----------------------------------------------------
            Keep viewing lightweight and safe.

            No assumption is made about a modal existing.
        -----------------------------------------------------
        */

        const message =

            `Exam: ${
                question.exam_name || "—"
            }\n\n` +

            `Subject: ${
                question.subject_name || "—"
            }\n\n` +

            `Question:\n${
                question.question || ""
            }\n\n` +

            `A: ${
                question.option_a || ""
            }\n` +

            `B: ${
                question.option_b || ""
            }\n` +

            `C: ${
                question.option_c || ""
            }\n` +

            `D: ${
                question.option_d || ""
            }\n\n` +

            `Correct Answer: ${
                question.correct_answer || ""
            }\n\n` +

            `Explanation:\n${
                question.explanation || ""
            }`;


        /*
            Existing application can replace this later
            with a proper modal without changing the API.
        */

        window.alert(
            message
        );

    }

    catch (error) {

        console.error(

            "View Question:",

            error

        );


        notifyUser(

            error.message ||
            "Failed to load question.",

            "error"

        );

    }

}


/*=========================================================
    RESET
=========================================================*/

function handleQuestionReset() {

    /*
        Allow browser to complete native reset first.
    */

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


    subjectSelect.innerHTML = `

        <option value="">

            Select Subject

        </option>

    `;

}


/*=========================================================
    JSON PARSER
=========================================================*/

async function parseQuestionJSON(
    response
) {

    const text =
        await response.text();


    if (!text) {

        return {};

    }


    try {

        return JSON.parse(
            text
        );

    }

    catch {

        throw new Error(

            `Server returned an invalid response (${response.status}).`

        );

    }

}


/*=========================================================
    SELECT HELPERS
=========================================================*/

function setSelectLoading(
    select,
    message
) {

    if (!select) {

        return;

    }


    select.innerHTML = "";


    const option =
        document.createElement(
            "option"
        );


    option.value =
        "";


    option.textContent =
        message;


    select.appendChild(
        option
    );

}


function setSelectError(
    select,
    message
) {

    if (!select) {

        return;

    }


    select.innerHTML = "";


    const option =
        document.createElement(
            "option"
        );


    option.value =
        "";


    option.textContent =
        message;


    select.appendChild(
        option
    );

}


function addSelectOption(
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
        String(value ?? "");


    option.textContent =
        String(label ?? "");


    select.appendChild(
        option
    );

}


/*=========================================================
    HTML SAFETY
=========================================================*/

function escapeQuestionHTML(
    value
) {

    return String(value ?? "")

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