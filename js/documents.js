/*=========================================================
        NURSEPHERE STUDENT DOCUMENTS
        FRONTEND JAVASCRIPT
=========================================================*/

"use strict";


/*=========================================================
        API CONFIGURATION
=========================================================*/

const DOCUMENTS_API_BASE =
    "https://nursephere.wamalwaemily.workers.dev/api";


/*=========================================================
        SESSION
=========================================================*/

const studentToken =
    localStorage.getItem("studentToken");


/*=========================================================
        DOM ELEMENTS
=========================================================*/

const documentUpload =
    document.getElementById(
        "documentUpload"
    );


const uploadArea =
    document.querySelector(
        ".upload-area"
    );


const documentsList =
    document.querySelector(
        ".documents-list"
    );


const emptyState =
    document.querySelector(
        ".empty-state"
    );


const receiptsSection =
    document.querySelector(
        ".receipts-section"
    );


/*=========================================================
        INITIALISE
=========================================================*/

document.addEventListener(
    "DOMContentLoaded",
    () => {

        initialiseDocumentsPage();

    }
);


/*=========================================================
        PAGE INITIALISATION
=========================================================*/

async function initialiseDocumentsPage() {

    if (!studentToken) {

        showAuthenticationRequired();

        return;

    }


    configureUploadInput();

    configureDragAndDrop();


    await loadDocuments();

}


/*=========================================================
        API HEADERS
=========================================================*/

function getAuthHeaders() {

    return {

        "Authorization":
            `Bearer ${studentToken}`

    };

}


/*=========================================================
        LOAD DOCUMENTS
=========================================================*/

async function loadDocuments() {

    setDocumentsLoading();


    try {

        const response =
            await fetch(

                `${DOCUMENTS_API_BASE}/documents`,

                {

                    method: "GET",

                    headers:
                        getAuthHeaders()

                }

            );


        /*---------------------------------------------
                ACCESS DENIED
        ---------------------------------------------*/

        if (
            response.status === 403
        ) {

            showDocumentsLocked();

            return;

        }


        /*---------------------------------------------
                SESSION INVALID
        ---------------------------------------------*/

        if (
            response.status === 401
        ) {

            showAuthenticationRequired();

            return;

        }


        const data =
            await response.json();


        if (
            !response.ok ||
            !data.success
        ) {

            throw new Error(

                data.message ||
                "Unable to load documents."

            );

        }


        /*---------------------------------------------
                ACCESS GRANTED
        ---------------------------------------------*/

        showDocumentsInterface(
            data
        );


        renderDocuments(
            data.documents || []
        );


    }

    catch (error) {

        console.error(
            "DOCUMENTS LOAD ERROR:",
            error
        );


        showDocumentsError(
            "We couldn't load your documents. Please try again."
        );

    }

}


/*=========================================================
        SHOW LOADING STATE
=========================================================*/

function setDocumentsLoading() {

    if (!documentsList) {

        return;

    }


    const heading =
        documentsList.querySelector(
            "h3"
        );


    if (heading) {

        heading.textContent =
            "Uploaded Documents";

    }


    if (emptyState) {

        emptyState.textContent =
            "Loading your documents...";

        emptyState.style.display =
            "block";

    }

}


/*=========================================================
        SHOW DOCUMENTS INTERFACE
=========================================================*/

function showDocumentsInterface(
    data
) {

    if (uploadArea) {

        uploadArea.style.display =
            "";

    }


    if (documentsList) {

        documentsList.style.display =
            "";

    }


    if (receiptsSection) {

        receiptsSection.style.display =
            "";

    }


    if (emptyState) {

        emptyState.style.display =
            "block";

    }


    configureUploadAccess(
        data.access_level
    );

}


/*=========================================================
        ACCESS LEVEL
=========================================================*/

function configureUploadAccess(
    accessLevel
) {

    const level =
        String(
            accessLevel || "none"
        )
        .trim()
        .toLowerCase();


    /*
        full = upload/delete/download/view

        download = download/view

        view = view only

        none = no access
    */


    if (
        level === "full"
    ) {

        enableUpload();

        return;

    }


    disableUpload();


    /*
        If the backend grants only view/download,
        the frontend still displays existing documents.
    */

}


