/*
========================================================
    NurseSphere Student Practice Controller
    File: js/exams.js
========================================================*/

"use strict";

/*========================================================
    API
========================================================*/

const API = {

    exams: "/api/exams",

    subjects: "/api/subjects"

};

/*========================================================
    DOM
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
    LOAD EXAMINATIONS
========================================================*/

async function loadExams() {

    examContainer.innerHTML = `
        <div class="empty-state">
            <p>Loading examinations...</p>
        </div>
    `;

    try {

        const response = await fetch(API.exams);

        const data = await response.json();

        if (!response.ok || !data.success) {

            throw new Error(data.message);

        }

        renderExams(data.exams);

    }

    catch (error) {

        console.error(error);

        examContainer.innerHTML = `
            <div class="empty-state">
                <h3>Unable to load examinations.</h3>
            </div>
        `;

    }

}

/*========================================================
    RENDER EXAMINATIONS
========================================================*/

function renderExams(exams) {

    examContainer.innerHTML = "";

    if (!exams.length) {

        examContainer.innerHTML = `
            <div class="empty-state">
                <h3>No examinations available.</h3>
            </div>
        `;

        return;

    }

    exams.forEach(exam => {

        const card = document.createElement("div");

        card.className = "exam-card";

        card.innerHTML = `

            <img
                src="${exam.image_url || 'assets/images/exam-placeholder.jpg'}"
                alt="${exam.name}"
            >

            <div class="exam-info">

                <h3>${exam.name}</h3>

                <p>${exam.description || ""}</p>

            </div>

        `;

        card.addEventListener("click", () => {

            document
                .querySelectorAll(".exam-card")
                .forEach(item => item.classList.remove("active"));

            card.classList.add("active");

            selectedExamId = exam.id;

            selectedExamText.textContent = exam.name;

            loadSubjects(exam.id);

        });

        examContainer.appendChild(card);

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

            `${API.subjects}?exam_id=${examId}`

        );

        const data = await response.json();

        if (!response.ok || !data.success) {

            throw new Error(data.message);

        }

        renderSubjects(data.subjects);

    }

    catch (error) {

        console.error(error);

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
                <h3>No subjects available.</h3>
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

                <p>${subject.description || ""}</p>

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

        card.querySelector(".practice-btn")
            .addEventListener("click", (e) => {

                e.stopPropagation();

                window.location.href =
                    `questions.html?subject_id=${subject.id}`;

            });

        card.querySelector(".resource-btn")
            .addEventListener("click", (e) => {

                e.stopPropagation();

                window.location.href =
                    `resources.html?subject_id=${subject.id}`;

            });

        subjectContainer.appendChild(card);

    });

}