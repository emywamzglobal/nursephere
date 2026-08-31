"use strict";

/*=========================================================
    NURSEPHERE STUDENT PROFILE CONTROLLER

    File:
        js/profile.js

    Production-ready frontend controller.

    DATABASE OWNERSHIP
    ---------------------------------------------------------
    students:
        - student_number
        - full_name
        - email
        - account_status
        - created_at
        - avatar_url
        - exam_id

    student_profiles:
        - first_name
        - last_name
        - phone_number
        - country
        - gender
        - date_of_birth
        - institution_name
        - expected_graduation
        - expected_exam_date
        - study_level

    Other backend sources:
        - subscription
        - student_progress
        - student_activity
        - student_documents

    This file:
        - never determines student identity
        - never hardcodes student information
        - never hardcodes subscription information
        - never hardcodes examinations
        - never overwrites student number
        - never sends email back as an editable field
=========================================================*/


/*=========================================================
    CONFIGURATION
=========================================================*/

const PROFILE_API_BASE =
    "https://nursephere.wamalwaemily.workers.dev/api";


/*=========================================================
    DOM ELEMENTS
=========================================================*/

/*---------------------------------------------------------
    PROFILE FORM
---------------------------------------------------------*/

const profileForm =
    document.querySelector(
        ".profile-form"
    );


/*---------------------------------------------------------
    PERSONAL INFORMATION
---------------------------------------------------------*/

const personalFormGroups =
    profileForm
        ? profileForm.querySelectorAll(
            ".form-group"
        )
        : [];


/*
    The Student Number field was added to the HTML.

    We first try the explicit ID.

    If the page version does not contain the ID,
    the label-based fallback prevents the rest of
    the profile controller from breaking.
*/

const studentNumberInput =
    document.getElementById(
        "studentNumber"
    );


/*
    Existing personal fields.
*/

const firstNameInput =
    getPersonalField(
        "first name",
        0
    );


const lastNameInput =
    getPersonalField(
        "last name",
        1
    );


const emailInput =
    getPersonalField(
        "email address",
        2
    );


const phoneInput =
    getPersonalField(
        "phone number",
        3
    );


const countryInput =
    getPersonalField(
        "country",
        4
    );


const genderSelect =
    getPersonalField(
        "gender",
        5
    );


const dateOfBirthInput =
    getPersonalField(
        "date of birth",
        6
    );


/*---------------------------------------------------------
    PROFILE PHOTO
---------------------------------------------------------*/

const profileImage =
    document.getElementById(
        "profileImage"
    );


const profileUpload =
    document.getElementById(
        "profileUpload"
    );


/*---------------------------------------------------------
    STUDY INFORMATION
---------------------------------------------------------*/

const studyGrid =
    document.querySelector(
        ".study-grid"
    );


const studyFormGroups =
    studyGrid
        ? studyGrid.querySelectorAll(
            ".form-group"
        )
        : [];


/*
    Examination has an explicit ID in the HTML.
*/

const examinationSelect =
    document.getElementById(
        "examinationSelect"
    );


/*
    Study information order:

        0 = Current Examination
        1 = Institution
        2 = Expected Graduation
        3 = Expected Exam Date
        4 = Study Level
*/

const institutionInput =
    getStudyField(
        1,
        "institution"
    );


const graduationInput =
    getStudyField(
        2,
        "graduation"
    );


const examDateInput =
    getStudyField(
        3,
        "exam date"
    );


const studyLevelSelect =
    getStudyField(
        4,
        "study level"
    );


/*---------------------------------------------------------
    SAVE / CANCEL
---------------------------------------------------------*/

const saveButton =
    document.querySelector(
        ".save-btn"
    );


const cancelButton =
    document.querySelector(
        ".cancel-btn"
    );


/*---------------------------------------------------------
    HEADER
---------------------------------------------------------*/

const uploadPhoto =
    document.getElementById(
        "uploadPhoto"
    );


const logoutButton =
    document.getElementById(
        "logoutBtn"
    );