/*=========================================================
        ENABLE UPLOAD
=========================================================*/

function enableUpload() {

    if (!uploadArea) {

        return;

    }


    uploadArea.classList.remove(
        "documents-upload-disabled"
    );


    if (documentUpload) {

        documentUpload.disabled =
            false;

    }

}


/*=========================================================
        DISABLE UPLOAD
=========================================================*/

function disableUpload() {

    if (uploadArea) {

        uploadArea.classList.add(
            "documents-upload-disabled"
        );

    }


    if (documentUpload) {

        documentUpload.disabled =
            true;

    }


    const uploadButton =
        uploadArea?.querySelector(
            ".upload-btn"
        );


    if (uploadButton) {

        uploadButton.disabled =
            true;

        uploadButton.title =
            "Document upload is not available for this subscription.";

    }

}


/*=========================================================
        CONFIGURE FILE INPUT
=========================================================*/

function configureUploadInput() {

    if (!documentUpload) {

        return;

    }


    documentUpload.addEventListener(
        "change",
        async function () {

            const files =
                Array.from(
                    this.files || []
                );


            if (!files.length) {

                return;

            }


            await uploadDocuments(
                files
            );


            this.value =
                "";

        }
    );

}


/*=========================================================
        DRAG AND DROP
=========================================================*/

function configureDragAndDrop() {

    if (!uploadArea) {

        return;

    }


    uploadArea.addEventListener(
        "dragover",
        function (event) {

            event.preventDefault();

            uploadArea.classList.add(
                "drag-active"
            );

        }
    );


    uploadArea.addEventListener(
        "dragleave",
        function () {

            uploadArea.classList.remove(
                "drag-active"
            );

        }
    );


    uploadArea.addEventListener(
        "drop",
        async function (event) {

            event.preventDefault();


            uploadArea.classList.remove(
                "drag-active"
            );


            if (
                documentUpload?.disabled
            ) {

                return;

            }


            const files =
                Array.from(
                    event.dataTransfer.files || []
                );


            if (!files.length) {

                return;

            }


            await uploadDocuments(
                files
            );

        }
    );

}


/*=========================================================
        UPLOAD DOCUMENTS
=========================================================*/

async function uploadDocuments(
    files
) {

    if (!files.length) {

        return;

    }


    setUploadBusy(
        true
    );


    try {

        for (
            const file of files
        ) {

            await uploadSingleDocument(
                file
            );

        }


        await loadDocuments();


        showUploadSuccess(
            files.length
        );


    }

    catch (error) {

        console.error(
            "DOCUMENT UPLOAD ERROR:",
            error
        );


        alert(
            error.message ||
            "Unable to upload the document."
        );

    }

    finally {

        setUploadBusy(
            false
        );

    }

}


/*=========================================================
        UPLOAD ONE DOCUMENT
=========================================================*/

async function uploadSingleDocument(
    file
) {

    const formData =
        new FormData();


    formData.append(
        "file",
        file
    );


    const response =
        await fetch(

            `${DOCUMENTS_API_BASE}/documents`,

            {

                method: "POST",

                headers:
                    getAuthHeaders(),

                body:
                    formData

            }

        );


    if (
        response.status === 403
    ) {

        throw new Error(
            "Document upload is not available for your current subscription."
        );

    }


    if (
        response.status === 401
    ) {

        throw new Error(
            "Your session has expired. Please log in again."
        );

    }


    const data =
        await response.json();


    if (
        !response.ok ||
        !data.success
    ) {

        throw new Error(

            data.message ||
            `Unable to upload ${file.name}.`

        );

    }


    return data;

}


/*=========================================================
        UPLOAD BUSY STATE
=========================================================*/

