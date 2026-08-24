"use strict";

/* =========================================================
   SUBJECT MANAGEMENT
   ========================================================= */

document.addEventListener("DOMContentLoaded", () => {

    initializeSubjectsPage();

});


/* =========================================================
   STATE
   ========================================================= */

let subjects = [];
let exams = [];


/* =========================================================
   INITIALIZE PAGE
   ========================================================= */

async function initializeSubjectsPage() {

    try {

        await loadExams();

        await loadSubjects();

        setupEventListeners();

    } catch (error) {

        console.error(
            "Subject Management Initialization Error:",
            error
        );

    }

}


/* =========================================================
   EVENT LISTENERS
   ========================================================= */

function setupEventListeners() {

    const form =
        document.getElementById("subjectForm");

    const saveDraftBtn =
        document.getElementById("saveDraftBtn");

    const publishBtn =
        document.getElementById("publishBtn");


    if (form) {

        form.addEventListener(
            "submit",
            handlePublish
        );

    }


    if (saveDraftBtn) {

        saveDraftBtn.addEventListener(
            "click",
            handleSaveDraft
        );

    }


    if (publishBtn) {

        publishBtn.addEventListener(
            "click",
            (event) => {

                event.preventDefault();

                handlePublish();

            }
        );

    }

}


/* =========================================================
   LOAD EXAMS
   GET /api/admin/exams
   ========================================================= */

async function loadExams() {

    const examSelect =
        document.getElementById("subjectExam");

    if (!examSelect) return;


    examSelect.innerHTML = `
        <option value="">
            Loading examinations...
        </option>
    `;


    try {

        const response = await fetch(
            "/api/admin/exams"
        );


        if (!response.ok) {

            throw new Error(
                `Failed to load examinations (${response.status})`
            );

        }


        const result =
            await response.json();


        if (!result.success) {

            throw new Error(
                result.message ||
                "Failed to load examinations."
            );

        }


        exams =
            Array.isArray(result.data)
                ? result.data
                : [];


        const activeExams =
            exams.filter(
                exam =>
                    exam.status === "active"
            );


        examSelect.innerHTML = `
            <option value="">
                Select Examination
            </option>
        `;


        activeExams.forEach(exam => {

            const option =
                document.createElement("option");


            option.value = exam.id;

            option.textContent =
                exam.name;


            examSelect.appendChild(option);

        });


        if (!activeExams.length) {

            examSelect.innerHTML = `
                <option value="">
                    No active examinations available
                </option>
            `;

        }

    } catch (error) {

        console.error(
            "Load Exams Error:",
            error
        );


        examSelect.innerHTML = `
            <option value="">
                Failed to load examinations
            </option>
        `;

    }

}


/* =========================================================
   LOAD SUBJECTS
   GET /api/admin/subjects
   ========================================================= */

async function loadSubjects() {

    const tableBody =
        document.getElementById(
            "subjectsTableBody"
        );

    if (!tableBody) return;


    tableBody.innerHTML = `
        <tr>
            <td colspan="4">
                Loading subjects...
            </td>
        </tr>
    `;


    try {

        const response = await fetch(
            "/api/admin/subjects"
        );


        if (!response.ok) {

            throw new Error(
                `Failed to load subjects (${response.status})`
            );

        }


        const result =
            await response.json();


        if (!result.success) {

            throw new Error(
                result.message ||
                "Failed to load subjects."
            );

        }


        subjects =
            Array.isArray(result.data)
                ? result.data
                : [];


        renderSubjects();

    } catch (error) {

        console.error(
            "Load Subjects Error:",
            error
        );


        tableBody.innerHTML = `
            <tr>
                <td colspan="4">
                    Failed to load subjects.
                </td>
            </tr>
        `;

    }

}


/* =========================================================
   RENDER SUBJECTS TABLE
   ========================================================= */

