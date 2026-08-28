// =========================================================
// NURSEPHERE — STUDY RESOURCES CONTROLLER
// File: student/js/resources.js
// =========================================================
//
/*
 * PRODUCTION VERSION
 *
 * Resources are completely independent from Practice.
 *
 * FLOW:
 *
 *   /student/resources
 *          ↓
 *   GET /api/exams
 *          ↓
 *   GET /api/subjects?exam_id=...
 *          ↓
 *   Student selects subject
 *          ↓
 *   GET /api/subjects/:subject_id/resources
 *          ↓
 *   Study resources displayed
 *
 * RESOURCE FILE ACCESS:
 *
 *   GET /api/resources/:id/view
 *   GET /api/resources/:id/download
 *
 * SECURITY:
 *
 *   • JWT stored locally
 *   • JWT sent only through Authorization header
 *   • Private R2 objects are NEVER exposed directly
 *   • Worker performs subscription authorization
 *   • Worker performs plan_features authorization
 *   • View/download requests are authenticated server-side
 *   • No resource file URL is opened directly
 *   • No HTML from API responses is injected
 *   • Blob URLs are revoked after use
 *   • 401 automatically clears the student session
 *
 * =========================================================
 */

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

const initialSubjectId =
    (
        urlParams.get("subject_id") ||
        ""
    ).trim();


// =========================================================
// RUNTIME STATE
// =========================================================

let availableSubjects = [];

let selectedSubjectId =
    initialSubjectId;

let subjectSelector = null;


// =========================================================
// VALIDATE REQUIRED DOM
// =========================================================

if (!resourcesContainer) {

    console.error(
        "Nursephere Resources: #resourcesContainer was not found."
    );

}


// =========================================================
// SESSION
// =========================================================

function getStudentToken() {

    return localStorage.getItem(
        "studentToken"
    );

}


// =========================================================
// VERIFY LOGIN
// =========================================================

function verifyLogin() {

    const token =
        getStudentToken();


    if (!token) {

        window.location.replace(
            LOGIN_PAGE
        );

        return false;

    }


    return true;

}


// =========================================================
// API ERROR
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

        case 401:
            return "Your session has expired.";

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
// JSON API REQUEST
// =========================================================