const headerStudentName =
    document.getElementById(
        "headerStudentName"
    );


const studentPlan =
    document.getElementById(
        "studentPlan"
    );


const studentAvatar =
    document.getElementById(
        "studentAvatar"
    );


/*=========================================================
    DOM FIELD HELPERS
=========================================================*/

function normalizeLabel(
    value
) {

    return String(
        value || ""
    )
        .trim()
        .replace(
            /\s+/g,
            " "
        )
        .toLowerCase();

}


/*---------------------------------------------------------
    PERSONAL FIELD LOOKUP
---------------------------------------------------------*/

function getPersonalField(
    labelText,
    fallbackIndex
) {

    if (
        !profileForm
    ) {

        return null;

    }


    const groups =
        profileForm.querySelectorAll(
            ".form-group"
        );


    const targetLabel =
        normalizeLabel(
            labelText
        );


    for (
        const group
        of groups
    ) {

        const label =
            group.querySelector(
                "label"
            );


        if (
            !label
        ) {

            continue;

        }


        if (
            normalizeLabel(
                label.textContent
            ) === targetLabel
        ) {

            return group.querySelector(
                "input, select"
            );

        }

    }


    return groups[
        fallbackIndex
    ]
        ?.querySelector(
            "input, select"
        ) || null;

}


/*---------------------------------------------------------
    STUDY FIELD LOOKUP
---------------------------------------------------------*/

function getStudyField(
    index,
    labelText
) {

    if (
        !studyGrid
    ) {

        return null;

    }


    const groups =
        studyGrid.querySelectorAll(
            ".form-group"
        );


    const targetLabel =
        normalizeLabel(
            labelText
        );


    for (
        const group
        of groups
    ) {

        const label =
            group.querySelector(
                "label"
            );


        if (
            !label
        ) {

            continue;

        }


        const labelValue =
            normalizeLabel(
                label.textContent
            );


        if (
            labelValue.includes(
                targetLabel
            )
        ) {

            return group.querySelector(
                "input, select"
            );

        }

    }


    return groups[
        index
    ]
        ?.querySelector(
            "input, select"
        ) || null;

}


/*=========================================================
    AUTHENTICATION
=========================================================*/

function getStudentToken() {

    return localStorage.getItem(
        "studentToken"
    );

}


/*=========================================================
    VERIFY LOGIN
=========================================================*/

function verifyLogin() {

    const token =
        getStudentToken();


    if (
        !token
    ) {

        window.location.replace(
            "../login.html"
        );

        return false;

    }


    return true;

}


/*=========================================================
    API REQUEST
=========================================================*/

async function apiRequest(
    endpoint,
    options = {}
) {

    const token =
        getStudentToken();


    if (
        !token
    ) {

        throw new Error(
            "Your session has expired."
        );

    }


    const headers = {

        "Authorization":
            `Bearer ${token}`

    };


    /*
        Only send JSON content type when
        the request actually contains JSON.

        This is important for FormData uploads.
    */

    if (
        options.body &&
        !(
            options.body
            instanceof
            FormData
        )
    ) {

        headers[
            "Content-Type"
        ] =
            "application/json";

    }


    const response =
        await fetch(

            `${PROFILE_API_BASE}${endpoint}`,

            {

                ...options,

                headers: {

                    ...headers,

                    ...(options.headers || {})

                }

            }

        );


    /*-----------------------------------------------------
        SESSION EXPIRED
    -----------------------------------------------------*/

    if (
        response.status ===
        401
    ) {

        localStorage.removeItem(
            "studentToken"
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
            "Invalid response from the server."
        );

    }


    if (
        !response.ok
    ) {

        throw new Error(

            result?.message ||

            "Unable to process your request."

        );

    }


    return result;

}


/*=========================================================
    LOAD PROFILE
=========================================================*/

