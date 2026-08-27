"use strict";

/* =========================================================
   NURSEPHERE ADMIN
   STUDY RESOURCE MANAGEMENT
   Production Frontend
   =========================================================

   Responsibilities:
   - Load active Exams
   - Load active Subjects belonging to selected Exam
   - Create study resources
   - Edit study resources
   - Activate / deactivate resources
   - Upload books through R2 multipart upload
   - Upload covers through R2 multipart upload
   - NO frontend file-size restriction
   - Supports PDF, DOCX, XLSX and CSV books

   This file is ADMIN/MANAGEMENT ONLY.
   It does not contain student-side resource logic.
   ========================================================= */


/* =========================================================
   INITIALIZATION
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

let currentUpload = null;


/* =========================================================
   DOM
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
   API
   ========================================================= */

const RESOURCE_API = {

    exams:
        "/api/admin/exams",

    subjects:
        "/api/admin/subjects",

    resources:
        "/api/admin/resources",

    uploadInit:
        "/api/admin/resources/upload/init",

    uploadPart:
        "/api/admin/resources/upload/part",

    uploadComplete:
        "/api/admin/resources/upload/complete",

    uploadAbort:
        "/api/admin/resources/upload/abort",

    /* -----------------------------------------
       STUDY RESOURCE VIEW
       Existing Admin Worker endpoint
       ----------------------------------------- */

    view:
        "/api/admin/resources",

    /* -----------------------------------------
       STUDY RESOURCE DOWNLOAD
       Existing Admin Worker endpoint
       ----------------------------------------- */

    download:
        "/api/admin/resources"

};


/* =========================================================
   R2 MULTIPART PART SIZE
   =========================================================

   IMPORTANT:
   There is NO maximum file-size restriction here.

   A large file is divided into multipart chunks and
   uploaded to R2.

   10 MiB per part keeps browser memory reasonable.
   ========================================================= */

const UPLOAD_PART_SIZE =
    10 * 1024 * 1024;


/* =========================================================
   SUPPORTED BOOK TYPES
   ========================================================= */

const BOOK_TYPES = {

    "application/pdf":
        "pdf",

    "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
        "docx",

    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
        "xlsx",

    "text/csv":
        "csv"

};


/* =========================================================
   INITIALIZE
   ========================================================= */

