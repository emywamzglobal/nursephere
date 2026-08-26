"use strict";

/* =========================================================
   NURSEPHERE ADMIN
   STUDY RESOURCE MANAGEMENT
   FINAL FRONTEND
   =========================================================

   Supports:
   - Active exams
   - Subjects filtered by selected exam
   - Study books:
       PDF
       DOCX
       XLSX
       CSV
   - Book covers:
       JPG
       PNG
       WEBP
   - Large multipart R2 uploads
   - NO APPLICATION FILE-SIZE LIMIT
   - Create
   - Edit
   - Replace book file
   - Replace cover
   - Activate / deactivate
   - Safe rendering
   - Upload failure cleanup

   API endpoints:
   GET    /api/admin/exams
   GET    /api/admin/subjects?exam_id=...
   GET    /api/admin/resources
   POST   /api/admin/resources
   PUT    /api/admin/resources/:id
   PATCH  /api/admin/resources/:id/status

   Multipart:
   POST   /api/admin/resources/upload/init
   PUT    /api/admin/resources/upload/part
   POST   /api/admin/resources/upload/complete
   POST   /api/admin/resources/upload/abort
   ========================================================= */


/* =========================================================
   API
   ========================================================= */

const API = {

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
        "/api/admin/resources/upload/abort"

};


/* =========================================================
   UPLOAD CONFIGURATION
   =========================================================

   10 MiB is the size of EACH multipart part.

   This is NOT a file-size limit.

   A 10 MiB part can be repeated thousands of times.
   ========================================================= */

const UPLOAD_PART_SIZE =
    10 * 1024 * 1024;


/* =========================================================
   ALLOWED BOOK TYPES
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
   EXTENSION FALLBACKS
   ========================================================= */

const BOOK_EXTENSIONS = {

    ".pdf":
        "pdf",

    ".docx":
        "docx",

    ".xlsx":
        "xlsx",

    ".csv":
        "csv"

};


/* =========================================================
   COVER TYPES
   ========================================================= */

const COVER_TYPES = {

    "image/jpeg":
        true,

    "image/png":
        true,

    "image/webp":
        true

};


/* =========================================================
   STATE
   ========================================================= */

let editingResourceId =
    null;

let resourcesCache =
    [];

let currentUpload =
    null;

let isSaving =
    false;


/* =========================================================
   DOM ELEMENTS
   ========================================================= */

let examSelect;
let subjectSelect;
let bookTitle;
let author;
let description;
let coverImage;
let bookFile;
let resourcesTableBody;
let addResourceBtn;
let saveButton;
let clearButton;


/* =========================================================
   INITIALIZATION
   ========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    initializePage
);


async function initializePage() {

    try {

        cacheDomElements();

        verifyRequiredElements();

        bindEvents();

        await loadExams();

        await loadResources();

    } catch (error) {

        console.error(
            "Study Resources initialization failed:",
            error
        );

        showMessage(
            error.message ||
            "Failed to initialize Study Resources.",
            "error"
        );

    }

}


/* =========================================================
   CACHE DOM
   ========================================================= */

function cacheDomElements() {

    examSelect =
        document.getElementById(
            "examSelect"
        );

    subjectSelect =
        document.getElementById(
            "subjectSelect"
        );

    bookTitle =
        document.getElementById(
            "bookTitle"
        );

    author =
        document.getElementById(
            "author"
        );

    description =
        document.getElementById(
            "description"
        );

    coverImage =
        document.getElementById(
            "coverImage"
        );

    bookFile =
        document.getElementById(
            "bookFile"
        );

    resourcesTableBody =
        document.getElementById(
            "resourcesTableBody"
        );

    addResourceBtn =
        document.getElementById(
            "addResourceBtn"
        );

    saveButton =
        document.querySelector(
            ".form-actions .btn-success"
        );

    clearButton =
        document.querySelector(
            ".form-actions .btn-secondary"
        );

}


/* =========================================================
   VERIFY HTML
   ========================================================= */

function verifyRequiredElements() {

    const required = [

        ["examSelect", examSelect],

        ["subjectSelect", subjectSelect],

        ["bookTitle", bookTitle],

        ["author", author],

        ["description", description],

        ["coverImage", coverImage],

        ["bookFile", bookFile],

        ["resourcesTableBody", resourcesTableBody],

        ["addResourceBtn", addResourceBtn],

        ["saveButton", saveButton],

        ["clearButton", clearButton]

    ];


    const missing =
        required
            .filter(
                ([, element]) =>
                    !element
            )
            .map(
                ([name]) =>
                    name
            );


    if (missing.length) {

        throw new Error(
            "Study Resources page is missing required HTML elements: " +
            missing.join(", ")
        );

    }

}


