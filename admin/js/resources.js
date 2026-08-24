"use strict";

/* =========================================================
   STUDY RESOURCE MANAGEMENT
   ========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    initializePage
);


/* =========================================================
   STATE
   ========================================================= */

let editingResourceId = null;
let resourcesCache = [];


/* =========================================================
   DOM ELEMENTS
   ========================================================= */

const examSelect =
    document.getElementById("examSelect");

const subjectSelect =
    document.getElementById("subjectSelect");

const bookTitle =
    document.getElementById("bookTitle");

const author =
    document.getElementById("author");

const description =
    document.getElementById("description");

const coverImage =
    document.getElementById("coverImage");

const bookFile =
    document.getElementById("bookFile");

const resourcesTableBody =
    document.getElementById("resourcesTableBody");

const addResourceBtn =
    document.getElementById("addResourceBtn");


/* =========================================================
   INITIALIZE
   ========================================================= */

async function initializePage() {

    try {

        bindEvents();

        await loadExams();

        await loadResources();

    } catch (error) {

        console.error(
            "Resource page initialization failed:",
            error
        );

        showMessage(
            error.message ||
            "Failed to initialize study resources.",
            "error"
        );

    }

}


/* =========================================================
   EVENT BINDING
   ========================================================= */

function bindEvents() {

    if (examSelect) {

        examSelect.addEventListener(
            "change",
            handleExamChange
        );

    }

    if (subjectSelect) {

        subjectSelect.addEventListener(
            "change",
            clearValidation
        );

    }

    if (bookTitle) {

        bookTitle.addEventListener(
            "input",
            clearValidation
        );

    }

    if (bookFile) {

        bookFile.addEventListener(
            "change",
            handleBookFileChange
        );

    }

    if (coverImage) {

        coverImage.addEventListener(
            "change",
            handleCoverChange
        );

    }

    if (addResourceBtn) {

        addResourceBtn.addEventListener(
            "click",
            focusResourceForm
        );

    }

    /*
     * The supplied HTML does not wrap the Book Details
     * fields in a <form>.
     *
     * Therefore we handle the Save Book button directly.
     */

    const saveButton =
        document.querySelector(
            ".form-actions .btn-success"
        );

    if (saveButton) {

        saveButton.addEventListener(
            "click",
            handleSaveResource
        );

    }

    const clearButton =
        document.querySelector(
            ".form-actions .btn-secondary"
        );

    if (clearButton) {

        clearButton.addEventListener(
            "click",
            handleClear
        );

    }

}


/* =========================================================
   LOAD EXAMS
   ========================================================= */

async function loadExams() {

    setSelectLoading(
        examSelect,
        "Loading Exams..."
    );

    try {

        const response =
            await fetch(
                "/api/admin/exams"
            );

        const result =
            await parseResponse(response);

        const exams =
            Array.isArray(result.data)
                ? result.data
                : [];

        examSelect.innerHTML = `
            <option value="">
                Select Exam
            </option>
        `;

        exams
            .filter(
                exam =>
                    exam.status === "active"
            )
            .forEach(
                exam => {

                    examSelect.insertAdjacentHTML(
                        "beforeend",
                        `
                        <option value="${escapeAttribute(exam.id)}">
                            ${escapeHtml(exam.name)}
                        </option>
                        `
                    );

                }
            );

    } catch (error) {

        console.error(
            "Load exams:",
            error
        );

        setSelectError(
            examSelect,
            "Failed to load exams"
        );

        throw error;

    }

}


/* =========================================================
   EXAM CHANGE
   ========================================================= */

async function handleExamChange() {

    const examId =
        examSelect.value;

    resetSubjectSelect();

    if (!examId) {

        return;

    }

    await loadSubjects(examId);

}


/* =========================================================
   LOAD SUBJECTS FOR SELECTED EXAM
   ========================================================= */