async function initializePage() {

    bindEvents();

    resetSubjectSelect();

    try {

        await loadExams();

        await loadResources();

    } catch (error) {

        console.error(
            "Study resource page initialization failed:",
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


    if (author) {

        author.addEventListener(
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
            () => focusResourceForm(true)
        );

    }


    const saveButton =
        document.querySelector(
            ".form-actions .btn-success"
        );


    if (saveButton) {

        saveButton.addEventListener(
            "click",
            event => {

                event.preventDefault();

                handleSaveResource();

            }
        );

    }


    const clearButton =
        document.querySelector(
            ".form-actions .btn-secondary"
        );


    if (clearButton) {

        clearButton.addEventListener(
            "click",
            event => {

                event.preventDefault();

                clearForm();

            }
        );

    }


    document.addEventListener(
        "click",
        handleTableAction
    );

}


/* =========================================================
   LOAD EXAMS
   ========================================================= */

async function loadExams() {

    setSelectLoading(
        examSelect,
        "Loading Exams..."
    );

    const response =
        await fetch(
            RESOURCE_API.exams,
            {
                method: "GET",
                cache: "no-store"
            }
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
                String(exam.status).toLowerCase() ===
                "active"
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

}


/* =========================================================
   EXAM CHANGE
   ========================================================= */

async function handleExamChange() {

    const examId =
        examSelect
            ? examSelect.value
            : "";


    resetSubjectSelect();


    if (!examId) {

        return;

    }


    await loadSubjects(examId);

}


/* =========================================================
   LOAD SUBJECTS
   ========================================================= */

async function loadSubjects(examId) {

    setSelectLoading(
        subjectSelect,
        "Loading Subjects..."
    );


    try {

        const url =
            `${RESOURCE_API.subjects}?exam_id=${encodeURIComponent(examId)}`;


        const response =
            await fetch(
                url,
                {
                    method: "GET",
                    cache: "no-store"
                }
            );


        const result =
            await parseResponse(response);


        const subjects =
            Array.isArray(result.data)
                ? result.data
                    .filter(
                        subject =>
                            String(subject.exam_id) ===
                            String(examId) &&

                            String(subject.status)
                                .toLowerCase() ===
                            "active"
                    )
                : [];


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
            "Load subjects failed:",
            error
        );

        setSelectError(
            subjectSelect,
            "Failed to load subjects"
        );

        throw error;

    }

}


/* =========================================================
   LOAD RESOURCE LIBRARY
   ========================================================= */

async function loadResources() {

    setTableLoading();


    const response =
        await fetch(
            RESOURCE_API.resources,
            {
                method: "GET",
                cache: "no-store"
            }
        );


    const result =
        await parseResponse(response);


    resourcesCache =
        Array.isArray(result.data)
            ? result.data
            : [];


    renderResources();

}


/* =========================================================
   RENDER RESOURCES
   ========================================================= */

function renderResources() {

    if (!resourcesTableBody) {

        return;

    }


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
                createResourceRow
            )
            .join("");

}


/* =========================================================
   RESOURCE ROW
   ========================================================= */

function createResourceRow(resource) {

    const cover =
        resource.cover_image
            ? `
                <img
                    src="${escapeAttribute(resource.cover_image)}"
                    alt="${escapeAttribute(
                        resource.title ||
                        "Study book cover"
                    )}"
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
        String(resource.status)
            .toLowerCase() === "active"

            ? `<span class="status-active">Active</span>`

            : `<span class="status-inactive">Inactive</span>`;


    const active =
        String(resource.status)
            .toLowerCase() === "active";


    /* =====================================================
       VIEW BUTTON

       Uses the existing Admin Worker route:

       GET /api/admin/resources/:id/view

       The Worker returns the actual R2 object with:

       Content-Disposition: inline

       Therefore the browser can open/view the resource.
       ===================================================== */

    const viewButton =
        resource.file_url
            ? `
                <button
                    type="button"
                    class="btn btn-sm btn-primary"
                    data-action="view"
                    data-id="${escapeAttribute(resource.id)}"
                    title="View study resource"
                >
                    <i class="fas fa-eye"></i>
                    View
                </button>
            `
            : "";


    /* =====================================================
       DOWNLOAD BUTTON

       Uses the existing Admin Worker route:

       GET /api/admin/resources/:id/download

       The Worker returns the actual R2 object with:

       Content-Disposition: attachment

       Therefore the browser downloads the file.
       ===================================================== */

    const downloadButton =
        resource.file_url
            ? `
                <button
                    type="button"
                    class="btn btn-sm btn-success"
                    data-action="download"
                    data-id="${escapeAttribute(resource.id)}"
                    title="Download study resource"
                >
                    <i class="fas fa-download"></i>
                    Download
                </button>
            `
            : "";


    return `
        <tr>

            <td>
                ${cover}
            </td>


            <td>

                <strong>
                    ${escapeHtml(
                        resource.title ||
                        "Untitled"
                    )}
                </strong>

                <br>

                ${status}

            </td>


            <td>
                ${escapeHtml(
                    resource.exam_name ||
                    "—"
                )}
            </td>


            <td>
                ${escapeHtml(
                    resource.subject_name ||
                    "—"
                )}
            </td>


            <td>
                ${escapeHtml(
                    resource.author ||
                    "—"
                )}
            </td>


            <td>

                <div class="resource-actions">

                    ${viewButton}

                    ${downloadButton}


                    <button
                        type="button"
                        class="btn btn-sm btn-secondary"
                        data-action="edit"
                        data-id="${escapeAttribute(resource.id)}"
                        title="Edit study resource"
                    >
                        <i class="fas fa-pen"></i>
                        Edit
                    </button>


                    <button
                        type="button"
                        class="btn btn-sm ${
                            active
                                ? "btn-danger"
                                : "btn-success"
                        }"
                        data-action="toggle"
                        data-id="${escapeAttribute(resource.id)}"
                        title="${
                            active
                                ? "Deactivate study resource"
                                : "Activate study resource"
                        }"
                    >

                        <i class="fas ${
                            active
                                ? "fa-ban"
                                : "fa-check"
                        }"></i>

                        ${
                            active
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
   TABLE ACTION
   ========================================================= */

async function handleTableAction(event) {

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


    /* =====================================================
       VIEW
       ===================================================== */

    if (action === "view") {

        viewResource(
            id,
            button
        );

        return;

    }


    /* =====================================================
       DOWNLOAD
       ===================================================== */

    if (action === "download") {

        downloadResource(
            id,
            button
        );

        return;

    }


    /* =====================================================
       EDIT
       ===================================================== */

    if (action === "edit") {

        await editResource(id);

        return;

    }


    /* =====================================================
       TOGGLE
       ===================================================== */

    if (action === "toggle") {

        await toggleResource(id);

    }

}


/* =========================================================
   VIEW RESOURCE
   =========================================================

   Existing Worker endpoint:

   GET /api/admin/resources/:id/view

   The Worker returns the actual R2 object.

   Content-Disposition:
       inline

   No JSON parsing is performed because this endpoint
   returns the file itself, not a JSON download_url.
   ========================================================= */

function viewResource(
    resourceId,
    button
) {

    if (!resourceId) {

        return;

    }


    const originalHTML =
        button.innerHTML;


    const viewUrl =
        `${RESOURCE_API.view}/${encodeURIComponent(resourceId)}/view`;


    try {

        /*
         * Open immediately from the user click.
         *
         * This avoids popup blockers caused by waiting
         * for an asynchronous fetch before opening.
         */

        const newWindow =
            window.open(
                viewUrl,
                "_blank",
                "noopener,noreferrer"
            );


        /*
         * If the browser blocked the popup, give the
         * administrator a useful message instead of
         * silently failing.
         */

        if (!newWindow) {

            showMessage(
                "The resource could not be opened. Please allow pop-ups for this site.",
                "error"
            );

            return;

        }


        button.disabled =
            true;


        button.innerHTML = `
            <i class="fas fa-check"></i>
            Opened
        `;


        setTimeout(
            () => {

                if (button) {

                    button.disabled =
                        false;

                    button.innerHTML =
                        originalHTML;

                }

            },
            1200
        );


    } catch (error) {

        console.error(
            "View resource failed:",
            error
        );


        showMessage(
            "Unable to open this study resource.",
            "error"
        );


        button.disabled =
            false;


        button.innerHTML =
            originalHTML;

    }

}


/* =========================================================
   DOWNLOAD RESOURCE
   =========================================================

   Existing Worker endpoint:

   GET /api/admin/resources/:id/download

   The Worker returns the actual R2 object.

   Content-Disposition:
       attachment

   We deliberately do NOT use fetch() + response.json()
   because this endpoint returns the binary file itself.

   A temporary same-origin anchor is used so the browser
   performs a normal download without navigating the
   Admin page away.
   ========================================================= */

function downloadResource(
    resourceId,
    button
) {

    if (!resourceId) {

        return;

    }


    const originalHTML =
        button.innerHTML;


    const downloadUrl =
        `${RESOURCE_API.download}/${encodeURIComponent(resourceId)}/download`;


    try {

        button.disabled =
            true;


        button.innerHTML = `
            <i class="fas fa-spinner fa-spin"></i>
            Downloading...
        `;


        const anchor =
            document.createElement(
                "a"
            );


        anchor.href =
            downloadUrl;


        /*
         * The Worker controls the actual filename through
         * Content-Disposition: attachment.
         *
         * Setting download to an empty string still tells
         * the browser this is intended as a download while
         * allowing the server filename to take precedence.
         */

        anchor.download =
            "";


        anchor.style.display =
            "none";


        document.body.appendChild(
            anchor
        );


        anchor.click();


        /*
         * Remove the temporary element immediately after
         * initiating the browser download.
         */

        anchor.remove();


        showMessage(
            "Study resource download started.",
            "success"
        );


    } catch (error) {

        console.error(
            "Download resource failed:",
            error
        );


        showMessage(
            "Unable to download this study resource.",
            "error"
        );

    } finally {

        button.disabled =
            false;


        button.innerHTML =
            originalHTML;

    }

}


/* =========================================================
   SAVE RESOURCE
   ========================================================= */

async function handleSaveResource() {

    clearValidation();


    const examId =
        examSelect
            ? examSelect.value.trim()
            : "";


    const subjectId =
        subjectSelect
            ? subjectSelect.value.trim()
            : "";


    const title =
        bookTitle
            ? bookTitle.value.trim()
            : "";


    const authorValue =
        author
            ? author.value.trim()
            : "";


    const descriptionValue =
        description
            ? description.value.trim()
            : "";


    const selectedFile =
        bookFile &&
        bookFile.files &&
        bookFile.files.length
            ? bookFile.files[0]
            : null;


    const selectedCover =
        coverImage &&
        coverImage.files &&
        coverImage.files.length
            ? coverImage.files[0]
            : null;


    /* -----------------------------------------
       EXAM
       ----------------------------------------- */

    if (!examId) {

        showMessage(
            "Please select an exam.",
            "error"
        );

        examSelect.focus();

        return;

    }


    /* -----------------------------------------
       SUBJECT
       ----------------------------------------- */

    if (!subjectId) {

        showMessage(
            "Please select a subject from the selected exam.",
            "error"
        );

        subjectSelect.focus();

        return;

    }


    /* -----------------------------------------
       TITLE
       ----------------------------------------- */

    if (!title) {

        showMessage(
            "Book title is required.",
            "error"
        );

        bookTitle.focus();

        return;

    }


    /* -----------------------------------------
       AUTHOR
       ----------------------------------------- */

    if (!authorValue) {

        showMessage(
            "Book author is required.",
            "error"
        );

        author.focus();

        return;

    }


    /* -----------------------------------------
       FILE
       ----------------------------------------- */

    if (
        !editingResourceId &&
        !selectedFile
    ) {

        showMessage(
            "Please select a study book.",
            "error"
        );

        bookFile.focus();

        return;

    }


    /* -----------------------------------------
       BOOK FILE VALIDATION
       ----------------------------------------- */

    if (
        selectedFile &&
        !getBookFileType(selectedFile)
    ) {

        showMessage(
            "Supported study book types are PDF, DOCX, XLSX and CSV.",
            "error"
        );

        return;

    }


    /* -----------------------------------------
       COVER VALIDATION
       ----------------------------------------- */

    if (
        selectedCover &&
        !isAllowedCover(selectedCover)
    ) {

        showMessage(
            "Only JPG, PNG and WebP cover images are supported.",
            "error"
        );

        return;

    }


    const saveButton =
        document.querySelector(
            ".form-actions .btn-success"
        );


    const wasEditing =
        Boolean(editingResourceId);


    setButtonLoading(
        saveButton,
        true,
        wasEditing
            ? "Updating..."
            : "Uploading..."
    );


    try {

        let existing = null;


        /* -------------------------------------
           EXISTING RESOURCE
           ------------------------------------- */

        if (editingResourceId) {

            existing =
                resourcesCache.find(
                    resource =>
                        String(resource.id) ===
                        String(editingResourceId)
                );


            if (!existing) {

                throw new Error(
                    "Study resource could not be found."
                );

            }

        }


        /* -------------------------------------
           FILE URL
           ------------------------------------- */

        let fileUrl =
            existing
                ? existing.file_url || ""
                : "";


        /* -------------------------------------
           UPLOAD STUDY BOOK
           ------------------------------------- */

        if (selectedFile) {

            showMessage(
                "Preparing study book upload...",
                "success"
            );


            const uploaded =
                await uploadLargeFile(
                    selectedFile,
                    "document"
                );


            fileUrl =
                uploaded.object_key;

        }


        /* -------------------------------------
           COVER URL
           ------------------------------------- */

        let coverUrl =
            existing
                ? existing.cover_image || ""
                : "";


        /* -------------------------------------
           UPLOAD COVER
           ------------------------------------- */

        if (selectedCover) {

            showMessage(
                "Uploading book cover...",
                "success"
            );


            const uploadedCover =
                await uploadLargeFile(
                    selectedCover,
                    "cover"
                );


            coverUrl =
                uploadedCover.object_key;

        }


        /* -------------------------------------
           FILE TYPE
           ------------------------------------- */

        const fileType =
            selectedFile
                ? getBookFileType(selectedFile)
                : (
                    existing
                        ? existing.file_type
                        : ""
                );


        /* -------------------------------------
           PAYLOAD
           ------------------------------------- */

        const payload = {

            subject_id:
                subjectId,

            title:
                title,

            author:
                authorValue,

            description:
                descriptionValue,

            file_url:
                fileUrl,

            cover_image:
                coverUrl,

            file_type:
                fileType,

            status:
                existing
                    ? (
                        existing.status ||
                        "active"
                    )
                    : "active"

        };


        await submitResource(
            payload,
            editingResourceId
        );


    } catch (error) {

        console.error(
            "Save study resource failed:",
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
            wasEditing
                ? "Update Book"
                : "Save Book"
        );

    }

}


/* =========================================================
   LARGE FILE UPLOAD
   ========================================================= */

async function uploadLargeFile(
    file,
    uploadType
) {

    if (!file) {

        throw new Error(
            "No file selected."
        );

    }


    const contentType =
        file.type ||
        detectMimeType(
            file.name,
            uploadType
        );


    if (
        uploadType === "document" &&
        !getBookFileType(file)
    ) {

        throw new Error(
            "Unsupported study book file type."
        );

    }


    if (
        uploadType === "cover" &&
        !isAllowedCover(file)
    ) {

        throw new Error(
            "Unsupported cover image type."
        );

    }


    currentUpload = null;


    try {

        /* -------------------------------------
           INITIALIZE
           ------------------------------------- */

        showMessage(
            "Initializing upload...",
            "success"
        );


        const initResponse =
            await fetch(
                RESOURCE_API.uploadInit,
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body:
                        JSON.stringify({

                            upload_type:
                                uploadType,

                            file_name:
                                file.name,

                            content_type:
                                contentType

                        })

                }
            );


        const initialized =
            await parseResponse(
                initResponse
            );


        const uploadData =
            initialized.data;


        if (!uploadData) {

            throw new Error(
                "Upload initialization returned no upload information."
            );

        }


        const objectKey =
            uploadData.object_key;


        const r2UploadId =
            uploadData.r2_upload_id;


        if (
            !objectKey ||
            !r2UploadId
        ) {

            throw new Error(
                "Upload initialization is incomplete."
            );

        }


        currentUpload = {

            uploadType:
                uploadType,

            objectKey:
                objectKey,

            r2UploadId:
                r2UploadId

        };


        /* -------------------------------------
           CALCULATE PARTS
           ------------------------------------- */

        const totalParts =
            Math.max(
                1,
                Math.ceil(
                    file.size /
                    UPLOAD_PART_SIZE
                )
            );


        const completedParts = [];


        /* -------------------------------------
           UPLOAD PARTS
           ------------------------------------- */

        for (
            let partNumber = 1;
            partNumber <= totalParts;
            partNumber++
        ) {

            const start =
                (
                    partNumber - 1
                ) *
                UPLOAD_PART_SIZE;


            const end =
                Math.min(
                    start +
                    UPLOAD_PART_SIZE,
                    file.size
                );


            const chunk =
                file.slice(
                    start,
                    end
                );


            showMessage(
                `Uploading ${
                    uploadType === "document"
                        ? "study book"
                        : "cover"
                }: part ${partNumber} of ${totalParts}...`,
                "success"
            );


            const partResponse =
                await fetch(
                    RESOURCE_API.uploadPart,
                    {
                        method: "PUT",

                        headers: {

                            "X-Upload-Type":
                                uploadType,

                            "X-Object-Key":
                                objectKey,

                            "X-R2-Upload-Id":
                                r2UploadId,

                            "X-Part-Number":
                                String(partNumber)

                        },

                        body:
                            chunk

                    }
                );


            const partResult =
                await parseResponse(
                    partResponse
                );


            const partData =
                partResult.data;


            if (
                !partData ||
                !partData.etag
            ) {

                throw new Error(
                    `Upload part ${partNumber} did not return an ETag.`
                );

            }


            completedParts.push({

                part_number:
                    partNumber,

                etag:
                    partData.etag

            });

        }


        /* -------------------------------------
           COMPLETE
           ------------------------------------- */

        showMessage(
            "Finalizing upload...",
            "success"
        );


        const completeResponse =
            await fetch(
                RESOURCE_API.uploadComplete,
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body:
                        JSON.stringify({

                            upload_type:
                                uploadType,

                            object_key:
                                objectKey,

                            r2_upload_id:
                                r2UploadId,

                            parts:
                                completedParts

                        })

                }
            );


        const completed =
            await parseResponse(
                completeResponse
            );


        currentUpload = null;


        return {

            object_key:
                completed.data &&
                completed.data.object_key
                    ? completed.data.object_key
                    : objectKey,

            etag:
                completed.data &&
                completed.data.etag
                    ? completed.data.etag
                    : null

        };

    } catch (error) {

        if (currentUpload) {

            await abortUpload(
                currentUpload
            );

        }


        currentUpload = null;


        throw error;

    }

}


