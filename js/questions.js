/*
=========================================================
    Nursephere Practice Questions Controller
    File: student/js/questions.js
=========================================================
*/

"use strict";

/*=========================================================
    Configuration
=========================================================*/

const PracticeAPI = {

    practice: "http://127.0.0.1:8787/api/practice",

    subjects: "http://127.0.0.1:8787/api/subjects"

};


/*=========================================================
    DOM Elements
=========================================================*/

const subjectName = document.getElementById("subjectName");

const questionProgress = document.getElementById("questionProgress");

const questionNumber = document.getElementById("questionNumber");

const questionText = document.getElementById("questionText");

const imageContainer = document.getElementById("imageContainer");

const questionImage = document.getElementById("questionImage");

const optionA = document.getElementById("optionA");

const optionB = document.getElementById("optionB");

const optionC = document.getElementById("optionC");

const optionD = document.getElementById("optionD");

const submitAnswerBtn = document.getElementById("submitAnswerBtn");

const explanationCard = document.getElementById("explanationCard");

const resultTitle = document.getElementById("resultTitle");

const correctAnswer = document.getElementById("correctAnswer");

const explanationText = document.getElementById("explanationText");

const previousBtn = document.getElementById("previousBtn");

const nextBtn = document.getElementById("nextBtn");

const finishBtn = document.getElementById("finishBtn");

const optionButtons = document.querySelectorAll(".option-btn");


/*=========================================================
    URL Parameters
=========================================================*/

const urlParams = new URLSearchParams(window.location.search);

const subjectId = urlParams.get("subject_id");

const studentId = localStorage.getItem("studentId");


/*=========================================================
    Practice Session
=========================================================*/

const practiceSession = {

    questions: [],

    currentQuestion: 0,

    selectedAnswer: null,

    correctAnswers: 0,

    wrongAnswers: 0,

    score: 0,

    answeredQuestions: []

};

/*=========================================================
    Helper Functions
=========================================================*/

function showError(message) {

    questionText.textContent = message;

    optionButtons.forEach(button => {

        button.disabled = true;

    });

    submitAnswerBtn.disabled = true;

    previousBtn.disabled = true;

    nextBtn.disabled = true;

    finishBtn.disabled = true;

}


function clearOptionStyles() {

    optionButtons.forEach(button => {

        button.classList.remove(

            "selected",

            "correct",

            "incorrect"

        );

        button.disabled = false;

    });

}


function hideExplanation() {

    explanationCard.style.display = "none";

}


function showExplanation(answer) {

    explanationCard.style.display = "block";

    correctAnswer.textContent = answer.correct_answer;

    explanationText.textContent = answer.explanation;

}


function getCurrentQuestion() {

    return practiceSession.questions[
        practiceSession.currentQuestion
    ];

}


function getCurrentAnswer() {

    return practiceSession.answeredQuestions[
        practiceSession.currentQuestion
    ];

}


function updateProgress() {

    const current = practiceSession.currentQuestion + 1;

    const total = practiceSession.questions.length;

    questionProgress.textContent = `Question ${current} of ${total}`;

    questionNumber.textContent = `Question ${current}`;

}


function updateNavigationButtons() {

    previousBtn.disabled =
        practiceSession.currentQuestion === 0;

    nextBtn.disabled = !getCurrentAnswer();

}


function setSelectedButton(answerLetter) {

    clearOptionStyles();

    optionButtons.forEach(button => {

        if (button.dataset.option === answerLetter) {

            button.classList.add("selected");

        }

    });

}


function lockOptions() {

    optionButtons.forEach(button => {

        button.disabled = true;

    });

}


function unlockOptions() {

    optionButtons.forEach(button => {

        button.disabled = false;

    });

}


function getOptionButton(letter) {

    return document.querySelector(

        `.option-btn[data-option="${letter}"]`

    );

}


function calculateScore() {

    const total = practiceSession.questions.length;

    if (total === 0) {

        practiceSession.score = 0;

        return;

    }

    practiceSession.score = Math.round(

        (practiceSession.correctAnswers / total) * 100

    );

}

/*=========================================================
    Load Subject Information
=========================================================*/

async function loadSubject() {

    try {

        const response = await fetch(

            `${PracticeAPI.subjects}?subject_id=${subjectId}`

        );

        const result = await response.json();

        if (!result.success) {

            throw new Error(result.message);

        }

        subjectName.textContent = result.subject.name;

    }

    catch (error) {

        console.error(error);

        showError("Failed to load subject.");

    }

}


/*=========================================================
    Load Practice Questions
=========================================================*/

async function loadQuestions() {

    try {

        const response = await fetch(

            `${PracticeAPI.practice}?subject_id=${subjectId}`

        );

        const result = await response.json();

        if (!result.success) {

            throw new Error(result.message);

        }

        practiceSession.questions = result.questions;

        if (practiceSession.questions.length === 0) {

            showError("No practice questions found.");

            return;

        }

        practiceSession.answeredQuestions =

            new Array(

                practiceSession.questions.length

            ).fill(null);

        renderQuestion();

    }

    catch (error) {

        console.error(error);

        showError("Unable to load practice questions.");

    }

}


/*=========================================================
    Render Question
=========================================================*/