async function loadSubjects(examId) {

    setSelectLoading(
        subjectSelect,
        "Loading Subjects..."
    );

    try {

        const response =
            await fetch(
                `/api/admin/subjects?exam_id=${encodeURIComponent(examId)}`
            );

        const result =
            await parseResponse(response);

        let subjects =
            Array.isArray(result.data)
                ? result.data
                : [];

        /*
         * The endpoint may return all subjects.
         * Filter again client-side to guarantee that
         * only subjects belonging to the selected exam
         * appear in this form.
         */

        subjects =
            subjects.filter(
                subject =>
                    String(subject.exam_id) ===
                    String(examId) &&
                    subject.status === "active"
            );

        subjectSelect.innerHTML = `
            <option value="">
                Select Subject
            </option>
        `;

        subjects.forEach(
            subject => {

                subjectSelect.insertAdjacentHTML(
                    "beforeend",
                    `
                    <option value="${escapeAttribute(subject.id)}">
                        ${escapeHtml(subject.name)}
                    </option>
                    `
                );

            }
        );

        if (!subjects.length) {

            subjectSelect.innerHTML = `
                <option value="">
                    No active subjects available
                </option>
            `;

        }

    } catch (error) {

        console.error(
            "Load subjects:",
            error
        );

        setSelectError(
            subjectSelect,
            "Failed to load subjects"
        );

    }

}


/* =========================================================
   LOAD RESOURCE LIBRARY
   ========================================================= */

async function loadResources() {

    setTableLoading();

    try {

        const response =
            await fetch(
                "/api/admin/resources"
            );

        const result =
            await parseResponse(response);

        resourcesCache =
            Array.isArray(result.data)
                ? result.data
                : [];

        renderResources();

    } catch (error) {

        console.error(
            "Load resources:",
            error
        );

        resourcesTableBody.innerHTML = `
            <tr>
                <td colspan="6">
                    Failed to load study resources.
                </td>
            </tr>
        `;

        showMessage(
            error.message ||
            "Failed to load study resources.",
            "error"
        );

    }

}


/* =========================================================
   RENDER RESOURCE TABLE
   ========================================================= */

function renderResources() {

    if (!resourcesCache.length) {

        resourcesTableBody.innerHTML = `
            <tr>
                <td colspan="6">
                    No study resources found.
                </td>
            </tr>
        `;

        return;

    }

    resourcesTableBody.innerHTML =
        resourcesCache
            .map(
                (resource, index) =>
                    createResourceRow(
                        resource,
                        index
                    )
            )
            .join("");

}


/* =========================================================
   RESOURCE TABLE ROW
   ========================================================= */

function createResourceRow(
    resource,
    index
) {

    const cover =
        resource.cover_image
            ? `
                <img
                    src="${escapeAttribute(resource.cover_image)}"
                    alt="${escapeAttribute(resource.title || "Book cover")}"
                    class="resource-cover"
                    loading="lazy"
                >
              `
            : `
                <div class="resource-cover-placeholder">
                    <i class="fas fa-book"></i>
                </div>
              `;

    const status =
        resource.status === "active"
            ? `<span class="status-active">Active</span>`
            : `<span class="status-inactive">Inactive</span>`;

    return `
        <tr>

            <td>
                ${cover}
            </td>

            <td>

                <strong>
                    ${escapeHtml(resource.title || "Untitled")}
                </strong>

                <br>

                ${status}

            </td>

            <td>
                ${escapeHtml(resource.exam_name || "—")}
            </td>

            <td>
                ${escapeHtml(resource.subject_name || "—")}
            </td>

            <td>
                ${escapeHtml(resource.author || "—")}
            </td>

            <td>

                <div class="resource-actions">

                    ${
                        resource.file_url
                            ? `
                                <a
                                    href="${escapeAttribute(resource.file_url)}"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    class="btn btn-sm btn-primary"
                                >
                                    <i class="fas fa-eye"></i>
                                    View
                                </a>
                              `
                            : ""
                    }

                    <button
                        type="button"
                        class="btn btn-sm btn-secondary"
                        data-action="edit"
                        data-id="${escapeAttribute(resource.id)}"
                    >
                        <i class="fas fa-pen"></i>
                        Edit
                    </button>

                    <button
                        type="button"
                        class="btn btn-sm ${
                            resource.status === "active"
                                ? "btn-danger"
                                : "btn-success"
                        }"
                        data-action="toggle"
                        data-id="${escapeAttribute(resource.id)}"
                    >
                        <i class="fas ${
                            resource.status === "active"
                                ? "fa-ban"
                                : "fa-check"
                        }"></i>

                        ${
                            resource.status === "active"
                                ? "Deactivate"
                                : "Activate"
                        }

                    </button>

                </div>

            </td>

        </tr>
    `;

}