async function loadProfile() {

    if (
        !verifyLogin()
    ) {

        return;

    }


    try {

        const result =
            await apiRequest(
                "/profile"
            );


        if (
            !result ||
            !result.success
        ) {

            throw new Error(

                result?.message ||

                "Unable to load your profile."

            );

        }


        await populateProfile(
            result
        );

    }

    catch (
        error
    ) {

        console.error(
            "NurseSphere Profile Error:",
            error
        );


        showProfileError(
            error.message
        );

    }

}


/*=========================================================
    LOAD ADMIN-MANAGED EXAMINATIONS
=========================================================*/

async function loadExaminations(
    selectedExamId = ""
) {

    if (
        !examinationSelect
    ) {

        return;

    }


    examinationSelect.innerHTML =
        "";


    const loadingOption =
        document.createElement(
            "option"
        );


    loadingOption.value =
        "";


    loadingOption.textContent =
        "Loading examinations...";


    examinationSelect.appendChild(
        loadingOption
    );


    try {

        const result =
            await apiRequest(
                "/exams"
            );


        /*
            Accept the response structures
            used by the existing examinations API.
        */

        const exams =

            Array.isArray(
                result?.exams
            )

                ? result.exams

                : Array.isArray(
                    result?.data
                )

                    ? result.data

                    : Array.isArray(
                        result?.results
                    )

                        ? result.results

                        : [];


        examinationSelect.innerHTML =
            "";


        const placeholder =
            document.createElement(
                "option"
            );


        placeholder.value =
            "";


        placeholder.textContent =
            "Select Examination";


        examinationSelect.appendChild(
            placeholder
        );


        exams.forEach(
            exam => {

                if (
                    !exam
                ) {

                    return;

                }


                const id =

                    exam.id ??

                    exam.exam_id ??

                    "";


                const name =

                    exam.name ||

                    exam.title ||

                    exam.exam_name ||

                    exam.display_name ||

                    "";


                if (
                    !id ||
                    !name
                ) {

                    return;

                }


                const option =
                    document.createElement(
                        "option"
                    );


                option.value =
                    String(
                        id
                    );


                option.textContent =
                    String(
                        name
                    );


                examinationSelect.appendChild(
                    option
                );

            }
        );


        /*
            The database stores the exam ID.
            Always restore by ID, not by display name.
        */

        if (
            selectedExamId
        ) {

            examinationSelect.value =
                String(
                    selectedExamId
                );

        }

    }

    catch (
        error
    ) {

        console.error(
            "Examination Load Error:",
            error
        );


        examinationSelect.innerHTML =
            "";


        const errorOption =
            document.createElement(
                "option"
            );


        errorOption.value =
            "";


        errorOption.textContent =
            "Unable to load examinations";


        examinationSelect.appendChild(
            errorOption
        );

    }

}


/*=========================================================
    POPULATE PROFILE
=========================================================*/

