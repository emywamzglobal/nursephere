/*
=========================================================
    NurseSphere Practice Questions Controller
    File: student/js/questions.js
=========================================================
*/

"use strict";


/* =====================================================
   CONFIGURATION
===================================================== */

const API_BASE =
    "https://nursephere.wamalwaemily.workers.dev/api";


/* =====================================================
   DOM ELEMENTS
===================================================== */

const subjectName =
    document.getElementById("subjectName");

const subjectDescription =
    document.getElementById("subjectDescription");

const progressText =
    document.getElementById("progressText");

const progressFill =
    document.getElementById("progressFill");

const questionNumber =
    document.getElementById("questionNumber");

const questionText =
    document.getElementById("questionText");

const optionsContainer =
    document.getElementById("optionsContainer");

const explanationBox =
    document.getElementById("explanationBox");

const explanationText =
    document.getElementById("explanationText");

const previousBtn =
    document.getElementById("previousBtn");

const submitBtn =
    document.getElementById("submitBtn");

const nextBtn =
    document.getElementById("nextBtn");

const finishBtn =
    document.getElementById("finishBtn");


/* =====================================================
   URL
===================================================== */

const urlParams =
    new URLSearchParams(
        window.location.search
    );

const subjectId =
    urlParams.get("subject_id");


/* =====================================================
   PRACTICE STATE
===================================================== */

const practiceState = {

    subject: null,

    questions: [],

    currentIndex: 0,

    /*
    Student's selected answers.

    {
        "question-id": "A"
    }
    */
    answers: {},

    /*
    Server responses.

    {
        "question-id": {
            correct: true,
            correctAnswer: "A",
            explanation: "..."
        }
    }
    */
    results: {},

    /*
    Whether the answer has already been
    submitted to the Worker.
    */
    submitted: {},

    correctAnswers: 0,

    wrongAnswers: 0

};


/* =====================================================
   AUTHENTICATION
===================================================== */

function getToken() {

    return localStorage.getItem(
        "studentToken"
    );

}


function redirectToLogin() {

    localStorage.removeItem(
        "studentToken"
    );

    localStorage.removeItem(
        "student"
    );

    localStorage.removeItem(
        "studentId"
    );

    window.location.replace(
        "../login.html"
    );

}


/* =====================================================
   API REQUEST
===================================================== */

async function apiRequest(
    endpoint,
    options = {}
) {

    const token =
        getToken();


    if (!token) {

        redirectToLogin();

        throw new Error(
            "Your session has expired."
        );

    }


    const headers = {

        "Authorization":
            `Bearer ${token}`,

        "Accept":
            "application/json",

        ...(options.headers || {})

    };


    if (
        options.body &&
        !headers["Content-Type"]
    ) {

        headers["Content-Type"] =
            "application/json";

    }


    let response;


    try {

        response = await fetch(
            `${API_BASE}${endpoint}`,
            {
                ...options,
                headers,
                cache: "no-store"
            }
        );

    }

    catch (error) {

        console.error(
            "NurseSphere API error:",
            error
        );

        throw new Error(
            "Unable to connect to NurseSphere."
        );

    }


    if (response.status === 401) {

        redirectToLogin();

        throw new Error(
            "Your session has expired."
        );

    }


    let data;


    try {

        data =
            await response.json();

    }

    catch {

        throw new Error(
            "The server returned an invalid response."
        );

    }


    if (
        !response.ok ||
        data?.success === false
    ) {

        throw new Error(
            data?.message ||
            "The request could not be completed."
        );

    }


    return data;

}


/* =====================================================
   INITIALIZATION
===================================================== */

document.addEventListener(
    "DOMContentLoaded",
    initializePractice
);


async function initializePractice() {

    if (!getToken()) {

        redirectToLogin();

        return;

    }


    if (!subjectId) {

        showFatalError(
            "No subject was selected. Please return to Practice and select a subject."
        );

        return;

    }


    setLoadingState();


    try {

        await loadPractice();

    }

    catch (error) {

        console.error(
            "Practice initialization error:",
            error
        );

        showFatalError(
            error.message ||
            "Unable to load practice questions."
        );

    }

}


/* =====================================================
   LOAD PRACTICE QUESTIONS
===================================================== */

