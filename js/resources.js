/*
=========================================================
    NurseSphere Study Resources Controller
    File: student/js/resources.js
=========================================================
*/

"use strict";


/* =====================================================
   CONFIGURATION
===================================================== */

const API_BASE =
    "https://nursephere.wamalwaemily.workers.dev/api";


/* =====================================================
   DOM ELEMENTS
===================================================== */

const subjectName =
    document.getElementById("subjectName");

const subjectDescription =
    document.getElementById("subjectDescription");

const resourcesContainer =
    document.getElementById("resourcesContainer");


/* =====================================================
   URL PARAMETERS
===================================================== */

const urlParams =
    new URLSearchParams(window.location.search);

const subjectId =
    urlParams.get("subject_id");


/* =====================================================
   AUTHENTICATION
===================================================== */

function getToken() {

    return localStorage.getItem("studentToken");

}


/* =====================================================
   API REQUEST
===================================================== */

async function apiRequest(
    endpoint,
    options = {}
) {

    const token =
        getToken();


    if (!token) {

        window.location.replace(
            "../login.html"
        );

        throw new Error(
            "Your session has expired."
        );

    }


    const headers = {

        "Authorization":
            `Bearer ${token}`,

        "Accept":
            "application/json",

        ...(options.headers || {})

    };


    let response;

    try {

        response = await fetch(
            `${API_BASE}${endpoint}`,
            {
                ...options,
                headers,
                cache: "no-store"
            }
        );

    }

    catch (error) {

        console.error(
            "NurseSphere API error:",
            error
        );

        throw new Error(
            "Unable to connect to NurseSphere."
        );

    }


    /* -----------------------------------------------
       Authentication failure
    ------------------------------------------------ */

    if (response.status === 401) {

        localStorage.removeItem(
            "studentToken"
        );

        localStorage.removeItem(
            "student"
        );

        localStorage.removeItem(
            "studentId"
        );

        window.location.replace(
            "../login.html"
        );

        throw new Error(
            "Your session has expired."
        );

    }


    let result;

    try {

        result =
            await response.json();

    }

    catch {

        throw new Error(
            "The server returned an invalid response."
        );

    }


    if (
        !response.ok ||
        result?.success === false
    ) {

        throw new Error(
            result?.message ||
            "Unable to load study resources."
        );

    }


    return result;

}


/* =====================================================
   LOADING STATE
===================================================== */