async function populateProfile(
    data
) {

    const profile =
        data?.profile || {};


    const subscription =
        data?.subscription || {};


    const summary =
        data?.summary || {};


    /*-----------------------------------------------------
        STUDENT NUMBER
        Source:
            students.student_number

        Read-only.
    -----------------------------------------------------*/

    setInputValue(
        studentNumberInput,
        profile.student_number
    );


    if (
        studentNumberInput
    ) {

        studentNumberInput.readOnly =
            true;

    }


    /*-----------------------------------------------------
        FIRST NAME
    -----------------------------------------------------*/

    setInputValue(
        firstNameInput,
        profile.first_name
    );


    /*-----------------------------------------------------
        LAST NAME
    -----------------------------------------------------*/

    setInputValue(
        lastNameInput,
        profile.last_name
    );


    /*-----------------------------------------------------
        EMAIL
        Source:
            students.email

        Read-only.
    -----------------------------------------------------*/

    setInputValue(
        emailInput,
        profile.email
    );


    if (
        emailInput
    ) {

        emailInput.readOnly =
            true;

    }


    /*-----------------------------------------------------
        PHONE
    -----------------------------------------------------*/

    setInputValue(
        phoneInput,
        profile.phone_number
    );


    /*-----------------------------------------------------
        COUNTRY
    -----------------------------------------------------*/

    setInputValue(
        countryInput,
        profile.country
    );


    /*-----------------------------------------------------
        GENDER
    -----------------------------------------------------*/

    setSelectValue(
        genderSelect,
        profile.gender
    );


    /*-----------------------------------------------------
        DATE OF BIRTH
    -----------------------------------------------------*/

    setInputValue(
        dateOfBirthInput,
        formatInputDate(
            profile.date_of_birth
        )
    );


    /*-----------------------------------------------------
        EXAMINATIONS
    -----------------------------------------------------*/

    await loadExaminations(
        profile.examination_id
    );


    /*-----------------------------------------------------
        INSTITUTION
    -----------------------------------------------------*/

    setInputValue(
        institutionInput,
        profile.institution_name
    );


    /*-----------------------------------------------------
        EXPECTED GRADUATION
    -----------------------------------------------------*/

    setInputValue(
        graduationInput,
        formatInputDate(
            profile.expected_graduation
        )
    );


    /*-----------------------------------------------------
        EXPECTED EXAM DATE
    -----------------------------------------------------*/

    setInputValue(
        examDateInput,
        formatInputDate(
            profile.expected_exam_date
        )
    );


    /*-----------------------------------------------------
        STUDY LEVEL
    -----------------------------------------------------*/

    setSelectValue(
        studyLevelSelect,
        profile.study_level
    );


    /*-----------------------------------------------------
        HEADER NAME
    -----------------------------------------------------*/

    const fullName =

        profile.full_name ||

        buildFullName(
            profile.first_name,
            profile.last_name
        ) ||

        "Student";


    if (
        headerStudentName
    ) {

        headerStudentName.textContent =
            fullName;

    }


    /*-----------------------------------------------------
        HEADER PLAN
    -----------------------------------------------------*/

    if (
        studentPlan
    ) {

        studentPlan.textContent =

            subscription.plan_name ||

            summary.current_plan ||

            "No Active Plan";

    }

/*=========================================================
    LOAD PROFILE AVATAR
=========================================================*/

async function loadProfileAvatar(
    studentId
) {

    if (
        !studentId
    ) {
        return;
    }

    const token =
        getStudentToken();

    if (
        !token
    ) {
        return;
    }

    try {

        const response =
            await fetch(
                `${PROFILE_API_BASE}/avatar/${encodeURIComponent(studentId)}`,
                {
                    method: "GET",

                    headers: {
                        "Authorization":
                            `Bearer ${token}`
                    }
                }
            );

        if (
            !response.ok
        ) {
            return;
        }

        const blob =
            await response.blob();

        if (
            !blob ||
            !blob.type.startsWith("image/")
        ) {
            return;
        }

        const imageUrl =
            URL.createObjectURL(
                blob
            );

        setAvatar(
            imageUrl
        );

    }

    catch (
        error
    ) {

        console.error(
            "Unable to load profile avatar:",
            error
        );

    }

}
    /*-----------------------------------------------------
        AVATAR
    -----------------------------------------------------*/

    loadProfileAvatar(
    profile.student_id
);


    /*-----------------------------------------------------
        SUMMARY CARDS
    -----------------------------------------------------*/

    populateSummary(
        summary
    );

}


/*=========================================================
    SUMMARY CARDS
=========================================================*/