async function loadPractice() {

    const result =
        await apiRequest(
            `/practice?subject_id=${encodeURIComponent(subjectId)}`
        );


    practiceState.subject =
        result.subject || null;


    practiceState.questions =
        Array.isArray(result.questions)
            ? result.questions
            : [];


    practiceState.currentIndex =
        0;


    practiceState.answers =
        {};

    practiceState.results =
        {};

    practiceState.submitted =
        {};

    practiceState.correctAnswers =
        0;

    practiceState.wrongAnswers =
        0;


    renderSubject();


    if (!practiceState.questions.length) {

        showNoQuestions();

        return;

    }


    updateProgress();

    renderQuestion();

}


/* =====================================================
   SUBJECT
===================================================== */

function renderSubject() {

    subjectName.textContent =
        practiceState.subject?.name ||
        "Practice Questions";


    subjectDescription.textContent =
        practiceState.subject?.description ||
        "Answer the practice questions for this subject.";

}


/* =====================================================
   CURRENT QUESTION
===================================================== */

function getCurrentQuestion() {

    return practiceState.questions[
        practiceState.currentIndex
    ];

}


/* =====================================================
   QUESTION ID
===================================================== */

function getQuestionId(question) {

    return String(
        question?.id || ""
    );

}


/* =====================================================
   RENDER QUESTION
===================================================== */

function renderQuestion() {

    const question =
        getCurrentQuestion();


    if (!question) {

        return;

    }


    const questionId =
        getQuestionId(question);


    questionNumber.textContent =
        `Question ${practiceState.currentIndex + 1}`;


    questionText.textContent =
        question.question ||
        "";


    renderOptions(
        question
    );


    renderExplanation(
        questionId
    );


    updateProgress();

    updateNavigation();

    updateSubmitButton();

    updateFinishButton();

}


/* =====================================================
   RENDER OPTIONS
===================================================== */

function renderOptions(question) {

    optionsContainer.innerHTML =
        "";


    const options = [

        {
            key: "A",
            value: question.option_a
        },

        {
            key: "B",
            value: question.option_b
        },

        {
            key: "C",
            value: question.option_c
        },

        {
            key: "D",
            value: question.option_d
        }

    ];


    const questionId =
        getQuestionId(question);


    const selectedAnswer =
        practiceState.answers[
            questionId
        ];


    const submitted =
        practiceState.submitted[
            questionId
        ] === true;


    const fragment =
        document.createDocumentFragment();


    options.forEach(
        option => {

            if (
                option.value === null ||
                option.value === undefined ||
                String(option.value).trim() === ""
            ) {

                return;

            }


            const label =
                document.createElement("label");


            label.className =
                "option";


            const input =
                document.createElement("input");


            input.type =
                "radio";


            input.name =
                `question-${questionId}`;


            input.value =
                option.key;


            input.checked =
                selectedAnswer === option.key;


            input.disabled =
                submitted;


            const letter =
                document.createElement("span");


            letter.className =
                "option-letter";


            letter.textContent =
                option.key;


            const text =
                document.createElement("span");


            text.className =
                "option-text";


            text.textContent =
                option.value;


            label.append(
                input,
                letter,
                text
            );


            input.addEventListener(
                "change",
                () => {

                    if (submitted) {

                        return;

                    }


                    practiceState.answers[
                        questionId
                    ] =
                        option.key;


                    updateSubmitButton();

                }
            );


            if (submitted) {

                applyResultStyle(
                    label,
                    option.key,
                    questionId
                );

            }


            fragment.appendChild(
                label
            );

        }
    );


    optionsContainer.appendChild(
        fragment
    );

}


/* =====================================================
   APPLY SERVER RESULT TO OPTIONS
===================================================== */

function applyResultStyle(
    label,
    optionKey,
    questionId
) {

    const result =
        practiceState.results[
            questionId
        ];


    if (!result) {

        return;

    }


    const selected =
        practiceState.answers[
            questionId
        ];


    /*
    Correct answer returned by Worker.
    */

    if (
        optionKey ===
        result.correctAnswer
    ) {

        label.classList.add(
            "correct"
        );

    }


    /*
    Student's incorrect selection.
    */

    if (
        optionKey === selected &&
        !result.correct
    ) {

        label.classList.add(
            "incorrect"
        );

    }

}


/* =====================================================
   SUBMIT CURRENT ANSWER
===================================================== */