/* =========================================================
   TABLE ACTIONS
   ========================================================= */

document.addEventListener(
    "click",
    async event => {

        const button =
            event.target.closest(
                "[data-action]"
            );

        if (!button) {

            return;

        }

        const action =
            button.dataset.action;

        const id =
            button.dataset.id;

        if (!id) {

            return;

        }

        if (action === "edit") {

            await editResource(id);

        }

        if (action === "toggle") {

            await toggleResource(id);

        }

    }
);


/* =========================================================
   SAVE RESOURCE
   ========================================================= */

async function handleSaveResource() {

    clearValidation();

    const title =
        bookTitle.value.trim();

    const subjectId =
        subjectSelect.value;

    if (!examSelect.value) {

        showMessage(
            "Please select an exam.",
            "error"
        );

        examSelect.focus();

        return;

    }

    if (!subjectId) {

        showMessage(
            "Please select a subject.",
            "error"
        );

        subjectSelect.focus();

        return;

    }

    if (!title) {

        showMessage(
            "Book title is required.",
            "error"
        );

        bookTitle.focus();

        return;

    }

    /*
     * IMPORTANT:
     *
     * Your current /api/admin/resources endpoint expects
     * file_url and cover_image.
     *
     * A browser File object is NOT an R2 URL.
     *
     * Do not send fake URLs.
     */

    if (!editingResourceId) {

        if (!bookFile.files.length) {

            showMessage(
                "Please select the PDF book.",
                "error"
            );

            bookFile.focus();

            return;

        }

    }

    const selectedFile =
        bookFile.files[0];

    if (
        selectedFile &&
        selectedFile.type !== "application/pdf"
    ) {

        showMessage(
            "Only PDF books are supported.",
            "error"
        );

        return;

    }

    /*
     * At this point an R2 upload handler is required
     * to convert the selected File into file_url.
     *
     * We deliberately stop here rather than uploading
     * to a nonexistent endpoint.
     */

    if (!editingResourceId) {

        showMessage(
            "The PDF must be uploaded to R2 before the resource can be saved. Connect the existing worker R2 upload handler here.",
            "error"
        );

        return;

    }

    /*
     * Editing existing resource.
     *
     * Preserve its current R2 URLs unless the worker
     * upload flow is used to replace them.
     */

    const existing =
        resourcesCache.find(
            resource =>
                String(resource.id) ===
                String(editingResourceId)
        );

    if (!existing) {

        showMessage(
            "Resource could not be found.",
            "error"
        );

        return;

    }

    const payload = {

        subject_id:
            subjectId,

        title:
            title,

        description:
            description.value.trim(),

        file_url:
            existing.file_url || "",

        cover_image:
            existing.cover_image || "",

        file_type:
            "pdf",

        status:
            existing.status || "active"

    };

    await submitResource(
        payload,
        editingResourceId
    );

}


/* =========================================================
   SUBMIT RESOURCE
   ========================================================= */

