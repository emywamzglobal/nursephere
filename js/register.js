/*==================================================
    Nursephere Registration Controller
    File: js/register.js
==================================================*/

"use strict";

/*==================================================
    Configuration
==================================================*/
const API_BASE =
    "https://nursephere.wamalwaemily.workers.dev/api";


/*==================================================
    DOM Elements
==================================================*/

const form = document.getElementById("registerForm");
const fullNameInput = document.getElementById("fullname");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const confirmPasswordInput = document.getElementById("confirmPassword");

const messageBox = document.getElementById("registerMessage");
const submitButton = document.querySelector(".register-btn");

/*==================================================
    Safety Check
==================================================*/

if (!form) {

    console.error("Register form not found.");

}

/*==================================================
    Message Functions
==================================================*/

function showMessage(message, type = "info") {

    if (!messageBox) return;

    messageBox.textContent = message;
    messageBox.className = "";
    messageBox.classList.add(type);

}

function clearMessage() {

    if (!messageBox) return;

    messageBox.textContent = "";
    messageBox.className = "";

}

/*==================================================
    Button Loading State
==================================================*/

function setLoading(loading) {

    if (!submitButton) return;

    submitButton.disabled = loading;

    if (loading) {

        submitButton.innerHTML = `
            <i class="fas fa-spinner fa-spin"></i>
            Creating Account...
        `;

    } else {

        submitButton.innerHTML = `
            <i class="fas fa-user-plus"></i>
            Create Account
        `;

    }

}

/*==================================================
    Validation
==================================================*/

function validateFullName(name) {

    return name.trim().length >= 3;

}

function validateEmail(email) {

    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

}

function validatePassword(password) {

    if (password.length < 8) {

        return {
            valid: false,
            message: "Password must be at least 8 characters."
        };

    }

    if (!/[A-Z]/.test(password)) {

        return {
            valid: false,
            message: "Password must contain at least one uppercase letter."
        };

    }

    if (!/[a-z]/.test(password)) {

        return {
            valid: false,
            message: "Password must contain at least one lowercase letter."
        };

    }

    if (!/[0-9]/.test(password)) {

        return {
            valid: false,
            message: "Password must contain at least one number."
        };

    }

    return {

        valid: true

    };

}

/*==================================================
    Registration Submit
==================================================*/

form.addEventListener("submit", async function (event) {

    event.preventDefault();

    clearMessage();

    const fullName = fullNameInput.value.trim();
    const email = emailInput.value.trim().toLowerCase();
    const password = passwordInput.value;
    const confirmPassword = confirmPasswordInput.value;

    if (!fullName || !email || !password || !confirmPassword) {

        showMessage("Please complete all required fields.", "error");
        return;

    }

    if (!validateFullName(fullName)) {

        showMessage("Please enter your full name.", "error");
        fullNameInput.focus();
        return;

    }

    if (!validateEmail(email)) {

        showMessage("Please enter a valid email address.", "error");
        emailInput.focus();
        return;

    }

    const passwordValidation = validatePassword(password);

    if (!passwordValidation.valid) {

        showMessage(passwordValidation.message, "error");
        passwordInput.focus();
        return;

    }

    if (password !== confirmPassword) {

        showMessage("Passwords do not match.", "error");
        confirmPasswordInput.focus();
        return;

    }

    const registrationData = {

        fullName,
        email,
        password

    };

    try {

        setLoading(true);

        const response = await fetch(`${API_BASE}/register`, {

            method: "POST",

            headers: {

                "Content-Type": "application/json"

            },

            body: JSON.stringify(registrationData)

        });

        const result = await response.json();

        if (!response.ok) {

            throw new Error(

                result.message ||

                "Registration failed."

            );

        }

        showMessage(

            "Registration successful! Redirecting to login...",

            "success"

        );

        form.reset();

        setTimeout(() => {

            window.location.href = "login.html";

        }, 3000);

    }

    catch (error) {

        showMessage(

            error.message,

            "error"

        );

    }

    finally {

        setLoading(false);

    }

});