async function apiRequest(
    endpoint,
    options = {}
) {

    const token =
        getStudentToken();


    if (!token) {

        window.location.replace(
            LOGIN_PAGE
        );

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

        "Content-Type":
            "application/json",

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

    const message =
        await getResponseMessage(
            response
        );

    throw new ApiError(

        message ||
        "Unable to access this study resource.",

        401

    );

}

    // -----------------------------------------------------
    // NON-JSON ERROR RESPONSE
    // -----------------------------------------------------

    if (!response.ok) {

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


    // -----------------------------------------------------
    // SUCCESS RESPONSE
    // -----------------------------------------------------

    return parseJsonResponse(
        response
    );

}


// =========================================================
// LOADING STATE
// =========================================================

function showLoading(
    message =
        "Please wait while we load your study resources."
) {

    if (!resourcesContainer) {
        return;
    }


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
        message;


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

    if (!resourcesContainer) {
        return;
    }


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
            initializeResourcesPage
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

    if (!resourcesContainer) {
        return;
    }


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
// NORMALIZE API PAYLOAD
// =========================================================

function getPayload(
    result
) {

    if (
        result?.data &&
        typeof result.data === "object" &&
        !Array.isArray(result.data)
    ) {

        return result.data;

    }


    return result || {};

}


// =========================================================
// NORMALIZE ARRAY
// =========================================================

function extractArray(
    payload,
    keys
) {

    for (
        const key of keys
    ) {

        if (
            Array.isArray(
                payload?.[key]
            )
        ) {

            return payload[key];

        }

    }


    return [];

}


// =========================================================
// LOAD ACTIVE EXAMS
// =========================================================
//
// Resources does not depend on Practice.
//
// We obtain the available exams directly from
// the API, then obtain their subjects.
//
// =========================================================

async function loadExams() {

    const result =
        await apiRequest(
            "/exams"
        );


    const payload =
        getPayload(
            result
        );


    const exams =
        extractArray(
            payload,
            [
                "exams",
                "items",
                "results"
            ]
        );


    return exams.filter(
        exam =>
            exam &&
            typeof exam === "object"
    );

}


// =========================================================
// LOAD SUBJECTS FOR AN EXAM
// =========================================================

async function loadSubjectsForExam(
    examId
) {

    const safeExamId =
        encodeURIComponent(
            String(
                examId || ""
            ).trim()
        );


    if (!safeExamId) {

        return [];

    }


    const result =
        await apiRequest(
            `/subjects?exam_id=${safeExamId}`
        );


    const payload =
        getPayload(
            result
        );


    return extractArray(
        payload,
        [
            "subjects",
            "items",
            "results"
        ]
    );

}


// =========================================================
// LOAD ALL SUBJECTS
// =========================================================
//
// The API exposes subjects by exam.
//
// Therefore we load the active exams first and then
// collect the subjects belonging to those exams.
//
// No subject is hardcoded here.
//
// =========================================================

async function loadAllSubjects() {

    const exams =
        await loadExams();


    if (!exams.length) {

        return [];

    }


    const subjectResults =
        await Promise.all(

            exams.map(
                async exam => {

                    const examId =
                        exam?.id ??
                        exam?.exam_id ??
                        exam?.examId;


                    if (!examId) {

                        return [];

                    }


                    try {

                        const subjects =
                            await loadSubjectsForExam(
                                examId
                            );


                        return subjects.map(
                            subject => ({

                                ...subject,

                                exam_id:
                                    subject?.exam_id ??
                                    subject?.examId ??
                                    examId,

                                exam_name:
                                    subject?.exam_name ??
                                    subject?.examName ??
                                    exam?.name ??
                                    exam?.title ??
                                    ""

                            })
                        );

                    }

                    catch (error) {

                        console.error(
                            `Unable to load subjects for exam ${examId}:`,
                            error
                        );


                        return [];

                    }

                }
            )

        );


    const flattened =
        subjectResults.flat();


    // -----------------------------------------------------
    // Remove duplicates.
    // -----------------------------------------------------

    const seen =
        new Set();


    const uniqueSubjects =
        flattened.filter(
            subject => {

                const id =
                    String(
                        subject?.id ??
                        subject?.subject_id ??
                        ""
                    ).trim();


                if (!id) {

                    return false;

                }


                if (
                    seen.has(id)
                ) {

                    return false;

                }


                seen.add(id);

                return true;

            }
        );


    return uniqueSubjects;

}


// =========================================================
// CREATE SUBJECT SELECTOR
// =========================================================

function createSubjectSelector() {

    // -----------------------------------------------------
    // If a selector already exists, reuse it.
    // -----------------------------------------------------

    const existing =
        document.getElementById(
            "resourceSubjectSelect"
        );


    if (existing) {

        subjectSelector =
            existing;

        return existing;

    }


    // -----------------------------------------------------
    // Create wrapper.
    // -----------------------------------------------------

    const wrapper =
        document.createElement(
            "div"
        );

    wrapper.className =
        "resource-subject-selector";


    // -----------------------------------------------------
    // Label.
    // -----------------------------------------------------

    const label =
        document.createElement(
            "label"
        );

    label.htmlFor =
        "resourceSubjectSelect";

    label.textContent =
        "Select Subject";


    // -----------------------------------------------------
    // Select.
    // -----------------------------------------------------

    const select =
        document.createElement(
            "select"
        );

    select.id =
        "resourceSubjectSelect";

    select.name =
        "subject_id";


    // -----------------------------------------------------
    // Placeholder.
    // -----------------------------------------------------

    const placeholder =
        document.createElement(
            "option"
        );

    placeholder.value =
        "";

    placeholder.textContent =
        "Choose a subject";

    placeholder.disabled =
        true;

    placeholder.selected =
        true;


    select.appendChild(
        placeholder
    );


    // -----------------------------------------------------
    // Populate subjects.
    // -----------------------------------------------------

    availableSubjects.forEach(
        subject => {

            const id =
                String(
                    subject?.id ??
                    subject?.subject_id ??
                    ""
                ).trim();


            if (!id) {

                return;

            }


            const option =
                document.createElement(
                    "option"
                );


            option.value =
                id;


            option.textContent =
                subject?.name ||
                subject?.title ||
                "Untitled Subject";


            // -------------------------------------------------
            // Only select a subject when one was already chosen.
            // -------------------------------------------------

            if (
                selectedSubjectId &&
                id ===
                selectedSubjectId
            ) {

                option.selected =
                    true;

            }


            select.appendChild(
                option
            );

        }
    );


    // -----------------------------------------------------
// Change event.
// -----------------------------------------------------

select.addEventListener(
    "change",
    async event => {

        const value =
            String(
                event.target.value ||
                ""
            ).trim();


        if (!value) {

            return;

        }


        selectedSubjectId =
            value;


        updateSubjectUrl(
            value
        );


        await loadSelectedSubjectResources(
            value
        );

    }
);


wrapper.append(
    label,
    select
);
    // -----------------------------------------------------
    // Insert selector.
    //
    // Prefer inserting immediately before the resource
    // container.
    // -----------------------------------------------------

    if (resourcesContainer) {

        resourcesContainer.parentNode.insertBefore(
            wrapper,
            resourcesContainer
        );

    }


    subjectSelector =
        select;


    return select;

}


// =========================================================
// UPDATE URL
// =========================================================

function updateSubjectUrl(
    subjectId
) {

    const url =
        new URL(
            window.location.href
        );


    if (subjectId) {

        url.searchParams.set(
            "subject_id",
            subjectId
        );

    }

    else {

        url.searchParams.delete(
            "subject_id"
        );

    }


    window.history.replaceState(
        {},
        "",
        url
    );

}


// =========================================================
// SET SELECTED SUBJECT
// =========================================================

function setSelectedSubject(
    subjectId
) {

    if (!subjectSelector) {

        return;

    }


    const safeId =
        String(
            subjectId || ""
        ).trim();


    subjectSelector.value =
        safeId;

}


// =========================================================
// FIND SUBJECT
// =========================================================

function findSubject(
    subjectId
) {

    const safeId =
        String(
            subjectId || ""
        ).trim();


    return availableSubjects.find(
        subject => {

            const id =
                String(
                    subject?.id ??
                    subject?.subject_id ??
                    ""
                ).trim();


            return id === safeId;

        }
    ) || null;

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
            subject?.title ||
            "Study Resources";

    }


    if (subjectDescription) {

        subjectDescription.textContent =
            subject?.description ||
            "Study resources for this subject.";

    }

}


// =========================================================
// LOAD SELECTED SUBJECT RESOURCES
// =========================================================

async function loadSelectedSubjectResources(
    subjectId
) {

    const safeId =
        String(
            subjectId || ""
        ).trim();


    if (!safeId) {

        if (subjectName) {

            subjectName.textContent =
                "Study Resources";

        }


        if (subjectDescription) {

            subjectDescription.textContent =
                "Select a subject to view available study resources.";

        }


        if (resourcesContainer) {

            resourcesContainer.innerHTML =
                "";

        }


        return;

    }


    showLoading();


    try {

        const result =
            await apiRequest(

                `/subjects/${encodeURIComponent(
                    safeId
                )}/resources`

            );


        const payload =
            getPayload(
                result
            );


        const subject =
            payload?.subject ||
            findSubject(
                safeId
            );


        const resources =
            extractArray(
                payload,
                [
                    "resources",
                    "items",
                    "results"
                ]
            );


        if (!subject) {

            throw new ApiError(
                "The selected subject could not be found.",
                404
            );

        }


        renderSubject(
            subject
        );


        setSelectedSubject(
            safeId
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
// INITIAL SUBJECT SCREEN
// =========================================================

function renderSubjectSelectionState() {

    if (subjectName) {

        subjectName.textContent =
            "Study Resources";

    }


    if (subjectDescription) {

        subjectDescription.textContent =
            "Select a subject to view available study resources.";

    }


    if (!resourcesContainer) {

        return;

    }


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
        "fas fa-book-open";

    icon.setAttribute(
        "aria-hidden",
        "true"
    );


    const title =
        document.createElement(
            "h3"
        );

    title.textContent =
        "Choose a Subject";


    const text =
        document.createElement(
            "p"
        );

    text.textContent =
        "Select a subject above to view its study resources.";


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
// RESOURCE ACCESS NORMALIZATION
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

    if (!resourcesContainer) {
        return;
    }


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
    // VIEW
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
    // DOWNLOAD
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
// RESOURCE FILE REQUEST
// =========================================================

async function requestResourceFile(
    resourceId,
    action
) {

    const token =
        getStudentToken();


    if (!token) {

        window.location.replace(
            LOGIN_PAGE
        );

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
        response.status ===
        401
    ) {

        const message =
            await getResponseMessage(
                response
            );

        throw new ApiError(

            message ||
            "Unable to access this study resource.",

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

        let result =
            null;


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
        [
            "pdf",
            "docx",
            "xlsx",
            "csv"
        ].includes(type)
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
        fileName ||
        "study-resource";


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

// =========================================================
// RESOURCE NOTIFICATION
// =========================================================

function showResourceNotification(
    message,
    type = "info",
    duration = 3500
) {

    const existing =
        document.getElementById(
            "nursephereResourceNotification"
        );

    if (existing) {
        existing.remove();
    }

    const overlay =
        document.createElement("div");

    overlay.id =
        "nursephereResourceNotification";

    Object.assign(
        overlay.style,
        {
            position: "fixed",
            inset: "0",
            background: "rgba(15, 23, 42, 0.38)",
            backdropFilter: "blur(4px)",
            WebkitBackdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
            zIndex: "99999",
            animation: "nursephereNoticeFadeIn 0.2s ease"
        }
    );

    const box =
        document.createElement("div");

    Object.assign(
        box.style,
        {
            width: "100%",
            maxWidth: "430px",
            background: "#ffffff",
            borderRadius: "20px",
            padding: "30px",
            boxShadow:
                "0 25px 70px rgba(0,0,0,0.22)",
            textAlign: "center",
            fontFamily:
                "Noto Sans, Arial, sans-serif"
        }
    );

    const icon =
        document.createElement("div");

    icon.textContent =
        type === "success"
            ? "✓"
            : type === "error"
                ? "!"
                : "i";

    Object.assign(
        icon.style,
        {
            width: "58px",
            height: "58px",
            margin: "0 auto 18px",
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "28px",
            fontWeight: "800",
            background:
                type === "success"
                    ? "#e8f7ee"
                    : type === "error"
                        ? "#fff0f0"
                        : "#eef5ff",
            color:
                type === "success"
                    ? "#16834a"
                    : type === "error"
                        ? "#d93025"
                        : "#1459c7"
        }
    );

    const title =
        document.createElement("h3");

    title.textContent =
        type === "success"
            ? "Success"
            : type === "error"
                ? "Unable to Complete"
                : "Study Resource";

    Object.assign(
        title.style,
        {
            margin: "0 0 10px",
            fontSize: "21px",
            fontWeight: "800",
            color: "#0b2545"
        }
    );

    const text =
        document.createElement("p");

    text.textContent =
        message;

    Object.assign(
        text.style,
        {
            margin: "0",
            fontSize: "15px",
            lineHeight: "1.6",
            color: "#64748b"
        }
    );

    const closeButton =
        document.createElement("button");

    closeButton.type =
        "button";

    closeButton.textContent =
        "OK";

    Object.assign(
        closeButton.style,
        {
            marginTop: "24px",
            minWidth: "110px",
            padding: "11px 24px",
            border: "none",
            borderRadius: "10px",
            background: "#0b3b78",
            color: "#ffffff",
            fontSize: "14px",
            fontWeight: "700",
            cursor: "pointer"
        }
    );

    closeButton.addEventListener(
        "click",
        () => overlay.remove()
    );

    box.append(
        icon,
        title,
        text,
        closeButton
    );

    overlay.appendChild(box);

    document.body.appendChild(
        overlay
    );

    if (
        type === "success" &&
        duration > 0
    ) {
        setTimeout(
            () => {
                if (
                    document.body.contains(
                        overlay
                    )
                ) {
                    overlay.remove();
                }
            },
            duration
        );
    }
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
            "This study resource could not be identified. Please refresh the page and try again.",
            "error"
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


        alert(

            error?.message ||
            "Unable to open this study resource.",
            "error"

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
// LOAD SUBJECT LIST
// =========================================================

async function loadSubjectList() {

    showLoading(
        "Loading available subjects..."
    );


    try {

        availableSubjects =
            await loadAllSubjects();


        if (
            !availableSubjects.length
        ) {

            if (subjectName) {

                subjectName.textContent =
                    "Study Resources";

            }


            if (subjectDescription) {

                subjectDescription.textContent =
                    "No subjects are currently available.";

            }


            if (resourcesContainer) {

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
                    "fas fa-book-open";


                const title =
                    document.createElement(
                        "h3"
                    );

                title.textContent =
                    "No Subjects Available";


                const text =
                    document.createElement(
                        "p"
                    );

                text.textContent =
                    "No subjects have been published yet.";


                empty.append(
                    icon,
                    title,
                    text
                );


                resourcesContainer.appendChild(
                    empty
                );

            }


            return;

        }


        createSubjectSelector();


        // -------------------------------------------------
        // If URL contains a valid subject, load it.
        // -------------------------------------------------

        if (
            initialSubjectId &&
            findSubject(
                initialSubjectId
            )
        ) {

            selectedSubjectId =
                initialSubjectId;


            setSelectedSubject(
                initialSubjectId
            );


            await loadSelectedSubjectResources(
                initialSubjectId
            );


            return;

        }


        // -------------------------------------------------
        // Otherwise show the subject-selection state.
        // -------------------------------------------------

        selectedSubjectId =
            "";


        renderSubjectSelectionState();

    }

    catch (error) {

        console.error(
            "Nursephere subject loading error:",
            error
        );


        showError(

            error?.message ||
            "Unable to load available subjects."

        );

    }

}


// =========================================================
// INITIALIZATION
// =========================================================

async function initializeResourcesPage() {

    // -----------------------------------------------------
    // Authentication is mandatory.
    // -----------------------------------------------------

    if (!verifyLogin()) {

        return;

    }


    // -----------------------------------------------------
    // Load subjects independently.
    // -----------------------------------------------------

    await loadSubjectList();

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