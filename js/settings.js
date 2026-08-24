"use strict";

/*=========================================================
    NurseSphere Settings Controller
    File: js/settings.js

    Database-driven.
    No hardcoded student data.
    No hardcoded preference state.
    Password change handled by dedicated worker.
=========================================================*/


/*=========================================================
    CONFIGURATION
=========================================================*/

const API_BASE =
    "https://nursephere.wamalwaemily.workers.dev/api";


/*=========================================================
    DOM ELEMENTS
=========================================================*/

const settingsForm =
    document.getElementById(
        "settingsForm"
    );

const emailNotifications =
    document.getElementById(
        "emailNotifications"
    );

const examReminders =
    document.getElementById(
        "examReminders"
    );

const subscriptionUpdates =
    document.getElementById(
        "subscriptionUpdates"
    );

const referralNotifications =
    document.getElementById(
        "referralNotifications"
    );


/*---------------------------------------------------------
    PASSWORD CHANGE
---------------------------------------------------------*/

const passwordChangeForm =
    document.getElementById(
        "passwordChangeForm"
    );

const currentPassword =
    document.getElementById(
        "currentPassword"
    );

const newPassword =
    document.getElementById(
        "newPassword"
    );

const confirmPassword =
    document.getElementById(
        "confirmPassword"
    );

const passwordChangeMessage =
    document.getElementById(
        "passwordChangeMessage"
    );


/*---------------------------------------------------------
    ACCOUNT
---------------------------------------------------------*/

const deleteAccountButton =
    document.getElementById(
        "deleteAccount"
    );

const deleteAccountMessage =
    document.getElementById(
        "deleteAccountMessage"
    );


/*---------------------------------------------------------
    SETTINGS MESSAGE
---------------------------------------------------------*/

const settingsMessage =
    document.getElementById(
        "settingsMessage"
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

        handleSessionExpired();

        throw new Error(
            "Your session has expired."
        );

    }


    const requestOptions = {

        ...options,

        headers: {

            "Authorization":
                `Bearer ${token}`,

            "Content-Type":
                "application/json",

            ...(options.headers || {})

        }

    };


    let response;


    try {

        response =
            await fetch(

                `${API_BASE}${endpoint}`,

                requestOptions

            );

    }

    catch (error) {

        console.error(
            "Settings API Network Error:",
            error
        );

        throw new Error(
            "Unable to connect to Nursephere."
        );

    }


    /*-----------------------------------------------------
        SESSION EXPIRED
    -----------------------------------------------------*/

    if (
        response.status ===
        401
    ) {

        handleSessionExpired();

        throw new Error(
            "Your session has expired."
        );

    }


    /*-----------------------------------------------------
        PARSE RESPONSE
    -----------------------------------------------------*/

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


    /*-----------------------------------------------------
        API ERROR
    -----------------------------------------------------*/

    if (!response.ok) {

        throw new Error(

            result.message ||

            "Unable to process your request."

        );

    }


    return result;

}


/*=========================================================
    SESSION EXPIRED
=========================================================*/

function handleSessionExpired() {

    localStorage.removeItem(
        "studentToken"
    );


    window.location.replace(
        "../login.html"
    );

}


/*=========================================================
    LOAD SETTINGS
=========================================================*/

async function loadSettings() {

    if (!verifyLogin()) {

        return;

    }


    try {

        const result =
            await apiRequest(
                "/settings"
            );


        if (!result.success) {

            throw new Error(

                result.message ||

                "Unable to load settings."

            );

        }


        populateSettings(
            result
        );

    }


    catch (error) {

        console.error(
            "Settings Load Error:",
            error
        );


        showSettingsMessage(
            error.message,
            "error"
        );

    }

}


/*=========================================================
    POPULATE SETTINGS
=========================================================*/

function populateSettings(
    data
) {

    const preferences =
        data.preferences || {};


    /*-----------------------------------------------------
        EMAIL NOTIFICATIONS
    -----------------------------------------------------*/

    if (emailNotifications) {

        emailNotifications.checked =
            preferences.email_notifications ===
            true;

    }


    /*-----------------------------------------------------
        EXAM REMINDERS
    -----------------------------------------------------*/

    if (examReminders) {

        examReminders.checked =
            preferences.exam_reminders ===
            true;

    }


    /*-----------------------------------------------------
        SUBSCRIPTION UPDATES
    -----------------------------------------------------*/

    if (subscriptionUpdates) {

        subscriptionUpdates.checked =
            preferences.subscription_updates ===
            true;

    }


    /*-----------------------------------------------------
        REFERRAL NOTIFICATIONS
    -----------------------------------------------------*/

    if (referralNotifications) {

        referralNotifications.checked =
            preferences.referral_notifications ===
            true;

    }


    /*-----------------------------------------------------
        STUDENT INFORMATION
    -----------------------------------------------------*/

    populateStudentInformation(
        data.student
    );

}