/* =========================================================
   ABORT UPLOAD
   ========================================================= */

async function abortUpload(upload) {

    try {

        await fetch(
            RESOURCE_API.uploadAbort,
            {
                method: "POST",

                headers: {
                    "Content-Type":
                        "application/json"
                },

                body:
                    JSON.stringify({

                        upload_type:
                            upload.uploadType,

                        object_key:
                            upload.objectKey,

                        r2_upload_id:
                            upload.r2UploadId

                    })

            }
        );

    } catch (error) {

        console.error(
            "Multipart upload abort failed:",
            error
        );

    }

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
            ? `${RESOURCE_API.resources}/${encodeURIComponent(resourceId)}`
            : RESOURCE_API.resources;


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
        await parseResponse(
            response
        );


    showMessage(
        result.message ||
        (
            resourceId
                ? "Study resource updated successfully."
                : "Study resource published successfully."
        ),
        "success"
    );


    clearForm();

    await loadResources();

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


    /* -----------------------------------------
       EXAM
       ----------------------------------------- */

    const examId =
        resource.exam_id || "";


    examSelect.value =
        examId;


    /* -----------------------------------------
       SUBJECTS COME FROM EXAM
       ----------------------------------------- */

    if (examId) {

        await loadSubjects(
            examId
        );

    }


    subjectSelect.value =
        resource.subject_id || "";


    bookTitle.value =
        resource.title || "";


    author.value =
        resource.author || "";


    description.value =
        resource.description || "";


    /* -----------------------------------------
       FILE INPUTS
       ----------------------------------------- */

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


    focusResourceForm(false);


    showMessage(
        "Editing selected study resource.",
        "success"
    );

}