async function submitResource(
    payload,
    resourceId = null
) {

    const method =
        resourceId
            ? "PUT"
            : "POST";

    const url =
        resourceId
            ? `/api/admin/resources/${encodeURIComponent(resourceId)}`
            : "/api/admin/resources";

    const saveButton =
        document.querySelector(
            ".form-actions .btn-success"
        );

    setButtonLoading(
        saveButton,
        true,
        resourceId
            ? "Updating..."
            : "Saving..."
    );

    try {

        const response =
            await fetch(
                url,
                {
                    method,
                    headers: {
                        "Content-Type":
                            "application/json"
                    },
                    body:
                        JSON.stringify(payload)
                }
            );

        const result =
            await parseResponse(response);

        showMessage(
            result.message ||
            "Study resource saved successfully.",
            "success"
        );

        clearForm();

        await loadResources();

    } catch (error) {

        console.error(
            "Save resource:",
            error
        );

        showMessage(
            error.message ||
            "Failed to save study resource.",
            "error"
        );

    } finally {

        setButtonLoading(
            saveButton,
            false,
            resourceId
                ? "Update Book"
                : "Save Book"
        );

    }

}


/* =========================================================
   EDIT RESOURCE
   ========================================================= */

async function editResource(id) {

    const resource =
        resourcesCache.find(
            item =>
                String(item.id) ===
                String(id)
        );

    if (!resource) {

        showMessage(
            "Study resource not found.",
            "error"
        );

        return;

    }

    editingResourceId =
        resource.id;

    examSelect.value =
        resource.exam_id || "";

    await loadSubjects(
        resource.exam_id
    );

    subjectSelect.value =
        resource.subject_id || "";

    bookTitle.value =
        resource.title || "";

    /*
     * Current API does not expose/store author.
     * Therefore we don't fabricate one.
     */

    author.value =
        resource.author || "";

    description.value =
        resource.description || "";

    /*
     * File inputs cannot be populated with an existing
     * R2 URL for security reasons.
     */

    bookFile.value = "";

    coverImage.value = "";

    const saveButton =
        document.querySelector(
            ".form-actions .btn-success"
        );

    if (saveButton) {

        saveButton.innerHTML = `
            <i class="fas fa-save"></i>
            Update Book
        `;

    }

    if (addResourceBtn) {

        addResourceBtn.innerHTML = `
            <i class="fas fa-plus"></i>
            Add New Book
        `;

    }

    focusResourceForm();

    showMessage(
        "Editing selected study resource.",
        "success"
    );

}


/* =========================================================
   TOGGLE RESOURCE STATUS
   ========================================================= */

async function toggleResource(id) {

    const resource =
        resourcesCache.find(
            item =>
                String(item.id) ===
                String(id)
        );

    if (!resource) {

        return;

    }

    const newStatus =
        resource.status === "active"
            ? "inactive"
            : "active";

    const confirmed =
        window.confirm(
            newStatus === "inactive"
                ? "Deactivate this study resource?"
                : "Activate this study resource?"
        );

    if (!confirmed) {

        return;

    }

    try {

        const response =
            await fetch(
                `/api/admin/resources/${encodeURIComponent(id)}/status`,
                {
                    method: "PATCH",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body:
                        JSON.stringify({
                            status: newStatus
                        })
                }
            );

        const result =
            await parseResponse(response);

        showMessage(
            result.message ||
            "Resource status updated.",
            "success"
        );

        await loadResources();

    } catch (error) {

        console.error(
            "Toggle resource:",
            error
        );

        showMessage(
            error.message ||
            "Failed to update resource status.",
            "error"
        );

    }

}


/* =========================================================
   CLEAR FORM
   ========================================================= */

function handleClear(event) {

    if (event) {

        event.preventDefault();

    }

    clearForm();

}


function clearForm() {

    editingResourceId =
        null;

    if (examSelect) {

        examSelect.value = "";

    }

    resetSubjectSelect();

    if (bookTitle) {

        bookTitle.value = "";

    }

    if (author) {

        author.value = "";

    }

    if (description) {

        description.value = "";

    }

    if (coverImage) {

        coverImage.value = "";

    }

    if (bookFile) {

        bookFile.value = "";

    }

    const saveButton =
        document.querySelector(
            ".form-actions .btn-success"
        );

    if (saveButton) {

        saveButton.innerHTML = `
            <i class="fas fa-save"></i>
            Save Book
        `;

    }

    clearValidation();

}


/* =========================================================
   ADD NEW RESOURCE
   ========================================================= */