/*=========================================================
    STUDENT INFORMATION
=========================================================*/

function populateStudentInformation(
    student
) {

    if (!student) {

        return;

    }


    /*
        We intentionally support common settings-page
        elements without assuming they must exist.
    */

    const studentNameElements =
        document.querySelectorAll(
            "[data-student-name]"
        );


    studentNameElements.forEach(
        element => {

            element.textContent =
                student.full_name ||
                "";

        }
    );


    const studentEmailElements =
        document.querySelectorAll(
            "[data-student-email]"
        );


    studentEmailElements.forEach(
        element => {

            element.textContent =
                student.email ||
                "";

        }
    );

}


/*=========================================================
    SAVE EMAIL PREFERENCES
=========================================================*/

async function saveEmailPreferences() {

    if (!verifyLogin()) {

        return;

    }


    const preferences = {

        email_notifications:
            emailNotifications
                ? emailNotifications.checked
                : true,

        exam_reminders:
            examReminders
                ? examReminders.checked
                : true,

        subscription_updates:
            subscriptionUpdates
                ? subscriptionUpdates.checked
                : true,

        referral_notifications:
            referralNotifications
                ? referralNotifications.checked
                : true

    };


    setPreferencesDisabled(
        true
    );


    try {

        const result =
            await apiRequest(

                "/settings/email-preferences",

                {

                    method:
                        "PUT",

                    body:
                        JSON.stringify(
                            preferences
                        )

                }

            );


        if (!result.success) {

            throw new Error(

                result.message ||

                "Unable to save your preferences."

            );

        }


        showSettingsMessage(

            result.message ||

            "Your preferences have been saved.",

            "success"

        );

    }


    catch (error) {

        console.error(
            "Preference Save Error:",
            error
        );


        showSettingsMessage(
            error.message,
            "error"
        );


        /*
            Reload the server state so the UI does not
            display values that were not actually saved.
        */

        await loadSettings();

    }


    finally {

        setPreferencesDisabled(
            false
        );

    }

}


/*=========================================================
    PREFERENCE EVENTS
=========================================================*/

function initializePreferenceEvents() {

    const preferenceElements = [

        emailNotifications,

        examReminders,

        subscriptionUpdates,

        referralNotifications

    ];


    preferenceElements.forEach(
        element => {

            if (!element) {

                return;

            }


            element.addEventListener(
                "change",
                saveEmailPreferences
            );

        }
    );

}


/*=========================================================
    DISABLE PREFERENCE CONTROLS
=========================================================*/

function setPreferencesDisabled(
    disabled
) {

    const preferenceElements = [

        emailNotifications,

        examReminders,

        subscriptionUpdates,

        referralNotifications

    ];


    preferenceElements.forEach(
        element => {

            if (element) {

                element.disabled =
                    disabled;

            }

        }
    );

}


/*=========================================================
    PASSWORD CHANGE
=========================================================*/

async function changePassword(
    event
) {

    event.preventDefault();


    if (!verifyLogin()) {

        return;

    }


    const current =
        currentPassword
            ? currentPassword.value.trim()
            : "";

    const newValue =
        newPassword
            ? newPassword.value
            : "";

    const confirmation =
        confirmPassword
            ? confirmPassword.value
            : "";


    /*-----------------------------------------------------
        REQUIRED FIELDS
    -----------------------------------------------------*/

    if (
        !current ||
        !newValue ||
        !confirmation
    ) {

        showPasswordMessage(
            "Please complete all password fields.",
            "error"
        );

        return;

    }


    /*-----------------------------------------------------
        PASSWORD MATCH
    -----------------------------------------------------*/

    if (
        newValue !==
        confirmation
    ) {

        showPasswordMessage(
            "Your new passwords do not match.",
            "error"
        );

        return;

    }


    /*-----------------------------------------------------
        PASSWORD LENGTH
    -----------------------------------------------------*/

    if (
        newValue.length <
        8
    ) {

        showPasswordMessage(
            "Your new password must be at least 8 characters.",
            "error"
        );

        return;

    }


    setPasswordFormDisabled(
        true
    );


    try {

        const result =
            await apiRequest(

                "/password/change",

                {

                    method:
                        "POST",

                    body:
                        JSON.stringify({

                            currentPassword:
                                current,

                            newPassword:
                                newValue

                        })

                }

            );


        if (!result.success) {

            throw new Error(

                result.message ||

                "Unable to change your password."

            );

        }


        showPasswordMessage(

            result.message ||

            "Your password has been changed successfully.",

            "success"

        );


        if (passwordChangeForm) {

            passwordChangeForm.reset();

        }

    }


    catch (error) {

        console.error(
            "Password Change Error:",
            error
        );


        showPasswordMessage(
            error.message,
            "error"
        );

    }


    finally {

        setPasswordFormDisabled(
            false
        );

    }

}


