"use strict";

/*=========================================================
    EXAM MANAGEMENT
=========================================================*/

document.addEventListener(
    "DOMContentLoaded",
    initializePage
);

/*=========================================================
    INITIALIZE
=========================================================*/

async function initializePage() {

    bindEvents();

    await loadExams();

}

/*=========================================================
    EVENT BINDINGS
=========================================================*/

function bindEvents() {

    const form =
        document.getElementById("examForm");

    const draftButton =
        document.getElementById("saveDraftBtn");

    if (form) {

        form.addEventListener(
            "submit",
            handlePublish
        );

    }

    if (draftButton) {

        draftButton.addEventListener(
            "click",
            handleSaveDraft
        );

    }

}

/*=========================================================
    LOAD EXAMS
=========================================================*/

async function loadExams() {

    const tableBody =
        document.getElementById(
            "examsTableBody"
        );

    if (!tableBody) return;

    tableBody.innerHTML = `
        <tr>
            <td colspan="3">
                Loading examinations...
            </td>
        </tr>
    `;

    try {

        const response = await fetch(
            "/api/admin/exams"
        );

        const result =
            await response.json();

        if (
            !response.ok ||
            !result.success
        ) {

            throw new Error(
                result.message ||
                "Failed to load examinations."
            );

        }

        renderExams(
            Array.isArray(result.data)
                ? result.data
                : []
        );

    }
    catch (error) {

        console.error(
            "EXAM LOAD ERROR:",
            error
        );

        tableBody.innerHTML = `
            <tr>
                <td colspan="3">
                    Failed to load examinations.
                </td>
            </tr>
        `;

    }

}

/*=========================================================
    RENDER EXAMS
=========================================================*/

function renderExams(exams) {

    const tableBody =
        document.getElementById(
            "examsTableBody"
        );

    tableBody.innerHTML = "";

    if (!exams.length) {

        tableBody.innerHTML = `
            <tr>
                <td colspan="3">
                    No examinations found.
                </td>
            </tr>
        `;

        return;

    }

    exams.forEach(
        exam => {

            const row =
                document.createElement("tr");

            const published =
                exam.status === "active";

            row.innerHTML = `

                <td>

                    <strong>
                        ${escapeHtml(exam.name)}
                    </strong>

                    ${
                        exam.description
                            ? `
                                <div class="exam-description">
                                    ${escapeHtml(
                                        exam.description
                                    )}
                                </div>
                            `
                            : ""
                    }

                </td>

                <td>

                    <span class="status-badge
                        ${published
                            ? "published"
                            : "draft"}
                    ">

                        ${
                            published
                                ? "Published"
                                : "Draft"
                        }

                    </span>

                </td>

                <td>

                    <button
                        type="button"
                        class="action-btn edit-btn"
                        data-id="${exam.id}">

                        Edit

                    </button>

                    <button
                        type="button"
                        class="action-btn toggle-btn"
                        data-id="${exam.id}">

                        ${
                            published
                                ? "Deactivate"
                                : "Publish"
                        }

                    </button>

                </td>

            `;

            tableBody.appendChild(row);

        }
    );

    bindTableActions();

}

/*=========================================================
    TABLE ACTIONS
=========================================================*/

function bindTableActions() {

    document
        .querySelectorAll(".edit-btn")
        .forEach(button => {

            button.addEventListener(
                "click",
                () => editExam(
                    button.dataset.id
                )
            );

        });

    document
        .querySelectorAll(".toggle-btn")
        .forEach(button => {

            button.addEventListener(
                "click",
                () => toggleExam(
                    button.dataset.id
                )
            );

        });

}

/*=========================================================
    SAVE DRAFT
=========================================================*/

async function handleSaveDraft(event) {

    if (event) {
        event.preventDefault();
    }

    await saveExam("inactive");

}

/*=========================================================
    PUBLISH
=========================================================*/

async function handlePublish(event) {

    event.preventDefault();

    await saveExam("active");

}

/*=========================================================
    CREATE / UPDATE EXAM
=========================================================*/

async function saveExam(status) {

    const examId =
        document.getElementById(
            "examId"
        ).value.trim();

    const name =
        document.getElementById(
            "examName"
        ).value.trim();

    const description =
        document.getElementById(
            "examDescription"
        ).value.trim();

    if (!name) {

        alert(
            "Examination name is required."
        );

        return;

    }

    /*
     * The current HTML does not contain
     * an exam-code field.
     *
     * The worker requires a code,
     * so generate one automatically.
     */

    const code =
        generateExamCode(name);

    const payload = {

        name,

        code,

        description,

        display_order: 0,

        status

    };

    try {

        setFormLoading(true);

        let response;

        /*-----------------------------------------
            CREATE
        -----------------------------------------*/

        if (!examId) {

            response = await fetch(
                "/api/admin/exams",
                {

                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body:
                        JSON.stringify(payload)

                }
            );

        }

        /*-----------------------------------------
            UPDATE
        -----------------------------------------*/

        else {

            response = await fetch(
                `/api/admin/exams/${examId}`,
                {

                    method: "PUT",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body:
                        JSON.stringify(payload)

                }
            );

        }

        const result =
            await response.json();

        if (
            !response.ok ||
            !result.success
        ) {

            throw new Error(
                result.message ||
                "Failed to save examination."
            );

        }

        alert(
            result.message ||
            "Examination saved successfully."
        );

        resetForm();

        await loadExams();

    }
    catch (error) {

        console.error(
            "EXAM SAVE ERROR:",
            error
        );

        alert(
            error.message ||
            "Failed to save examination."
        );

    }
    finally {

        setFormLoading(false);

    }

}