/* =========================================================
   EVENT BINDING
   ========================================================= */

function bindEvents() {

    examSelect.addEventListener(
        "change",
        handleExamChange
    );


    subjectSelect.addEventListener(
        "change",
        clearValidation
    );


    bookTitle.addEventListener(
        "input",
        clearValidation
    );


    author.addEventListener(
        "input",
        clearValidation
    );


    description.addEventListener(
        "input",
        clearValidation
    );


    bookFile.addEventListener(
        "change",
        handleBookFileChange
    );


    coverImage.addEventListener(
        "change",
        handleCoverChange
    );


    addResourceBtn.addEventListener(
        "click",
        handleAddNewBook
    );


    saveButton.addEventListener(
        "click",
        handleSaveResource
    );


    clearButton.addEventListener(
        "click",
        handleClear
    );


    resourcesTableBody.addEventListener(
        "click",
        handleTableAction
    );

}


/* =========================================================
   ADD NEW BOOK
   ========================================================= */

function handleAddNewBook(event) {

    if (event) {

        event.preventDefault();

    }

    clearForm();

    examSelect.focus();

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
                API.exams,
                {
                    method: "GET",
                    cache: "no-store"
                }
            );


        const result =
            await parseResponse(
                response
            );


        const exams =
            Array.isArray(
                result.data
            )
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
                    String(
                        exam.status
                    ).toLowerCase() ===
                    "active"
            )
            .forEach(
                exam => {

                    const option =
                        document.createElement(
                            "option"
                        );


                    option.value =
                        String(
                            exam.id
                        );


                    option.textContent =
                        exam.name ||
                        "Unnamed Exam";


                    examSelect.appendChild(
                        option
                    );

                }
            );


    } catch (error) {

        console.error(
            "Load exams failed:",
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

    clearValidation();

    resetSubjectSelect();


    const examId =
        String(
            examSelect.value ||
            ""
        ).trim();


    if (!examId) {

        return;

    }


    await loadSubjects(
        examId
    );

}


/* =========================================================
   LOAD SUBJECTS FOR EXAM
   ========================================================= */

async function loadSubjects(
    examId
) {

    setSelectLoading(
        subjectSelect,
        "Loading Subjects..."
    );


    try {

        const response =
            await fetch(
                `${API.subjects}?exam_id=${encodeURIComponent(examId)}`,
                {
                    method: "GET",
                    cache: "no-store"
                }
            );


        const result =
            await parseResponse(
                response
            );


        let subjects =
            Array.isArray(
                result.data
            )
                ? result.data
                : [];


        /*
         * Double-check the relationship client-side.
         *
         * The selected subject MUST belong to the
         * selected exam.
         */

        subjects =
            subjects.filter(
                subject =>

                    String(
                        subject.exam_id
                    ) ===
                    String(
                        examId
                    ) &&

                    String(
                        subject.status
                    ).toLowerCase() ===
                    "active"
            );


        subjectSelect.innerHTML = `
            <option value="">
                Select Subject
            </option>
        `;


        subjects.forEach(
            subject => {

                const option =
                    document.createElement(
                        "option"
                    );


                option.value =
                    String(
                        subject.id
                    );


                option.textContent =
                    subject.name ||
                    "Unnamed Subject";


                subjectSelect.appendChild(
                    option
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
                API.resources,
                {
                    method: "GET",
                    cache: "no-store"
                }
            );


        const result =
            await parseResponse(
                response
            );


        resourcesCache =
            Array.isArray(
                result.data
            )
                ? result.data
                : [];


        renderResources();


    } catch (error) {

        console.error(
            "Load resources failed:",
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
   RENDER RESOURCES
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
                (
                    resource,
                    index
                ) =>
                    createResourceRow(
                        resource,
                        index
                    )
            )
            .join("");

}


/* =========================================================
   RESOURCE ROW
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
                    alt="${escapeAttribute(
                        resource.title ||
                        "Book cover"
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
        resource.status === "active"

            ? `
                <span class="status-active">
                    Active
                </span>
            `

            : `
                <span class="status-inactive">
                    Inactive
                </span>
            `;


    const fileType =
        normalizeFileType(
            resource.file_type
        );


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

                ${
                    fileType
                        ? `
                            <small>
                                ${escapeHtml(
                                    fileType.toUpperCase()
                                )}
                            </small>
                          `
                        : ""
                }

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

                    ${
                        resource.file_url
                            ? `
                                <a
                                    href="${escapeAttribute(
                                        resource.file_url
                                    )}"
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
                        data-id="${escapeAttribute(
                            resource.id
                        )}"
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
                        data-id="${escapeAttribute(
                            resource.id
                        )}"
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

async function handleTableAction(
    event
) {

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


    if (
        action ===
        "edit"
    ) {

        await editResource(
            id
        );

        return;

    }


    if (
        action ===
        "toggle"
    ) {

        await toggleResource(
            id
        );

    }

}


/* =========================================================
   SAVE RESOURCE
   ========================================================= */

async function handleSaveResource(
    event
) {

    if (event) {

        event.preventDefault();

    }


    if (isSaving) {

        return;

    }


    clearValidation();


    const examId =
        String(
            examSelect.value ||
            ""
        ).trim();


    const subjectId =
        String(
            subjectSelect.value ||
            ""
        ).trim();


    const title =
        String(
            bookTitle.value ||
            ""
        ).trim();


    const authorValue =
        String(
            author.value ||
            ""
        ).trim();


    const descriptionValue =
        String(
            description.value ||
            ""
        ).trim();


    const selectedFile =
        bookFile.files &&
        bookFile.files.length
            ? bookFile.files[0]
            : null;


    const selectedCover =
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
            "Please select a subject.",
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
       NEW RESOURCE MUST HAVE FILE
       ----------------------------------------- */

    if (
        !editingResourceId &&
        !selectedFile
    ) {

        showMessage(
            "Please select the study book.",
            "error"
        );

        bookFile.focus();

        return;

    }


    /* -----------------------------------------
       VALIDATE BOOK FILE
       ----------------------------------------- */

    if (
        selectedFile &&
        !getBookFileType(
            selectedFile
        )
    ) {

        showMessage(
            "Only PDF, DOCX, XLSX and CSV study books are supported.",
            "error"
        );

        bookFile.focus();

        return;

    }


    /* -----------------------------------------
       VALIDATE COVER
       ----------------------------------------- */

    if (
        selectedCover &&
        !isAllowedCover(
            selectedCover
        )
    ) {

        showMessage(
            "Only JPG, PNG and WebP cover images are supported.",
            "error"
        );

        coverImage.focus();

        return;

    }


    const existing =
        editingResourceId
            ? resourcesCache.find(
                resource =>
                    String(
                        resource.id
                    ) ===
                    String(
                        editingResourceId
                    )
              )
            : null;


    if (
        editingResourceId &&
        !existing
    ) {

        showMessage(
            "Study resource could not be found.",
            "error"
        );

        return;

    }


    isSaving =
        true;


    setButtonLoading(
        saveButton,
        true,
        editingResourceId
            ? "Updating..."
            : "Uploading..."
    );


    try {

        /* -----------------------------------------
           EXISTING FILE
           ----------------------------------------- */

        let fileUrl =
            existing
                ? existing.file_url || ""
                : "";


        let fileType =
            existing
                ? normalizeFileType(
                    existing.file_type
                  )
                : "";


        /* -----------------------------------------
           UPLOAD BOOK
           ----------------------------------------- */

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


            fileType =
                getBookFileType(
                    selectedFile
                );

        }


        /* -----------------------------------------
           UPLOAD COVER
           ----------------------------------------- */

        let coverUrl =
            existing
                ? existing.cover_image || ""
                : "";


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


        /* -----------------------------------------
           SAFETY CHECK
           ----------------------------------------- */

        if (!fileUrl) {

            throw new Error(
                "The study book has not been uploaded."
            );

        }


        if (!fileType) {

            throw new Error(
                "The study book file type could not be determined."
            );

        }


        /* -----------------------------------------
           D1 PAYLOAD
           ----------------------------------------- */

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


        /* -----------------------------------------
           SAVE D1
           ----------------------------------------- */

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

        isSaving =
            false;


        setButtonLoading(
            saveButton,
            false,
            editingResourceId
                ? "Update Book"
                : "Save Book"
        );

    }

}


/* =========================================================
   LARGE FILE MULTIPART UPLOAD
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
        getFallbackMimeType(
            file.name,
            uploadType
        );


    let uploadInfo =
        null;


    try {

        /* -----------------------------------------
           INITIALIZE
           ----------------------------------------- */

        showMessage(
            "Initializing file upload...",
            "success"
        );


        const initResponse =
            await fetch(
                API.uploadInit,
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


        const initResult =
            await parseResponse(
                initResponse
            );


        uploadInfo =
            initResult.data;


        if (!uploadInfo) {

            throw new Error(
                "Upload initialization returned no upload information."
            );

        }


        const objectKey =
            uploadInfo.object_key;


        const r2UploadId =
            uploadInfo.r2_upload_id;


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


        /* -----------------------------------------
           PART COUNT
           ----------------------------------------- */

        const totalParts =
            Math.ceil(
                file.size /
                UPLOAD_PART_SIZE
            );


        if (totalParts < 1) {

            throw new Error(
                "Selected file is empty."
            );

        }


        const completedParts =
            [];


        /* -----------------------------------------
           UPLOAD PARTS
           ----------------------------------------- */

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
                        : "book cover"
                }: part ${partNumber} of ${totalParts}...`,
                "success"
            );


            const partResponse =
                await fetch(
                    API.uploadPart,
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
                                String(
                                    partNumber
                                )

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


        /* -----------------------------------------
           COMPLETE
           ----------------------------------------- */

        showMessage(
            "Finalizing file upload...",
            "success"
        );


        const completeResponse =
            await fetch(
                API.uploadComplete,
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


        const completeResult =
            await parseResponse(
                completeResponse
            );


        const completedData =
            completeResult.data || {};


        currentUpload =
            null;


        return {

            object_key:
                completedData.object_key ||
                objectKey,

            etag:
                completedData.etag ||
                null

        };


    } catch (error) {

        if (currentUpload) {

            await abortUpload(
                currentUpload
            );

        }


        currentUpload =
            null;


        throw error;

    }

}


/* =========================================================
   ABORT MULTIPART UPLOAD
   ========================================================= */

async function abortUpload(
    upload
) {

    try {

        await fetch(
            API.uploadAbort,
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
   SUBMIT RESOURCE TO D1
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

            ? `${API.resources}/${encodeURIComponent(
                resourceId
              )}`

            : API.resources;


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
                        JSON.stringify(
                            payload
                        )

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
                    : "Study book published successfully."
            ),
            "success"
        );


        clearForm();

        await loadResources();


    } catch (error) {

        console.error(
            "Submit resource failed:",
            error
        );

        throw error;

    }

}


/* =========================================================
   EDIT RESOURCE
   ========================================================= */

async function editResource(
    id
) {

    const resource =
        resourcesCache.find(
            item =>
                String(
                    item.id
                ) ===
                String(
                    id
                )
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


    /*
     * Restore the exam first.
     */

    examSelect.value =
        resource.exam_id || "";


    /*
     * Then load subjects belonging
     * to that exam.
     */

    if (resource.exam_id) {

        await loadSubjects(
            resource.exam_id
        );

    }


    /*
     * Then restore the subject.
     */

    subjectSelect.value =
        resource.subject_id || "";


    bookTitle.value =
        resource.title || "";


    author.value =
        resource.author || "";


    description.value =
        resource.description || "";


    /*
     * Browser security prevents us from
     * placing an existing R2 object into
     * a file input.
     *
     * Empty means:
     * keep existing file unless replacement
     * is selected.
     */

    bookFile.value =
        "";


    coverImage.value =
        "";


    saveButton.innerHTML = `
        <i class="fas fa-save"></i>
        Update Book
    `;


    addResourceBtn.innerHTML = `
        <i class="fas fa-plus"></i>
        Add New Book
    `;


    /*
     * DO NOT call clearForm() here.
     *
     * clearForm() intentionally destroys
     * editingResourceId.
     */

    focusResourceForm(
        false
    );


    showMessage(
        "Editing selected study resource.",
        "success"
    );

}


/* =========================================================
   FOCUS FORM
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
   TOGGLE STATUS
   ========================================================= */

async function toggleResource(
    id
) {

    const resource =
        resourcesCache.find(
            item =>
                String(
                    item.id
                ) ===
                String(
                    id
                )
        );


    if (!resource) {

        showMessage(
            "Study resource not found.",
            "error"
        );

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
                `${API.resources}/${encodeURIComponent(
                    id
                )}/status`,
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
            "Resource status updated.",
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
            "Failed to update resource status.",
            "error"
        );

    }

}


/* =========================================================
   CLEAR
   ========================================================= */

function handleClear(
    event
) {

    if (event) {

        event.preventDefault();

    }


    clearForm();

}


/* =========================================================
   CLEAR FORM
   ========================================================= */

function clearForm() {

    editingResourceId =
        null;


    if (examSelect) {

        examSelect.value =
            "";

    }


    resetSubjectSelect();


    if (bookTitle) {

        bookTitle.value =
            "";

    }


    if (author) {

        author.value =
            "";

    }


    if (description) {

        description.value =
            "";

    }


    if (coverImage) {

        coverImage.value =
            "";

    }


    if (bookFile) {

        bookFile.value =
            "";

    }


    if (saveButton) {

        saveButton.disabled =
            false;


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
   BOOK FILE CHANGE
   ========================================================= */

function handleBookFileChange() {

    const file =
        bookFile.files &&
        bookFile.files.length
            ? bookFile.files[0]
            : null;


    if (!file) {

        return;

    }


    const fileType =
        getBookFileType(
            file
        );


    if (!fileType) {

        bookFile.value =
            "";


        showMessage(
            "Only PDF, DOCX, XLSX and CSV study books are supported.",
            "error"
        );

        return;

    }


    showMessage(
        `Selected ${fileType.toUpperCase()} study book: ${file.name}`,
        "success"
    );

}


/* =========================================================
   COVER CHANGE
   ========================================================= */

function handleCoverChange() {

    const file =
        coverImage.files &&
        coverImage.files.length
            ? coverImage.files[0]
            : null;


    if (!file) {

        return;

    }


    if (
        !isAllowedCover(
            file
        )
    ) {

        coverImage.value =
            "";


        showMessage(
            "Only JPG, PNG and WebP cover images are supported.",
            "error"
        );

        return;

    }


    showMessage(
        `Selected cover: ${file.name}`,
        "success"
    );

}


/* =========================================================
   DETERMINE BOOK TYPE
   ========================================================= */

function getBookFileType(
    file
) {

    if (!file) {

        return null;

    }


    const mime =
        String(
            file.type ||
            ""
        )
        .trim()
        .toLowerCase();


    if (
        BOOK_TYPES[mime]
    ) {

        return BOOK_TYPES[mime];

    }


    const name =
        String(
            file.name ||
            ""
        )
        .trim()
        .toLowerCase();


    for (
        const extension
        of Object.keys(
            BOOK_EXTENSIONS
        )
    ) {

        if (
            name.endsWith(
                extension
            )
        ) {

            return BOOK_EXTENSIONS[
                extension
            ];

        }

    }


    return null;

}


/* =========================================================
   FALLBACK MIME TYPE
   ========================================================= */

function getFallbackMimeType(
    fileName,
    uploadType
) {

    if (
        uploadType ===
        "cover"
    ) {

        return "image/jpeg";

    }


    const name =
        String(
            fileName ||
            ""
        )
        .toLowerCase();


    if (
        name.endsWith(".pdf")
    ) {

        return "application/pdf";

    }


    if (
        name.endsWith(".docx")
    ) {

        return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

    }


    if (
        name.endsWith(".xlsx")
    ) {

        return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

    }


    if (
        name.endsWith(".csv")
    ) {

        return "text/csv";

    }


    return "application/octet-stream";

}


/* =========================================================
   COVER VALIDATION
   ========================================================= */

function isAllowedCover(
    file
) {

    if (!file) {

        return false;

    }


    const mime =
        String(
            file.type ||
            ""
        )
        .trim()
        .toLowerCase();


    return Boolean(
        COVER_TYPES[mime]
    );

}


/* =========================================================
   NORMALIZE FILE TYPE
   ========================================================= */

function normalizeFileType(
    value
) {

    return String(
        value ??
        ""
    )
    .trim()
    .toLowerCase()
    .replace(
        /^\./,
        ""
    );

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

async function parseResponse(
    response
) {

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
            ${escapeHtml(
                message
            )}
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
            ${escapeHtml(
                message
            )}
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
                ${escapeHtml(
                    text
                )}
              `

            : `
                <i class="fas fa-save"></i>
                ${escapeHtml(
                    text
                )}
              `;

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

        } else {

            document.body.prepend(
                container
            );

        }

    }


    container.className =
        `resource-message ${type}`;


    container.textContent =
        String(
            message ||
            ""
        );


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

function escapeHtml(
    value
) {

    return String(
        value ??
        ""
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

function escapeAttribute(
    value
) {

    return escapeHtml(
        value
    );

}