"use strict";

/*
=========================================================
    NURSEPHERE ADMIN
    BULK QUESTION IMPORT
=========================================================

    Supported:
        DOCX
        XLSX
        XLS

    Flow:

        Selected Exam
             ↓
        Selected Subject
             ↓
        Upload File
             ↓
        /api/admin/questions/import
             ↓
        Parser Worker
             ↓
        Validate
             ↓
        Duplicate Check
             ↓
        D1 Batch Insert

    IMPORTANT:
        This file owns the import form.

        questions.js must NOT contain another
        import submit handler.

=========================================================
*/


/*=========================================================
    API
=========================================================*/

const QUESTIONS_IMPORT_API =

    "/api/admin/questions/import";


/*=========================================================
    DOM
=========================================================*/

const importForm =
    document.getElementById(
        "importForm"
    );

const importSubject =
    document.getElementById(
        "importSubject"
    );

const questionFile =
    document.getElementById(
        "questionFile"
    );


/*=========================================================
    STATE
=========================================================*/

let importInProgress =
    false;


/*=========================================================
    INITIALIZE
=========================================================*/

document.addEventListener(

    "DOMContentLoaded",

    initializeQuestionImporter

);


function initializeQuestionImporter() {

    if (!importForm) {

        return;

    }


    importForm.addEventListener(

        "submit",

        handleQuestionImport

    );


    questionFile?.addEventListener(

        "change",

        validateSelectedFile

    );

}


/*=========================================================
    MAIN IMPORT
=========================================================*/

async function handleQuestionImport(
    event
) {

    event.preventDefault();


    if (
        importInProgress
    ) {

        return;

    }


    const examSelect =
        document.getElementById(
            "examSelect"
        );


    const examId =
        String(
            examSelect?.value || ""
        ).trim();


    const subjectId =
        String(
            importSubject?.value || ""
        ).trim();


    const file =
        questionFile?.files?.[0];


    /*-----------------------------------------------------
        EXAM
    -----------------------------------------------------*/

    if (!examId) {

        notifyUser(

            "Please select an exam.",

            "error"

        );

        examSelect?.focus();

        return;

    }


    /*-----------------------------------------------------
        SUBJECT
    -----------------------------------------------------*/

    if (!subjectId) {

        notifyUser(

            "Please select a subject.",

            "error"

        );

        importSubject?.focus();

        return;

    }


    /*-----------------------------------------------------
        FILE
    -----------------------------------------------------*/

    if (!file) {

        notifyUser(

            "Please select a question file.",

            "error"

        );

        questionFile?.focus();

        return;

    }


    if (
        !validateSelectedFile()
    ) {

        return;

    }


    /*-----------------------------------------------------
        START
    -----------------------------------------------------*/

    importInProgress =
        true;


    const submitButton =
        importForm.querySelector(

            'button[type="submit"]'

        );


    setButtonLoading(

        submitButton,

        "Importing Questions..."

    );


    try {

        notifyUser(

            "Uploading and importing questions...",

            "info"

        );


        /*
        -------------------------------------------------
            FORM DATA

            IMPORTANT:
            Do NOT manually set Content-Type.

            Browser must generate the multipart
            boundary automatically.
        -------------------------------------------------
        */

        const formData =
            new FormData();


        formData.append(

            "exam_id",

            examId

        );


        formData.append(

            "subject_id",

            subjectId

        );


        formData.append(

            "file",

            file,

            file.name

        );


        /*
        -------------------------------------------------
            REQUEST
        -------------------------------------------------
        */

        const response =
            await fetch(

                QUESTIONS_IMPORT_API,

                {

                    method:
                        "POST",

                    headers: {

                        "Accept":
                            "application/json"

                    },

                    body:
                        formData,

                    cache:
                        "no-store"

                }

            );


        const result =
            await parseJSON(
                response
            );


        /*
        -------------------------------------------------
            HTTP ERROR
        -------------------------------------------------
        */

        if (
            !response.ok
        ) {

            const error =
                new Error(

                    result?.message ||

                    `Import failed (${response.status}).`

                );


            error.details =
                Array.isArray(
                    result?.errors
                )

                    ? result.errors

                    : [];


            throw error;

        }


        /*
        -------------------------------------------------
            API ERROR
        -------------------------------------------------
        */

        if (
            result?.success !== true
        ) {

            const error =
                new Error(

                    result?.message ||

                    "Question import failed."

                );


            error.details =
                Array.isArray(
                    result?.errors
                )

                    ? result.errors

                    : [];


            throw error;

        }


        /*
        -------------------------------------------------
            SUCCESS
        -------------------------------------------------
        */

        const imported =
            Number(
                result.imported || 0
            );


        const skipped =
            Number(
                result.skipped || 0
            );


        let message =

            `${imported} question` +

            (
                imported === 1
                    ? ""
                    : "s"
            ) +

            " imported successfully.";


        if (
            skipped > 0
        ) {

            message +=

                ` ${skipped} skipped.`;

        }


        notifyUser(

            message,

            skipped > 0
                ? "warning"
                : "success"

        );


        /*
        -------------------------------------------------
            RESET FILE
        -------------------------------------------------
        */

        importForm.reset();


        /*
        -------------------------------------------------
            REFRESH QUESTION BANK
        -------------------------------------------------
        */

        if (

            typeof window.loadQuestions ===
            "function"

        ) {

            await window.loadQuestions();

        }

        else {

            /*
                If questions.js keeps loadQuestions
                private, refresh the page so the
                newly imported questions appear.
            */

            window.setTimeout(

                () => {

                    window.location.reload();

                },

                500

            );

        }

    }

    catch (error) {

        console.error(

            "Question Import:",

            error

        );


        let message =

            error?.message ||

            "Question import failed.";


        /*
        -------------------------------------------------
            DISPLAY FIRST VALIDATION ERROR
        -------------------------------------------------
        */

        if (

            Array.isArray(
                error?.details
            ) &&

            error.details.length

        ) {

            const firstError =
                error.details[0];


            if (
                firstError?.question
            ) {

                message +=

                    ` Question ${firstError.question}: ` +

                    (
                        firstError.error ||

                        "Invalid question."

                    );

            }

        }


        notifyUser(

            message,

            "error"

        );

    }

    finally {

        importInProgress =
            false;


        restoreButton(

            submitButton,

            "Import Questions"

        );

    }

}