function renderSubjects() {

    const tableBody =
        document.getElementById(
            "subjectsTableBody"
        );


    if (!tableBody) return;


    tableBody.innerHTML = "";


    if (!subjects.length) {

        tableBody.innerHTML = `
            <tr>
                <td colspan="4">
                    No subjects found.
                </td>
            </tr>
        `;

        return;

    }


    subjects.forEach(subject => {

        const row =
            document.createElement("tr");


        const status =
            subject.status === "active"
                ? "published"
                : "draft";


        row.innerHTML = `

            <td>
                ${escapeHTML(
                    subject.exam_name || "—"
                )}
            </td>

            <td>
                ${escapeHTML(
                    subject.name || "—"
                )}
            </td>

            <td>
                <span class="status-${status}">
                    ${capitalize(status)}
                </span>
            </td>

            <td>

                <button
                    type="button"
                    class="secondary-btn"
                    data-action="edit"
                    data-id="${subject.id}">
                    Edit
                </button>

                <button
                    type="button"
                    class="secondary-btn"
                    data-action="toggle"
                    data-id="${subject.id}">
                    ${
                        status === "published"
                            ? "Unpublish"
                            : "Publish"
                    }
                </button>

                <button
                    type="button"
                    class="secondary-btn"
                    data-action="delete"
                    data-id="${subject.id}">
                    Delete
                </button>

            </td>

        `;


        tableBody.appendChild(row);

    });


    tableBody
        .querySelectorAll("[data-action]")
        .forEach(button => {

            button.addEventListener(
                "click",
                handleTableAction
            );

        });

}


/* =========================================================
   SAVE DRAFT
   POST /api/admin/subjects
   ========================================================= */

async function handleSaveDraft(event) {

    if (event) {
        event.preventDefault();
    }


    await saveSubject("inactive");

}


/* =========================================================
   PUBLISH SUBJECT
   POST /api/admin/subjects
   ========================================================= */

async function handlePublish(event) {

    if (event) {
        event.preventDefault();
    }


    await saveSubject("active");

}


/* =========================================================
   CREATE / UPDATE SUBJECT
   ========================================================= */

async function saveSubject(status) {

    const subjectId =
        document.getElementById(
            "subjectId"
        ).value.trim();


    const examId =
        document.getElementById(
            "subjectExam"
        ).value.trim();


    const name =
        document.getElementById(
            "subjectName"
        ).value.trim();


    const description =
        document.getElementById(
            "subjectDescription"
        ).value.trim();


    if (!examId) {

        alert(
            "Please select an examination."
        );

        return;

    }


    if (!name) {

        alert(
            "Subject name is required."
        );

        return;

    }


    const payload = {

        exam_id: examId,

        name: name,

        description: description,

        status: status

    };


    try {

        let response;


        if (subjectId) {

            response = await fetch(
                `/api/admin/subjects/${encodeURIComponent(subjectId)}`,
                {

                    method: "PUT",

                    headers: {

                        "Content-Type":
                            "application/json"

                    },

                    body:
                        JSON.stringify(payload)

                }
            );

        } else {

            response = await fetch(
                "/api/admin/subjects",
                {

                    method: "POST",

                    headers: {

                        "Content-Type":
                            "application/json"

                    },

                    body:
                        JSON.stringify(payload)

                }
            );

        }


        const result =
            await response.json();


        if (!response.ok ||
            !result.success) {

            throw new Error(
                result.message ||
                "Unable to save subject."
            );

        }


        alert(
            result.message ||
            "Subject saved successfully."
        );


        resetSubjectForm();

        await loadSubjects();

    } catch (error) {

        console.error(
            "Save Subject Error:",
            error
        );


        alert(
            error.message ||
            "Unable to save subject."
        );

    }

}


/* =========================================================
   TABLE ACTIONS
   ========================================================= */

async function handleTableAction(event) {

    const button =
        event.currentTarget;


    const action =
        button.dataset.action;


    const subjectId =
        button.dataset.id;


    if (!subjectId) return;


    if (action === "edit") {

        await editSubject(subjectId);

        return;

    }


    if (action === "toggle") {

        await toggleSubject(subjectId);

        return;

    }


    if (action === "delete") {

        await deleteSubject(subjectId);

    }

}