function populateSummary(
    summary
) {

    const cards =
        document.querySelectorAll(
            ".summary-card"
        );


    cards.forEach(
        card => {

            const heading =
                card.querySelector(
                    "h3"
                );


            const value =
                card.querySelector(
                    "h2"
                );


            if (
                !heading ||
                !value
            ) {

                return;

            }


            const label =
                normalizeLabel(
                    heading.textContent
                );


            /*---------------------------------------------
                MEMBER SINCE
            ---------------------------------------------*/

            if (
                label ===
                "member since"
            ) {

                value.textContent =
                    formatMemberSince(
                        summary.member_since
                    );

                return;

            }


            /*---------------------------------------------
                CURRENT PLAN
            ---------------------------------------------*/

            if (
                label ===
                "current plan"
            ) {

                value.textContent =

                    summary.current_plan ||

                    "No Active Plan";

                return;

            }


            /*---------------------------------------------
                QUESTIONS ANSWERED
            ---------------------------------------------*/

            if (
                label ===
                "questions answered"
            ) {

                value.textContent =
                    formatNumber(
                        summary.questions_answered
                    );

                return;

            }


            /*---------------------------------------------
                PRACTICE SESSIONS
            ---------------------------------------------*/

            if (
                label ===
                "practice sessions"
            ) {

                value.textContent =
                    formatNumber(
                        summary.practice_sessions
                    );

                return;

            }


            /*---------------------------------------------
                DOCUMENTS UPLOADED
            ---------------------------------------------*/

            if (
                label ===
                "documents uploaded"
            ) {

                value.textContent =
                    formatNumber(
                        summary.documents_uploaded
                    );

                return;

            }


            /*---------------------------------------------
                STUDY STREAK
            ---------------------------------------------*/

            if (
                label ===
                "study streak"
            ) {

                const streak =
                    Number(
                        summary.study_streak || 0
                    );


                value.textContent =

                    `${streak} ${
                        streak === 1
                            ? "Day"
                            : "Days"
                    }`;

                return;

            }

        }
    );

}


/*=========================================================
    SAVE PROFILE
=========================================================*/

async function saveProfile(
    event
) {

    if (
        event
    ) {

        event.preventDefault();

    }


    if (
        !verifyLogin()
    ) {

        return;

    }


    if (
        saveButton
    ) {

        saveButton.disabled =
            true;


        saveButton.dataset.originalText =
            saveButton.innerHTML;


        saveButton.innerHTML =
            "Saving...";

    }


    try {

        /*
            IMPORTANT:

            Student Number is NOT submitted.

            Email is NOT submitted.

            Those are account identity fields
            owned by students.
        */

        const payload = {

            first_name:
                getInputValue(
                    firstNameInput
                ),


            last_name:
                getInputValue(
                    lastNameInput
                ),


            phone_number:
                getInputValue(
                    phoneInput
                ),


            country:
                getInputValue(
                    countryInput
                ),


            gender:
                normalizeGender(
                    getInputValue(
                        genderSelect
                    )
                ),


            date_of_birth:
                getInputValue(
                    dateOfBirthInput
                ),


            examination_id:
                getInputValue(
                    examinationSelect
                ),


            institution_name:
                getInputValue(
                    institutionInput
                ),


            expected_graduation:
                getInputValue(
                    graduationInput
                ),


            expected_exam_date:
                getInputValue(
                    examDateInput
                ),


            study_level:
                normalizeStudyLevel(
                    getInputValue(
                        studyLevelSelect
                    )
                )

        };


        const result =
            await apiRequest(

                "/profile",

                {

                    method:
                        "PUT",

                    body:
                        JSON.stringify(
                            payload
                        )

                }

            );


        if (
            !result ||
            !result.success
        ) {

            throw new Error(

                result?.message ||

                "Unable to save your profile."

            );

        }


        showProfileMessage(
            result.message ||
            "Profile updated successfully."
        );


        /*
            Database becomes the source
            of truth again after saving.
        */

        await loadProfile();

    }

    catch (
        error
    ) {

        console.error(
            "Profile Save Error:",
            error
        );


        showProfileError(
            error.message
        );

    }

    finally {

        if (
            saveButton
        ) {

            saveButton.disabled =
                false;


            if (
                saveButton.dataset.originalText
            ) {

                saveButton.innerHTML =
                    saveButton.dataset.originalText;

            }

        }

    }

}


/*=========================================================
    CANCEL CHANGES
=========================================================*/

async function cancelChanges(
    event
) {

    if (
        event
    ) {

        event.preventDefault();

    }


    /*
        Do not manually reset individual fields.

        Reload the database-backed profile.
        This guarantees Cancel returns the UI
        to the actual persisted values.
    */

    await loadProfile();

}


