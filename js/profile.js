"use strict";

/*=========================================================
    NurseSphere Student Profile Controller
    File: js/profile.js

    Database-driven.
    Uses authenticated studentToken.
    No hardcoded student data.
    No hardcoded subscription data.
=========================================================*/


/*=========================================================
    CONFIGURATION
=========================================================*/

const API_BASE =
    "https://nursephere.wamalwaemily.workers.dev/api";


/*=========================================================
    DOM ELEMENTS
=========================================================*/

const profileForm =
    document.querySelector(".profile-form");

const firstNameInput =
    profileForm?.querySelectorAll(
        ".form-group input"
    )[0];

const lastNameInput =
    profileForm?.querySelectorAll(
        ".form-group input"
    )[1];

const emailInput =
    profileForm?.querySelectorAll(
        ".form-group input"
    )[2];

const phoneInput =
    profileForm?.querySelectorAll(
        ".form-group input"
    )[3];

const countryInput =
    profileForm?.querySelectorAll(
        ".form-group input"
    )[4];

const genderSelect =
    profileForm?.querySelectorAll(
        ".form-group select"
    )[0];

const dateOfBirthInput =
    profileForm?.querySelectorAll(
        ".form-group input"
    )[5];

const studyGrid =
    document.querySelector(".study-grid");

const examinationSelect =
    studyGrid?.querySelectorAll(
        ".form-group select"
    )[0];

const institutionInput =
    studyGrid?.querySelectorAll(
        ".form-group input"
    )[0];

const graduationInput =
    studyGrid?.querySelectorAll(
        ".form-group input"
    )[1];

const examDateInput =
    studyGrid?.querySelectorAll(
        ".form-group input"
    )[2];

const studyLevelSelect =
    studyGrid?.querySelectorAll(
        ".form-group select"
    )[1];

const saveButton =
    document.querySelector(".save-btn");

const cancelButton =
    document.querySelector(".cancel-btn");

const profileUpload =
    document.getElementById(
        "profileUpload"
    );

const profileImage =
    document.getElementById(
        "profileImage"
    );

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


    const response =
        await fetch(

            `${API_BASE}${endpoint}`,

            {

                ...options,

                headers: {

                    "Authorization":
                        `Bearer ${token}`,

                    "Content-Type":
                        "application/json",

                    ...(options.headers || {})

                }

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

        throw new Error(
            "Your session has expired."
        );

    }


    let result = null;


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

            result.message ||

            "Unable to process your request."

        );

    }


    return result;

}


/*=========================================================
    LOAD PROFILE
=========================================================*/

async function loadProfile() {

    if (!verifyLogin()) {

        return;

    }


    try {

        const result =
            await apiRequest(
                "/profile"
            );


        if (!result.success) {

            throw new Error(

                result.message ||

                "Unable to load profile."

            );

        }


        populateProfile(
            result
        );

    }


    catch (error) {

        console.error(
            "Profile Error:",
            error
        );


        showProfileError(
            error.message
        );

    }

}


/*=========================================================
    POPULATE PROFILE
=========================================================*/