function setUploadBusy(
    busy
) {

    const uploadButton =
        uploadArea?.querySelector(
            ".upload-btn"
        );


    if (!uploadButton) {

        return;

    }


    if (busy) {

        uploadButton.disabled =
            true;

        uploadButton.dataset.originalText =
            uploadButton.innerHTML;

        uploadButton.innerHTML =
            `
                <i class="fas fa-spinner fa-spin"></i>
                Uploading...
            `;

    }

    else {

        uploadButton.disabled =
            false;

        if (
            uploadButton.dataset.originalText
        ) {

            uploadButton.innerHTML =
                uploadButton.dataset.originalText;

        }

    }

}


/*=========================================================
        RENDER DOCUMENTS
=========================================================*/

function renderDocuments(
    documents
) {

    if (!documentsList) {

        return;

    }


    let heading =
        documentsList.querySelector(
            "h3"
        );


    if (!heading) {

        heading =
            document.createElement(
                "h3"
            );

        documentsList.prepend(
            heading
        );

    }


    heading.textContent =
        "Uploaded Documents";


    const existingItems =
        documentsList.querySelectorAll(
            ".document-item"
        );


    existingItems.forEach(
        item => item.remove()
    );


    if (!documents.length) {

        if (emptyState) {

            emptyState.textContent =
                "You haven't uploaded any documents yet.";

            emptyState.style.display =
                "block";

        }

        return;

    }


    if (emptyState) {

        emptyState.style.display =
            "none";

    }


    documents.forEach(
        documentData => {

            const item =
                createDocumentElement(
                    documentData
                );


            documentsList.appendChild(
                item
            );

        }
    );

}


/*=========================================================
        CREATE DOCUMENT ELEMENT
=========================================================*/

function createDocumentElement(
    documentData
) {

    const item =
        document.createElement(
            "div"
        );


    item.className =
        "document-item";


    item.dataset.documentId =
        documentData.id || "";


    const icon =
        document.createElement(
            "div"
        );


    icon.className =
        "document-icon";


    icon.innerHTML =
        getDocumentIcon(
            documentData.file_type
        );


    const details =
        document.createElement(
            "div"
        );


    details.className =
        "document-details";


    const name =
        document.createElement(
            "h4"
        );


    name.textContent =
        documentData.file_name ||
        "Untitled document";


    const meta =
        document.createElement(
            "p"
        );


    meta.textContent =
        formatDocumentMeta(
            documentData
        );


    details.appendChild(
        name
    );

    details.appendChild(
        meta
    );


    const actions =
        document.createElement(
            "div"
        );


    actions.className =
        "document-actions";


    /*
        Download
    */

    const downloadButton =
        document.createElement(
            "button"
        );


    downloadButton.type =
        "button";


    downloadButton.className =
        "document-download-btn";


    downloadButton.innerHTML =
        `
            <i class="fas fa-download"></i>
            Download
        `;


    downloadButton.addEventListener(
        "click",
        () => {

            downloadDocument(
                documentData.id
            );

        }
    );


    actions.appendChild(
        downloadButton
    );


    /*
        Delete
    */

    const deleteButton =
        document.createElement(
            "button"
        );


    deleteButton.type =
        "button";


    deleteButton.className =
        "document-delete-btn";


    deleteButton.innerHTML =
        `
            <i class="fas fa-trash"></i>
            Delete
        `;


    deleteButton.addEventListener(
        "click",
        () => {

            deleteDocument(
                documentData.id
            );

        }
    );


    actions.appendChild(
        deleteButton
    );


    item.appendChild(
        icon
    );


    item.appendChild(
        details
    );


    item.appendChild(
        actions
    );


    return item;

}


/*=========================================================
        DOCUMENT ICON
=========================================================*/

function getDocumentIcon(
    fileType
) {

    const type =
        String(
            fileType || ""
        )
        .toLowerCase();


    if (
        type.includes("pdf")
    ) {

        return `
            <i class="fas fa-file-pdf"></i>
        `;

    }


    if (
        type.includes("word") ||
        type.includes("document")
    ) {

        return `
            <i class="fas fa-file-word"></i>
        `;

    }


    if (
        type.includes("excel") ||
        type.includes("spreadsheet") ||
        type.includes("sheet")
    ) {

        return `
            <i class="fas fa-file-excel"></i>
        `;

    }


    if (
        type.startsWith("image/")
    ) {

        return `
            <i class="fas fa-file-image"></i>
        `;

    }


    if (
        type.startsWith("video/")
    ) {

        return `
            <i class="fas fa-file-video"></i>
        `;

    }


    if (
        type.startsWith("audio/")
    ) {

        return `
            <i class="fas fa-file-audio"></i>
        `;

    }


    return `
        <i class="fas fa-file"></i>
    `;

}