/*=========================================================
    PASSWORD FORM STATE
=========================================================*/

function setPasswordFormDisabled(
    disabled
) {

    const controls = [

        currentPassword,

        newPassword,

        confirmPassword

    ];


    controls.forEach(
        element => {

            if (element) {

                element.disabled =
                    disabled;

            }

        }
    );


    const submitButton =
        passwordChangeForm
            ?.querySelector(
                'button[type="submit"]'
            );


    if (submitButton) {

        submitButton.disabled =
            disabled;

    }

}


/*=========================================================
    DELETE ACCOUNT
=========================================================*/

async function deleteAccount() {

    if (!verifyLogin()) {

        return;

    }


    /*
        The backend requires the literal word DELETE.
        We do not delete anything on the first click.
    */

    const confirmation =
        window.prompt(
            "This action permanently deletes your Nursephere account and cannot be undone.\n\nType DELETE to confirm."
        );


    if (
        confirmation ===
        null
    ) {

        return;

    }


    if (
        confirmation
            .trim()
            .toUpperCase() !==
        "DELETE"
    ) {

        showDeleteAccountMessage(
            "Account deletion was not confirmed.",
            "error"
        );

        return;

    }


    setDeleteAccountDisabled(
        true
    );


    try {

        const result =
            await apiRequest(

                "/settings/account",

                {

                    method:
                        "DELETE",

                    body:
                        JSON.stringify({

                            confirmation:
                                "DELETE"

                        })

                }

            );


        if (!result.success) {

            throw new Error(

                result.message ||

                "Unable to delete your account."

            );

        }


        /*
            The account is now deleted.
            Remove the local session immediately.
        */

        localStorage.removeItem(
            "studentToken"
        );


        showDeleteAccountMessage(

            result.message ||

            "Your account has been deleted.",

            "success"

        );


        /*
            Give the user a moment to see the success
            state before leaving the page.
        */

        setTimeout(
            function () {

                window.location.replace(
                    "../login.html"
                );

            },
            1200
        );

    }


    catch (error) {

        console.error(
            "Account Deletion Error:",
            error
        );


        showDeleteAccountMessage(
            error.message,
            "error"
        );


        setDeleteAccountDisabled(
            false
        );

    }

}


/*=========================================================
    DELETE ACCOUNT BUTTON STATE
=========================================================*/

function setDeleteAccountDisabled(
    disabled
) {

    if (!deleteAccountButton) {

        return;

    }


    deleteAccountButton.disabled =
        disabled;

}


/*=========================================================
    SETTINGS MESSAGE
=========================================================*/

function showSettingsMessage(
    message,
    type
) {

    if (!settingsMessage) {

        return;

    }


    settingsMessage.textContent =
        message || "";


    settingsMessage.className =
        "message";


    if (type) {

        settingsMessage.classList.add(
            type
        );

    }

}


/*=========================================================
    PASSWORD MESSAGE
=========================================================*/

function showPasswordMessage(
    message,
    type
) {

    if (!passwordChangeMessage) {

        return;

    }


    passwordChangeMessage.textContent =
        message || "";


    passwordChangeMessage.className =
        "message";


    if (type) {

        passwordChangeMessage.classList.add(
            type
        );

    }

}


/*=========================================================
    DELETE ACCOUNT MESSAGE
=========================================================*/

function showDeleteAccountMessage(
    message,
    type
) {

    if (!deleteAccountMessage) {

        return;

    }


    deleteAccountMessage.textContent =
        message || "";


    deleteAccountMessage.className =
        "message";


    if (type) {

        deleteAccountMessage.classList.add(
            type
        );

    }

}


/*=========================================================
    INITIALIZE PASSWORD CHANGE
=========================================================*/

function initializePasswordChange() {

    if (!passwordChangeForm) {

        return;

    }


    passwordChangeForm.addEventListener(
        "submit",
        changePassword
    );

}


/*=========================================================
    INITIALIZE ACCOUNT DELETION
=========================================================*/

function initializeAccountDeletion() {

    if (!deleteAccountButton) {

        return;

    }


    deleteAccountButton.addEventListener(
        "click",
        deleteAccount
    );

}


/*=========================================================
    INITIALIZE
=========================================================*/

document.addEventListener(
    "DOMContentLoaded",
    async function () {

        if (!verifyLogin()) {

            return;

        }


        initializePreferenceEvents();

        initializePasswordChange();

        initializeAccountDeletion();

        await loadSettings();

    }
);