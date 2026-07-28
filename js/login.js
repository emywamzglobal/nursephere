/*
=========================================================
    NurseSphere Login Controller
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
    document.getElementById("loginForm");

const emailInput =
    document.getElementById("email");

const passwordInput =
    document.getElementById("password");

const messageBox =
    document.getElementById("loginMessage");

const submitButton =
    document.querySelector(".login-btn");

/*=========================================================
    Helper Functions
=========================================================*/

function showMessage(message, type = "error") {

    if (!messageBox) return;

    messageBox.textContent = message;

    messageBox.className = `message ${type}`;

    messageBox.style.display = "block";

}

function clearMessage() {

    if (!messageBox) return;

    messageBox.textContent = "";

    messageBox.className = "message";

    messageBox.style.display = "none";

}

function setLoading(isLoading) {

    if (!submitButton) return;

    submitButton.disabled = isLoading;

    submitButton.textContent =

        isLoading

            ? "Signing In..."

            : "Log In";

}

/*=========================================================
    Redirect Logged In Students
=========================================================*/

document.addEventListener(

    "DOMContentLoaded",

    function () {

        redirectIfAuthenticated();

    }

);

/*=========================================================
    Login Submit
=========================================================*/

loginForm.addEventListener(

    "submit",

    async function (event) {

        event.preventDefault();

        clearMessage();

        const email =

            emailInput.value
                .trim()
                .toLowerCase();

        const password =

            passwordInput.value;

        if (

            !email ||

            !password

        ) {

            showMessage(

                "Please enter your email and password."

            );

            return;

        }

        try {

            setLoading(true);

            const response = await fetch(

                `${API_BASE}/login`,

                {

                    method: "POST",

                    headers: {

                        "Content-Type":
                            "application/json"

                    },

                    body: JSON.stringify({

                        email,

                        password

                    })

                }

            );

            const result =

                await response.json();

            if (!response.ok) {

                throw new Error(

                    result.message ||

                    "Login failed."

                );

            }

            showMessage(

                "Login successful.",

                "success"

            );

            setTimeout(function () {

                completeLogin(

                    result.token,

                    result.student

                );

            }, 800);

        }

        catch (error) {

            showMessage(

                error.message

            );

        }

        finally {

            setLoading(false);

        }

    }

);