/*=========================================================
        DOCUMENT META
=========================================================*/

function formatDocumentMeta(
    documentData
) {

    const size =
        formatFileSize(
            documentData.file_size
        );


    const date =
        formatDate(
            documentData.created_at
        );


    const parts = [];


    if (size) {

        parts.push(
            size
        );

    }


    if (date) {

        parts.push(
            date
        );

    }


    return parts.join(
        " • "
    );

}


/*=========================================================
        FILE SIZE
=========================================================*/

function formatFileSize(
    bytes
) {

    const size =
        Number(bytes);


    if (
        !Number.isFinite(size) ||
        size <= 0
    ) {

        return "";

    }


    const units = [
        "Bytes",
        "KB",
        "MB",
        "GB"
    ];


    const exponent =
        Math.min(

            Math.floor(
                Math.log(size) /
                Math.log(1024)
            ),

            units.length - 1

        );


    const value =
        size /
        Math.pow(
            1024,
            exponent
        );


    return `${value.toFixed(
        exponent === 0 ? 0 : 1
    )} ${units[exponent]}`;

}


/*=========================================================
        DATE
=========================================================*/

function formatDate(
    value
) {

    if (!value) {

        return "";

    }


    const date =
        new Date(
            value
        );


    if (
        Number.isNaN(
            date.getTime()
        )
    ) {

        return "";

    }


    return date.toLocaleDateString(
        undefined,
        {

            year:
                "numeric",

            month:
                "short",

            day:
                "numeric"

        }
    );

}


/*=========================================================
        DOWNLOAD DOCUMENT
=========================================================*/

async function downloadDocument(
    documentId
) {

    if (!documentId) {

        return;

    }


    try {

        const response =
            await fetch(

                `${DOCUMENTS_API_BASE}/documents/download?id=${encodeURIComponent(documentId)}`,

                {

                    method: "GET",

                    headers:
                        getAuthHeaders()

                }

            );


        if (
            response.status === 403
        ) {

            alert(
                "You do not have permission to download this document."
            );

            return;

        }


        if (
            response.status === 401
        ) {

            alert(
                "Your session has expired. Please log in again."
            );

            return;

        }


        if (
            !response.ok
        ) {

            let message =
                "Unable to download the document.";

            try {

                const data =
                    await response.json();

                message =
                    data.message ||
                    message;

            }

            catch (
                ignored
            ) {}

            throw new Error(
                message
            );

        }


        const blob =
            await response.blob();


        const disposition =
            response.headers.get(
                "Content-Disposition"
            );


        let fileName =
            "document";


        if (disposition) {

            const match =
                disposition.match(
                    /filename="([^"]+)"/i
                );


            if (match) {

                fileName =
                    match[1];

            }

        }


        const objectUrl =
            URL.createObjectURL(
                blob
            );


        const link =
            document.createElement(
                "a"
            );


        link.href =
            objectUrl;


        link.download =
            fileName;


        document.body.appendChild(
            link
        );


        link.click();


        link.remove();


        URL.revokeObjectURL(
            objectUrl
        );

    }

    catch (error) {

        console.error(
            "DOCUMENT DOWNLOAD ERROR:",
            error
        );


        alert(
            error.message ||
            "Unable to download the document."
        );

    }

}


/*=========================================================
        DELETE DOCUMENT
=========================================================*/

