/*
=========================================================
    NurseSphere Student Login Controller
    File: js/login.js
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

const loginForm =
    document.getElementById(
        "loginForm"
    );


const emailInput =
    document.getElementById(
        "email"
    );


const passwordInput =
    document.getElementById(
        "password"
    );


const messageBox =
    document.getElementById(
        "loginMessage"
    );


const submitButton =
    document.querySelector(
        ".login-btn"
    );


/*=========================================================
    Helper Functions
=========================================================*/

function showMessage(
    message,
    type = "error"
) {

    if (!messageBox) {

        return;

    }


    messageBox.textContent =
        message;


    messageBox.className =
        `message ${type}`;


    messageBox.style.display =
        "block";

}


function clearMessage() {

    if (!messageBox) {

        return;

    }


    messageBox.textContent =
        "";


    messageBox.className =
        "message";


    messageBox.style.display =
        "none";

}


/*=========================================================
    Complete Student Login
=========================================================*/

function completeStudentLogin(
    token,
    student
) {

    localStorage.setItem(

        "studentToken",

        token

    );


    localStorage.setItem(

        "studentId",

        student.id

    );


    localStorage.setItem(

        "studentName",

        student.fullName

    );


    localStorage.setItem(

        "studentEmail",

        student.email

    );


    localStorage.setItem(

        "subscriptionStatus",

        student.subscriptionStatus

    );


    localStorage.setItem(

        "trialActive",

        String(
            student.trialActive
        )

    );


    window.location.href =
        "student/dashboard.html";

}


/*=========================================================
    Redirect If Already Authenticated
=========================================================*/

function redirectIfAuthenticated() {

    const token =
        localStorage.getItem(
            "studentToken"
        );


    if (token) {

        window.location.href =
            "student/dashboard.html";

    }

}


/*=========================================================
    Loading State
=========================================================*/

function setLoading(
    isLoading
) {

    if (!submitButton) {

        return;

    }


    submitButton.disabled =
        isLoading;


    submitButton.textContent =

        isLoading

            ? "Signing In..."

            : "Log In";

}


/*=========================================================
    Initialize
=========================================================*/

document.addEventListener(

    "DOMContentLoaded",

    function () {

        redirectIfAuthenticated();

    }

);


/*=========================================================
    Student Login Submit
=========================================================*/

if (

    loginForm

) {

    loginForm.addEventListener(

        "submit",

        async function (
            event
        ) {

            event.preventDefault();


            clearMessage();


            const email =

                emailInput.value
                    .trim()
                    .toLowerCase();


            const password =
                passwordInput.value;


            /*=============================================
                Validate
            =============================================*/

            if (

                !email

                ||

                !password

            ) {

                showMessage(

                    "Please enter your email and password."

                );


                return;

            }


            try {

                setLoading(
                    true
                );


                const response =
                    await fetch(

                        `${API_BASE}/login`,

                        {

                            method:
                                "POST",

                            headers: {

                                "Content-Type":
                                    "application/json"

                            },

                            body:
                                JSON.stringify({

                                    email,

                                    password

                                })

                        }

                    );


                const result =
                    await response.json();


                if (

                    !response.ok

                    ||

                    result.success === false

                ) {

                    throw new Error(

                        result.message

                        ||

                        "Login failed."

                    );

                }


                showMessage(

                    "Login successful.",

                    "success"

                );


                setTimeout(

                    function () {

                        completeStudentLogin(

                            result.token,

                            result.student

                        );

                    },

                    800

                );


            }

            catch (
                error
            ) {

                console.error(

                    "Student login error:",

                    error

                );


                showMessage(

                    error.message

                    ||

                    "Unable to log in. Please try again."

                );

            }

            finally {

                setLoading(
                    false
                );

            }

        }

    );

}