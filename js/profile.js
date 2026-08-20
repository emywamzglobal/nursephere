"use strict";

/*=========================================================
    NurseSphere Student Profile Controller
    File: js/profile.js

    Production-ready.

    Database-driven.
    Authenticated student only.
    No hardcoded student data.
    No hardcoded subscription data.
    No hardcoded examinations.

    Handles:
    - Profile loading
    - Personal information
    - Study information
    - Admin-managed examinations
    - Save Changes
    - Cancel Changes
    - Account summary cards
    - Member Since
    - Header student name
    - Header subscription plan
    - Profile avatar
    - Header avatar synchronization
    - Profile photo upload
    - Logout
    - Session expiry
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
    PROFILE CONTAINER
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


const firstNameInput =
    personalFormGroups[0]
        ?.querySelector(
            "input"
        );


const lastNameInput =
    personalFormGroups[1]
        ?.querySelector(
            "input"
        );


const emailInput =
    personalFormGroups[2]
        ?.querySelector(
            "input"
        );


const phoneInput =
    personalFormGroups[3]
        ?.querySelector(
            "input"
        );


const countryInput =
    personalFormGroups[4]
        ?.querySelector(
            "input"
        );


const genderSelect =
    personalFormGroups[5]
        ?.querySelector(
            "select"
        );


const dateOfBirthInput =
    personalFormGroups[6]
        ?.querySelector(
            "input"
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
    Current Examination
*/

const examinationSelect =
    document.getElementById(
        "examinationSelect"
    );


/*
    Study information order:

    0 = Current Examination
    1 = Nursing School / Institution
    2 = Expected Graduation
    3 = Expected Exam Date
    4 = Current Study Level
*/

const institutionInput =
    studyFormGroups[1]
        ?.querySelector(
            "input"
        );


const graduationInput =
    studyFormGroups[2]
        ?.querySelector(
            "input"
        );


const examDateInput =
    studyFormGroups[3]
        ?.querySelector(
            "input"
        );


