/*
========================================================
    Nursephere Student Practice Controller
    File: js/practice.js
========================================================
*/

"use strict";

/*========================================================
    API
========================================================*/

const PracticeAPI = {

    exams: "http://127.0.0.1:8787/api/exams",

    subjects: "http://127.0.0.1:8787/api/subjects"

};

/*========================================================
    DOM ELEMENTS
========================================================*/

const examContainer = document.getElementById("examContainer");

const subjectContainer = document.getElementById("subjectContainer");

const selectedExamText = document.getElementById("selectedExamText");

/*========================================================
    STATE
========================================================*/

let selectedExamId = null;

/*========================================================
    INITIALIZE
========================================================*/

document.addEventListener("DOMContentLoaded", () => {

    loadExams();

});

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

        const response = await fetch(PracticeAPI.exams);

        const data = await response.json();

        if (!data.success) {

            throw new Error(data.message);

        }

        renderExams(data.exams);

    }

    catch (error) {

        console.error("Load Exams Error:", error);

        examContainer.innerHTML = `

            <div class="empty-state">

                <h3>Unable to load examinations.</h3>

                <p>Please try again later.</p>

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

                <h3>No subjects available.</h3>

                <p>

                    No subjects have been added to this examination.

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

                <h3>${subject.name}</h3>

                <p>${subject.description || "Start practicing and access study resources for this subject."}</p>

            </div>

            <div class="subject-actions">

                <button class="practice-btn">

                    <i class="fas fa-clipboard-question"></i>

                    Start Practice

                </button>

                <button class="resource-btn">

                    <i class="fas fa-book-open"></i>

                    Study Resources

                </button>

            </div>

        `;

        const practiceBtn = card.querySelector(".practice-btn");

        const resourceBtn = card.querySelector(".resource-btn");

        practiceBtn.addEventListener("click", () => {

            window.location.href =
                `questions.html?subject_id=${subject.id}`;

        });

        resourceBtn.addEventListener("click", () => {

            window.location.href =
                `resources.html?subject_id=${subject.id}`;

        });

        subjectContainer.appendChild(card);

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

        const data = await response.json();

        if (!data.success) {

            throw new Error(data.message);

        }

        renderSubjects(data.subjects);

    }

    catch (error) {

        console.error("Load Subjects Error:", error);

        subjectContainer.innerHTML = `

            <div class="empty-state">

                <h3>Unable to load subjects.</h3>

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

                <h3>No subjects available.</h3>

                <p>

                    No subjects have been added to this examination.

                </p>

            </div>

        `;

        return;

    }

    subjects.forEach(subject => {

        const card = document.createElement("div");

        card.className = "subject-card";

        card.innerHTML = `

            <h3>${subject_name}</h3>

            <p>${subject.description || ""}</p>

        `;

        card.addEventListener("click", () => {

            window.location.href =
                `subject.html?exam_id=${selectedExamId}&subject_id=${subject.id}`;

        });

        subjectContainer.appendChild(card);

    });

}