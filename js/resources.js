// =========================================================
// NURSEPHERE — STUDY RESOURCES CONTROLLER
// File: student/js/resources.js
// =========================================================
//
// PRODUCTION VERSION
//
// Student access:
//
//   GET /api/subjects/:subject_id/resources
//   GET /api/resources/:id/view
//   GET /api/resources/:id/download
//
// SECURITY:
//
//   • JWT stored locally
//   • JWT sent only through Authorization header
//   • Private R2 objects are NEVER exposed directly
//   • Worker performs subscription authorization
//   • Worker performs plan_features authorization
//   • View/download requests are authenticated server-side
//   • No resource file URL is opened directly
//   • No HTML from API responses is injected
//   • Blob URLs are revoked after use
//   • 401 automatically clears the student session
//
// =========================================================

"use strict";


// =========================================================
// CONFIGURATION
// =========================================================

const API_BASE =
    "https://nursephere.wamalwaemily.workers.dev/api";

const LOGIN_PAGE =
    "../login.html";

const PRACTICE_PAGE =
    "../practice.html";

const REQUEST_TIMEOUT =
    30000;


// =========================================================
// DOM ELEMENTS
// =========================================================

const subjectName =
    document.getElementById("subjectName");

const subjectDescription =
    document.getElementById("subjectDescription");

const resourcesContainer =
    document.getElementById("resourcesContainer");


// =========================================================
// URL PARAMETERS
// =========================================================

const urlParams =
    new URLSearchParams(
        window.location.search
    );

const subjectId =
    (urlParams.get("subject_id") || "").trim();


// =========================================================
// SESSION
// =========================================================

function getToken() {

    const token =
        localStorage.getItem(
            "studentToken"
        );

    return token
        ? token.trim()
        : "";

}


function clearStudentSession() {

    localStorage.removeItem(
        "studentToken"
    );

    localStorage.removeItem(
        "student"
    );

    localStorage.removeItem(
        "studentId"
    );

}


function redirectToLogin() {

    clearStudentSession();

    window.location.replace(
        LOGIN_PAGE
    );

}


// =========================================================
// GENERIC API ERROR
// =========================================================

class ApiError extends Error {

    constructor(
        message,
        status = 0,
        code = ""
    ) {

        super(message);

        this.name =
            "ApiError";

        this.status =
            status;

        this.code =
            code;

    }

}


// =========================================================
// REQUEST TIMEOUT
// =========================================================

async function fetchWithTimeout(
    url,
    options = {},
    timeout = REQUEST_TIMEOUT
) {

    const controller =
        new AbortController();

    const timer =
        setTimeout(
            () => controller.abort(),
            timeout
        );

    try {

        return await fetch(
            url,
            {
                ...options,
                signal:
                    controller.signal
            }
        );

    }

    catch (error) {

        if (
            error?.name ===
            "AbortError"
        ) {

            throw new ApiError(
                "The request timed out. Please try again.",
                408
            );

        }

        throw error;

    }

    finally {

        clearTimeout(timer);

    }

}


// =========================================================
// RESPONSE MESSAGE
// =========================================================

async function getResponseMessage(
    response
) {

    try {

        const contentType =
            response.headers.get(
                "content-type"
            ) || "";

        if (
            contentType
                .toLowerCase()
                .includes(
                    "application/json"
                )
        ) {

            const json =
                await response.json();

            return (
                json?.message ||
                json?.error ||
                ""
            );

        }

        const text =
            await response.text();

        return text.trim();

    }

    catch {

        return "";

    }

}


// =========================================================
// JSON API REQUEST
// =========================================================

