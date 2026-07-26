/*
=========================================================
    Nursephere Study Resources Controller
    File: student/js/resources.js
=========================================================
*/

"use strict";

/*=========================================================
    Configuration
=========================================================*/
const API_BASE =
    "https://nursephere.wamalwaemily.workers.dev/api";
const ResourceAPI = {

    subjects: "https://nursephere.wamalwaemily.workers.dev/api/subjects",

    resources: "https://nursephere.wamalwaemily.workers.dev/api/resources"

};

/*=========================================================
    DOM Elements
=========================================================*/

const subjectName = document.getElementById("subjectName");

const subjectDescription = document.getElementById("subjectDescription");

const resourcesContainer = document.getElementById("resourcesContainer");

/*=========================================================
    URL Parameters
=========================================================*/

const urlParams = new URLSearchParams(window.location.search);

const subjectId = urlParams.get("subject_id");

const studentId = localStorage.getItem("studentId");

/*=========================================================
    Helper Functions
=========================================================*/

function showError(message) {

    resourcesContainer.innerHTML = `

        <div class="empty-state">

            <i class="fas fa-circle-exclamation"></i>

            <h3>Error</h3>

            <p>${message}</p>

        </div>

    `;

}

/*=========================================================
    Download Resource
=========================================================*/

async function downloadResource(resourceId) {

    try {

        const response = await fetch(
            `${ResourceAPI.resources}/${resourceId}/download`,
            {
                headers: {
                    "student-id": studentId
                }
            }
        );

        const result = await response.json();

        if (!response.ok) {

            throw new Error(result.message || "Unable to download resource.");

        }

        window.open(result.download_url, "_blank");

    } catch (error) {

        console.error(error);

        alert(error.message);

    }

}

/*=========================================================
    Load Functions
=========================================================*/

async function loadSubjectResources() {

    try {

        const response = await fetch(`${ResourceAPI.subjects}/${subjectId}/resources`);

        const result = await response.json();

        if (!response.ok) {

            throw new Error(result.message || "Failed to load resources.");

        }

        renderSubject(result.subject);

        renderResources(result.resources);

    } catch (error) {

        console.error(error);

        showError(error.message);

    }

}

/*=========================================================
    Render Functions
=========================================================*/

function renderSubject(subject) {

    subjectName.textContent = subject.name;

    subjectDescription.textContent = subject.description;

}

function renderResources(resources) {

    if (!resources.length) {

        resourcesContainer.innerHTML = `

            <div class="empty-state">

                <i class="fas fa-folder-open"></i>

                <h3>No Resources Found</h3>

                <p>No study resources are available for this subject.</p>

            </div>

        `;

        return;

    }

    resourcesContainer.innerHTML = resources.map(resource => `

        <div class="resource-card">

            <div class="resource-header">

                <h3>${resource.title}</h3>

                <span>${resource.type}</span>

            </div>

            <p>${resource.description}</p>

            <div class="resource-actions">

    <a href="${resource.file_url}" target="_blank" class="view-resource">
        View Resource
    </a>

    <button
        class="download-resource"
        data-resource-id="${resource.id}">
        Download
    </button>

</div>

        </div>

    `).join("");

}

/*=========================================================
    Event Listeners
=========================================================*/

resourcesContainer.addEventListener("click", (event) => {

    const downloadButton = event.target.closest(".download-resource");

    if (!downloadButton) return;

    const resourceId = downloadButton.dataset.resourceId;

    downloadResource(resourceId);

});



/*=========================================================
    Initialization
=========================================================*/

document.addEventListener("DOMContentLoaded", () => {

    if (!subjectId) {

        showError("Invalid subject selected.");

        return;

    }

    loadSubjectResources();

});