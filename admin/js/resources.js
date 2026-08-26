"use strict";

/* =========================================================
   NURSEPHERE ADMIN
   STUDY RESOURCE MANAGEMENT
   =========================================================
   
   HTML ELEMENTS USED:

   #examSelect
   #subjectSelect
   #bookTitle
   #author
   #description
   #coverImage
   #bookFile
   #addResourceBtn
   .form-actions .btn-success
   .form-actions .btn-secondary
   #resourcesTableBody

   FEATURES:

   - Load active exams
   - Load active subjects by exam
   - Add new study book
   - Upload PDF to private R2 DOCUMENTS
   - Upload cover to R2 IMAGES
   - Multipart uploads for large files
   - NO APPLICATION FILE-SIZE LIMIT
   - Publish resource to D1
   - Edit resource metadata
   - Replace PDF
   - Replace cover
   - Activate / deactivate
   - Soft delete
   - Refresh library
   - Safe HTML escaping
   - Upload failure cleanup
   ========================================================= */


/* =========================================================
   CONFIGURATION
   ========================================================= */

const RESOURCE_UPLOAD_ENDPOINT =
    "/api/admin/resources/upload";

const RESOURCE_API_ENDPOINT =
    "/api/admin/resources";

/*
 * 10 MiB parts.

 * This is NOT a file-size limit.
 *
 * It is simply the size of each individual
 * multipart request sent to the Worker.
 *
 * The complete book can therefore be much larger.
 */
const MULTIPART_CHUNK_SIZE =
    10 * 1024 * 1024;


/* =========================================================
   STATE
   ========================================================= */

let editingResourceId = null;

let resourcesCache = [];

let isSaving = false;


/* =========================================================
   DOM ELEMENTS
   ========================================================= */

const examSelect =
    document.getElementById(
        "examSelect"
    );

const subjectSelect =
    document.getElementById(
        "subjectSelect"
    );

const bookTitle =
    document.getElementById(
        "bookTitle"
    );

const author =
    document.getElementById(
        "author"
    );

const description =
    document.getElementById(
        "description"
    );

const coverImage =
    document.getElementById(
        "coverImage"
    );

const bookFile =
    document.getElementById(
        "bookFile"
    );

const resourcesTableBody =
    document.getElementById(
        "resourcesTableBody"
    );

const addResourceBtn =
    document.getElementById(
        "addResourceBtn"
    );

const saveButton =
    document.querySelector(
        ".form-actions .btn-success"
    );

const clearButton =
    document.querySelector(
        ".form-actions .btn-secondary"
    );


/* =========================================================
   INITIALIZATION
   ========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    initializePage
);


async function initializePage() {

    try {

        verifyRequiredElements();

        bindEvents();

        await loadExams();

        await loadResources();

    } catch (error) {

        console.error(
            "Study Resource initialization failed:",
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
   VERIFY HTML
   ========================================================= */