/*=========================================================
    EDIT EXAM
=========================================================*/

async function editExam(examId) {

    if (!examId) return;

    try {

        const response = await fetch(
            `/api/admin/exams/${examId}`
        );

        const result =
            await response.json();

        if (
            !response.ok ||
            !result.success
        ) {

            throw new Error(
                result.message ||
                "Failed to load examination."
            );

        }

        const exam =
            result.data;

        document.getElementById(
            "examId"
        ).value =
            exam.id || "";

        document.getElementById(
            "examName"
        ).value =
            exam.name || "";

        document.getElementById(
            "examDescription"
        ).value =
            exam.description || "";

        document.getElementById(
            "examStatus"
        ).value =
            exam.status === "active"
                ? "published"
                : "draft";

        window.scrollTo({

            top: 0,

            behavior: "smooth"

        });

    }
    catch (error) {

        console.error(
            "EXAM EDIT ERROR:",
            error
        );

        alert(
            error.message ||
            "Failed to load examination."
        );

    }

}

/*=========================================================
    PUBLISH / DEACTIVATE
=========================================================*/

async function toggleExam(examId) {

    if (!examId) return;

    try {

        const response = await fetch(
            `/api/admin/exams/${examId}`
        );

        const result =
            await response.json();

        if (
            !response.ok ||
            !result.success
        ) {

            throw new Error(
                result.message ||
                "Failed to load examination."
            );

        }

        const exam =
            result.data;

        const isPublished =
            exam.status === "active";

        const nextStatus =
            isPublished
                ? "inactive"
                : "active";

        const confirmation =
            isPublished
                ? "Deactivate this examination?"
                : "Publish this examination?";

        if (!window.confirm(
            confirmation
        )) {

            return;

        }

        const updateResponse =
            await fetch(
                `/api/admin/exams/${examId}`,
                {

                    method: "PUT",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body: JSON.stringify({

                        name:
                            exam.name,

                        code:
                            exam.code,

                        description:
                            exam.description || "",

                        image_url:
                            exam.image_url || "",

                        icon_url:
                            exam.icon_url || "",

                        color:
                            exam.color || "",

                        display_order:
                            Number(
                                exam.display_order
                            ) || 0,

                        status:
                            nextStatus

                    })

                }
            );

        const updateResult =
            await updateResponse.json();

        if (
            !updateResponse.ok ||
            !updateResult.success
        ) {

            throw new Error(
                updateResult.message ||
                "Failed to update examination."
            );

        }

        await loadExams();

    }
    catch (error) {

        console.error(
            "EXAM TOGGLE ERROR:",
            error
        );

        alert(
            error.message ||
            "Failed to update examination."
        );

    }

}

/*=========================================================
    RESET FORM
=========================================================*/

function resetForm() {

    const form =
        document.getElementById(
            "examForm"
        );

    if (form) {

        form.reset();

    }

    document.getElementById(
        "examId"
    ).value = "";

    document.getElementById(
        "examStatus"
    ).value = "draft";

}

/*=========================================================
    FORM LOADING
=========================================================*/

function setFormLoading(isLoading) {

    const draftButton =
        document.getElementById(
            "saveDraftBtn"
        );

    const publishButton =
        document.getElementById(
            "publishBtn"
        );

    if (draftButton) {

        draftButton.disabled =
            isLoading;

        draftButton.textContent =
            isLoading
                ? "Saving..."
                : "Save Draft";

    }

    if (publishButton) {

        publishButton.disabled =
            isLoading;

        publishButton.textContent =
            isLoading
                ? "Saving..."
                : "Publish";

    }

}

/*=========================================================
    GENERATE EXAM CODE
=========================================================*/

function generateExamCode(name) {

    return String(name)

        .trim()

        .toUpperCase()

        .replace(/[^A-Z0-9]+/g, "_")

        .replace(/^_+|_+$/g, "")

        .slice(0, 30);

}

/*=========================================================
    HTML ESCAPING
=========================================================*/

function escapeHtml(value) {

    return String(value ?? "")

        .replace(/&/g, "&amp;")

        .replace(/</g, "&lt;")

        .replace(/>/g, "&gt;")

        .replace(/"/g, "&quot;")

        .replace(/'/g, "&#039;");

}