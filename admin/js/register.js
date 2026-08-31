/* =========================================================
   NURSEPHERE ADMIN ACCOUNT ACTIVATION
   File: admin/js/register.js
========================================================= */

"use strict";


/* =========================================================
   DOM ELEMENTS
========================================================= */

const registerForm =
    document.getElementById(
        "registerForm"
    );


const emailInput =
    document.getElementById(
        "email"
    );


const passwordInput =
    document.getElementById(
        "password"
    );


const confirmPasswordInput =
    document.getElementById(
        "confirmPassword"
    );


const registerButton =
    document.getElementById(
        "registerBtn"
    );


const messageContainer =
    document.getElementById(
        "message"
    );


const togglePassword =
    document.getElementById(
        "togglePassword"
    );


const toggleConfirmPassword =
    document.getElementById(
        "toggleConfirmPassword"
    );


/* =========================================================
   INITIALIZE PAGE
========================================================= */

document.addEventListener(

    "DOMContentLoaded",

    function () {

        initializePasswordToggles();

        clearMessage();

    }

);


/* =========================================================
   REGISTER FORM SUBMIT
========================================================= */

if (

    registerForm

) {

    registerForm.addEventListener(

        "submit",

        async function (event) {


            event.preventDefault();


            clearMessage();


            /* =================================================
               READ FORM VALUES
            ================================================= */

            const email =
                emailInput?.value
                    ?.trim()
                    .toLowerCase()
                ||
                "";


            const password =
                passwordInput?.value
                ||
                "";


            const confirmPassword =
                confirmPasswordInput?.value
                ||
                "";


            /* =================================================
               VALIDATE EMAIL
            ================================================= */

            if (

                !email

            ) {

                showMessage(

                    "Please enter your administrator email address.",

                    "error"

                );


                emailInput?.focus();


                return;

            }


            const emailPattern =
                /^[^\s@]+@[^\s@]+\.[^\s@]+$/;


            if (

                !emailPattern.test(
                    email
                )

            ) {

                showMessage(

                    "Please enter a valid email address.",

                    "error"

                );


                emailInput?.focus();


                return;

            }


            /* =================================================
               VALIDATE PASSWORD
            ================================================= */

            if (

                !password

            ) {

                showMessage(

                    "Please create a password.",

                    "error"

                );


                passwordInput?.focus();


                return;

            }


            if (

                password.length < 8

            ) {

                showMessage(

                    "Password must be at least 8 characters.",

                    "error"

                );


                passwordInput?.focus();


                return;

            }


            /* =================================================
               CONFIRM PASSWORD
            ================================================= */

            if (

                password !== confirmPassword

            ) {

                showMessage(

                    "Passwords do not match.",

                    "error"

                );


                confirmPasswordInput?.focus();


                return;

            }


            /* =================================================
               ACTIVATE ADMINISTRATOR ACCOUNT
            ================================================= */

            setButtonLoading(

                registerButton,

                true,

                "Activating Account..."

            );


            try {


                const apiResponse =

    await fetch(

        "https://nursephere.wamalwaemily.workers.dev/api/admin/register",

        {

            method: "POST",

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


const response =
    await apiResponse.json();


if (

    !apiResponse.ok

    ||

    response.success === false

) {

    throw new Error(

        response.message

        ||

        "Unable to activate your administrator account."

    );

}

                /* =============================================
                   SUCCESS
                ============================================= */

                showMessage(

                    response.message

                    ||

                    "Administrator account activated successfully.",

                    "success"

                );


                passwordInput.value =
                    "";


                confirmPasswordInput.value =
                    "";


                /* =============================================
                   REDIRECT TO LOGIN
                ============================================= */

                setTimeout(

                    function () {


                        window.location.href =
                            "login.html";


                    },

                    1500

                );


            } catch (error) {


                console.error(

                    "Administrator registration error:",

                    error

                );


                showMessage(

                    error?.message

                    ||

                    "Unable to activate your account. Please try again.",

                    "error"

                );

            }


            finally {


                setButtonLoading(

                    registerButton,

                    false

                );

            }

        }

    );

}


/* =========================================================
   PASSWORD VISIBILITY
========================================================= */

function initializePasswordToggles() {


    if (

        togglePassword

        &&

        passwordInput

    ) {

        togglePassword.addEventListener(

            "click",

            function () {

                togglePasswordVisibility(

                    passwordInput,

                    togglePassword

                );

            }

        );

    }


    if (

        toggleConfirmPassword

        &&

        confirmPasswordInput

    ) {

        toggleConfirmPassword.addEventListener(

            "click",

            function () {

                togglePasswordVisibility(

                    confirmPasswordInput,

                    toggleConfirmPassword

                );

            }

        );

    }

}


/* =========================================================
   TOGGLE PASSWORD VISIBILITY
========================================================= */

function togglePasswordVisibility(
    input,
    toggle
) {


    if (

        !input

        ||

        !toggle

    ) {

        return;

    }


    const icon =
        toggle.querySelector(
            "i"
        );


    if (

        input.type === "password"

    ) {

        input.type =
            "text";


        if (

            icon

        ) {

            icon.className =
                "fa-solid fa-eye-slash";

        }


    } else {


        input.type =
            "password";


        if (

            icon

        ) {

            icon.className =
                "fa-solid fa-eye";

        }

    }

}


/* =========================================================
   SHOW MESSAGE
========================================================= */

function showMessage(
    message,
    type = "error"
) {


    if (

        !messageContainer

    ) {

        return;

    }


    messageContainer.textContent =
        message;


    messageContainer.className =
        type === "success"

            ? "success"

            : "error";

}


/* =========================================================
   CLEAR MESSAGE
========================================================= */

function clearMessage() {


    if (

        !messageContainer

    ) {

        return;

    }


    messageContainer.textContent =
        "";


    messageContainer.className =
        "";

}


/* =========================================================
   BUTTON LOADING
========================================================= */

function setButtonLoading(
    button,
    loading,
    loadingText = "Loading..."
) {


    if (

        !button

    ) {

        return;

    }


    if (

        loading

    ) {


        if (

            !button.dataset.originalHtml

        ) {

            button.dataset.originalHtml =
                button.innerHTML;

        }


        button.disabled =
            true;


        button.innerHTML = `

            <i class="fa-solid fa-spinner fa-spin"></i>

            ${escapeHtml(
                loadingText
            )}

        `;


        return;

    }


    button.disabled =
        false;


    if (

        button.dataset.originalHtml

    ) {

        button.innerHTML =
            button.dataset.originalHtml;


        delete button.dataset.originalHtml;

    }

}


/* =========================================================
   ESCAPE HTML
========================================================= */

function escapeHtml(
    value
) {


    if (

        value === null

        ||

        value === undefined

    ) {

        return "";

    }


    const element =
        document.createElement(
            "div"
        );


    element.textContent =
        String(
            value
        );


    return element.innerHTML;

}