/* =========================================================
   TOGGLE RESOURCE
   ========================================================= */

async function toggleResource(id) {

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


    const active =
        String(resource.status)
            .toLowerCase() ===
        "active";


    const newStatus =
        active
            ? "inactive"
            : "active";


    const confirmed =
        window.confirm(
            active
                ? "Deactivate this study resource?"
                : "Activate this study resource?"
        );


    if (!confirmed) {

        return;

    }


    try {

        const response =
            await fetch(
                `${RESOURCE_API.resources}/${encodeURIComponent(id)}/status`,
                {
                    method: "PATCH",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body:
                        JSON.stringify({
                            status:
                                newStatus
                        })

                }
            );


        const result =
            await parseResponse(
                response
            );


        showMessage(
            result.message ||
            "Study resource status updated.",
            "success"
        );


        await loadResources();

    } catch (error) {

        console.error(
            "Toggle resource failed:",
            error
        );


        showMessage(
            error.message ||
            "Failed to update study resource status.",
            "error"
        );

    }

}


/* =========================================================
   CLEAR FORM
   ========================================================= */

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


    if (bookFile) {

        bookFile.value = "";

    }


    if (coverImage) {

        coverImage.value = "";

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


    if (addResourceBtn) {

        addResourceBtn.innerHTML = `
            <i class="fas fa-plus"></i>
            Add New Book
        `;

    }


    clearValidation();

}