function verifyRequiredElements() {

    const requiredElements = [

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
        requiredElements
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
        focusResourceForm
    );


    saveButton.addEventListener(
        "click",
        handleSaveResource
    );


    clearButton.addEventListener(
        "click",
        handleClear
    );


    /*
     * Event delegation for table actions.
     */
    resourcesTableBody.addEventListener(
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


    try {

        const response =
            await fetch(
                "/api/admin/exams"
            );


        const result =
            await parseResponse(
                response
            );


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
                    exam.status ===
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
        examSelect.value;


    if (!examId) {

        return;

    }


    await loadSubjects(
        examId
    );

}


/* =========================================================
   LOAD SUBJECTS
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
                `/api/admin/subjects?exam_id=${encodeURIComponent(
                    examId
                )}`
            );


        const result =
            await parseResponse(
                response
            );


        let subjects =
            Array.isArray(result.data)
                ? result.data
                : [];


        /*
         * Client-side protection:
         * only show subjects belonging
         * to selected exam and active subjects.
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

                    subject.status ===
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


        showMessage(
            error.message ||
            "Failed to load subjects.",
            "error"
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
                RESOURCE_API_ENDPOINT
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
   RENDER RESOURCE TABLE
   ========================================================= */

function renderResources() {

    if (
        !resourcesCache.length
    ) {

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
   RESOURCE TABLE ROW
   ========================================================= */

function createResourceRow(
    resource,
    index
) {

    const title =
        resource.title ||
        "Untitled Book";


    const authorName =
        resource.author ||
        "—";


    const examName =
        resource.exam_name ||
        "—";


    const subjectName =
        resource.subject_name ||
        "—";


    const status =
        resource.status ===
        "active";


    const cover =
        resource.cover_image
            ? `
                <img
                    src="${escapeAttribute(
                        resource.cover_image
                    )}"
                    alt="${escapeAttribute(
                        title
                    )}"
                    class="resource-cover"
                    loading="lazy"
                >
            `
            : `
                <div
                    class="resource-cover-placeholder"
                    aria-label="No cover image"
                >
                    <i
                        class="fas fa-book"
                        aria-hidden="true"
                    ></i>
                </div>
            `;


    return `
        <tr>

            <td>
                ${cover}
            </td>

            <td>

                <strong>
                    ${escapeHtml(title)}
                </strong>

                <br>

                ${
                    status
                        ? `
                            <span
                                class="status-active"
                            >
                                Active
                            </span>
                        `
                        : `
                            <span
                                class="status-inactive"
                            >
                                Inactive
                            </span>
                        `
                }

            </td>

            <td>
                ${escapeHtml(examName)}
            </td>

            <td>
                ${escapeHtml(subjectName)}
            </td>

            <td>
                ${escapeHtml(authorName)}
            </td>

            <td>

                <div
                    class="resource-actions"
                >

                    <button
                        type="button"
                        class="btn btn-sm btn-secondary"
                        data-action="edit"
                        data-id="${escapeAttribute(
                            resource.id
                        )}"
                    >
                        <i
                            class="fas fa-pen"
                            aria-hidden="true"
                        ></i>

                        Edit
                    </button>


                    <button
                        type="button"
                        class="btn btn-sm ${
                            status
                                ? "btn-danger"
                                : "btn-success"
                        }"
                        data-action="toggle"
                        data-id="${escapeAttribute(
                            resource.id
                        )}"
                    >

                        <i
                            class="fas ${
                                status
                                    ? "fa-ban"
                                    : "fa-check"
                            }"
                            aria-hidden="true"
                        ></i>

                        ${
                            status
                                ? "Deactivate"
                                : "Activate"
                        }

                    </button>


                    <button
                        type="button"
                        class="btn btn-sm btn-danger"
                        data-action="delete"
                        data-id="${escapeAttribute(
                            resource.id
                        )}"
                    >

                        <i
                            class="fas fa-trash"
                            aria-hidden="true"
                        ></i>

                        Delete

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


    const resourceId =
        button.dataset.id;


    if (!resourceId) {

        return;

    }


    if (
        action ===
        "edit"
    ) {

        await editResource(
            resourceId
        );

        return;

    }


    if (
        action ===
        "toggle"
    ) {

        await toggleResource(
            resourceId
        );

        return;

    }


    if (
        action ===
        "delete"
    ) {

        await deleteResource(
            resourceId
        );

    }

}


/* =========================================================
   SAVE RESOURCE
   ========================================================= */

async function handleSaveResource() {

    if (isSaving) {

        return;

    }


    clearValidation();


    const subjectId =
        subjectSelect.value.trim();


    const title =
        bookTitle.value.trim();


    const authorName =
        author.value.trim();


    const descriptionText =
        description.value.trim();


    const selectedBook =
        bookFile.files[0] ||
        null;


    const selectedCover =
        coverImage.files[0] ||
        null;


    /* -----------------------------------------
       BASIC VALIDATION
       ----------------------------------------- */

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


    if (!authorName) {

        showMessage(
            "Book author is required.",
            "error"
        );

        author.focus();

        return;

    }


    /*
     * New resource requires a book.
     *
     * Existing resource may keep its
     * current PDF.
     */
    if (
        !editingResourceId &&
        !selectedBook
    ) {

        showMessage(
            "Please select the PDF book.",
            "error"
        );

        bookFile.focus();

        return;

    }


    if (
        selectedBook &&
        !isPdfFile(
            selectedBook
        )
    ) {

        showMessage(
            "Only PDF books are supported.",
            "error"
        );

        return;

    }


    if (
        selectedCover &&
        !isSupportedCover(
            selectedCover
        )
    ) {

        showMessage(
            "Cover must be JPG, PNG or WebP.",
            "error"
        );

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
            "The resource being edited could not be found.",
            "error"
        );

        return;

    }


    isSaving = true;


    const originalButtonHTML =
        saveButton.innerHTML;


    try {

        setSaveButton(
            true,
            selectedBook
                ? "Preparing upload..."
                : "Saving..."
        );


        let fileKey =
            existing?.file_url ||
            "";


        let coverKey =
            existing?.cover_image ||
            "";


        /*
         * -----------------------------------------
         * UPLOAD PDF
         * -----------------------------------------
         */

        if (selectedBook) {

            const upload =
                await uploadFileToR2(
                    selectedBook,
                    "document",
                    progress =>
                        setSaveButton(
                            true,
                            `Uploading book ${progress}%...`
                        )
                );


            fileKey =
                upload.object_key;

        }


        /*
         * -----------------------------------------
         * UPLOAD COVER
         * -----------------------------------------
         */

        if (selectedCover) {

            const upload =
                await uploadFileToR2(
                    selectedCover,
                    "cover",
                    progress =>
                        setSaveButton(
                            true,
                            `Uploading cover ${progress}%...`
                        )
                );


            coverKey =
                upload.object_key;

        }


        /*
         * -----------------------------------------
         * FINAL DATABASE PUBLISH
         * -----------------------------------------
         */

        setSaveButton(
            true,
            editingResourceId
                ? "Publishing update..."
                : "Publishing book..."
        );


        const payload = {

            subject_id:
                subjectId,

            title:
                title,

            author:
                authorName,

            description:
                descriptionText,

            file_url:
                fileKey,

            cover_image:
                coverKey,

            file_type:
                "pdf",

            status:
                existing?.status ||
                "active"

        };


        const resourceId =
            editingResourceId;


        const response =
            await fetch(
                resourceId
                    ? `${RESOURCE_API_ENDPOINT}/${encodeURIComponent(
                        resourceId
                    )}`
                    : RESOURCE_API_ENDPOINT,
                {
                    method:
                        resourceId
                            ? "PUT"
                            : "POST",

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
            "Save/publish study resource failed:",
            error
        );


        showMessage(
            error.message ||
            "Failed to publish the study book.",
            "error"
        );


    } finally {

        isSaving = false;

        saveButton.innerHTML =
            originalButtonHTML;

        saveButton.disabled =
            false;

    }

}


/* =========================================================
   R2 FILE UPLOAD
   ========================================================= */

async function uploadFileToR2(
    file,
    uploadType,
    onProgress
) {

    let uploadState =
        null;


    try {

        /*
         * -----------------------------------------
         * INITIALIZE MULTIPART UPLOAD
         * -----------------------------------------
         */

        const initResponse =
            await fetch(
                `${RESOURCE_UPLOAD_ENDPOINT}/init`,
                {
                    method:
                        "POST",

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
                                getContentType(
                                    file,
                                    uploadType
                                )

                        })
                }
            );


        const initResult =
            await parseResponse(
                initResponse
            );


        uploadState =
            initResult.data;


        if (
            !uploadState ||
            !uploadState.object_key ||
            !uploadState.r2_upload_id
        ) {

            throw new Error(
                "The server did not return a valid R2 upload session."
            );

        }


        /*
         * -----------------------------------------
         * SPLIT INTO PARTS
         * -----------------------------------------
         */

        const totalParts =
            Math.max(
                1,
                Math.ceil(
                    file.size /
                    MULTIPART_CHUNK_SIZE
                )
            );


        const parts = [];


        /*
         * -----------------------------------------
         * UPLOAD EACH PART
         * -----------------------------------------
         */

        for (
            let index = 0;
            index < totalParts;
            index++
        ) {

            const partNumber =
                index + 1;


            const start =
                index *
                MULTIPART_CHUNK_SIZE;


            const end =
                Math.min(
                    start +
                    MULTIPART_CHUNK_SIZE,
                    file.size
                );


            const chunk =
                file.slice(
                    start,
                    end
                );


            const partResponse =
                await fetch(
                    `${RESOURCE_UPLOAD_ENDPOINT}/part`,
                    {
                        method:
                            "PUT",

                        headers: {

                            "Content-Type":
                                "application/octet-stream",

                            "X-Upload-Type":
                                uploadType,

                            "X-Object-Key":
                                uploadState.object_key,

                            "X-R2-Upload-Id":
                                uploadState.r2_upload_id,

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
                    `R2 did not return an ETag for upload part ${partNumber}.`
                );

            }


            parts.push({

                part_number:
                    partNumber,

                etag:
                    partData.etag

            });


            const progress =
                Math.round(
                    (
                        partNumber /
                        totalParts
                    ) *
                    100
                );


            if (
                typeof onProgress ===
                "function"
            ) {

                onProgress(
                    progress
                );

            }

        }


        /*
         * -----------------------------------------
         * COMPLETE MULTIPART UPLOAD
         * -----------------------------------------
         */

        if (
            typeof onProgress ===
            "function"
        ) {

            onProgress(
                100
            );

        }


        const completeResponse =
            await fetch(
                `${RESOURCE_UPLOAD_ENDPOINT}/complete`,
                {
                    method:
                        "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body:
                        JSON.stringify({

                            upload_type:
                                uploadType,

                            object_key:
                                uploadState.object_key,

                            r2_upload_id:
                                uploadState.r2_upload_id,

                            parts:
                                parts

                        })
                }
            );


        const completeResult =
            await parseResponse(
                completeResponse
            );


        if (
            !completeResult.data ||
            !completeResult.data.object_key
        ) {

            throw new Error(
                "R2 upload completed without a storage key."
            );

        }


        return {

            object_key:
                completeResult.data.object_key,

            etag:
                completeResult.data.etag ||
                null

        };


    } catch (error) {

        /*
         * -----------------------------------------
         * CLEAN UP FAILED MULTIPART UPLOAD
         * -----------------------------------------
         */

        if (
            uploadState &&
            uploadState.object_key &&
            uploadState.r2_upload_id
        ) {

            await abortR2Upload(
                uploadType,
                uploadState.object_key,
                uploadState.r2_upload_id
            );

        }


        throw error;

    }

}


/* =========================================================
   ABORT R2 UPLOAD
   ========================================================= */

async function abortR2Upload(
    uploadType,
    objectKey,
    r2UploadId
) {

    try {

        await fetch(
            `${RESOURCE_UPLOAD_ENDPOINT}/abort`,
            {
                method:
                    "POST",

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
                            r2UploadId

                    })
            }
        );

    } catch (error) {

        console.error(
            "R2 upload cleanup failed:",
            error
        );

    }

}


/* =========================================================
   FILE VALIDATION
   ========================================================= */

function handleBookFileChange() {

    clearValidation();


    const file =
        bookFile.files[0];


    if (!file) {

        return;

    }


    if (
        !isPdfFile(
            file
        )
    ) {

        bookFile.value =
            "";

        showMessage(
            "Only PDF books are supported.",
            "error"
        );

        return;

    }


    /*
     * IMPORTANT:
     *
     * There is intentionally NO
     * file-size restriction here.
     */

    showMessage(
        `Book selected: ${file.name} (${formatFileSize(file.size)})`,
        "success"
    );

}


function handleCoverChange() {

    clearValidation();


    const file =
        coverImage.files[0];


    if (!file) {

        return;

    }


    if (
        !isSupportedCover(
            file
        )
    ) {

        coverImage.value =
            "";

        showMessage(
            "Cover must be JPG, PNG or WebP.",
            "error"
        );

        return;

    }


    showMessage(
        `Cover selected: ${file.name}`,
        "success"
    );

}


function isPdfFile(
    file
) {

    if (!file) {

        return false;

    }


    const name =
        String(
            file.name ||
            ""
        ).toLowerCase();


    return (
        file.type ===
        "application/pdf"
    ) ||
    name.endsWith(
        ".pdf"
    );

}


function isSupportedCover(
    file
) {

    if (!file) {

        return false;

    }


    const allowed =
        [
            "image/jpeg",
            "image/png",
            "image/webp"
        ];


    return allowed.includes(
        file.type
    );

}


/* =========================================================
   CONTENT TYPE
   ========================================================= */

function getContentType(
    file,
    uploadType
) {

    if (
        uploadType ===
        "document"
    ) {

        return "application/pdf";

    }


    if (
        file.type
    ) {

        return file.type;

    }


    return "application/octet-stream";

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
     * Exam is derived from
     * the resource's subject.
     */

    examSelect.value =
        resource.exam_id ||
        "";


    await loadSubjects(
        resource.exam_id
    );


    subjectSelect.value =
        resource.subject_id ||
        "";


    bookTitle.value =
        resource.title ||
        "";


    author.value =
        resource.author ||
        "";


    description.value =
        resource.description ||
        "";


    /*
     * Browser security prevents us
     * from placing an existing file
     * into <input type="file">.
     *
     * Leaving it empty means:
     * keep existing PDF unless a
     * replacement is selected.
     */

    bookFile.value =
        "";


    coverImage.value =
        "";


    saveButton.innerHTML = `
        <i
            class="fas fa-save"
            aria-hidden="true"
        ></i>

        Update Book
    `;


    showMessage(
        "Editing selected study resource. Select a new PDF or cover only if you want to replace it.",
        "success"
    );


    /*
     * Put the form near the top
     * of the visible page.
     */

    const detailsCard =
        document.querySelector(
            ".content-card"
        );


    if (
        detailsCard &&
        typeof detailsCard.scrollIntoView ===
        "function"
    ) {

        detailsCard.scrollIntoView({
            behavior:
                "smooth",
            block:
                "start"
        });

    }

}


/* =========================================================
   TOGGLE ACTIVE / INACTIVE
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
        resource.status ===
        "active"
            ? "inactive"
            : "active";


    const confirmed =
        window.confirm(
            newStatus ===
            "inactive"
                ? "Deactivate this study book? Students will no longer see it as active."
                : "Activate this study book?"
        );


    if (!confirmed) {

        return;

    }


    try {

        const response =
            await fetch(
                `${RESOURCE_API_ENDPOINT}/${encodeURIComponent(
                    id
                )}/status`,
                {
                    method:
                        "PATCH",

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
            "Failed to update resource status.",
            "error"
        );

    }

}


/* =========================================================
   SOFT DELETE
   ========================================================= */

async function deleteResource(
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


    const confirmed =
        window.confirm(
            `Deactivate "${resource.title || "this study book"}"?`
        );


    if (!confirmed) {

        return;

    }


    try {

        const response =
            await fetch(
                `${RESOURCE_API_ENDPOINT}/${encodeURIComponent(
                    id
                )}`,
                {
                    method:
                        "DELETE"
                }
            );


        const result =
            await parseResponse(
                response
            );


        showMessage(
            result.message ||
            "Study resource deactivated successfully.",
            "success"
        );


        await loadResources();


    } catch (error) {

        console.error(
            "Delete resource failed:",
            error
        );


        showMessage(
            error.message ||
            "Failed to deactivate study resource.",
            "error"
        );

    }

}


/* =========================================================
   CLEAR FORM
   ========================================================= */

function handleClear(
    event
) {

    if (event) {

        event.preventDefault();

    }


    clearForm();

}


function clearForm() {

    editingResourceId =
        null;


    examSelect.value =
        "";


    resetSubjectSelect();


    bookTitle.value =
        "";


    author.value =
        "";


    description.value =
        "";


    coverImage.value =
        "";


    bookFile.value =
        "";


    saveButton.disabled =
        false;


    saveButton.innerHTML = `
        <i
            class="fas fa-save"
            aria-hidden="true"
        ></i>

        Save Book
    `;


    clearValidation();

}


/* =========================================================
   ADD NEW BOOK
   ========================================================= */

function focusResourceForm(
    event
) {

    if (event) {

        event.preventDefault();

    }


    if (isSaving) {

        return;

    }


    clearForm();


    examSelect.focus();


    const detailsCard =
        document.querySelector(
            ".content-card"
        );


    if (
        detailsCard &&
        typeof detailsCard.scrollIntoView ===
        "function"
    ) {

        detailsCard.scrollIntoView({
            behavior:
                "smooth",
            block:
                "start"
        });

    }

}


/* =========================================================
   RESET SUBJECT
   ========================================================= */

function resetSubjectSelect() {

    subjectSelect.innerHTML = `
        <option value="">
            Select Subject
        </option>
    `;

}


/* =========================================================
   RESPONSE PARSER
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
        result?.success === false
    ) {

        throw new Error(
            result?.message ||
            `Request failed (${response.status}).`
        );

    }


    return result;

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


    select.disabled =
        true;

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


    select.disabled =
        false;

}


/* =========================================================
   RE-ENABLE SELECT
   ========================================================= */

function enableSelect(
    select
) {

    if (!select) {

        return;

    }


    select.disabled =
        false;

}


/* =========================================================
   PATCH SELECT STATE
   ========================================================= */

const originalLoadExams =
    loadExams;


/*
 * Re-enable exam after loading.
 */
loadExams = async function () {

    try {

        await originalLoadExams();

    } finally {

        enableSelect(
            examSelect
        );

    }

};


/*
 * Re-enable subject after loading.
 */
const originalLoadSubjects =
    loadSubjects;


loadSubjects = async function (
    examId
) {

    try {

        await originalLoadSubjects(
            examId
        );

    } finally {

        enableSelect(
            subjectSelect
        );

    }

};


/* =========================================================
   TABLE LOADING
   ========================================================= */

function setTableLoading() {

    resourcesTableBody.innerHTML = `
        <tr>
            <td colspan="6">
                <i
                    class="fas fa-spinner fa-spin"
                    aria-hidden="true"
                ></i>

                Loading study resources...
            </td>
        </tr>
    `;

}


/* =========================================================
   SAVE BUTTON STATE
   ========================================================= */

function setSaveButton(
    loading,
    text
) {

    saveButton.disabled =
        loading;


    if (loading) {

        saveButton.innerHTML = `
            <i
                class="fas fa-spinner fa-spin"
                aria-hidden="true"
            ></i>

            ${escapeHtml(text)}
        `;

        return;

    }


    saveButton.innerHTML = `
        <i
            class="fas fa-save"
            aria-hidden="true"
        ></i>

        ${escapeHtml(text)}
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
   MESSAGE SYSTEM
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
            6000
        );

}


/* =========================================================
   FILE SIZE FORMATTER
   ========================================================= */

function formatFileSize(
    bytes
) {

    if (
        !Number.isFinite(
            bytes
        ) ||
        bytes <= 0
    ) {

        return "0 B";

    }


    const units =
        [
            "B",
            "KB",
            "MB",
            "GB",
            "TB"
        ];


    const exponent =
        Math.min(
            Math.floor(
                Math.log(
                    bytes
                ) /
                Math.log(
                    1024
                )
            ),
            units.length - 1
        );


    const value =
        bytes /
        Math.pow(
            1024,
            exponent
        );


    return `${value.toFixed(
        exponent === 0
            ? 0
            : 2
    )} ${units[exponent]}`;

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


function escapeAttribute(
    value
) {

    return escapeHtml(
        value
    );

}


/* =========================================================
   END
   ========================================================= */