/*=========================================================
    OPEN PROFILE UPLOAD
=========================================================*/

function openProfileUpload(
    event
) {

    if (
        event
    ) {

        event.preventDefault();

    }


    if (
        profileUpload
    ) {

        profileUpload.click();

    }

}

/*=========================================================
    PROFILE PHOTO UPLOAD

    Worker contract:

    PUT /api/profile/avatar

    FormData:
        avatar

    Authentication:
        Bearer studentToken
=========================================================*/

async function uploadProfilePhoto() {

    if (
        !profileUpload ||
        !profileUpload.files ||
        !profileUpload.files.length
    ) {

        return;

    }


    const file =
        profileUpload.files[0];


    /*-----------------------------------------------------
        VALIDATE FILE TYPE
    -----------------------------------------------------*/

    const allowedTypes = [

        "image/jpeg",

        "image/png",

        "image/webp"

    ];


    if (
        !allowedTypes.includes(
            file.type
        )
    ) {

        showProfileError(
            "Only JPG, PNG and WebP images are allowed."
        );

        profileUpload.value =
            "";

        return;

    }


    /*-----------------------------------------------------
        VALIDATE FILE SIZE

        Maximum: 5 MB

        Matches the Worker validation.
    -----------------------------------------------------*/

    const MAX_IMAGE_SIZE =
        5 * 1024 * 1024;


    if (
        file.size >
        MAX_IMAGE_SIZE
    ) {

        showProfileError(
            "Avatar image must not exceed 5 MB."
        );

        profileUpload.value =
            "";

        return;

    }


    try {

        /*-------------------------------------------------
            CREATE FORM DATA

            IMPORTANT:

            Worker expects:

                formData.get("avatar")
        -------------------------------------------------*/

        const formData =
            new FormData();


        formData.append(
            "avatar",
            file
        );


        /*-------------------------------------------------
            UPLOAD AVATAR

            Matches Worker exactly:

                PUT /api/profile/avatar
        -------------------------------------------------*/

        const result =
            await apiRequest(

                "/profile/avatar",

                {

                    method:
                        "PUT",

                    body:
                        formData

                }

            );


        /*-------------------------------------------------
            VERIFY SUCCESS
        -------------------------------------------------*/

        if (
            !result ||
            !result.success
        ) {

            throw new Error(

                result?.message ||

                "Unable to upload profile photo."

            );

        }


        /*-------------------------------------------------
            SUCCESS MESSAGE
        -------------------------------------------------*/

        showProfileMessage(

            result.message ||

            "Avatar updated successfully."

        );


        /*-------------------------------------------------
            RELOAD DATABASE PROFILE

            Flow:

            Worker saves image → R2

            Worker saves avatar_key → D1

            loadProfile()

            GET /api/avatar/{studentId}

            setAvatar(imageUrl)

            ↓

            profileImage updated

            studentAvatar updated

            ONE IMAGE EVERYWHERE
        -------------------------------------------------*/

        await loadProfile();

    }

    catch (
        error
    ) {

        console.error(
            "Profile Photo Error:",
            error
        );


        showProfileError(

            error.message ||

            "Unable to upload profile photo."

        );

    }

    finally {

        /*-------------------------------------------------
            RESET FILE INPUT
        -------------------------------------------------*/

        profileUpload.value =
            "";

    }

}

/*=========================================================
    SET AVATAR
=========================================================*/

function setAvatar(
    url
) {

    /*
        No stored image:
        keep the HTML placeholder.
    */

    if (
        !url
    ) {

        return;

    }


    /*
        Only assign values that can actually
        be loaded by the browser.

        R2 object keys such as:
            images/students/123.jpg

        are NOT treated as image URLs.
    */

    if (
        !isBrowserImageUrl(
            url
        )
    ) {

        return;

    }


    if (
        profileImage
    ) {

        profileImage.src =
            url;

    }


    if (
        studentAvatar
    ) {

        studentAvatar.src =
            url;

    }

}