const studyLevelSelect =
    studyFormGroups[4]
        ?.querySelector(
            "select"
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


    if (!token) {

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


    if (!token) {

        throw new Error(
            "Your session has expired."
        );

    }


    const requestHeaders = {

        "Authorization":
            `Bearer ${token}`

    };


    /*
        JSON content type only when
        the request contains a JSON body.

        FormData must NOT receive
        a manually assigned content type.
    */

    if (
        options.body &&
        !(options.body instanceof FormData)
    ) {

        requestHeaders[
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

                    ...requestHeaders,

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


    if (!response.ok) {

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

    catch (error) {

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


    /*
        Temporary loading state.
    */

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
            Support the existing exams
            API response structures.
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

                if (!exam) {

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
            Restore saved examination.
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

    catch (error) {

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
        PERSONAL INFORMATION
    -----------------------------------------------------*/

    setInputValue(
        firstNameInput,
        profile.first_name
    );


    setInputValue(
        lastNameInput,
        profile.last_name
    );


    setInputValue(
        emailInput,
        profile.email
    );


    setInputValue(
        phoneInput,
        profile.phone_number
    );


    setInputValue(
        countryInput,
        profile.country
    );


    setSelectValue(
        genderSelect,
        profile.gender
    );


    setInputValue(
        dateOfBirthInput,
        formatInputDate(
            profile.date_of_birth
        )
    );


    /*
        Email belongs to the student account.
        Profile does not modify it.
    */

    if (
        emailInput
    ) {

        emailInput.readOnly =
            true;

    }


    /*-----------------------------------------------------
        STUDY INFORMATION
    -----------------------------------------------------*/

    await loadExaminations(
        profile.examination_id ||
        ""
    );


    setInputValue(
        institutionInput,
        profile.institution_name
    );


    setInputValue(
        graduationInput,
        formatInputDate(
            profile.expected_graduation
        )
    );


    setInputValue(
        examDateInput,
        formatInputDate(
            profile.expected_exam_date
        )
    );


    setSelectValue(
        studyLevelSelect,
        profile.study_level
    );


    /*-----------------------------------------------------
        HEADER STUDENT NAME
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


    /*-----------------------------------------------------
        AVATAR
    -----------------------------------------------------*/

    if (
        profile.avatar_url
    ) {

        setAvatar(
            profile.avatar_url
        );

    }


    /*-----------------------------------------------------
        SUMMARY CARDS
    -----------------------------------------------------*/

    populateSummary(
        summary
    );

}


/*=========================================================
    POPULATE SUMMARY CARDS
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
                heading.textContent
                    .trim()
                    .replace(
                        /\s+/g,
                        " "
                    )
                    .toLowerCase();


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
                getInputValue(
                    genderSelect
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
                getInputValue(
                    studyLevelSelect
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
            Reload the actual saved
            database values.
        */

        await loadProfile();

    }

    catch (error) {

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
        Discard unsaved browser changes
        and reload saved database values.
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
    UPLOAD PROFILE PHOTO
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
        IMAGE TYPE
    -----------------------------------------------------*/

    if (
        !file.type.startsWith(
            "image/"
        )
    ) {

        showProfileError(
            "Please select a valid image file."
        );


        profileUpload.value =
            "";


        return;

    }


    /*-----------------------------------------------------
        FILE SIZE
    -----------------------------------------------------*/

    const MAX_IMAGE_SIZE =
        5 * 1024 * 1024;


    if (
        file.size >
        MAX_IMAGE_SIZE
    ) {

        showProfileError(
            "Profile photo must be 5 MB or smaller."
        );


        profileUpload.value =
            "";


        return;

    }


    try {

        const token =
            getStudentToken();


        if (!token) {

            verifyLogin();

            return;

        }


        const formData =
            new FormData();


        formData.append(
            "file",
            file
        );


        const response =
            await fetch(

                `${PROFILE_API_BASE}/upload`,

                {

                    method:
                        "POST",

                    headers: {

                        "Authorization":
                            `Bearer ${token}`

                    },

                    body:
                        formData

                }

            );


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


            return;

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

                "Unable to upload profile photo."

            );

        }


        if (
            !result?.success
        ) {

            throw new Error(

                result?.message ||

                "Unable to upload profile photo."

            );

        }


        /*
            Immediately synchronize both
            profile image and header avatar
            when the API returns a browser URL.
        */

        const avatarUrl =

            result.avatar_url ||

            result.avatarUrl ||

            result.url ||

            "";


        if (
            isBrowserImageUrl(
                avatarUrl
            )
        ) {

            setAvatar(
                avatarUrl
            );

        }


        showProfileMessage(
            result.message ||
            "Profile photo uploaded successfully."
        );


        /*
            Database remains the source
            of truth after upload.
        */

        await loadProfile();

    }

    catch (error) {

        console.error(
            "Profile Photo Error:",
            error
        );


        showProfileError(
            error.message
        );

    }

    finally {

        if (
            profileUpload
        ) {

            profileUpload.value =
                "";

        }

    }

}


/*=========================================================
    SET AVATAR
=========================================================*/

function setAvatar(
    url
) {

    if (
        !url
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
    AVATAR URL VALIDATION
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
    INPUT HELPERS
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
    SELECT HELPER
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


    const normalizedValue =
        String(
            value ?? ""
        )
        .trim()
        .toLowerCase();


    if (
        !normalizedValue
    ) {

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
                    normalizedValue

                    ||

                    optionText ===
                    normalizedValue

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
    FULL NAME
=========================================================*/

function buildFullName(
    firstName,
    lastName
) {

    return [

        firstName,

        lastName

    ]
    .filter(
        value =>
            Boolean(
                value
            )
    )
    .join(
        " "
    );

}


/*=========================================================
    NUMBER FORMAT
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
    MEMBER SINCE
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


    /*
        Cloudflare D1 commonly returns:

        2026-07-23 13:04:50

        Normalize the SQL timestamp.
    */

    const normalizedValue =
        value.replace(
            " ",
            "T"
        );


    const parsedDate =
        new Date(
            normalizedValue
        );


    if (
        Number.isNaN(
            parsedDate.getTime()
        )
    ) {

        return "Not Available";

    }


    return parsedDate.toLocaleDateString(

        "en-US",

        {

            year:
                "numeric",

            month:
                "long"

        }

    );

}


/*=========================================================
    DATE FORMAT FOR INPUTS
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
        Already correct for
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


    const normalizedValue =
        value.replace(
            " ",
            "T"
        );


    const parsedDate =
        new Date(
            normalizedValue
        );


    if (
        Number.isNaN(
            parsedDate.getTime()
        )
    ) {

        return "";

    }


    /*
        Local calendar components prevent
        timezone date shifting.
    */

    const year =
        parsedDate.getFullYear();


    const month =
        String(
            parsedDate.getMonth() + 1
        )
        .padStart(
            2,
            "0"
        );


    const day =
        String(
            parsedDate.getDate()
        )
        .padStart(
            2,
            "0"
        );


    return `${year}-${month}-${day}`;

}


/*=========================================================
    PROFILE MESSAGE
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
    PROFILE ERROR
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

/*
    The current .profile-form is a DIV,
    not a <form>, so Save is handled
    directly through .save-btn.
*/


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
    HEADER UPLOAD PHOTO
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
    PROFILE IMAGE
---------------------------------------------------------*/

if (
    profileImage
) {

    profileImage.addEventListener(
        "click",
        openProfileUpload
    );

}


/*---------------------------------------------------------
    PROFILE FILE INPUT
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
    Safe whether this script is loaded
    before or after DOM readiness.
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