async function submitCurrentAnswer() {

    const question =
        getCurrentQuestion();


    if (!question) {

        return;

    }


    const questionId =
        getQuestionId(question);


    if (
        practiceState.submitted[
            questionId
        ]
    ) {

        return;

    }


    const selectedAnswer =
        practiceState.answers[
            questionId
        ];


    if (!selectedAnswer) {

        alert(
            "Please select an answer first."
        );

        return;

    }


    submitBtn.disabled =
        true;


    submitBtn.textContent =
        "Checking...";


    try {

        /*
        IMPORTANT:

        The correct answer is NOT in the
        question response anymore.

        The Worker checks it directly
        against D1.
        */

        const result =
            await apiRequest(
                "/practice/answer",
                {
                    method: "POST",

                    body: JSON.stringify({

                        question_id:
                            questionId,

                        answer:
                            selectedAnswer

                    })

                }
            );


        practiceState.submitted[
            questionId
        ] = true;


        practiceState.results[
            questionId
        ] = {

            correct:
                result.correct === true,

            correctAnswer:
                normalizeAnswer(
                    result.correct_answer
                ),

            explanation:
                result.explanation ||
                ""

        };


        if (
            result.correct === true
        ) {

            practiceState.correctAnswers++;

        }

        else {

            practiceState.wrongAnswers++;

        }


        renderQuestion();

    }

    catch (error) {

        console.error(
            "Answer submission error:",
            error
        );


        submitBtn.disabled =
            false;


        submitBtn.textContent =
            "Submit Answer";


        alert(
            error.message ||
            "Unable to check your answer."
        );

    }

}


/* =====================================================
   EXPLANATION
===================================================== */

function renderExplanation(
    questionId
) {

    const result =
        practiceState.results[
            questionId
        ];


    if (
        !practiceState.submitted[
            questionId
        ] ||
        !result
    ) {

        explanationBox.hidden =
            true;

        explanationText.textContent =
            "";

        return;

    }


    explanationBox.hidden =
        false;


    explanationText.textContent =
        result.explanation ||
        "No explanation has been provided for this question.";

}


/* =====================================================
   PROGRESS
===================================================== */

function updateProgress() {

    const total =
        practiceState.questions.length;


    if (!total) {

        progressText.textContent =
            "0 of 0";

        progressFill.style.width =
            "0%";

        return;

    }


    const current =
        practiceState.currentIndex + 1;


    progressText.textContent =
        `${current} of ${total}`;


    progressFill.style.width =
        `${(
            current / total
        ) * 100}%`;

}


/* =====================================================
   NAVIGATION
===================================================== */

function updateNavigation() {

    const index =
        practiceState.currentIndex;


    const lastIndex =
        practiceState.questions.length - 1;


    previousBtn.disabled =
        index <= 0;


    nextBtn.disabled =
        index >= lastIndex;

}


/* =====================================================
   SUBMIT BUTTON
===================================================== */

function updateSubmitButton() {

    const question =
        getCurrentQuestion();


    if (!question) {

        submitBtn.disabled =
            true;

        return;

    }


    const questionId =
        getQuestionId(question);


    const submitted =
        practiceState.submitted[
            questionId
        ] === true;


    if (submitted) {

        submitBtn.disabled =
            true;

        submitBtn.textContent =
            "Answer Submitted";

        return;

    }


    submitBtn.disabled =
        !practiceState.answers[
            questionId
        ];


    submitBtn.textContent =
        "Submit Answer";

}


/* =====================================================
   FINISH BUTTON
===================================================== */

function updateFinishButton() {

    const total =
        practiceState.questions.length;


    if (!total) {

        finishBtn.disabled =
            true;

        return;

    }


    const allSubmitted =
        practiceState.questions.every(
            question =>
                practiceState.submitted[
                    getQuestionId(question)
                ] === true
        );


    finishBtn.disabled =
        !allSubmitted;

}


/* =====================================================
   PREVIOUS BUTTON
===================================================== */

previousBtn.addEventListener(
    "click",
    () => {

        if (
            practiceState.currentIndex <= 0
        ) {

            return;

        }


        practiceState.currentIndex--;

        renderQuestion();

    }
);


/* =====================================================
   NEXT BUTTON
===================================================== */