/*=========================================================
    BROWSER IMAGE URL CHECK
=========================================================*/

function isBrowserImageUrl(
    value
) {

    if (
        !value
    ) {

        return false;

    }


    const url =
        String(
            value
        ).trim();


    return (

        url.startsWith(
            "https://"
        )

        ||

        url.startsWith(
            "http://"
        )

        ||

        url.startsWith(
            "data:image/"
        )

        ||

        url.startsWith(
            "blob:"
        )

        ||

        url.startsWith(
            "/"
        )

        ||

        url.startsWith(
            "./"
        )

        ||

        url.startsWith(
            "../"
        )

    );

}


/*=========================================================
    LOGOUT
=========================================================*/

function logout(
    event
) {

    if (
        event
    ) {

        event.preventDefault();

    }


    localStorage.removeItem(
        "studentToken"
    );


    window.location.replace(
        "../login.html"
    );

}


/*=========================================================
    INPUT VALUE
=========================================================*/

function getInputValue(
    element
) {

    if (
        !element
    ) {

        return "";

    }


    return String(
        element.value ?? ""
    ).trim();

}


/*=========================================================
    SET INPUT VALUE
=========================================================*/

function setInputValue(
    element,
    value
) {

    if (
        !element
    ) {

        return;

    }


    element.value =
        value ?? "";

}


/*=========================================================
    SET SELECT VALUE
=========================================================*/

function setSelectValue(
    element,
    value
) {

    if (
        !element
    ) {

        return;

    }


    const target =
        String(
            value ?? ""
        )
        .trim()
        .toLowerCase();


    /*
        Empty database value means:
        leave the select on its placeholder.
    */

    if (
        !target
    ) {

        element.value =
            "";

        return;

    }


    const option =
        Array.from(
            element.options
        )
        .find(
            option => {

                const optionValue =
                    String(
                        option.value ?? ""
                    )
                    .trim()
                    .toLowerCase();


                const optionText =
                    String(
                        option.textContent ?? ""
                    )
                    .trim()
                    .toLowerCase();


                return (

                    optionValue ===
                    target

                    ||

                    optionText ===
                    target

                );

            }
        );


    if (
        option
    ) {

        element.value =
            option.value;

    }

}


/*=========================================================
    NORMALIZE GENDER
=========================================================*/

function normalizeGender(
    value
) {

    const normalized =
        String(
            value ?? ""
        )
        .trim();


    /*
        HTML placeholder values should
        become an empty database value.
    */

    if (
        !normalized ||
        normalizeLabel(
            normalized
        ) ===
        "select gender"
    ) {

        return "";

    }


    return normalized;

}


/*=========================================================
    NORMALIZE STUDY LEVEL
=========================================================*/

function normalizeStudyLevel(
    value
) {

    const normalized =
        String(
            value ?? ""
        )
        .trim();


    /*
        HTML placeholder values should
        become an empty database value.
    */

    if (
        !normalized ||
        normalizeLabel(
            normalized
        ) ===
        "select study stage"
    ) {

        return "";

    }


    return normalized;

}


/*=========================================================
    BUILD FULL NAME
=========================================================*/

function buildFullName(
    firstName,
    lastName
) {

    return [

        firstName,

        lastName

    ]
    .map(
        value =>
            String(
                value ?? ""
            ).trim()
    )
    .filter(
        Boolean
    )
    .join(
        " "
    );

}


/*=========================================================
    FORMAT NUMBER
=========================================================*/

function formatNumber(
    value
) {

    const number =
        Number(
            value ?? 0
        );


    if (
        !Number.isFinite(
            number
        )
    ) {

        return "0";

    }


    return number.toLocaleString(
        "en-US"
    );

}


/*=========================================================
    FORMAT MEMBER SINCE

    Desired display:

        July 23, 2026

    The database keeps the full timestamp.
=========================================================*/

