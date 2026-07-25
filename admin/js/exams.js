/*
=========================================================
    NurseSphere Admin Examination Management
    File: admin/js/exams.js
=========================================================
*/

"use strict";

/*=========================================================
    Authentication
=========================================================*/

Auth.requireAdmin();

/*=========================================================
    State
=========================================================*/

let examinations = [];

let filteredExaminations = [];

/*=========================================================
    DOM Elements
=========================================================*/

const tableBody = document.getElementById("examsTableBody");

const searchInput = document.getElementById("searchInput");

const addExamBtn = document.getElementById("addExamBtn");

const examModal = document.getElementById("examModal");

const examForm = document.getElementById("examForm");

const examId = document.getElementById("examId");

const examName = document.getElementById("examName");

const examDescription = document.getElementById("examDescription");

const examStatus = document.getElementById("examStatus");

const closeModalBtn = document.getElementById("closeModal");

const cancelBtn = document.getElementById("cancelBtn");

/*=========================================================
    Initialize
=========================================================*/

document.addEventListener(

    "DOMContentLoaded",

    () => {

        loadExaminations();

        registerEvents();

    }

);

/*=========================================================
    Event Listeners
=========================================================*/

function registerEvents() {

    if (addExamBtn) {

        addExamBtn.addEventListener(

            "click",

            openCreateModal

        );

    }

    if (searchInput) {

        searchInput.addEventListener(

            "input",

            filterExaminations

        );

    }

    if (closeModalBtn) {

        closeModalBtn.addEventListener(

            "click",

            closeModal

        );

    }

    if (cancelBtn) {

        cancelBtn.addEventListener(

            "click",

            closeModal

        );

    }

    window.addEventListener(

        "click",

        function (event) {

            if (event.target === examModal) {

                closeModal();

            }

        }

    );

}

/*=========================================================
    Load Examinations
=========================================================*/

async function loadExaminations() {

    try {

        tableBody.innerHTML = `

            <tr>

                <td colspan="3" class="loading">

                    Loading examinations...

                </td>

            </tr>

        `;

        const response = await API.get(

            "/api/admin/exams"

        );

        examinations = response.data || [];

        filteredExaminations = [...examinations];

        renderTable();

    }

    catch (error) {

        console.error(error);

        tableBody.innerHTML = `

            <tr>

                <td colspan="3" class="error">

                    Failed to load examinations.

                </td>

            </tr>

        `;

    }

}

/*=========================================================
    Render Table
=========================================================*/

function renderTable() {

    tableBody.innerHTML = "";

    if (filteredExaminations.length === 0) {

        tableBody.innerHTML = `

            <tr>

                <td colspan="3">

                    No examinations found.

                </td>

            </tr>

        `;

        return;

    }

    filteredExaminations.forEach(

        exam => {

            tableBody.insertAdjacentHTML(

                "beforeend",

                createRow(exam)

            );

        }

    );

}

/*=========================================================
    Create Table Row
=========================================================*/

function createRow(exam) {

    return `

<tr>

    <td>

        ${escapeHtml(exam.name)}

    </td>

    <td>

        <span class="status-badge ${exam.status}">

            ${capitalize(exam.status)}

        </span>

    </td>

    <td class="actions">

        <button

            class="btn-edit"

            onclick="editExam('${exam.id}')">

            <i class="fas fa-pen"></i>

        </button>

        <button

            class="btn-delete"

            onclick="deleteExam('${exam.id}')">

            <i class="fas fa-trash"></i>

        </button>

    </td>

</tr>

`;

}

/*=========================================================
    Search
=========================================================*/

function filterExaminations() {

    const keyword =

        searchInput.value

        .trim()

        .toLowerCase();

    filteredExaminations = examinations.filter(

        exam =>

            exam.name

            .toLowerCase()

            .includes(keyword)

    );

    renderTable();

}

/*=========================================================
    Helpers
=========================================================*/

function capitalize(text = "") {

    return text.charAt(0).toUpperCase() +

        text.slice(1);

}

function escapeHtml(text = "") {

    const div = document.createElement("div");

    div.textContent = text;

    return div.innerHTML;

}