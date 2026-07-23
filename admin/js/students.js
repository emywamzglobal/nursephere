"use strict";

/* ===========================================================
   NurseSphere Admin - Students
=========================================================== */

document.addEventListener("DOMContentLoaded", init);

async function init() {

    Auth.requireAdmin();

    loadAdmin();

    await loadStudents();

}

/* ===========================================================
   Load Logged In Admin
=========================================================== */

function loadAdmin() {

    const admin = Auth.getUser();

    if (!admin) return;

    const adminName = document.getElementById("adminName");

    if (adminName) {

        adminName.textContent = admin.name || "Administrator";

    }

}

/* ===========================================================
   Load Students
=========================================================== */

async function loadStudents() {

    const tbody = document.getElementById("studentsTableBody");

    if (!tbody) return;

    tbody.innerHTML = `
        <tr>
            <td colspan="6" class="text-center">
                Loading students...
            </td>
        </tr>
    `;

    try {

        const result = await API.get(API.ADMIN + "/students");

        if (!result.success) {

            throw new Error(result.message || "Unable to load students.");

        }

        renderStudents(result.data || []);

    }

    catch (error) {

        console.error(error);

        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="text-center">
                    Failed to load students.
                </td>
            </tr>
        `;

    }

}

/* ===========================================================
   Render Students
=========================================================== */

function renderStudents(students) {

    const tbody = document.getElementById("studentsTableBody");

    if (!tbody) return;

    if (!students.length) {

        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="text-center">
                    No students found.
                </td>
            </tr>
        `;

        return;

    }

    tbody.innerHTML = students.map(student => {

        const fullName = `${student.first_name || ""} ${student.last_name || ""}`.trim();

        const status = (student.status || "inactive").toLowerCase();

        return `

            <tr>

                <td>

                    <strong>${escapeHtml(fullName)}</strong>

                </td>

                <td>

                    ${escapeHtml(student.email || "-")}

                </td>

                <td>

                    ${escapeHtml(student.exam_name || "-")}

                </td>

                <td>

                    ${escapeHtml(student.subscription_status || "-")}

                </td>

                <td>

                    <span class="status-badge ${status}">

                        ${status}

                    </span>

                </td>

                <td>

                    <button
                        class="action-btn"
                        onclick="viewStudent(${student.id})">

                        View

                    </button>

                </td>

            </tr>

        `;

    }).join("");

}

/* ===========================================================
   View Student
=========================================================== */

window.viewStudent = async function (studentId) {

    try {

        const result = await API.get(

            API.ADMIN + "/students/" + studentId

        );

        if (!result.success) {

            Utils.showToast(

                result.message,

                "error"

            );

            return;

        }

        console.log(result.data);

        alert(

            "Student:\n\n" +

            result.data.first_name +

            " " +

            result.data.last_name +

            "\n\nEmail: " +

            result.data.email

        );

    }

    catch (error) {

        console.error(error);

        Utils.showToast(

            "Unable to load student.",

            "error"

        );

    }

};

/* ===========================================================
   Escape HTML
=========================================================== */

function escapeHtml(value) {

    if (value === null || value === undefined) {

        return "";

    }

    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

}