function showLoading() {

    resourcesContainer.innerHTML = "";


    const loading =
        document.createElement("div");


    loading.className =
        "empty-state";


    const icon =
        document.createElement("i");


    icon.className =
        "fas fa-spinner fa-spin";


    const title =
        document.createElement("h3");


    title.textContent =
        "Loading Study Resources";


    const text =
        document.createElement("p");


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


/* =====================================================
   ERROR STATE
===================================================== */

function showError(
    message,
    showRetry = true
) {

    resourcesContainer.innerHTML = "";


    const empty =
        document.createElement("div");


    empty.className =
        "empty-state";


    const icon =
        document.createElement("i");


    icon.className =
        "fas fa-circle-exclamation";


    const title =
        document.createElement("h3");


    title.textContent =
        "Unable to Load Resources";


    const text =
        document.createElement("p");


    text.textContent =
        message;


    empty.append(
        icon,
        title,
        text
    );


    if (showRetry) {

        const retry =
            document.createElement("button");


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


/* =====================================================
   LOAD SUBJECT + RESOURCES
===================================================== */

async function loadSubjectResources() {

    showLoading();


    try {

        /*
        The Worker endpoint returns:

        {
            success: true,
            subject: {...},
            resources: [...]
        }

        The subject_id comes directly from
        practice.js.
        */

        const result =
            await apiRequest(
                `/subjects/${encodeURIComponent(subjectId)}/resources`
            );


        if (!result.subject) {

            throw new Error(
                "The selected subject could not be found."
            );

        }


        renderSubject(
            result.subject
        );


        renderResources(
            Array.isArray(result.resources)
                ? result.resources
                : []
        );

    }

    catch (error) {

        console.error(
            "NurseSphere Resources:",
            error
        );


        showError(
            error.message ||
            "Unable to load study resources."
        );

    }

}


/* =====================================================
   RENDER SUBJECT
===================================================== */

function renderSubject(subject) {

    subjectName.textContent =
        subject?.name ||
        "Study Resources";


    subjectDescription.textContent =
        subject?.description ||
        "Study resources for this subject.";

}


/* =====================================================
   RENDER RESOURCES
===================================================== */

function renderResources(resources) {

    resourcesContainer.innerHTML = "";


    if (!resources.length) {

        renderEmptyResources();

        return;

    }


    const fragment =
        document.createDocumentFragment();


    resources.forEach(
        resource => {

            const card =
                createResourceCard(
                    resource
                );


            fragment.appendChild(
                card
            );

        }
    );


    resourcesContainer.appendChild(
        fragment
    );

}


/* =====================================================
   CREATE RESOURCE CARD
===================================================== */

function createResourceCard(resource) {

    const card =
        document.createElement("article");


    card.className =
        "resource-card";


    /* -----------------------------------------------
       Header
    ------------------------------------------------ */

    const header =
        document.createElement("div");


    header.className =
        "resource-header";


    const title =
        document.createElement("h3");


    title.textContent =
        resource?.title ||
        "Untitled Resource";


    const type =
        document.createElement("span");


    type.textContent =
        resource?.type ||
        "Study Material";


    header.append(
        title,
        type
    );


    /* -----------------------------------------------
       Description
    ------------------------------------------------ */

    const description =
        document.createElement("p");


    description.textContent =
        resource?.description ||
        "Study material for this subject.";


    /* -----------------------------------------------
       Actions
    ------------------------------------------------ */

    const actions =
        document.createElement("div");


    actions.className =
        "resource-actions";


    /* -----------------------------------------------
       View Resource
    ------------------------------------------------ */

    if (resource?.file_url) {

        const viewButton =
            document.createElement("a");


        viewButton.href =
            resource.file_url;


        viewButton.target =
            "_blank";


        viewButton.rel =
            "noopener noreferrer";


        viewButton.className =
            "view-resource";


        viewButton.innerHTML =
            '<i class="fas fa-eye"></i> View Resource';


        actions.appendChild(
            viewButton
        );

    }


    /* -----------------------------------------------
       Download
    ------------------------------------------------ */

    if (resource?.id) {

        const downloadButton =
            document.createElement("button");


        downloadButton.type =
            "button";


        downloadButton.className =
            "download-resource";


        downloadButton.dataset.resourceId =
            resource.id;


        downloadButton.innerHTML =
            '<i class="fas fa-download"></i> Download';


        downloadButton.addEventListener(
            "click",
            () => {

                downloadResource(
                    resource.id,
                    downloadButton
                );

            }
        );


        actions.appendChild(
            downloadButton
        );

    }


    card.append(
        header,
        description,
        actions
    );


    return card;

}


/* =====================================================
   EMPTY RESOURCES
===================================================== */

function renderEmptyResources() {

    const empty =
        document.createElement("div");


    empty.className =
        "empty-state";


    const icon =
        document.createElement("i");


    icon.className =
        "fas fa-folder-open";


    const title =
        document.createElement("h3");


    title.textContent =
        "No Study Resources Available";


    const text =
        document.createElement("p");


    text.textContent =
        "No study books, PDFs, notes, or other resources have been published for this subject yet.";


    empty.append(
        icon,
        title,
        text
    );


    resourcesContainer.appendChild(
        empty
    );

}


/* =====================================================
   DOWNLOAD RESOURCE
===================================================== */

async function downloadResource(
    resourceId,
    button
) {

    if (!resourceId) {

        return;

    }


    const originalHTML =
        button.innerHTML;


    try {

        button.disabled =
            true;


        button.innerHTML =
            '<i class="fas fa-spinner fa-spin"></i> Preparing...';


        /*
        The Worker authenticates the request using
        the student's JWT.
        */

        const result =
            await apiRequest(
                `/resources/${encodeURIComponent(resourceId)}/download`
            );


        if (
            !result.download_url
        ) {

            throw new Error(
                "A download link could not be generated."
            );

        }


        /*
        Open the Worker-authorized download URL.
        */

        window.open(
            result.download_url,
            "_blank",
            "noopener,noreferrer"
        );

    }

    catch (error) {

        console.error(
            "Resource download error:",
            error
        );


        alert(
            error.message ||
            "Unable to download this resource."
        );

    }

    finally {

        button.disabled =
            false;


        button.innerHTML =
            originalHTML;

    }

}


/* =====================================================
   INITIALIZATION
===================================================== */

document.addEventListener(
    "DOMContentLoaded",
    () => {

        /*
        A subject ID is mandatory because this page
        belongs to the subject selected on Practice.
        */

        if (!subjectId) {

            showError(
                "No subject was selected. Please return to Practice and select a subject."
            );

            return;

        }


        /*
        Student authentication is mandatory.
        */

        if (!getToken()) {

            window.location.replace(
                "../login.html"
            );

            return;

        }


        loadSubjectResources();

    }
);