/*=========================================================
    FILE VALIDATION
=========================================================*/

function validateSelectedFile() {

    if (!questionFile) {

        return false;

    }


    const file =
        questionFile.files?.[0];


    if (!file) {

        return false;

    }


    const fileName =
        String(
            file.name || ""
        )
        .trim()
        .toLowerCase();


    const allowedExtensions = [

        ".docx",

        ".xlsx",

        ".xls"

    ];


    const validExtension =
        allowedExtensions.some(

            extension =>

                fileName.endsWith(
                    extension
                )

        );


    if (!validExtension) {

        notifyUser(

            "Only DOCX, XLSX and XLS files are supported.",

            "error"

        );


        questionFile.value =
            "";


        return false;

    }


    /*
        Keep this aligned with the
        parser worker limit.
    */

    const MAX_FILE_SIZE =
        25 * 1024 * 1024;


    if (
        file.size >
        MAX_FILE_SIZE
    ) {

        notifyUser(

            "The selected file is too large. Maximum size is 25 MB.",

            "error"

        );


        questionFile.value =
            "";


        return false;

    }


    return true;

}


/*=========================================================
    API RESPONSE
=========================================================*/

async function parseJSON(
    response
) {

    const text =
        await response.text();


    if (!text) {

        return {};

    }


    try {

        return JSON.parse(
            text
        );

    }

    catch {

        throw new Error(

            `The server returned an invalid response (${response.status}).`

        );

    }

}


/*=========================================================
    BUTTON STATE
=========================================================*/

function setButtonLoading(

    button,

    text

) {

    if (!button) {

        return;

    }


    if (
        !button.dataset.originalText
    ) {

        button.dataset.originalText =
            button.textContent.trim();

    }


    button.disabled =
        true;


    button.textContent =
        text;

}


function restoreButton(

    button,

    fallbackText

) {

    if (!button) {

        return;

    }


    button.disabled =
        false;


    button.textContent =

        button.dataset.originalText ||

        fallbackText;


    delete button.dataset.originalText;

}


/*=========================================================
    NOTIFICATIONS
=========================================================*/

function notifyUser(

    message,

    type = "info"

) {

    /*
        Use the existing project notification
        system if available.
    */

    if (

        typeof window.notifyUser ===
        "function"

    ) {

        window.notifyUser(

            message,

            type

        );

        return;

    }


    /*
        Fallback to project Utils.
    */

    if (

        window.Utils &&

        typeof window.Utils.showToast ===
        "function"

    ) {

        window.Utils.showToast(

            message,

            type

        );

        return;

    }


    /*
        Final fallback.
    */

    if (
        type === "error"
    ) {

        console.error(
            message
        );

    }

    else {

        console.log(
            message
        );

    }


    alert(
        message
    );

}