function formatMemberSince(
    date
) {

    if (
        !date
    ) {

        return "Not Available";

    }


    const value =
        String(
            date
        ).trim();


    if (
        !value
    ) {

        return "Not Available";

    }


    /*
        D1 may return:

            2026-07-23 13:04:50

        Normalize the SQL timestamp before
        creating the Date object.
    */

    const normalized =
        value.replace(
            " ",
            "T"
        );


    const parsedDate =
        new Date(
            normalized
        );


    if (
        Number.isNaN(
            parsedDate.getTime()
        )
    ) {

        /*
            Last-resort support for a simple
            YYYY-MM-DD database value.
        */

        const match =
            value.match(
                /^(\d{4})-(\d{2})-(\d{2})/
            );


        if (
            !match
        ) {

            return "Not Available";

        }


        return new Date(

            Number(
                match[1]
            ),

            Number(
                match[2]
            ) - 1,

            Number(
                match[3]
            )

        )
        .toLocaleDateString(

            "en-US",

            {

                year:
                    "numeric",

                month:
                    "long",

                day:
                    "numeric"

            }

        );

    }


    return parsedDate.toLocaleDateString(

        "en-US",

        {

            year:
                "numeric",

            month:
                "long",

            day:
                "numeric"

        }

    );

}


/*=========================================================
    FORMAT DATE INPUT

    Converts database dates into:

        YYYY-MM-DD
=========================================================*/

function formatInputDate(
    date
) {

    if (
        !date
    ) {

        return "";

    }


    const value =
        String(
            date
        ).trim();


    /*
        Already correct for:
            <input type="date">
    */

    if (
        /^\d{4}-\d{2}-\d{2}$/
            .test(
                value
            )
    ) {

        return value;

    }


    /*
        Extract the calendar date directly
        when the database contains a timestamp.

        This avoids timezone shifting.
    */

    const match =
        value.match(
            /^(\d{4})-(\d{2})-(\d{2})/
        );


    if (
        match
    ) {

        return (

            `${match[1]}-` +

            `${match[2]}-` +

            `${match[3]}`

        );

    }


    return "";

}


/*=========================================================
    PROFILE SUCCESS MESSAGE
=========================================================*/

function showProfileMessage(
    message
) {

    console.log(
        "NurseSphere:",
        message
    );


    alert(
        message
    );

}


/*=========================================================
    PROFILE ERROR MESSAGE
=========================================================*/

function showProfileError(
    message
) {

    console.error(
        "NurseSphere Profile Error:",
        message
    );


    alert(

        message ||

        "Unable to process your profile request."

    );

}


/*=========================================================
    EVENT LISTENERS
=========================================================*/

/*---------------------------------------------------------
    SAVE
---------------------------------------------------------*/

if (
    saveButton
) {

    saveButton.addEventListener(
        "click",
        saveProfile
    );

}


/*---------------------------------------------------------
    CANCEL
---------------------------------------------------------*/

if (
    cancelButton
) {

    cancelButton.addEventListener(
        "click",
        cancelChanges
    );

}


/*---------------------------------------------------------
    HEADER PHOTO
---------------------------------------------------------*/

if (
    uploadPhoto
) {

    uploadPhoto.addEventListener(
        "click",
        openProfileUpload
    );

}


/*---------------------------------------------------------
    PROFILE PHOTO INPUT
---------------------------------------------------------*/

if (
    profileUpload
) {

    profileUpload.addEventListener(
        "change",
        uploadProfilePhoto
    );

}


/*---------------------------------------------------------
    LOGOUT
---------------------------------------------------------*/

if (
    logoutButton
) {

    logoutButton.addEventListener(
        "click",
        logout
    );

}


/*=========================================================
    INITIALIZE
=========================================================*/

async function initializeProfile() {

    await loadProfile();

}


/*
    Works whether profile.js is loaded
    before or after DOMContentLoaded.
*/

if (
    document.readyState ===
    "loading"
) {

    document.addEventListener(

        "DOMContentLoaded",

        initializeProfile,

        {
            once: true
        }

    );

}

else {

    initializeProfile();

}