nextBtn.addEventListener(
    "click",
    () => {

        const question =
            getCurrentQuestion();


        if (!question) {

            return;

        }


        const questionId =
            getQuestionId(question);


        /*
        Student must submit the current
        answer before moving forward.
        */

        if (
            !practiceState.submitted[
                questionId
            ]
        ) {

            alert(
                "Please submit your answer before continuing."
            );

            return;

        }


        if (
            practiceState.currentIndex <
            practiceState.questions.length - 1
        ) {

            practiceState.currentIndex++;

            renderQuestion();

        }

    }
);


/* =====================================================
   SUBMIT BUTTON
===================================================== */

submitBtn.addEventListener(
    "click",
    submitCurrentAnswer
);


/* =====================================================
   FINISH PRACTICE
===================================================== */

finishBtn.addEventListener(
    "click",
    finishPractice
);


async function finishPractice() {

    const total =
        practiceState.questions.length;


    if (!total) {

        return;

    }


    const allSubmitted =
        practiceState.questions.every(
            question =>
                practiceState.submitted[
                    getQuestionId(question)
                ] === true
        );


    if (!allSubmitted) {

        alert(
            "Please answer and submit all questions before finishing."
        );

        return;

    }


    /*
    IMPORTANT:

    We DO NOT send:
        score
        correct_answers
        wrong_answers
        student_id

    The Worker calculates those values.
    */

    const answers =
        practiceState.questions.map(
            question => ({

                question_id:
                    getQuestionId(
                        question
                    ),

                answer:
                    practiceState.answers[
                        getQuestionId(
                            question
                        )
                    ]

            })
        );


    finishBtn.disabled =
        true;


    finishBtn.textContent =
        "Saving Result...";


    try {

        const result =
            await apiRequest(
                "/practice",
                {
                    method: "POST",

                    body: JSON.stringify({

                        subject_id:
                            subjectId,

                        answers:
                            answers

                    })

                }
            );


        /*
        Use the authoritative score
        returned by the Worker.
        */

        showFinalResult(
            result.result
        );

    }

    catch (error) {

        console.error(
            "Practice result error:",
            error
        );


        finishBtn.disabled =
            false;


        finishBtn.textContent =
            "Finish Practice";


        alert(
            error.message ||
            "Your practice result could not be saved."
        );

    }

}


/* =====================================================
   FINAL RESULT
===================================================== */

function showFinalResult(result) {

    const total =
        result?.total_questions ??
        practiceState.questions.length;


    const correct =
        result?.correct_answers ??
        practiceState.correctAnswers;


    const wrong =
        result?.wrong_answers ??
        practiceState.wrongAnswers;


    const score =
        result?.score ?? 0;


    alert(
        `Practice Complete!\n\n` +
        `Score: ${score}%\n` +
        `Correct: ${correct}\n` +
        `Wrong: ${wrong}\n` +
        `Total: ${total}`
    );


    finishBtn.textContent =
        "Practice Completed";


    finishBtn.disabled =
        true;

}


/* =====================================================
   NO QUESTIONS
===================================================== */

function showNoQuestions() {

    questionNumber.textContent =
        "No Questions";


    questionText.textContent =
        "No practice questions are currently available for this subject.";


    optionsContainer.innerHTML =
        "";


    explanationBox.hidden =
        true;


    progressText.textContent =
        "0 of 0";


    progressFill.style.width =
        "0%";


    previousBtn.disabled =
        true;


    submitBtn.disabled =
        true;


    nextBtn.disabled =
        true;


    finishBtn.disabled =
        true;

}


/* =====================================================
   LOADING STATE
===================================================== */

function setLoadingState() {

    questionNumber.textContent =
        "Loading...";


    questionText.textContent =
        "Loading practice questions...";


    optionsContainer.innerHTML =
        "";


    explanationBox.hidden =
        true;


    previousBtn.disabled =
        true;


    submitBtn.disabled =
        true;


    nextBtn.disabled =
        true;


    finishBtn.disabled =
        true;

}


/* =====================================================
   FATAL ERROR
===================================================== */

function showFatalError(
    message
) {

    questionNumber.textContent =
        "Unable to Load";


    questionText.textContent =
        message;


    optionsContainer.innerHTML =
        "";


    explanationBox.hidden =
        true;


    previousBtn.disabled =
        true;


    submitBtn.disabled =
        true;


    nextBtn.disabled =
        true;


    finishBtn.disabled =
        true;

}


/* =====================================================
   ANSWER NORMALIZATION
===================================================== */

function normalizeAnswer(
    answer
) {

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