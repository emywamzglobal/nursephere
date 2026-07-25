/*
========================================================
    NurseSphere Student Practice Controller
    File: js/practice.js
========================================================
*/

"use strict";

/*========================================================
    API ENDPOINTS
========================================================*/

const PracticeAPI = {

    exams: "http://127.0.0.1:8787/api/exams",

    subjects: "http://127.0.0.1:8787/api/subjects"

};

/*========================================================
    DOM ELEMENTS
========================================================*/

const examContainer =
    document.getElementById("examContainer");

const subjectContainer =
    document.getElementById("subjectContainer");

const selectedExamText =
    document.getElementById("selectedExamText");

/*========================================================
    STATE
========================================================*/

let selectedExamId = null;

/*========================================================
    INITIALIZE
========================================================*/

document.addEventListener(

    "DOMContentLoaded",

    () => {

        loadExams();

    }

);

/*========================================================
    LOAD EXAMS
========================================================*/

async function loadExams() {

    examContainer.innerHTML = `

        <div class="empty-state">

            <p>Loading examinations...</p>

        </div>

    `;

    try {

        const response =
            await fetch(PracticeAPI.exams);

        const result =
            await response.json();

        if (!result.success) {

            throw new Error(
                result.message
            );

        }

        renderExams(result.exams);

    }

    catch (error) {

        console.error(
            "Load Exams:",
            error
        );

        examContainer.innerHTML = `

            <div class="empty-state">

                <h3>

                    Unable to load examinations.

                </h3>

                <p>

                    Please try again later.

                </p>

            </div>

        `;

    }

}

/*========================================================
    RENDER EXAMS
========================================================*/

function renderExams(exams) {

    examContainer.innerHTML = "";

    if (!exams.length) {

        examContainer.innerHTML = `

            <div class="empty-state">

                <i class="fas fa-file-circle-xmark"></i>

                <h3>

                    No examinations available.

                </h3>

                <p>

                    The administrator has not added any examinations yet.

                </p>

            </div>

        `;

        return;

    }

    exams.forEach(exam => {

        const button = document.createElement("button");

        button.className = "exam-card";

        button.innerHTML = `

            <i class="fas fa-file-medical"></i>

            <span>

                ${exam.name}

            </span>

        `;

        button.addEventListener(

            "click",

            () => {

                document

                    .querySelectorAll(".exam-card")

                    .forEach(card => {

                        card.classList.remove("active");

                    });

                button.classList.add("active");

                selectedExamId = exam.id;

                selectedExamText.textContent =

                    `Subjects for ${exam.name}`;

                loadSubjects(exam.id);

            }

        );

        examContainer.appendChild(button);

    });

}

/*========================================================
    LOAD SUBJECTS
========================================================*/

async function loadSubjects(examId) {

    subjectContainer.innerHTML = `

        <div class="empty-state">

            <p>Loading subjects...</p>

        </div>

    `;

    try {

        const response = await fetch(

            `${PracticeAPI.subjects}?exam_id=${examId}`

        );

        const result = await response.json();

        if (!result.success) {

            throw new Error(

                result.message

            );

        }

        renderSubjects(result.subjects);

    }

    catch (error) {

        console.error(

            "Load Subjects:",

            error

        );

        subjectContainer.innerHTML = `

            <div class="empty-state">

                <i class="fas fa-circle-exclamation"></i>

                <h3>

                    Unable to load subjects.

                </h3>

                <p>

                    Please try again later.

                </p>

            </div>

        `;

    }

}

/*========================================================
    RENDER SUBJECTS
========================================================*/

function renderSubjects(subjects) {

    subjectContainer.innerHTML = "";

    if (!subjects.length) {

        subjectContainer.innerHTML = `

            <div class="empty-state">

                <i class="fas fa-book-medical"></i>

                <h3>

                    No subjects available.

                </h3>

                <p>

                    This examination does not have any subjects yet.

                </p>

            </div>

        `;

        return;

    }

    subjects.forEach(subject => {

        const card = document.createElement("div");

        card.className = "subject-card";

        card.innerHTML = `

            <div class="subject-info">

                <h3>

                    ${subject.name}

                </h3>

                <p>

                    ${subject.description || "Begin practicing questions or open study resources."}

                </p>

            </div>

            <div class="subject-actions">

                <button
                    class="practice-btn"
                    data-id="${subject.id}">

                    <i class="fas fa-clipboard-question"></i>

                    Start Practice

                </button>

                <button
                    class="resource-btn"
                    data-id="${subject.id}">

                    <i class="fas fa-book-open"></i>

                    Study Resources

                </button>

            </div>

        `;

        card

            .querySelector(".practice-btn")

            .addEventListener(

                "click",

                () => {

                    window.location.href =

                        `questions.html?subject_id=${subject.id}`;

                }

            );

        card

            .querySelector(".resource-btn")

            .addEventListener(

                "click",

                () => {

                    window.location.href =

                        `resources.html?subject_id=${subject.id}`;

                }

            );

        subjectContainer.appendChild(card);

    });

}


