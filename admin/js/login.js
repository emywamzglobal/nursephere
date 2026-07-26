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

const AdminAPI = {

    login: "https://nursephere.wamalwaemily.workers.dev/api/admin/login"

};

/*=========================================================
    DOM Elements
=========================================================*/

const loginForm = document.getElementById("loginForm");

const emailInput = document.getElementById("email");

const passwordInput = document.getElementById("password");

const loginButton = document.getElementById("loginBtn");

const messageBox = document.getElementById("message");

const togglePassword = document.getElementById("togglePassword");

/*=========================================================
    Helper Functions
=========================================================*/

function showMessage(message, type = "error") {

    messageBox.textContent = message;

    messageBox.className = type;

}

function clearMessage() {

    messageBox.textContent = "";

    messageBox.className = "";

}

function setLoading(isLoading) {

    loginButton.disabled = isLoading;

    loginButton.innerHTML = isLoading

        ? '<i class="fa-solid fa-spinner fa-spin"></i> Signing In...'

        : '<i class="fa-solid fa-right-to-bracket"></i> Login';

}

/*=========================================================
    Toggle Password
=========================================================*/

togglePassword.addEventListener("click", () => {

    if (passwordInput.type === "password") {

        passwordInput.type = "text";

        togglePassword.innerHTML =
            '<i class="fa-solid fa-eye-slash"></i>';

    }

    else {

        passwordInput.type = "password";

        togglePassword.innerHTML =
            '<i class="fa-solid fa-eye"></i>';

    }

});

/*=========================================================
    Login Submit
=========================================================*/

loginForm.addEventListener("submit", async function (event) {

    event.preventDefault();

    clearMessage();

    const email = emailInput.value.trim().toLowerCase();

    const password = passwordInput.value.trim();

    if (!email || !password) {

        showMessage(
            "Please enter your email and password."
        );

        return;

    }

    try {

        setLoading(true);

        const response = await fetch(AdminAPI.login, {

            method: "POST",

            headers: {

                "Content-Type": "application/json"

            },

            body: JSON.stringify({

                email,

                password

            })

        });

        const result = await response.json();

        if (!response.ok) {

            throw new Error(

                result.message ||

                "Invalid email or password."

            );

        }

        /*=========================================
    Save Admin Session
=========================================*/

Auth.saveSession({

    token: result.token,

    id: result.admin.id,

    name: `${result.admin.first_name} ${result.admin.last_name}`.trim(),

    email: result.admin.email,

    role: result.admin.role

});

        showMessage(

            "Login successful.",

            "success"

        );

        setTimeout(() => {

            window.location.href =

                "dashboard.html";

        }, 800);

    }

    catch (error) {

        showMessage(

            error.message ||

            "Unable to login."

        );

    }

    finally {

        setLoading(false);

    }

});