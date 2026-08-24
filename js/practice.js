/*
========================================================
    NurseSphere Student Practice Controller
    File: js/practice.js
========================================================
*/

"use strict";


/* ======================================================
   API
====================================================== */

const PRACTICE_API_BASE =
    "https://nursephere.wamalwaemily.workers.dev/api";


/* ======================================================
   STATE
====================================================== */

const practiceState = {

    exams: [],

    subjects: [],

    selectedExamId: null,

    selectedExam: null

};


/* ======================================================
   DOM
====================================================== */

const examContainer =
    document.getElementById("examContainer");

const subjectContainer =
    document.getElementById("subjectContainer");

const selectedExamText =
    document.getElementById("selectedExamText");

const examCount =
    document.getElementById("examCount");

const subjectCount =
    document.getElementById("subjectCount");

const practiceMessage =
    document.getElementById("practiceMessage");


/* ======================================================
   INITIALIZE
====================================================== */

document.addEventListener(
    "DOMContentLoaded",
    initializePractice
);


async function initializePractice() {

    const token =
        localStorage.getItem("studentToken");

    if (!token) {

        window.location.replace("../login.html");

        return;

    }

    await loadExams();

}


/* ======================================================
   API REQUEST
====================================================== */

async function apiRequest(endpoint) {

    const token =
        localStorage.getItem("studentToken");

    if (!token) {

        window.location.replace("../login.html");

        throw new Error(
            "Your session has expired."
        );

    }

    let response;

    try {

        response = await fetch(
            `${PRACTICE_API_BASE}${endpoint}`,
            {
                method: "GET",

                headers: {
                    "Authorization":
                        `Bearer ${token}`,

                    "Accept":
                        "application/json"
                },

                cache: "no-store"
            }
        );

    }

    catch (error) {

        console.error(
            "NurseSphere API connection error:",
            error
        );

        throw new Error(
            "Unable to connect to NurseSphere."
        );

    }


    /* -----------------------------------------------
       Session expired
    ------------------------------------------------ */

    if (response.status === 401) {

        localStorage.removeItem(
            "studentToken"
        );

        localStorage.removeItem(
            "student"
        );

        window.location.replace(
            "../login.html"
        );

        throw new Error(
            "Your session has expired."
        );

    }


    let result;

    try {

        result =
            await response.json();

    }

    catch {

        throw new Error(
            "The server returned an invalid response."
        );

    }


    if (
        !response.ok ||
        result?.success === false
    ) {

        throw new Error(
            result?.message ||
            "Unable to load practice content."
        );

    }


    return result;

}


/* ======================================================
   LOAD EXAMINATIONS
====================================================== */

async function loadExams() {

    showExamLoading();

    clearMessage();

    try {

        const result =
            await apiRequest("/exams");


        practiceState.exams =
            Array.isArray(result.exams)
                ? result.exams
                : [];


        updateExamCount();


        renderExams();


        /*
        IMPORTANT:
        Do NOT automatically select the first exam.

        The student must explicitly choose
        an examination.
        */

        clearSubjects();

    }

    catch (error) {

        console.error(
            "NurseSphere Practice - Exams:",
            error
        );


        showExamError(
            error.message
        );


        clearSubjects();


        showMessage(
            "We could not load the examinations. Please try again.",
            "error"
        );

    }

}


/* ======================================================
   RENDER EXAMS
====================================================== */

