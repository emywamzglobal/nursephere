/*
========================================================
    Nursephere Student Practice Controller
    Production version
    File: js/practice.js
========================================================
*/

"use strict";

const PRACTICE_API_BASE =
    "https://nursephere.wamalwaemily.workers.dev/api";

const practiceState = {
    exams: [],
    subjects: [],
    selectedExamId: null,
    selectedExam: null,
    searchTerm: ""
};

const examContainer = document.getElementById("examContainer");
const subjectContainer = document.getElementById("subjectContainer");
const selectedExamText = document.getElementById("selectedExamText");
const examCount = document.getElementById("examCount");
const subjectCount = document.getElementById("subjectCount");
const searchInput = document.getElementById("searchInput");
const practiceMessage = document.getElementById("practiceMessage");

document.addEventListener("DOMContentLoaded", initializePractice);

async function initializePractice() {
    const token = localStorage.getItem("studentToken");

    if (!token) {
        window.location.replace("../login.html");
        return;
    }

    const requestedExamId =
        new URLSearchParams(window.location.search).get("exam_id");

    if (searchInput) {
        searchInput.addEventListener("input", () => {
            practiceState.searchTerm =
                searchInput.value.trim().toLowerCase();

            renderExams();
            renderSubjects();
        });
    }

    await loadExams(requestedExamId);
}

async function apiRequest(path) {
    const token = localStorage.getItem("studentToken");

    if (!token) {
        window.location.replace("../login.html");
        throw new Error("Your session has expired.");
    }

    let response;

    try {
        response = await fetch(
            `${PRACTICE_API_BASE}${path}`,
            {
                method: "GET",
                headers: {
                    "Authorization": `Bearer ${token}`,
                    "Accept": "application/json"
                },
                cache: "no-store"
            }
        );
    } catch (error) {
        throw new Error("Unable to connect to Nursephere.");
    }

    if (response.status === 401) {
        localStorage.removeItem("studentToken");
        localStorage.removeItem("student");
        window.location.replace("../login.html");
        throw new Error("Your session has expired.");
    }

    let result;

    try {
        result = await response.json();
    } catch {
        throw new Error("The server returned an invalid response.");
    }

    if (!response.ok || result?.success === false) {
        throw new Error(
            result?.message || "Unable to load practice content."
        );
    }

    return result;
}

async function loadExams(requestedExamId = null) {
    showExamLoading();
    clearMessage();

    try {
        const result = await apiRequest("/exams");

        practiceState.exams = normalizeArray(
            result.exams ?? result.data ?? result.results
        );

        examCount.textContent =
            `${practiceState.exams.length} ${practiceState.exams.length === 1 ? "exam" : "exams"}`;

        renderExams();

        if (!practiceState.exams.length) {
            clearSubjects();
            return;
        }

        const matchingExam =
            requestedExamId
                ? practiceState.exams.find(
                    exam => String(getId(exam)) === String(requestedExamId)
                )
                : null;

        const examToSelect =
            matchingExam || practiceState.exams[0];

        selectExam(examToSelect, false);

    } catch (error) {
        console.error("Nursephere Practice - Exams:", error);
        showExamError(error.message);
        clearSubjects();
        showMessage(
            "We could not load the examinations. Please try again.",
            "error"
        );
    }
}

async function selectExam(exam, updateUrl = true) {
    const examId = getId(exam);

    if (!examId) return;

    practiceState.selectedExamId = String(examId);
    practiceState.selectedExam = exam;

    if (updateUrl) {
        const url = new URL(window.location.href);
        url.searchParams.set("exam_id", String(examId));
        window.history.replaceState({}, "", url);
    }

    selectedExamText.textContent =
        `Subjects for ${getName(exam)}`;

    renderExams();
    await loadSubjects(examId);
}

