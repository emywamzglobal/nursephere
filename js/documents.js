/*
=========================================================
    NurseSphere Student Documents Controller
    File: js/documents.js

    Responsibilities:
    - JWT authentication
    - Annual-plan access check
    - Document upload
    - Document listing
    - Document download
    - Document deletion
    - Upgrade display for non-Annual students
=========================================================
*/

"use strict";

(() => {

    /*=========================================================
        API CONFIGURATION
    =========================================================*/

    const API_BASE =
        "https://nursephere.wamalwaemily.workers.dev/api";


    /*=========================================================
        STUDENT SESSION
    =========================================================*/

    const studentToken =
        localStorage.getItem("studentToken");


    /*=========================================================
        DOM ELEMENTS
    =========================================================*/

    const documentUpload =
        document.getElementById("documentUpload");

    const documentsList =
        document.querySelector(".documents-list");

    const uploadArea =
        document.querySelector(".upload-area");

    const receiptsSection =
        document.querySelector(".receipts-section");


    /*=========================================================
        SESSION
    =========================================================*/

    function redirectToLogin() {

        window.location.href =
            "../login.html";

    }


    function requireAuthentication() {

        if (!studentToken) {

            redirectToLogin();

            return false;

        }

        return true;

    }


    /*=========================================================
        ANNUAL LOCK
    =========================================================*/

    function showUpgradeRequired() {

        if (uploadArea) {

            uploadArea.style.display =
                "none";

        }


        if (documentsList) {

            documentsList.innerHTML = `

                <div class="documents-upgrade">

                    <div class="upgrade-icon">

                        <i class="fas fa-lock"></i>

                    </div>

                    <h3>

                        Documents Are Available
                        on the Annual Plan

                    </h3>

                    <p>

                        Store, manage and access
                        your personal nursing study
                        materials from your account.

                    </p>

                    <a
                        href="../checkout.html?plan=yearly"
                        class="upload-btn">

                        <i class="fas fa-crown"></i>

                        Upgrade to Annual Plan

                    </a>

                </div>

            `;

        }

    }


    /*=========================================================
        LOADING
    =========================================================*/

    function showLoading() {

        if (!documentsList) {
            return;
        }


        documentsList.innerHTML = `

            <h3>

                Uploaded Documents

            </h3>

            <p class="empty-state">

                Loading your documents...

            </p>

        `;

    }


    /*=========================================================
        ERROR
    =========================================================*/

    function showError(message) {

        if (!documentsList) {
            return;
        }


        documentsList.innerHTML = `

            <h3>

                Uploaded Documents

            </h3>

            <p class="empty-state">

                ${message}

            </p>

        `;

    }


    /*=========================================================
        FORMAT FILE SIZE
    =========================================================*/

    function formatFileSize(bytes) {

        const size =
            Number(bytes);


        if (!size) {

            return "0 KB";

        }


        if (
            size <
            1024
        ) {

            return `${size} B`;

        }


        if (
            size <
            1024 * 1024
        ) {

            return `${(
                size / 1024
            ).toFixed(1)} KB`;

        }


        return `${(
            size /
            (1024 * 1024)
        ).toFixed(1)} MB`;

    }


    /*=========================================================
        ESCAPE HTML
    =========================================================*/

    function escapeHtml(value) {

        return String(
            value ?? ""
        )
            .replace(
                /&/g,
                "&amp;"
            )
            .replace(
                /</g,
                "&lt;"
            )
            .replace(
                />/g,
                "&gt;"
            )
            .replace(
                /"/g,
                "&quot;"
            )
            .replace(
                /'/g,
                "&#039;"
            );

    }


    /*=========================================================
        FILE ICON
    =========================================================*/

    function getFileIcon(type) {

        if (
            type ===
            "application/pdf"
        ) {

            return "fa-file-pdf";

        }


        if (
            type.includes("word") ||
            type.includes("document")
        ) {

            return "fa-file-word";

        }


        if (
            type.includes("presentation") ||
            type.includes("powerpoint")
        ) {

            return "fa-file-powerpoint";

        }


        if (
            type.startsWith("image/")
        ) {

            return "fa-file-image";

        }


        if (
            type.includes("text")
        ) {

            return "fa-file-lines";

        }


        return "fa-file";

    }


    /*=========================================================
        LOAD DOCUMENTS
    =========================================================*/

    async function loadDocuments() {

        if (
            !requireAuthentication()
        ) {

            return;

        }


        showLoading();


        try {

            const response =
                await fetch(

                    `${API_BASE}/documents`,

                    {

                        method: "GET",

                        headers: {

                            "Authorization":
                                `Bearer ${studentToken}`,

                            "Content-Type":
                                "application/json"

                        }

                    }

                );


            /*-----------------------------------------
                SESSION EXPIRED
            -----------------------------------------*/

            if (
                response.status ===
                401
            ) {

                redirectToLogin();

                return;

            }


            const result =
                await response.json();


            /*-----------------------------------------
                NON-ANNUAL PLAN
            -----------------------------------------*/

            if (
                response.status ===
                403
            ) {

                showUpgradeRequired();

                return;

            }


            if (
                !response.ok ||
                !result.success
            ) {

                throw new Error(

                    result.message ||

                    "Unable to load documents."

                );

            }


            renderDocuments(
                result.documents || []
            );

        }


        catch (error) {

            console.error(
                "Documents Load Error:",
                error
            );


            showError(

                error.message ||

                "Unable to load your documents."

            );

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


        if (
            !documents.length
        ) {

            documentsList.innerHTML = `

                <h3>

                    Uploaded Documents

                </h3>

                <p class="empty-state">

                    You haven't uploaded
                    any documents yet.

                </p>

            `;

            return;

        }


        documentsList.innerHTML = `

            <h3>

                Uploaded Documents

            </h3>

            <div class="documents-items">

                ${documents.map(
                    document => `

                    <div
                        class="document-item"
                        data-document-id="${escapeHtml(
                            document.id
                        )}">

                        <div class="document-icon">

                            <i class="fas ${getFileIcon(
                                document.file_type
                            )}"></i>

                        </div>

                        <div class="document-info">

                            <h4>

                                ${escapeHtml(
                                    document.file_name
                                )}

                            </h4>

                            <p>

                                ${escapeHtml(
                                    document.file_type
                                )}

                                •
                                ${formatFileSize(
                                    document.file_size
                                )}

                            </p>

                        </div>

                        <div class="document-actions">

                            <button
                                type="button"
                                class="document-download"
                                data-id="${escapeHtml(
                                    document.id
                                )}">

                                <i class="fas fa-download"></i>

                                Download

                            </button>

                            <button
                                type="button"
                                class="document-delete"
                                data-id="${escapeHtml(
                                    document.id
                                )}">

                                <i class="fas fa-trash"></i>

                                Delete

                            </button>

                        </div>

                    </div>

                `
                ).join("")}

            </div>

        `;


        setupDocumentActions();

    }


    /*=========================================================
        UPLOAD
    =========================================================*/

    async function uploadDocuments(
        files
    ) {

        if (
            !files ||
            !files.length
        ) {

            return;

        }


        if (
            !requireAuthentication()
        ) {

            return;

        }


        for (
            const file of files
        ) {

            try {

                const formData =
                    new FormData();


                formData.append(
                    "file",
                    file
                );


                const response =
                    await fetch(

                        `${API_BASE}/documents`,

                        {

                            method: "POST",

                            headers: {

                                "Authorization":
                                    `Bearer ${studentToken}`

                            },

                            body:
                                formData

                        }

                    );


                if (
                    response.status ===
                    401
                ) {

                    redirectToLogin();

                    return;

                }


                const result =
                    await response.json();


                if (
                    response.status ===
                    403
                ) {

                    showUpgradeRequired();

                    return;

                }


                if (
                    !response.ok ||
                    !result.success
                ) {

                    throw new Error(

                        result.message ||

                        `Unable to upload ${file.name}.`

                    );

                }

            }


            catch (error) {

                console.error(
                    "Document Upload Error:",
                    error
                );


                alert(

                    error.message ||

                    `Unable to upload ${file.name}.`

                );

            }

        }


        await loadDocuments();

    }


    /*=========================================================
        DOWNLOAD
    =========================================================*/

    async function downloadDocument(
        documentId
    ) {

        if (
            !requireAuthentication()
        ) {

            return;

        }


        try {

            const response =
                await fetch(

                    `${API_BASE}/documents/download?id=${encodeURIComponent(
                        documentId
                    )}`,

                    {

                        method: "GET",

                        headers: {

                            "Authorization":
                                `Bearer ${studentToken}`

                        }

                    }

                );


            if (
                response.status ===
                401
            ) {

                redirectToLogin();

                return;

            }


            if (
                response.status ===
                403
            ) {

                showUpgradeRequired();

                return;

            }


            if (
                !response.ok
            ) {

                const result =
                    await response.json()
                        .catch(
                            () => ({})
                        );


                throw new Error(

                    result.message ||

                    "Unable to download document."

                );

            }


            const blob =
                await response.blob();


            const contentDisposition =
                response.headers.get(
                    "Content-Disposition"
                );


            let fileName =
                "document";


            const match =
                contentDisposition &&
                contentDisposition.match(
                    /filename="([^"]+)"/
                );


            if (match) {

                fileName =
                    match[1];

            }


            const blobUrl =
                URL.createObjectURL(
                    blob
                );


            const link =
                document.createElement(
                    "a"
                );


            link.href =
                blobUrl;


            link.download =
                fileName;


            document.body.appendChild(
                link
            );


            link.click();


            link.remove();


            URL.revokeObjectURL(
                blobUrl
            );

        }


        catch (error) {

            console.error(
                "Document Download Error:",
                error
            );


            alert(

                error.message ||

                "Unable to download document."

            );

        }

    }


    /*=========================================================
        DELETE
    =========================================================*/

    async function deleteDocument(
        documentId
    ) {

        if (
            !requireAuthentication()
        ) {

            return;

        }


        const confirmed =
            window.confirm(

                "Delete this document permanently?"

            );


        if (!confirmed) {

            return;

        }


        try {

            const response =
                await fetch(

                    `${API_BASE}/documents?id=${encodeURIComponent(
                        documentId
                    )}`,

                    {

                        method: "DELETE",

                        headers: {

                            "Authorization":
                                `Bearer ${studentToken}`,

                            "Content-Type":
                                "application/json"

                        }

                    }

                );


            if (
                response.status ===
                401
            ) {

                redirectToLogin();

                return;

            }


            const result =
                await response.json();


            if (
                response.status ===
                403
            ) {

                showUpgradeRequired();

                return;

            }


            if (
                !response.ok ||
                !result.success
            ) {

                throw new Error(

                    result.message ||

                    "Unable to delete document."

                );

            }


            await loadDocuments();

        }


        catch (error) {

            console.error(
                "Document Delete Error:",
                error
            );


            alert(

                error.message ||

                "Unable to delete document."

            );

        }

    }


    /*=========================================================
        DOCUMENT ACTIONS
    =========================================================*/

    function setupDocumentActions() {

        const downloadButtons =
            document.querySelectorAll(
                ".document-download"
            );


        downloadButtons.forEach(
            button => {

                button.addEventListener(
                    "click",
                    () => {

                        downloadDocument(
                            button.dataset.id
                        );

                    }
                );

            }
        );


        const deleteButtons =
            document.querySelectorAll(
                ".document-delete"
            );


        deleteButtons.forEach(
            button => {

                button.addEventListener(
                    "click",
                    () => {

                        deleteDocument(
                            button.dataset.id
                        );

                    }
                );

            }
        );

    }


    /*=========================================================
        FILE INPUT
    =========================================================*/

    function setupFileUpload() {

        if (!documentUpload) {
            return;
        }


        documentUpload.addEventListener(
            "change",
            async () => {

                const files =
                    Array.from(
                        documentUpload.files || []
                    );


                if (
                    !files.length
                ) {

                    return;

                }


                await uploadDocuments(
                    files
                );


                documentUpload.value =
                    "";

            }
        );

    }


    /*=========================================================
        INITIALIZE
    =========================================================*/

    document.addEventListener(
        "DOMContentLoaded",
        () => {

            if (
                !requireAuthentication()
            ) {

                return;

            }


            setupFileUpload();

            loadDocuments();

        }
    );

})();