function populateProfile(
    data
) {

    const profile =
        data.profile || {};

    const subscription =
        data.subscription || {};

    const summary =
        data.summary || {};


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


    /*-----------------------------------------------------
        STUDY INFORMATION
    -----------------------------------------------------*/

    setSelectValue(
        examinationSelect,
        profile.examination
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
        EMAIL IS ACCOUNT DATA

        Do not allow the profile form to overwrite it.
    -----------------------------------------------------*/

    if (emailInput) {

        emailInput.readOnly =
            true;

    }


    /*-----------------------------------------------------
        HEADER
    -----------------------------------------------------*/

    const fullName =
        profile.full_name ||

        buildFullName(
            profile.first_name,
            profile.last_name
        ) ||

        "Student";


    if (headerStudentName) {

        headerStudentName.textContent =
            fullName;

    }


    if (studentPlan) {

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
        SUMMARY
    -----------------------------------------------------*/

    populateSummary(
        summary
    );

}


/*=========================================================
    POPULATE SUMMARY
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

            }


            /*---------------------------------------------
                CURRENT PLAN
            ---------------------------------------------*/

            else if (
                label ===
                "current plan"
            ) {

                value.textContent =

                    summary.current_plan ||

                    "No Active Plan";

            }


            /*---------------------------------------------
                QUESTIONS ANSWERED
            ---------------------------------------------*/

            else if (
                label ===
                "questions answered"
            ) {

                value.textContent =
                    formatNumber(
                        summary.questions_answered
                    );

            }


            /*---------------------------------------------
                PRACTICE SESSIONS
            ---------------------------------------------*/

            else if (
                label ===
                "practice sessions"
            ) {

                value.textContent =
                    formatNumber(
                        summary.practice_sessions
                    );

            }


            /*---------------------------------------------
                DOCUMENTS UPLOADED
            ---------------------------------------------*/

            else if (
                label ===
                "documents uploaded"
            ) {

                value.textContent =
                    formatNumber(
                        summary.documents_uploaded
                    );

            }


            /*---------------------------------------------
                STUDY STREAK
            ---------------------------------------------*/

            else if (
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

    if (event) {

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

                    method: "PUT",

                    body:
                        JSON.stringify(
                            payload
                        )

                }

            );


        if (!result.success) {

            throw new Error(

                result.message ||

                "Unable to save profile."

            );

        }


        showProfileMessage(
            result.message ||
            "Profile updated successfully."
        );


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

function cancelChanges() {

    loadProfile();

}


/*=========================================================
    PROFILE PHOTO
=========================================================*/

function openProfileUpload(
    event
) {

    if (event) {

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
        VALIDATE IMAGE
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
        5 MB MAXIMUM
    -----------------------------------------------------*/

    if (
        file.size >
        5 * 1024 * 1024
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

                `${API_BASE}/upload`,

                {

                    method: "POST",

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


        let result = null;


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

                result.message ||

                "Unable to upload profile photo."

            );

        }


        if (!result.success) {

            throw new Error(

                result.message ||

                "Unable to upload profile photo."

            );

        }


        /*-------------------------------------------------
            Use returned avatar URL if available.
        -------------------------------------------------*/

        const avatarUrl =

            result.avatar_url ||

            result.avatarUrl ||

            result.url;


        if (
            avatarUrl
        ) {

            setAvatar(
                avatarUrl
            );

        }


        showProfileMessage(
            result.message ||
            "Profile photo updated successfully."
        );


        /*-------------------------------------------------
            Reload database-backed profile.
        -------------------------------------------------*/

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

    if (!url) {

        return;

    }


    if (profileImage) {

        profileImage.src =
            url;

    }


    if (studentAvatar) {

        studentAvatar.src =
            url;

    }

}


/*=========================================================
    LOGOUT
=========================================================*/

function logout() {

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

    if (!element) {

        return "";

    }


    return String(
        element.value || ""
    ).trim();

}


function setInputValue(
    element,
    value
) {

    if (!element) {

        return;

    }


    element.value =
        value || "";

}


function setSelectValue(
    element,
    value
) {

    if (
        !element ||
        !value
    ) {

        return;

    }


    const target =
        String(
            value
        )
        .trim()
        .toLowerCase();


    const option =
        Array.from(
            element.options
        )
        .find(
            option =>

                option.value
                    .trim()
                    .toLowerCase() ===
                target

                ||

                option.textContent
                    .trim()
                    .toLowerCase() ===
                target

        );


    if (option) {

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
        Boolean
    )
    .join(" ");

}


/*=========================================================
    NUMBER FORMAT
=========================================================*/

function formatNumber(
    value
) {

    return Number(
        value || 0
    )
    .toLocaleString(
        "en-US"
    );

}


/*=========================================================
    MEMBER SINCE
=========================================================*/

function formatMemberSince(
    date
) {

    if (!date) {

        return "Not Available";

    }


    const parsedDate =
        new Date(
            date
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
    DATE FORMAT
=========================================================*/

function formatInputDate(
    date
) {

    if (!date) {

        return "";

    }


    const value =
        String(
            date
        ).trim();


    if (
        /^\d{4}-\d{2}-\d{2}$/
            .test(
                value
            )
    ) {

        return value;

    }


    const parsedDate =
        new Date(
            value
        );


    if (
        Number.isNaN(
            parsedDate.getTime()
        )
    ) {

        return "";

    }


    return parsedDate
        .toISOString()
        .slice(
            0,
            10
        );

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
        "Unable to load your profile."
    );

}


/*=========================================================
    EVENT LISTENERS
=========================================================*/

if (profileForm) {

    profileForm.addEventListener(
        "submit",
        saveProfile
    );

}


if (saveButton) {

    saveButton.addEventListener(
        "click",
        saveProfile
    );

}


if (cancelButton) {

    cancelButton.addEventListener(
        "click",
        cancelChanges
    );

}


if (uploadPhoto) {

    uploadPhoto.addEventListener(
        "click",
        openProfileUpload
    );

}


if (profileUpload) {

    profileUpload.addEventListener(
        "change",
        uploadProfilePhoto
    );

}


if (logoutButton) {

    logoutButton.addEventListener(
        "click",
        logout
    );

}


/*=========================================================
    INITIALIZE
=========================================================*/

document.addEventListener(
    "DOMContentLoaded",
    async function () {

        await loadProfile();

    }
);