function focusResourceForm() {

    clearForm();

    if (examSelect) {

        examSelect.focus();

    }

}


/* =========================================================
   FILE SELECTION
   ========================================================= */

function handleBookFileChange() {

    const file =
        bookFile.files[0];

    if (!file) {

        return;

    }

    if (
        file.type !==
        "application/pdf"
    ) {

        bookFile.value = "";

        showMessage(
            "Only PDF files are supported.",
            "error"
        );

        return;

    }

    if (
        file.size >
        50 * 1024 * 1024
    ) {

        bookFile.value = "";

        showMessage(
            "The PDF must be 50 MB or smaller.",
            "error"
        );

        return;

    }

}


function handleCoverChange() {

    const file =
        coverImage.files[0];

    if (!file) {

        return;

    }

    if (
        !file.type.startsWith(
            "image/"
        )
    ) {

        coverImage.value = "";

        showMessage(
            "Please select a valid image file.",
            "error"
        );

        return;

    }

    if (
        file.size >
        5 * 1024 * 1024
    ) {

        coverImage.value = "";

        showMessage(
            "The cover image must be 5 MB or smaller.",
            "error"
        );

    }

}


/* =========================================================
   SUBJECT RESET
   ========================================================= */

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


/* =========================================================
   RESPONSE HANDLING
   ========================================================= */

async function parseResponse(response) {

    let result;

    try {

        result =
            await response.json();

    } catch {

        throw new Error(
            `Server returned an invalid response (${response.status}).`
        );

    }

    if (
        !response.ok ||
        result.success === false
    ) {

        throw new Error(
            result.message ||
            `Request failed (${response.status}).`
        );

    }

    return result;

}


/* =========================================================
   TABLE LOADING
   ========================================================= */

function setTableLoading() {

    resourcesTableBody.innerHTML = `
        <tr>
            <td colspan="6">
                <i class="fas fa-spinner fa-spin"></i>
                Loading study resources...
            </td>
        </tr>
    `;

}


/* =========================================================
   SELECT LOADING
   ========================================================= */

function setSelectLoading(
    select,
    message
) {

    if (!select) {

        return;

    }

    select.innerHTML = `
        <option value="">
            ${escapeHtml(message)}
        </option>
    `;

}


function setSelectError(
    select,
    message
) {

    if (!select) {

        return;

    }

    select.innerHTML = `
        <option value="">
            ${escapeHtml(message)}
        </option>
    `;

}


/* =========================================================
   BUTTON LOADING
   ========================================================= */

function setButtonLoading(
    button,
    loading,
    text
) {

    if (!button) {

        return;

    }

    button.disabled =
        loading;

    if (loading) {

        button.innerHTML = `
            <i class="fas fa-spinner fa-spin"></i>
            ${escapeHtml(text)}
        `;

    } else {

        button.innerHTML = `
            <i class="fas fa-save"></i>
            ${escapeHtml(text)}
        `;

    }

}


/* =========================================================
   VALIDATION
   ========================================================= */

function clearValidation() {

    document
        .querySelectorAll(
            ".field-error"
        )
        .forEach(
            element =>
                element.remove()
        );

}


/* =========================================================
   MESSAGE
   ========================================================= */

function showMessage(
    message,
    type = "success"
) {

    let container =
        document.getElementById(
            "resourceMessage"
        );

    if (!container) {

        container =
            document.createElement(
                "div"
            );

        container.id =
            "resourceMessage";

        container.setAttribute(
            "role",
            "alert"
        );

        const section =
            document.querySelector(
                ".content-section"
            );

        if (section) {

            section.prepend(
                container
            );

        }

    }

    container.className =
        `resource-message ${type}`;

    container.textContent =
        message;

    clearTimeout(
        container._timer
    );

    container._timer =
        setTimeout(
            () => {

                container.remove();

            },
            5000
        );

}


/* =========================================================
   HTML ESCAPING
   ========================================================= */

function escapeHtml(value) {

    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");

}


function escapeAttribute(value) {

    return escapeHtml(value);

}