async function apiRequest(
    endpoint,
    options = {}
) {

    const token =
        getToken();

    if (!token) {

        redirectToLogin();

        throw new ApiError(
            "Your session has expired.",
            401
        );

    }


    const headers = {

        "Accept":
            "application/json",

        "Authorization":
            `Bearer ${token}`,

        ...(options.headers || {})

    };


    let response;

    try {

        response =
            await fetchWithTimeout(

                `${API_BASE}${endpoint}`,

                {
                    ...options,
                    headers,
                    cache:
                        "no-store"
                }

            );

    }

    catch (error) {

        console.error(
            "Nursephere API connection error:",
            error
        );

        if (
            error instanceof ApiError
        ) {

            throw error;

        }

        throw new ApiError(
            "Unable to connect to Nursephere."
        );

    }


    if (
        response.status === 401
    ) {

        redirectToLogin();

        throw new ApiError(
            "Your session has expired.",
            401
        );

    }


    const message =
        await getResponseMessage(
            response
        );


    if (!response.ok) {

        throw new ApiError(

            message ||
            getFriendlyHttpMessage(
                response.status
            ),

            response.status

        );

    }


    return parseJsonResponse(
        response,
        message
    );

}


// =========================================================
// JSON RESPONSE PARSER
// =========================================================

async function parseJsonResponse(
    response,
    fallbackMessage = ""
) {

    try {

        const result =
            await response.json();

        if (
            result?.success === false
        ) {

            throw new ApiError(
                result.message ||
                "The request could not be completed.",
                response.status
            );

        }

        return result;

    }

    catch (error) {

        if (
            error instanceof ApiError
        ) {

            throw error;

        }

        throw new ApiError(

            fallbackMessage ||
            "The server returned an invalid response.",

            response.status

        );

    }

}


// =========================================================
// HTTP ERROR MESSAGES
// =========================================================

function getFriendlyHttpMessage(
    status
) {

    switch (status) {

        case 400:
            return "The request was invalid.";

        case 403:
            return "You do not have access to this resource.";

        case 404:
            return "The requested resource was not found.";

        case 409:
            return "The request could not be completed.";

        case 429:
            return "Too many requests. Please try again later.";

        case 500:
        case 502:
        case 503:
        case 504:
            return "Nursephere is temporarily unavailable.";

        default:
            return "Unable to complete the request.";

    }

}


// =========================================================
// RESOURCE FILE REQUEST
// =========================================================
//
// IMPORTANT:
//
// The new Worker streams the actual R2 object.
//
// Therefore:
//
//   response = PDF/DOCX/XLSX/CSV binary
//
// NOT:
//
//   { download_url: "..." }
//
// =========================================================

async function requestResourceFile(
    resourceId,
    action
) {

    const token =
        getToken();

    if (!token) {

        redirectToLogin();

        throw new ApiError(
            "Your session has expired.",
            401
        );

    }


    const safeId =
        encodeURIComponent(
            resourceId
        );


    const endpoint =
        `/resources/${safeId}/${action}`;


    let response;

    try {

        response =
            await fetchWithTimeout(

                `${API_BASE}${endpoint}`,

                {

                    method:
                        "GET",

                    headers: {

                        "Authorization":
                            `Bearer ${token}`,

                        "Accept":
                            "*/*"

                    },

                    cache:
                        "no-store"

                }

            );

    }

    catch (error) {

        console.error(
            "Resource file request failed:",
            error
        );

        if (
            error instanceof ApiError
        ) {

            throw error;

        }

        throw new ApiError(
            "Unable to connect to Nursephere."
        );

    }


    if (
        response.status === 401
    ) {

        redirectToLogin();

        throw new ApiError(
            "Your session has expired.",
            401
        );

    }


    if (
        !response.ok
    ) {

        const message =
            await getResponseMessage(
                response
            );

        throw new ApiError(

            message ||
            getFriendlyHttpMessage(
                response.status
            ),

            response.status

        );

    }


    const contentType =
        (
            response.headers.get(
                "content-type"
            ) || ""
        ).toLowerCase();


    if (
        contentType.includes(
            "application/json"
        )
    ) {

        let result = null;

        try {

            result =
                await response.json();

        }

        catch {

            throw new ApiError(
                "The server returned an invalid resource response."
            );

        }


        throw new ApiError(

            result?.message ||
            "Unable to retrieve the study resource.",

            response.status

        );

    }


    const blob =
        await response.blob();


    if (
        !blob ||
        blob.size === 0
    ) {

        throw new ApiError(
            "The study resource is empty or unavailable."
        );

    }


    return {

        blob,

        contentType:
            contentType ||
            blob.type ||
            "application/octet-stream",

        fileName:
            getFileNameFromResponse(
                response
            )

    };

}