async function loadSubjects(examId) {
    showSubjectLoading();
    clearMessage();

    try {
        const result =
            await apiRequest(`/subjects?exam_id=${encodeURIComponent(examId)}`);

        practiceState.subjects = normalizeArray(
            result.subjects ?? result.data ?? result.results
        );

        subjectCount.textContent =
            `${practiceState.subjects.length} ${practiceState.subjects.length === 1 ? "subject" : "subjects"}`;

        renderSubjects();

    } catch (error) {
        console.error("Nursephere Practice - Subjects:", error);

        practiceState.subjects = [];
        subjectCount.textContent = "0 subjects";

        subjectContainer.innerHTML = "";

        const empty = document.createElement("div");
        empty.className = "practice-empty";

        const icon = document.createElement("div");
        icon.className = "empty-icon";
        icon.innerHTML = '<i class="fas fa-circle-exclamation"></i>';

        const title = document.createElement("h3");
        title.textContent = "Unable to load subjects";

        const text = document.createElement("p");
        text.textContent = error.message ||
            "Please try again later.";

        const retry = document.createElement("button");
        retry.type = "button";
        retry.className = "practice-retry";
        retry.textContent = "Try Again";
        retry.addEventListener(
            "click",
            () => loadSubjects(examId)
        );

        empty.append(icon, title, text, retry);
        subjectContainer.appendChild(empty);

        showMessage(
            "The selected examination could not load its subjects.",
            "error"
        );
    }
}

function renderExams() {
    examContainer.innerHTML = "";

    const filtered = practiceState.exams.filter(exam => {
        if (!practiceState.searchTerm) return true;

        const haystack = [
            getName(exam),
            exam.description || ""
        ]
            .join(" ")
            .toLowerCase();

        return haystack.includes(practiceState.searchTerm);
    });

    if (!filtered.length) {
        renderNoSearchResults(
            examContainer,
            "No examinations match your search.",
            "Try another examination name."
        );
        return;
    }

    const fragment = document.createDocumentFragment();

    filtered.forEach(exam => {
        const id = getId(exam);
        const card = document.createElement("button");

        card.type = "button";
        card.className = "exam-card";

        if (
            practiceState.selectedExamId &&
            String(id) === String(practiceState.selectedExamId)
        ) {
            card.classList.add("active");
            card.setAttribute("aria-pressed", "true");
        } else {
            card.setAttribute("aria-pressed", "false");
        }

        const imageUrl = getImageUrl(exam);

        if (imageUrl) {
            const image = document.createElement("img");
            image.src = imageUrl;
            image.alt = "";
            image.loading = "lazy";
            image.className = "exam-card-image";
            card.appendChild(image);
        } else {
            const icon = document.createElement("span");
            icon.className = "exam-card-icon";
            icon.innerHTML = '<i class="fas fa-file-medical"></i>';
            card.appendChild(icon);
        }

        const content = document.createElement("span");
        content.className = "exam-card-content";

        const title = document.createElement("strong");
        title.textContent = getName(exam);

        const description = document.createElement("small");
        description.textContent =
            exam.description ||
            "View available subjects";

        content.append(title, description);
        card.appendChild(content);

        const arrow = document.createElement("i");
        arrow.className = "fas fa-chevron-right exam-card-arrow";
        card.appendChild(arrow);

        card.addEventListener(
            "click",
            () => selectExam(exam)
        );

        fragment.appendChild(card);
    });

    examContainer.appendChild(fragment);
}

