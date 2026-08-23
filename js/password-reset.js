/*
=========================================================
    NurseSphere Password Reset Controller
    File: js/reset-password.js
=========================================================
*/

"use strict";


/*=========================================================
    Configuration
=========================================================*/

const API_BASE =
    "https://nursephere.wamalwaemily.workers.dev/api";


/*=========================================================
    DOM Elements
=========================================================*/

const resetPasswordForm =
    document.getElementById(
        "resetPasswordForm"
    );

const newPasswordInput =
    document.getElementById(
        "newPassword"
    );

const confirmPasswordInput =
    document.getElementById(
        "confirmPassword"
    );

const messageBox =
    document.getElementById(
        "resetPasswordMessage"
    );

const submitButton =
    document.querySelector(
        ".forgot-btn"
    );


/*=========================================================
    Helper Functions
=========================================================*/

function showMessage(
    message,
    type = "error"
) {

    if (!messageBox) return;

    messageBox.textContent =
        message;

    messageBox.className =
        `message ${type}`;

    messageBox.style.display =
        "block";

}


function clearMessage() {

    if (!messageBox) return;

    messageBox.textContent =
        "";

    messageBox.className =
        "message";

    messageBox.style.display =
        "none";

}


function setLoading(
    isLoading
) {

    if (!submitButton) return;

    submitButton.disabled =
        isLoading;


    submitButton.innerHTML =

        isLoading

            ? `
                <i class="fas fa-spinner fa-spin"></i>
                Resetting...
              `

            : `
                <i class="fas fa-key"></i>
                Reset Password
              `;

}


/*=========================================================
    Read Reset Token
=========================================================*/

function getResetToken() {

    const params =
        new URLSearchParams(
            window.location.search
        );

    return (
        params.get("token") || ""
    ).trim();

}


/*=========================================================
    Password Validation
=========================================================*/

function validatePassword(
    password
) {

    if (
        password.length < 8
    ) {

        return {

            valid: false,

            message:
                "Password must be at least 8 characters."

        };

    }


    if (
        !/[A-Z]/.test(
            password
        )
    ) {

        return {

            valid: false,

            message:
                "Password must contain at least one uppercase letter."

        };

    }


    if (
        !/[a-z]/.test(
            password
        )
    ) {

        return {

            valid: false,

            message:
                "Password must contain at least one lowercase letter."

        };

    }


    if (
        !/[0-9]/.test(
            password
        )
    ) {

        return {

            valid: false,

            message:
                "Password must contain at least one number."

        };

    }


    return {

        valid: true

    };

}


/*=========================================================
    Reset Token
=========================================================*/

const resetToken =
    getResetToken();


/*=========================================================
    Safety Check
=========================================================*/

if (!resetPasswordForm) {

    console.error(
        "Password reset form not found."
    );

}


/*=========================================================
    Validate Reset Link
=========================================================*/

if (
    resetPasswordForm &&
    !resetToken
) {

    showMessage(

        "This password reset link is invalid or incomplete.",

        "error"

    );

    resetPasswordForm.style.display =
        "none";

}


/*=========================================================
    Password Reset Submit
=========================================================*/

if (
    resetPasswordForm &&
    resetToken
) {

    resetPasswordForm.addEventListener(

        "submit",

        async function (event) {

            event.preventDefault();

            clearMessage();


            const newPassword =
                newPasswordInput.value;

            const confirmPassword =
                confirmPasswordInput.value;


            /*-----------------------------------------------
                Required Fields
            ------------------------------------------------*/

            if (
                !newPassword ||
                !confirmPassword
            ) {

                showMessage(

                    "Please enter and confirm your new password.",

                    "error"

                );

                return;

            }


            /*-----------------------------------------------
                Password Validation
            ------------------------------------------------*/

            const passwordValidation =
                validatePassword(
                    newPassword
                );


            if (
                !passwordValidation.valid
            ) {

                showMessage(

                    passwordValidation.message,

                    "error"

                );

                newPasswordInput.focus();

                return;

            }


            /*-----------------------------------------------
                Password Confirmation
            ------------------------------------------------*/

            if (
                newPassword !==
                confirmPassword
            ) {

                showMessage(

                    "Passwords do not match.",

                    "error"

                );

                confirmPasswordInput.focus();

                return;

            }


            /*-----------------------------------------------
                Reset Payload
            ------------------------------------------------*/

            const resetData = {

                token:
                    resetToken,

                newPassword:
                    newPassword

            };


            /*-----------------------------------------------
                API Request
            ------------------------------------------------*/

            try {

                setLoading(true);


                const response =
                    await fetch(

                        `${API_BASE}/password-reset/confirm`,

                        {

                            method:
                                "POST",

                            headers: {

                                "Content-Type":
                                    "application/json"

                            },

                            body:
                                JSON.stringify(
                                    resetData
                                )

                        }

                    );


                const result =
                    await response.json();


                /*-------------------------------------------
                    API Error
                --------------------------------------------*/

                if (
                    !response.ok
                ) {

                    throw new Error(

                        result.message ||

                        "Unable to reset your password."

                    );

                }


                /*-------------------------------------------
                    Success
                --------------------------------------------*/

                showMessage(

                    result.message ||

                    "Password reset successfully. Redirecting to login...",

                    "success"

                );


                resetPasswordForm.reset();


                setTimeout(

                    function () {

                        window.location.href =
                            "login.html";

                    },

                    2000

                );

            }


            /*-----------------------------------------------
                Network / Unexpected Error
            ------------------------------------------------*/

            catch (
                error
            ) {

                showMessage(

                    error.message ||

                    "Unable to reset your password.",

                    "error"

                );

            }


            /*-----------------------------------------------
                Restore Button
            ------------------------------------------------*/

            finally {

                setLoading(
                    false
                );

            }

        }

    );

}