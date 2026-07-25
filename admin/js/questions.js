"use strict";

/*=========================================================
    QUESTION MANAGEMENT
=========================================================*/

document.addEventListener(

    "DOMContentLoaded",

    () => {

        initializePage();

    }

);

/*=========================================================
    INITIALIZE PAGE
=========================================================*/

async function initializePage() {

    await loadExams();

}

/*=========================================================
    LOAD EXAMS
=========================================================*/

async function loadExams() {

    try {

        const examSelect =

            document.getElementById(

                "examSelect"

            );

        examSelect.innerHTML = `

            <option value="">

                Loading Exams...

            </option>

        `;

        const response = await fetch(

            "/api/exams"

        );

        const result =

            await response.json();

        if (!result.success) {

            throw new Error(

                result.message

            );

        }

        examSelect.innerHTML = `

            <option value="">

                Select Exam

            </option>

        `;

        result.exams.forEach(

            exam => {

                examSelect.innerHTML += `

                    <option value="${exam.id}">

                        ${exam.name}

                    </option>

                `;

            }

        );

    }

    catch (error) {

        console.error(

            "Load Exams:",

            error

        );

        document.getElementById(

            "examSelect"

        ).innerHTML = `

            <option value="">

                Failed to load exams

            </option>

        `;

    }

}

await loadExams();

document

    .getElementById("examSelect")

    .addEventListener(

        "change",

        handleExamChange

    );

    /*=========================================================
    LOAD SUBJECTS
=========================================================*/

async function loadSubjects(examId) {

    try {

        const subjectSelect =

            document.getElementById(

                "subjectSelect"

            );

        subjectSelect.innerHTML = `

            <option value="">

                Loading Subjects...

            </option>

        `;

        const response = await fetch(

            `/api/admin/subjects?exam_id=${examId}`

        );

        const result =

            await response.json();

        if (!result.success) {

            throw new Error(

                result.message

            );

        }

        subjectSelect.innerHTML = `

            <option value="">

                Select Subject

            </option>

        `;

        result.subjects.forEach(

            subject => {

                subjectSelect.innerHTML += `

                    <option value="${subject.id}">

                        ${subject.name}

                    </option>

                `;

            }

        );

    }

    catch (error) {

        console.error(

            "Load Subjects:",

            error

        );

        document.getElementById(

            "subjectSelect"

        ).innerHTML = `

            <option value="">

                Failed to load subjects

            </option>

        `;

    }

}