function renderQuestion() {

    const question = getCurrentQuestion();

    updateProgress();

    clearOptionStyles();

    hideExplanation();

    practiceSession.selectedAnswer = null;

    submitAnswerBtn.disabled = true;

    questionText.textContent = question.question;

    optionA.textContent = question.option_a;

    optionB.textContent = question.option_b;

    optionC.textContent = question.option_c;

    optionD.textContent = question.option_d;

    if (

        question.image_url &&

        question.image_url.trim() !== ""

    ) {

        imageContainer.style.display = "block";

        questionImage.src = question.image_url;

        questionImage.alt = "Practice Question";

    }

    else {

        imageContainer.style.display = "none";

        questionImage.src = "";

    }

    restorePreviousAnswer();

    updateNavigationButtons();

}

/*=========================================================
    Restore Previous Answer
=========================================================*/

function restorePreviousAnswer() {

    const savedAnswer = getCurrentAnswer();

    if (!savedAnswer) {

        unlockOptions();

        submitAnswerBtn.disabled = true;

        nextBtn.disabled = true;

        return;

    }

    practiceSession.selectedAnswer =

        savedAnswer.selectedAnswer;

    setSelectedButton(

        savedAnswer.selectedAnswer

    );

    if (!savedAnswer.submitted) {

        submitAnswerBtn.disabled = false;

        return;

    }

    lockOptions();

    showExplanation(getCurrentQuestion());

    submitAnswerBtn.disabled = true;

    nextBtn.disabled = false;

    const selectedButton = getOptionButton(

        savedAnswer.selectedAnswer

    );

    const correctButton = getOptionButton(

        getCurrentQuestion().correct_answer

    );

    selectedButton.classList.remove("selected");

    if (savedAnswer.isCorrect) {

        selectedButton.classList.add("correct");

        resultTitle.textContent = "✔ Correct!";

    }

    else {

        selectedButton.classList.add("incorrect");

        correctButton.classList.add("correct");

        resultTitle.textContent = "✖ Incorrect";

    }

}


/*=========================================================
    Option Selection
=========================================================*/

optionButtons.forEach(button => {

    button.addEventListener("click", () => {

        clearOptionStyles();

        button.classList.add("selected");

        practiceSession.selectedAnswer =

            button.dataset.option;

        submitAnswerBtn.disabled = false;

    });

});


/*=========================================================
    Submit Answer
=========================================================*/

submitAnswerBtn.addEventListener("click", () => {

    const question = getCurrentQuestion();

    const selected =

        practiceSession.selectedAnswer;

    if (!selected) {

        return;

    }

    lockOptions();

    submitAnswerBtn.disabled = true;

    const selectedButton =

        getOptionButton(selected);

    const correctButton =

        getOptionButton(question.correct_answer);

    selectedButton.classList.remove("selected");

    const isCorrect =

        selected === question.correct_answer;

    if (isCorrect) {

        selectedButton.classList.add("correct");

        resultTitle.textContent = "✔ Correct!";

        practiceSession.correctAnswers++;

    }

    else {

        selectedButton.classList.add("incorrect");

        correctButton.classList.add("correct");

        resultTitle.textContent = "✖ Incorrect";

        practiceSession.wrongAnswers++;

    }

    showExplanation(question);

    practiceSession.answeredQuestions[

        practiceSession.currentQuestion

    ] = {

        selectedAnswer: selected,

        submitted: true,

        isCorrect: isCorrect

    };

    calculateScore();

    nextBtn.disabled = false;

});

/*=========================================================
    Previous Question
=========================================================*/

previousBtn.addEventListener("click", () => {

    if (practiceSession.currentQuestion === 0) {

        return;

    }

    practiceSession.currentQuestion--;

    renderQuestion();

});


/*=========================================================
    Next Question
=========================================================*/

nextBtn.addEventListener("click", () => {

    if (

        practiceSession.currentQuestion >=

        practiceSession.questions.length - 1

    ) {

        return;

    }

    practiceSession.currentQuestion++;

    renderQuestion();

});


/*=========================================================
    Finish Practice
=========================================================*/

finishBtn.addEventListener("click", async () => {

    const unanswered =

        practiceSession.answeredQuestions.filter(

            answer => answer === null

        );

    if (unanswered.length > 0) {

        alert(

            "Please answer all questions before finishing."

        );

        return;

    }

    finishBtn.disabled = true;

    try {

        await saveResults();

        alert(

            `Practice Complete!\n\n` +

            `Correct: ${practiceSession.correctAnswers}\n` +

            `Wrong: ${practiceSession.wrongAnswers}\n` +

            `Score: ${practiceSession.score}%`

        );

        window.location.href =

            "subject.html?subject_id=" + subjectId;

    }

    catch (error) {

        console.error(error);

        alert(

            "Failed to save your practice results."

        );

        finishBtn.disabled = false;

    }

});


/*=========================================================
    Save Practice Results
=========================================================*/

async function saveResults() {

    const response = await fetch(

        PracticeAPI.practice,

        {

            method: "POST",

            headers: {

                "Content-Type": "application/json"

            },

            body: JSON.stringify({

                student_id: studentId,

                subject_id: subjectId,

                total_questions:

                    practiceSession.questions.length,

                correct_answers:

                    practiceSession.correctAnswers,

                wrong_answers:

                    practiceSession.wrongAnswers,

                score:

                    practiceSession.score

            })

        }

    );

    const result = await response.json();

    if (!result.success) {

        throw new Error(result.message);

    }

}


/*=========================================================
    Initialise Practice Page
=========================================================*/

document.addEventListener(

    "DOMContentLoaded",

    async () => {

        if (!studentId) {

            window.location.href =

                "../login.html";

            return;

        }

        if (!subjectId) {

            showError(

                "Subject ID is missing."

            );

            return;

        }

        await loadSubject();

        await loadQuestions();

    }

);