/*
=========================================================
    Nursephere Admin Login Controller
    File: admin/js/login.js
=========================================================
*/

"use strict";


/*=========================================================
    Configuration
=========================================================*/

const ADMIN_API_BASE =
    "https://nursephere.wamalwaemily.workers.dev/api/admin";


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


const loginButton =
    document.getElementById(
        "loginBtn"
    );


const messageBox =
    document.getElementById(
        "message"
    );


const togglePassword =
    document.getElementById(
        "togglePassword"
    );


/*=========================================================
    Safety Check
=========================================================*/

if (

    !loginForm

) {

    console.error(
        "Admin login form not found."
    );

}


/*=========================================================
    Message Functions
=========================================================*/

function showMessage(
    message,
    type = "error"
) {

    if (

        !messageBox

    ) {

        return;

    }


    messageBox.textContent =
        message;


    messageBox.className =
        type;

}


function clearMessage() {

    if (

        !messageBox

    ) {

        return;

    }


    messageBox.textContent =
        "";


    messageBox.className =
        "";

}


/*=========================================================
    Loading State
=========================================================*/

function setLoading(
    isLoading
) {

    if (

        !loginButton

    ) {

        return;

    }


    loginButton.disabled =
        isLoading;


    loginButton.innerHTML =

        isLoading

            ? `
                <i class="fa-solid fa-spinner fa-spin"></i>
                Signing In...
            `

            : `
                <i class="fa-solid fa-right-to-bracket"></i>
                Login
            `;

}


/*=========================================================
    Redirect Authenticated Administrator
=========================================================*/

function redirectIfAuthenticated() {

    const token =
        localStorage.getItem(
            "adminToken"
        );


    if (

        token

    ) {

        window.location.href =
            "dashboard.html";

    }

}


/*=========================================================
    Save Administrator Session
=========================================================*/

function saveAdminSession(
    token,
    admin
) {

    localStorage.setItem(

        "adminToken",

        token

    );


    localStorage.setItem(

        "adminId",

        admin.id

    );


    localStorage.setItem(

        "adminFirstName",

        admin.firstName

        ||

        admin.first_name

        ||

        ""

    );


    localStorage.setItem(

        "adminLastName",

        admin.lastName

        ||

        admin.last_name

        ||

        ""

    );


    localStorage.setItem(

        "adminEmail",

        admin.email

        ||

        ""

    );


    localStorage.setItem(

        "adminRole",

        admin.role

        ||

        ""

    );

}


/*=========================================================
    Toggle Password Visibility
=========================================================*/

if (

    togglePassword

    &&

    passwordInput

) {

    togglePassword.addEventListener(

        "click",

        function () {

            if (

                passwordInput.type ===
                    "password"

            ) {

                passwordInput.type =
                    "text";


                togglePassword.innerHTML =
                    '<i class="fa-solid fa-eye-slash"></i>';


                return;

            }


            passwordInput.type =
                "password";


            togglePassword.innerHTML =
                '<i class="fa-solid fa-eye"></i>';

        }

    );

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
    Admin Login Submit
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

                emailInput
                    ?.value
                    .trim()
                    .toLowerCase();


            const password =
                passwordInput?.value;


            /*=============================================
                Validate Fields
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


            /*=============================================
                Send Login Request
            =============================================*/

            try {

                setLoading(
                    true
                );


                const response =
                    await fetch(

                        `${ADMIN_API_BASE}/login`,

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


                let result;


                try {

                    result =
                        await response.json();

                }

                catch {

                    throw new Error(

                        "The server returned an invalid response."

                    );

                }


                /*=========================================
                    API Error
                =========================================*/

                if (

                    !response.ok

                    ||

                    result.success === false

                ) {

                    throw new Error(

                        result.message

                        ||

                        "Invalid email or password."

                    );

                }


                /*=========================================
                    Validate Response
                =========================================*/

                if (

                    !result.token

                    ||

                    !result.admin

                ) {

                    throw new Error(

                        "Invalid login response received."

                    );

                }


                /*=========================================
                    Save Administrator Session
                =========================================*/

                saveAdminSession(

                    result.token,

                    result.admin

                );


                /*=========================================
                    Success
                =========================================*/

                showMessage(

                    result.message

                    ||

                    "Login successful.",

                    "success"

                );


                setTimeout(

                    function () {

                        window.location.href =
                            "dashboard.html";

                    },

                    800

                );


            }

            catch (
                error
            ) {

                console.error(

                    "Admin login error:",

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