/* =========================================================
   FOCUS RESOURCE FORM
   ========================================================= */

function focusResourceForm(
    clear = true
) {

    if (clear) {

        clearForm();

    }


    if (examSelect) {

        examSelect.focus();

    }

}


/* =========================================================
   BOOK FILE CHANGE
   ========================================================= */

function handleBookFileChange() {

    const file =
        bookFile &&
        bookFile.files &&
        bookFile.files.length
            ? bookFile.files[0]
            : null;


    if (!file) {

        return;

    }


    if (!getBookFileType(file)) {

        bookFile.value = "";


        showMessage(
            "Supported study book types are PDF, DOCX, XLSX and CSV.",
            "error"
        );

    }

    /*
     * NO FILE SIZE CHECK.
     *
     * A large book is allowed.
     */

}


/* =========================================================
   COVER CHANGE
   ========================================================= */

function handleCoverChange() {

    const file =
        coverImage &&
        coverImage.files &&
        coverImage.files.length
            ? coverImage.files[0]
            : null;


    if (!file) {

        return;

    }


    if (!isAllowedCover(file)) {

        coverImage.value = "";


        showMessage(
            "Only JPG, PNG and WebP cover images are supported.",
            "error"
        );

    }

}


/* =========================================================
   BOOK FILE TYPE
   ========================================================= */