// =========================================================
// RESPONSE FILE NAME
// =========================================================

function getFileNameFromResponse(
    response
) {

    const disposition =
        response.headers.get(
            "content-disposition"
        ) || "";


    /*
     * Supports:
     *
     * filename="file.pdf"
     *
     * filename*=UTF-8''file.pdf
     */

    const encodedMatch =
        disposition.match(
            /filename\*=UTF-8''([^;]+)/i
        );


    if (
        encodedMatch?.[1]
    ) {

        try {

            return sanitizeFileName(
                decodeURIComponent(
                    encodedMatch[1]
                )
            );

        }

        catch {

            // Continue to normal filename parsing.

        }

    }


    const normalMatch =
        disposition.match(
            /filename="([^"]+)"/i
        );


    if (
        normalMatch?.[1]
    ) {

        return sanitizeFileName(
            normalMatch[1]
        );

    }


    const fallbackMatch =
        disposition.match(
            /filename=([^;]+)/i
        );


    if (
        fallbackMatch?.[1]
    ) {

        return sanitizeFileName(
            fallbackMatch[1]
        );

    }


    return "study-resource";

}


// =========================================================
// SAFE FILE NAME
// =========================================================

function sanitizeFileName(
    value
) {

    return String(
        value || ""
    )
    .replace(
        /[\r\n"]/g,
        ""
    )
    .replace(
        /[\\/:*?<>|]/g,
        "_"
    )
    .trim()
    .slice(
        0,
        180
    ) || "study-resource";

}


// =========================================================
// FILE EXTENSION
// =========================================================

function getResourceExtension(
    resource
) {

    const type =
        String(
            resource?.file_type ||
            resource?.type ||
            ""
        )
        .trim()
        .toLowerCase();


    if (
        ["pdf", "docx", "xlsx", "csv"]
            .includes(type)
    ) {

        return type;

    }


    return "";

}


// =========================================================
// CREATE FALLBACK FILE NAME
// =========================================================

function createResourceFileName(
    resource
) {

    const title =
        sanitizeFileName(
            resource?.title ||
            "study-resource"
        );


    const extension =
        getResourceExtension(
            resource
        );


    if (!extension) {

        return title;

    }


    if (
        title
            .toLowerCase()
            .endsWith(
                `.${extension}`
            )
    ) {

        return title;

    }


    return `${title}.${extension}`;

}


// =========================================================
// LOADING STATE
// =========================================================

function showLoading() {

    resourcesContainer.innerHTML =
        "";


    const loading =
        document.createElement(
            "div"
        );


    loading.className =
        "empty-state";


    const icon =
        document.createElement(
            "i"
        );

    icon.className =
        "fas fa-spinner fa-spin";

    icon.setAttribute(
        "aria-hidden",
        "true"
    );


    const title =
        document.createElement(
            "h3"
        );

    title.textContent =
        "Loading Study Resources";


    const text =
        document.createElement(
            "p"
        );

    text.textContent =
        "Please wait while we load the resources for this subject.";


    loading.append(
        icon,
        title,
        text
    );


    resourcesContainer.appendChild(
        loading
    );

}


// =========================================================
// ERROR STATE
// =========================================================

function showError(
    message,
    showRetry = true
) {

    resourcesContainer.innerHTML =
        "";


    const empty =
        document.createElement(
            "div"
        );

    empty.className =
        "empty-state";


    const icon =
        document.createElement(
            "i"
        );

    icon.className =
        "fas fa-circle-exclamation";

    icon.setAttribute(
        "aria-hidden",
        "true"
    );


    const title =
        document.createElement(
            "h3"
        );

    title.textContent =
        "Unable to Load Resources";


    const text =
        document.createElement(
            "p"
        );

    text.textContent =
        message ||
        "Unable to load study resources.";


    empty.append(
        icon,
        title,
        text
    );


    if (showRetry) {

        const retry =
            document.createElement(
                "button"
            );

        retry.type =
            "button";

        retry.className =
            "retry-btn";

        retry.textContent =
            "Try Again";

        retry.addEventListener(
            "click",
            loadSubjectResources
        );


        empty.appendChild(
            retry
        );

    }


    resourcesContainer.appendChild(
        empty
    );

}


// =========================================================
// EMPTY STATE
// =========================================================

function renderEmptyResources() {

    const empty =
        document.createElement(
            "div"
        );

    empty.className =
        "empty-state";


    const icon =
        document.createElement(
            "i"
        );

    icon.className =
        "fas fa-folder-open";

    icon.setAttribute(
        "aria-hidden",
        "true"
    );


    const title =
        document.createElement(
            "h3"
        );

    title.textContent =
        "No Study Resources Available";


    const text =
        document.createElement(
            "p"
        );

    text.textContent =
        "No study resources have been published for this subject yet.";


    empty.append(
        icon,
        title,
        text
    );


    resourcesContainer.appendChild(
        empty
    );

}


// =========================================================
// LOAD SUBJECT + RESOURCES
// =========================================================

async function loadSubjectResources() {

    if (!subjectId) {

        showError(
            "No subject was selected. Please return to Practice and select a subject.",
            false
        );

        return;

    }


    showLoading();


    try {

        const result =
            await apiRequest(

                `/subjects/${encodeURIComponent(
                    subjectId
                )}/resources`

            );


        /*
         * Supports both:
         *
         * {
         *   success: true,
         *   subject: {...},
         *   resources: [...]
         * }
         *
         * and:
         *
         * {
         *   success: true,
         *   data: {
         *      subject: {...},
         *      resources: [...]
         *   }
         * }
         */

        const payload =
            result?.data &&
            typeof result.data === "object"
                ? result.data
                : result;


        const subject =
            payload?.subject;


        const resources =
            Array.isArray(
                payload?.resources
            )
                ? payload.resources
                : [];


        if (!subject) {

            throw new ApiError(
                "The selected subject could not be found.",
                404
            );

        }


        renderSubject(
            subject
        );


        renderResources(
            resources
        );

    }

    catch (error) {

        console.error(
            "Nursephere Resources:",
            error
        );


        showError(

            error?.message ||
            "Unable to load study resources."

        );

    }

}


// =========================================================
// RENDER SUBJECT
// =========================================================

function renderSubject(
    subject
) {

    if (subjectName) {

        subjectName.textContent =
            subject?.name ||
            "Study Resources";

    }


    if (subjectDescription) {

        subjectDescription.textContent =
            subject?.description ||
            "Study resources for this subject.";

    }

}


// =========================================================
// RESOURCE ACCESS NORMALIZATION
// =========================================================
//
// The Worker remains the final authority.
//
// The frontend never grants access itself.
//
// This function only determines whether the UI should
// display a button when the API supplies access_level.
//
// If access_level is absent, View remains available because
// the Worker will authorize/deny the actual request.
//
// Download is only displayed when the API explicitly
// reports download access.
//
// =========================================================

function getResourceAccessLevel(
    resource
) {

    const candidates = [

        resource?.access_level,

        resource?.accessLevel,

        resource?.student_access_level,

        resource?.studentAccessLevel

    ];


    for (
        const candidate of candidates
    ) {

        const value =
            String(
                candidate ?? ""
            )
            .trim()
            .toLowerCase();


        if (
            value === "download" ||
            value === "view" ||
            value === "none"
        ) {

            return value;

        }

    }


    return null;

}


// =========================================================
// RENDER RESOURCES
// =========================================================

function renderResources(
    resources
) {

    resourcesContainer.innerHTML =
        "";


    if (
        !Array.isArray(resources) ||
        resources.length === 0
    ) {

        renderEmptyResources();

        return;

    }


    const fragment =
        document.createDocumentFragment();


    resources.forEach(
        resource => {

            if (
                !resource ||
                typeof resource !== "object"
            ) {

                return;

            }


            const card =
                createResourceCard(
                    resource
                );


            fragment.appendChild(
                card
            );

        }
    );


    if (
        !fragment.childNodes.length
    ) {

        renderEmptyResources();

        return;

    }


    resourcesContainer.appendChild(
        fragment
    );

}


// =========================================================
// CREATE RESOURCE CARD
// =========================================================

function createResourceCard(
    resource
) {

    const card =
        document.createElement(
            "article"
        );

    card.className =
        "resource-card";


    // -----------------------------------------------------
    // HEADER
    // -----------------------------------------------------

    const header =
        document.createElement(
            "div"
        );

    header.className =
        "resource-header";


    const title =
        document.createElement(
            "h3"
        );

    title.textContent =
        resource?.title ||
        "Untitled Resource";


    const type =
        document.createElement(
            "span"
        );

    type.className =
        "resource-type";

    type.textContent =
        (
            resource?.file_type ||
            resource?.type ||
            "Study Material"
        )
        .toString()
        .toUpperCase();


    header.append(
        title,
        type
    );


    // -----------------------------------------------------
    // AUTHOR
    // -----------------------------------------------------

    const author =
        document.createElement(
            "p"
        );

    author.className =
        "resource-author";

    author.textContent =
        resource?.author
            ? `By ${resource.author}`
            : "";


    if (
        !resource?.author
    ) {

        author.hidden =
            true;

    }


    // -----------------------------------------------------
    // DESCRIPTION
    // -----------------------------------------------------

    const description =
        document.createElement(
            "p"
        );

    description.className =
        "resource-description";

    description.textContent =
        resource?.description ||
        "Study material for this subject.";


    // -----------------------------------------------------
    // ACTIONS
    // -----------------------------------------------------

    const actions =
        document.createElement(
            "div"
        );

    actions.className =
        "resource-actions";


    // -----------------------------------------------------
    // VIEW BUTTON
    // -----------------------------------------------------

    const viewButton =
        document.createElement(
            "button"
        );

    viewButton.type =
        "button";

    viewButton.className =
        "view-resource";

    viewButton.innerHTML =
        '<i class="fas fa-eye" aria-hidden="true"></i> View Resource';

    viewButton.dataset.resourceId =
        resource?.id || "";

    viewButton.addEventListener(
        "click",
        () => {

            viewResource(
                resource,
                viewButton
            );

        }
    );


    actions.appendChild(
        viewButton
    );


    // -----------------------------------------------------
    // DOWNLOAD BUTTON
    // -----------------------------------------------------
    //
    // If the API explicitly says "view", don't show
    // download.
    //
    // If it says "download", show download.
    //
    // If access level is not supplied, we still show the
    // button because the Worker is the authority and will
    // return 403 if the student's plan cannot download.
    //
    // -----------------------------------------------------

    const accessLevel =
        getResourceAccessLevel(
            resource
        );


    if (
        accessLevel !== "view" &&
        accessLevel !== "none"
    ) {

        const downloadButton =
            document.createElement(
                "button"
            );

        downloadButton.type =
            "button";

        downloadButton.className =
            "download-resource";

        downloadButton.dataset.resourceId =
            resource?.id || "";

        downloadButton.innerHTML =
            '<i class="fas fa-download" aria-hidden="true"></i> Download';


        downloadButton.addEventListener(
            "click",
            () => {

                downloadResource(
                    resource,
                    downloadButton
                );

            }
        );


        actions.appendChild(
            downloadButton
        );

    }


    // -----------------------------------------------------
    // CARD
    // -----------------------------------------------------

    card.append(
        header,
        author,
        description,
        actions
    );


    return card;

}


// =========================================================
// BUTTON LOADING STATE
// =========================================================

function setButtonLoading(
    button,
    text
) {

    if (!button) {

        return () => {};

    }


    const originalHTML =
        button.innerHTML;


    button.disabled =
        true;

    button.setAttribute(
        "aria-busy",
        "true"
    );


    button.innerHTML =
        `<i class="fas fa-spinner fa-spin" aria-hidden="true"></i> ${text}`;


    return () => {

        button.disabled =
            false;

        button.removeAttribute(
            "aria-busy"
        );

        button.innerHTML =
            originalHTML;

    };

}


// =========================================================
// OPEN BLOB IN NEW TAB
// =========================================================

function openBlobInNewTab(
    blob,
    fileName
) {

    const blobUrl =
        URL.createObjectURL(
            blob
        );


    /*
     * Create the anchor only after the file has been
     * authorized and downloaded.
     *
     * This means the browser never receives a direct
     * public R2 URL.
     */

    const link =
        document.createElement(
            "a"
        );

    link.href =
        blobUrl;

    link.target =
        "_blank";

    link.rel =
        "noopener noreferrer";

    link.download =
        fileName || "study-resource";


    document.body.appendChild(
        link
    );


    link.click();


    link.remove();


    /*
     * Give the browser enough time to begin consuming
     * the Blob URL before revoking it.
     */

    setTimeout(
        () => {

            URL.revokeObjectURL(
                blobUrl
            );

        },
        60000
    );

}


// =========================================================
// VIEW RESOURCE
// =========================================================

async function viewResource(
    resource,
    button
) {

    const resourceId =
        String(
            resource?.id || ""
        ).trim();


    if (!resourceId) {

        alert(
            "This study resource is unavailable."
        );

        return;

    }


    const restore =
        setButtonLoading(
            button,
            "Opening..."
        );


    try {

        const result =
            await requestResourceFile(
                resourceId,
                "view"
            );


        const fileName =
            result.fileName !==
            "study-resource"

                ? result.fileName

                : createResourceFileName(
                    resource
                );


        openBlobInNewTab(
            result.blob,
            fileName
        );

    }

    catch (error) {

        console.error(
            "Resource view error:",
            error
        );


        /*
         * 403 is expected when a plan doesn't include
         * study resources.
         */

        alert(

            error?.message ||
            "Unable to open this study resource."

        );

    }

    finally {

        restore();

    }

}


// =========================================================
// DOWNLOAD RESOURCE
// =========================================================

async function downloadResource(
    resource,
    button
) {

    const resourceId =
        String(
            resource?.id || ""
        ).trim();


    if (!resourceId) {

        alert(
            "This study resource is unavailable."
        );

        return;

    }


    const restore =
        setButtonLoading(
            button,
            "Preparing..."
        );


    try {

        const result =
            await requestResourceFile(
                resourceId,
                "download"
            );


        const fileName =
            result.fileName !==
            "study-resource"

                ? result.fileName

                : createResourceFileName(
                    resource
                );


        /*
         * Force download.
         */

        const blobUrl =
            URL.createObjectURL(
                result.blob
            );


        const link =
            document.createElement(
                "a"
            );

        link.href =
            blobUrl;

        link.download =
            fileName;

        link.rel =
            "noopener noreferrer";

        link.style.display =
            "none";


        document.body.appendChild(
            link
        );


        link.click();


        link.remove();


        setTimeout(
            () => {

                URL.revokeObjectURL(
                    blobUrl
                );

            },
            60000
        );

    }

    catch (error) {

        console.error(
            "Resource download error:",
            error
        );


        alert(

            error?.message ||
            "Unable to download this resource."

        );

    }

    finally {

        restore();

    }

}


// =========================================================
// INITIALIZATION
// =========================================================

function initializeResourcesPage() {

    /*
     * Subject ID is mandatory.
     */

    if (!subjectId) {

        showError(

            "No subject was selected. Please return to Practice and select a subject.",

            false

        );

        return;

    }


    /*
     * Authentication is mandatory.
     */

    if (!getToken()) {

        redirectToLogin();

        return;

    }


    loadSubjectResources();

}


// =========================================================
// DOM READY
// =========================================================

if (
    document.readyState ===
    "loading"
) {

    document.addEventListener(
        "DOMContentLoaded",
        initializeResourcesPage,
        {
            once: true
        }
    );

}

else {

    initializeResourcesPage();

}