function renderExams() {

    examContainer.innerHTML = "";


    if (!practiceState.exams.length) {

        renderEmpty(
            examContainer,
            "No Examinations Available",
            "The administrator has not published any active examinations yet.",
            "fa-file-circle-xmark"
        );

        return;

    }


    const fragment =
        document.createDocumentFragment();


    practiceState.exams.forEach(
        exam => {

            const examId =
                getId(exam);


            const button =
                document.createElement("button");


            button.type =
                "button";


            button.className =
                "exam-card";


            if (
                String(examId) ===
                String(
                    practiceState.selectedExamId
                )
            ) {

                button.classList.add(
                    "active"
                );

            }


            /*
            ------------------------------------------
            Exam icon / image
            ------------------------------------------
            */

            const imageUrl =
                getImageUrl(exam);


            if (imageUrl) {

                const image =
                    document.createElement("img");

                image.className =
                    "exam-card-image";

                image.src =
                    imageUrl;

                image.alt = "";

                image.loading =
                    "lazy";

                button.appendChild(
                    image
                );

            }

            else {

                const icon =
                    document.createElement("span");

                icon.className =
                    "exam-card-icon";

                icon.innerHTML =
                    '<i class="fas fa-file-medical"></i>';

                button.appendChild(
                    icon
                );

            }


            /*
            ------------------------------------------
            Exam information
            ------------------------------------------
            */

            const content =
                document.createElement("span");


            content.className =
                "exam-card-content";


            const name =
                document.createElement("strong");


            name.textContent =
                getName(exam);


            content.appendChild(
                name
            );


            if (exam.description) {

                const description =
                    document.createElement("small");


                description.textContent =
                    exam.description;


                content.appendChild(
                    description
                );

            }


            button.appendChild(
                content
            );


            /*
            ------------------------------------------
            Arrow
            ------------------------------------------
            */

            const arrow =
                document.createElement("span");


            arrow.className =
                "exam-card-arrow";


            arrow.innerHTML =
                '<i class="fas fa-chevron-right"></i>';


            button.appendChild(
                arrow
            );


            /*
            ------------------------------------------
            Selection
            ------------------------------------------
            */

            button.addEventListener(
                "click",
                () => {

                    selectExam(
                        exam
                    );

                }
            );


            fragment.appendChild(
                button
            );

        }
    );


    examContainer.appendChild(
        fragment
    );

}


/* ======================================================
   SELECT EXAM
====================================================== */

async function selectExam(exam) {

    const examId =
        getId(exam);


    if (!examId) {

        showMessage(
            "This examination has an invalid ID.",
            "error"
        );

        return;

    }


    practiceState.selectedExamId =
        String(examId);


    practiceState.selectedExam =
        exam;


    selectedExamText.textContent =
        `Subjects for ${getName(exam)}`;


    renderExams();


    await loadSubjects(
        examId
    );

}


/* ======================================================
   LOAD SUBJECTS FOR SELECTED EXAM
====================================================== */

async function loadSubjects(examId) {

    showSubjectLoading();

    clearMessage();


    try {

        const result =
            await apiRequest(
                `/subjects?exam_id=${encodeURIComponent(examId)}`
            );


        /*
        Only subjects returned for this
        examination are stored.
        */

        practiceState.subjects =
            Array.isArray(result.subjects)
                ? result.subjects
                : [];


        updateSubjectCount();


        renderSubjects();

    }

    catch (error) {

        console.error(
            "NurseSphere Practice - Subjects:",
            error
        );


        practiceState.subjects =
            [];


        updateSubjectCount();


        renderEmpty(
            subjectContainer,
            "Unable to Load Subjects",
            error.message ||
                "Please try again later.",
            "fa-circle-exclamation"
        );


        showMessage(
            "The selected examination's subjects could not be loaded.",
            "error"
        );

    }

}


/* ======================================================
   RENDER SUBJECTS
====================================================== */

function renderSubjects() {

    subjectContainer.innerHTML = "";


    if (!practiceState.subjects.length) {

        renderEmpty(
            subjectContainer,
            "No Subjects Available",
            "The administrator has not published any active subjects for this examination yet.",
            "fa-book-medical"
        );

        return;

    }


    const fragment =
        document.createDocumentFragment();


    practiceState.subjects.forEach(
        subject => {

            const subjectId =
                getId(subject);


            if (!subjectId) {

                return;

            }


            const card =
                document.createElement("article");


            card.className =
                "subject-card";


            /*
            ------------------------------------------
            Subject image
            ------------------------------------------
            */

            const visual =
                document.createElement("div");


            visual.className =
                "subject-visual";


            const imageUrl =
                getImageUrl(subject);


            if (imageUrl) {

                const image =
                    document.createElement("img");


                image.src =
                    imageUrl;


                image.alt =
                    getName(subject);


                image.loading =
                    "lazy";


                visual.appendChild(
                    image
                );

            }

            else {

                visual.innerHTML =
                    '<i class="fas fa-book-open"></i>';

            }


            /*
            ------------------------------------------
            Subject information
            ------------------------------------------
            */

            const info =
                document.createElement("div");


            info.className =
                "subject-info";


            const title =
                document.createElement("h3");


            title.textContent =
                getName(subject);


            const description =
                document.createElement("p");


            description.textContent =
                subject.description ||
                "Begin practicing questions or open the study resources for this subject.";


            info.append(
                title,
                description
            );


            /*
            ------------------------------------------
            Actions
            ------------------------------------------
            */

            const actions =
                document.createElement("div");


            actions.className =
                "subject-actions";


            /*
            PRACTICE QUESTIONS
            */

            const practiceButton =
                document.createElement("button");


            practiceButton.type =
                "button";


            practiceButton.className =
                "practice-btn";


            practiceButton.innerHTML =
                '<i class="fas fa-clipboard-question"></i>' +
                '<span>Start Practice</span>';


            practiceButton.addEventListener(
                "click",
                () => {

                    window.location.href =
                        `questions.html?subject_id=${encodeURIComponent(subjectId)}`;

                }
            );


            /*
            STUDY RESOURCES
            */

            const resourceButton =
                document.createElement("button");


            resourceButton.type =
                "button";


            resourceButton.className =
                "resource-btn";


            resourceButton.innerHTML =
                '<i class="fas fa-book-open"></i>' +
                '<span>Study Resources</span>';


            resourceButton.addEventListener(
                "click",
                () => {

                    window.location.href =
                        `resources.html?subject_id=${encodeURIComponent(subjectId)}`;

                }
            );


            actions.append(
                practiceButton,
                resourceButton
            );


            card.append(
                visual,
                info,
                actions
            );


            fragment.appendChild(
                card
            );

        }
    );


    subjectContainer.appendChild(
        fragment
    );

}