function renderSubjects() {
    subjectContainer.innerHTML = "";

    const filtered = practiceState.subjects.filter(subject => {
        if (!practiceState.searchTerm) return true;

        const haystack = [
            getName(subject),
            subject.description || ""
        ]
            .join(" ")
            .toLowerCase();

        return haystack.includes(practiceState.searchTerm);
    });

    if (!filtered.length) {
        renderNoSearchResults(
            subjectContainer,
            practiceState.searchTerm
                ? "No subjects match your search."
                : "No subjects available.",
            practiceState.searchTerm
                ? "Try another subject name."
                : "The administrator has not published any active subjects for this examination yet."
        );
        return;
    }

    const fragment = document.createDocumentFragment();

    filtered.forEach(subject => {
        const id = getId(subject);
        const card = document.createElement("article");
        card.className = "subject-card";

        const visual = document.createElement("div");
        visual.className = "subject-visual";

        const imageUrl = getImageUrl(subject);

        if (imageUrl) {
            const image = document.createElement("img");
            image.src = imageUrl;
            image.alt = "";
            image.loading = "lazy";
            visual.appendChild(image);
        } else {
            visual.innerHTML = '<i class="fas fa-book-open"></i>';
        }

        const info = document.createElement("div");
        info.className = "subject-info";

        const title = document.createElement("h3");
        title.textContent = getName(subject);

        const description = document.createElement("p");
        description.textContent =
            subject.description ||
            "Practice questions and study resources for this subject.";

        info.append(title, description);

        const actions = document.createElement("div");
        actions.className = "subject-actions";

        const practiceButton = document.createElement("a");
        practiceButton.className = "practice-btn";
        practiceButton.href =
            `questions.html?subject_id=${encodeURIComponent(id)}`;
        practiceButton.innerHTML =
            '<i class="fas fa-clipboard-question"></i><span>Start Practice</span>';

        const resourceButton = document.createElement("a");
        resourceButton.className = "resource-btn";
        resourceButton.href =
            `resources.html?subject_id=${encodeURIComponent(id)}`;
        resourceButton.innerHTML =
            '<i class="fas fa-book-open"></i><span>Study Resources</span>';

        actions.append(practiceButton, resourceButton);
        card.append(visual, info, actions);

        fragment.appendChild(card);
    });

    subjectContainer.appendChild(fragment);
}

function clearSubjects() {
    practiceState.subjects = [];
    practiceState.selectedExam = null;
    practiceState.selectedExamId = null;
    subjectCount.textContent = "0 subjects";

    subjectContainer.innerHTML = "";

    const empty = document.createElement("div");
    empty.className = "practice-empty";

    const icon = document.createElement("div");
    icon.className = "empty-icon";
    icon.innerHTML = '<i class="fas fa-book-medical"></i>';

    const title = document.createElement("h3");
    title.textContent = "No Examination Selected";

    const text = document.createElement("p");
    text.textContent =
        "Your administrator-managed subjects will appear here after you select an examination.";

    empty.append(icon, title, text);
    subjectContainer.appendChild(empty);
}

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

function showExamError(message) {
    examContainer.innerHTML = "";

    const empty = document.createElement("div");
    empty.className = "practice-empty";

    const icon = document.createElement("div");
    icon.className = "empty-icon";
    icon.innerHTML = '<i class="fas fa-cloud-arrow-down"></i>';

    const title = document.createElement("h3");
    title.textContent = "Unable to load examinations";

    const text = document.createElement("p");
    text.textContent =
        message || "Please try again later.";

    const retry = document.createElement("button");
    retry.type = "button";
    retry.className = "practice-retry";
    retry.textContent = "Try Again";
    retry.addEventListener("click", () => loadExams());

    empty.append(icon, title, text, retry);
    examContainer.appendChild(empty);
}

function renderNoSearchResults(container, titleText, descriptionText) {
    const empty = document.createElement("div");
    empty.className = "practice-empty";

    const icon = document.createElement("div");
    icon.className = "empty-icon";
    icon.innerHTML = '<i class="fas fa-magnifying-glass"></i>';

    const title = document.createElement("h3");
    title.textContent = titleText;

    const text = document.createElement("p");
    text.textContent = descriptionText;

    empty.append(icon, title, text);
    container.appendChild(empty);
}

function showMessage(message, type = "error") {
    if (!practiceMessage) return;

    practiceMessage.hidden = false;
    practiceMessage.className = `practice-message ${type}`;
    practiceMessage.textContent = message;
}

function clearMessage() {
    if (!practiceMessage) return;

    practiceMessage.hidden = true;
    practiceMessage.textContent = "";
}

function normalizeArray(value) {
    return Array.isArray(value) ? value.filter(Boolean) : [];
}

function getId(item) {
    return item?.id ?? item?.exam_id ?? item?.subject_id ?? "";
}

function getName(item) {
    return String(
        item?.name ??
        item?.title ??
        item?.exam_name ??
        item?.subject_name ??
        "Untitled"
    );
}

function getImageUrl(item) {
    const value =
        item?.image_url ??
        item?.cover_image ??
        "";

    return typeof value === "string" && value.trim()
        ? value.trim()
        : "";
}