function getBookFileType(file) {

    if (!file) {

        return null;

    }


    const mime =
        String(
            file.type || ""
        )
        .trim()
        .toLowerCase();


    if (BOOK_TYPES[mime]) {

        return BOOK_TYPES[mime];

    }


    const name =
        String(
            file.name || ""
        )
        .trim()
        .toLowerCase();


    if (name.endsWith(".pdf")) {

        return "pdf";

    }


    if (name.endsWith(".docx")) {

        return "docx";

    }


    if (name.endsWith(".xlsx")) {

        return "xlsx";

    }


    if (name.endsWith(".csv")) {

        return "csv";

    }


    return null;

}


/* =========================================================
   MIME DETECTION
   ========================================================= */

function detectMimeType(
    fileName,
    uploadType
) {

    if (uploadType === "cover") {

        const name =
            String(
                fileName || ""
            )
            .toLowerCase();


        if (name.endsWith(".png")) {

            return "image/png";

        }


        if (name.endsWith(".webp")) {

            return "image/webp";

        }


        return "image/jpeg";

    }


    const type =
        getExtension(
            fileName
        );


    if (type === "pdf") {

        return "application/pdf";

    }


    if (type === "docx") {

        return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

    }


    if (type === "xlsx") {

        return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

    }


    if (type === "csv") {

        return "text/csv";

    }


    return "application/octet-stream";

}