/* ======================================================
   CLEAR SUBJECTS
====================================================== */

function clearSubjects() {

    practiceState.subjects =
        [];

    practiceState.selectedExam =
        null;

    practiceState.selectedExamId =
        null;


    updateSubjectCount();


    selectedExamText.textContent =
        "Select an examination above to display its subjects.";


    renderEmpty(
        subjectContainer,
        "No Examination Selected",
        "Your administrator-managed subjects will appear here after you select an examination.",
        "fa-book-medical"
    );

}


/* ======================================================
   COUNTS
====================================================== */

function updateExamCount() {

    const count =
        practiceState.exams.length;


    examCount.textContent =
        `${count} ${count === 1 ? "exam" : "exams"}`;

}


function updateSubjectCount() {

    const count =
        practiceState.subjects.length;


    subjectCount.textContent =
        `${count} ${count === 1 ? "subject" : "subjects"}`;

}


/* ======================================================
   LOADING STATES
====================================================== */

function showExamLoading() {

    examContainer.innerHTML = `
        <div class="practice-loading">
            <i class="fas fa-spinner fa-spin"></i>
            <span>Loading examinations...</span>
        </div>
    `;

}


function showSubjectLoading() {

    subjectContainer.innerHTML = `
        <div class="practice-loading">
            <i class="fas fa-spinner fa-spin"></i>
            <span>Loading subjects...</span>
        </div>
    `;

}


/* ======================================================
   ERROR STATE
====================================================== */

function showExamError(message) {

    renderEmpty(
        examContainer,
        "Unable to Load Examinations",
        message ||
            "Please try again later.",
        "fa-cloud-arrow-down"
    );

}


/* ======================================================
   GENERIC EMPTY STATE
====================================================== */

function renderEmpty(
    container,
    titleText,
    descriptionText,
    iconClass
) {

    container.innerHTML = "";


    const empty =
        document.createElement("div");


    empty.className =
        "practice-empty";


    const icon =
        document.createElement("div");


    icon.className =
        "empty-icon";


    icon.innerHTML =
        `<i class="fas ${iconClass}"></i>`;


    const title =
        document.createElement("h3");


    title.textContent =
        titleText;


    const text =
        document.createElement("p");


    text.textContent =
        descriptionText;


    empty.append(
        icon,
        title,
        text
    );


    container.appendChild(
        empty
    );

}


/* ======================================================
   MESSAGE
====================================================== */

function showMessage(
    message,
    type = "error"
) {

    if (!practiceMessage) {
        return;
    }


    practiceMessage.hidden =
        false;


    practiceMessage.className =
        `practice-message ${type}`;


    practiceMessage.textContent =
        message;

}


function clearMessage() {

    if (!practiceMessage) {
        return;
    }


    practiceMessage.hidden =
        true;


    practiceMessage.textContent =
        "";

}


/* ======================================================
   HELPERS
====================================================== */

function getId(item) {

    return item?.id || "";

}


function getName(item) {

    return String(
        item?.name ||
        "Untitled"
    );

}


function getImageUrl(item) {

    const image =
        item?.image_url || "";


    return typeof image === "string" &&
        image.trim()
        ? image.trim()
        : "";

}