async function deleteDocument(
    documentId
) {

    if (!documentId) {

        return;

    }


    const confirmed =
        window.confirm(
            "Are you sure you want to delete this document?"
        );


    if (!confirmed) {

        return;

    }


    try {

        const response =
            await fetch(

                `${DOCUMENTS_API_BASE}/documents?id=${encodeURIComponent(documentId)}`,

                {

                    method: "DELETE",

                    headers:
                        getAuthHeaders()

                }

            );


        if (
            response.status === 403
        ) {

            alert(
                "You do not have permission to delete documents."
            );

            return;

        }


        if (
            response.status === 401
        ) {

            alert(
                "Your session has expired. Please log in again."
            );

            return;

        }


        const data =
            await response.json();


        if (
            !response.ok ||
            !data.success
        ) {

            throw new Error(

                data.message ||
                "Unable to delete the document."

            );

        }


        await loadDocuments();

    }

    catch (error) {

        console.error(
            "DOCUMENT DELETE ERROR:",
            error
        );


        alert(
            error.message ||
            "Unable to delete the document."
        );

    }

}


/*=========================================================
        LOCKED DOCUMENTS STATE
=========================================================*/

function showDocumentsLocked() {

    if (uploadArea) {

        uploadArea.style.display =
            "none";

    }


    if (documentsList) {

        documentsList.style.display =
            "none";

    }


    /*
        Keep the page itself open.
        We do NOT redirect to checkout.
    */

    const existingNotice =
        document.getElementById(
            "documentsAccessNotice"
        );


    if (existingNotice) {

        existingNotice.remove();

    }


    const notice =
        document.createElement(
            "section"
        );


    notice.id =
        "documentsAccessNotice";


    notice.className =
        "documents-access-notice";


    notice.innerHTML =
        `
            <div class="documents-lock-icon">

                <i class="fas fa-lock"></i>

            </div>

            <h2>
                Documents Are Locked
            </h2>

            <p>
                Secure document storage and payment
                receipt access are available with
                an eligible premium subscription.
            </p>

            <a
                href="../pricing.html"
                class="documents-upgrade-btn"
            >
                <i class="fas fa-crown"></i>
                Upgrade Plan
            </a>
        `;


    const main =
        document.querySelector(
            ".dashboard-content"
        );


    if (main) {

        main.appendChild(
            notice
        );

    }


    /*
        Receipts are also protected.
    */

    if (receiptsSection) {

        receiptsSection.style.display =
            "none";

    }

}


/*=========================================================
        AUTHENTICATION REQUIRED
=========================================================*/

function showAuthenticationRequired() {

    if (uploadArea) {

        uploadArea.style.display =
            "none";

    }


    if (documentsList) {

        documentsList.style.display =
            "none";

    }


    if (receiptsSection) {

        receiptsSection.style.display =
            "none";

    }


    const main =
        document.querySelector(
            ".dashboard-content"
        );


    if (!main) {

        return;

    }


    const notice =
        document.createElement(
            "section"
        );


    notice.className =
        "documents-access-notice";


    notice.innerHTML =
        `
            <div class="documents-lock-icon">

                <i class="fas fa-lock"></i>

            </div>

            <h2>
                Please Sign In
            </h2>

            <p>
                Your student session is required
                to access Documents.
            </p>

            <a
                href="../login.html"
                class="documents-upgrade-btn"
            >
                Sign In
            </a>
        `;


    main.appendChild(
        notice
    );

}


/*=========================================================
        GENERAL ERROR STATE
=========================================================*/

function showDocumentsError(
    message
) {

    if (uploadArea) {

        uploadArea.style.display =
            "none";

    }


    if (documentsList) {

        documentsList.style.display =
            "";

    }


    if (emptyState) {

        emptyState.textContent =
            message;

        emptyState.style.display =
            "block";

    }

}


/*=========================================================
        UPLOAD SUCCESS
=========================================================*/

function showUploadSuccess(
    count
) {

    if (!uploadArea) {

        return;

    }


    const message =
        count === 1
            ? "Document uploaded successfully."
            : `${count} documents uploaded successfully.`;


    const existing =
        uploadArea.querySelector(
            ".upload-success-message"
        );


    if (existing) {

        existing.remove();

    }


    const success =
        document.createElement(
            "p"
        );


    success.className =
        "upload-success-message";


    success.textContent =
        message;


    uploadArea.appendChild(
        success
    );


    window.setTimeout(
        () => {

            success.remove();

        },
        4000
    );

}