/* =========================================================
   EXTENSION
   ========================================================= */

function getExtension(fileName) {

    const name =
        String(
            fileName || ""
        )
        .toLowerCase();


    const index =
        name.lastIndexOf(".");


    if (index === -1) {

        return "";

    }


    return name
        .slice(index + 1);

}


/* =========================================================
   COVER VALIDATION
   ========================================================= */

function isAllowedCover(file) {

    if (!file) {

        return false;

    }


    const mime =
        String(
            file.type || ""
        )
        .toLowerCase();


    if (
        [
            "image/jpeg",
            "image/png",
            "image/webp"
        ].includes(mime)
    ) {

        return true;

    }


    const extension =
        getExtension(
            file.name
        );


    return [
        "jpg",
        "jpeg",
        "png",
        "webp"
    ].includes(
        extension
    );

}


/* =========================================================
   RESET SUBJECT
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

    if (!resourcesTableBody) {

        return;

    }


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


/* =========================================================
   SELECT ERROR
   ========================================================= */

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


    button.innerHTML =
        loading

            ? `
                <i class="fas fa-spinner fa-spin"></i>
                ${escapeHtml(text)}
              `

            : `
                <i class="fas fa-save"></i>
                ${escapeHtml(text)}
              `;

}


/* =========================================================
   VALIDATION CLEAR
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

                if (
                    container &&
                    container.parentNode
                ) {

                    container.remove();

                }

            },
            5000
        );

}


/* =========================================================
   HTML ESCAPING
   ========================================================= */

function escapeHtml(value) {

    return String(
        value ?? ""
    )
    .replaceAll(
        "&",
        "&amp;"
    )
    .replaceAll(
        "<",
        "&lt;"
    )
    .replaceAll(
        ">",
        "&gt;"
    )
    .replaceAll(
        '"',
        "&quot;"
    )
    .replaceAll(
        "'",
        "&#039;"
    );

}


/* =========================================================
   ATTRIBUTE ESCAPING
   ========================================================= */

function escapeAttribute(value) {

    return escapeHtml(value);

}