/* =========================================================
   EDIT SUBJECT
   GET /api/admin/subjects/:id
   ========================================================= */

async function editSubject(subjectId) {

    try {

        const response = await fetch(
            `/api/admin/subjects/${encodeURIComponent(subjectId)}`
        );


        const result =
            await response.json();


        if (!response.ok ||
            !result.success) {

            throw new Error(
                result.message ||
                "Unable to load subject."
            );

        }


        const subject =
            result.data;


        document.getElementById(
            "subjectId"
        ).value = subject.id;


        document.getElementById(
            "subjectExam"
        ).value = subject.exam_id;


        document.getElementById(
            "subjectName"
        ).value = subject.name || "";


        document.getElementById(
            "subjectDescription"
        ).value =
            subject.description || "";


        document.getElementById(
            "subjectStatus"
        ).value =
            subject.status === "active"
                ? "published"
                : "draft";


        window.scrollTo({

            top: 0,

            behavior: "smooth"

        });

    } catch (error) {

        console.error(
            "Edit Subject Error:",
            error
        );


        alert(
            error.message ||
            "Unable to load subject."
        );

    }

}


/* =========================================================
   PUBLISH / UNPUBLISH
   PUT /api/admin/subjects/:id
   ========================================================= */

async function toggleSubject(subjectId) {

    const subject =
        subjects.find(
            item =>
                item.id === subjectId
        );


    if (!subject) return;


    const newStatus =
        subject.status === "active"
            ? "inactive"
            : "active";


    try {

        const response = await fetch(
            `/api/admin/subjects/${encodeURIComponent(subjectId)}`,
            {

                method: "PUT",

                headers: {

                    "Content-Type":
                        "application/json"

                },

                body: JSON.stringify({

                    exam_id:
                        subject.exam_id,

                    name:
                        subject.name,

                    description:
                        subject.description || "",

                    image_url:
                        subject.image_url || "",

                    display_order:
                        subject.display_order || 0,

                    status:
                        newStatus

                })

            }
        );


        const result =
            await response.json();


        if (!response.ok ||
            !result.success) {

            throw new Error(
                result.message ||
                "Unable to update subject status."
            );

        }


        await loadSubjects();

    } catch (error) {

        console.error(
            "Toggle Subject Error:",
            error
        );


        alert(
            error.message ||
            "Unable to update subject."
        );

    }

}


/* =========================================================
   DELETE SUBJECT
   DELETE /api/admin/subjects/:id
   ========================================================= */

async function deleteSubject(subjectId) {

    const confirmed =
        confirm(
            "Delete this subject? It will be deactivated and will no longer be available to students."
        );


    if (!confirmed) return;


    try {

        const response = await fetch(
            `/api/admin/subjects/${encodeURIComponent(subjectId)}`,
            {

                method: "DELETE"

            }
        );


        const result =
            await response.json();


        if (!response.ok ||
            !result.success) {

            throw new Error(
                result.message ||
                "Unable to delete subject."
            );

        }


        await loadSubjects();

    } catch (error) {

        console.error(
            "Delete Subject Error:",
            error
        );


        alert(
            error.message ||
            "Unable to delete subject."
        );

    }

}


/* =========================================================
   RESET FORM
   ========================================================= */

function resetSubjectForm() {

    const form =
        document.getElementById(
            "subjectForm"
        );


    if (form) {

        form.reset();

    }


    document.getElementById(
        "subjectId"
    ).value = "";


    document.getElementById(
        "subjectStatus"
    ).value = "draft";

}


/* =========================================================
   HTML ESCAPING
   ========================================================= */

function escapeHTML(value) {

    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

}


/* =========================================================
   CAPITALIZE
   ========================================================= */

function capitalize(value) {

    if (!value) return "";

    return value.charAt(0).toUpperCase()
        + value.slice(1);

}