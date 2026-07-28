"use strict";

/*=========================================================
    NurseSphere Authentication
    File: js/auth.js

    Responsibilities

    - Session Management
    - Authentication State
    - Session Storage
    - Login Persistence
    - Return Navigation

=========================================================*/

// =========================================================
// STORAGE KEYS
// =========================================================

const AUTH_STORAGE = {

    token: "studentToken",

    student: "student",

    nextPage: "nextPage",

    selectedPlan: "selectedPlan",

    useTrial: "useTrial"

};

// =========================================================
// APPLICATION STATE
// =========================================================

const authState = {

    token: null,

    student: null,

    authenticated: false

};

// =========================================================
// SAVE SESSION
// =========================================================

function saveSession(token, student) {

    localStorage.setItem(

        AUTH_STORAGE.token,

        token

    );

    localStorage.setItem(

        AUTH_STORAGE.student,

        JSON.stringify(student)

    );

    authState.token = token;

    authState.student = student;

    authState.authenticated = true;

}

// =========================================================
// GET SESSION
// =========================================================

function getSession() {

    const token =

        localStorage.getItem(

            AUTH_STORAGE.token

        );

    const studentString =

        localStorage.getItem(

            AUTH_STORAGE.student

        );

    if (

        !token ||

        !studentString

    ) {

        return null;

    }

    try {

        return {

            token,

            student:

                JSON.parse(studentString)

        };

    }

    catch {

        clearSession();

        return null;

    }

}

// =========================================================
// CLEAR SESSION
// =========================================================

function clearSession() {

    localStorage.removeItem(

        AUTH_STORAGE.token

    );

    localStorage.removeItem(

        AUTH_STORAGE.student

    );

    authState.token = null;

    authState.student = null;

    authState.authenticated = false;

}

// =========================================================
// SAVE RETURN DESTINATION
// =========================================================

function saveReturnLocation(

    page,

    plan = null,

    useTrial = false

) {

    sessionStorage.setItem(

        AUTH_STORAGE.nextPage,

        page

    );

    if (plan) {

        sessionStorage.setItem(

            AUTH_STORAGE.selectedPlan,

            plan

        );

    }

    sessionStorage.setItem(

        AUTH_STORAGE.useTrial,

        useTrial

    );

}

// =========================================================
// GET RETURN DESTINATION
// =========================================================

function getReturnLocation() {

    return {

        page:

            sessionStorage.getItem(

                AUTH_STORAGE.nextPage

            ),

        plan:

            sessionStorage.getItem(

                AUTH_STORAGE.selectedPlan

            ),

        useTrial:

            sessionStorage.getItem(

                AUTH_STORAGE.useTrial

            ) === "true"

    };

}

// =========================================================
// CLEAR RETURN DESTINATION
// =========================================================

function clearReturnLocation() {

    sessionStorage.removeItem(

        AUTH_STORAGE.nextPage

    );

    sessionStorage.removeItem(

        AUTH_STORAGE.selectedPlan

    );

    sessionStorage.removeItem(

        AUTH_STORAGE.useTrial

    );

}

// =========================================================
// DECODE JWT PAYLOAD
// =========================================================

function decodeToken(token) {

    try {

        const payload =

            token.split(".")[1];

        const base64 =

            payload
                .replace(/-/g, "+")
                .replace(/_/g, "/");

        const json =

            decodeURIComponent(

                atob(base64)

                .split("")

                .map(character =>

                    "%" +

                    ("00" + character.charCodeAt(0).toString(16))

                    .slice(-2)

                )

                .join("")

            );

        return JSON.parse(json);

    }

    catch {

        return null;

    }

}

// =========================================================
// TOKEN EXPIRY CHECK
// =========================================================

function isTokenExpired(token) {

    const payload =

        decodeToken(token);

    if (

        !payload ||

        !payload.exp

    ) {

        return true;

    }

    const now =

        Math.floor(

            Date.now() / 1000

        );

    return now >= payload.exp;

}

// =========================================================
// RESTORE SESSION
// =========================================================

function restoreSession() {

    const session =

        getSession();

    if (!session) {

        return false;

    }

    if (

        isTokenExpired(

            session.token

        )

    ) {

        clearSession();

        return false;

    }

    authState.token =

        session.token;

    authState.student =

        session.student;

    authState.authenticated = true;

    return true;

}

// =========================================================
// AUTHENTICATION STATUS
// =========================================================

function isLoggedIn() {

    return (

        authState.authenticated === true

    );

}

// =========================================================
// REQUIRE AUTHENTICATION
// =========================================================

function requireAuth() {

    if (

        !restoreSession()

    ) {

        const currentPage =

            window.location.pathname

            .split("/")

            .pop();

        saveReturnLocation(

            currentPage

        );

        window.location.href =

            "login.html";

        return false;

    }

    return true;

}

// =========================================================
// INITIALIZE AUTH
// =========================================================

restoreSession();

// =========================================================
// UPDATE NAVBAR
// =========================================================

function updateNavbar() {

    const guestElements =

        document.querySelectorAll(

            "[data-auth='guest']"

        );

    const authElements =

        document.querySelectorAll(

            "[data-auth='authenticated']"

        );

    guestElements.forEach(element => {

        element.style.display =

            authState.authenticated

                ? "none"

                : "";

    });

    authElements.forEach(element => {

        element.style.display =

            authState.authenticated

                ? ""

                : "none";

    });

    const studentName =

        document.querySelector(

            "[data-student-name]"

        );

    if (

        studentName &&

        authState.student

    ) {

        studentName.textContent =

            authState.student.fullName;

    }

}

// =========================================================
// LOGIN
// =========================================================

function login(token, student) {

    saveSession(

        token,

        student

    );

    updateNavbar();

}

// =========================================================
// LOGOUT
// =========================================================

function logout() {

    clearSession();

    clearReturnLocation();

    updateNavbar();

    window.location.href =

        "index.html";

}

// =========================================================
// LOGOUT BUTTONS
// =========================================================

function bindLogoutButtons() {

    document

        .querySelectorAll(

            "[data-action='logout']"

        )

        .forEach(button => {

            button.addEventListener(

                "click",

                function (event) {

                    event.preventDefault();

                    logout();

                }

            );

        });

}

// =========================================================
// AUTH INITIALIZATION
// =========================================================

document.addEventListener(

    "DOMContentLoaded",

    function () {

        restoreSession();

        updateNavbar();

        bindLogoutButtons();

    }

);

// =========================================================
// BUILD RETURN URL
// =========================================================

function buildReturnUrl() {

    const destination = getReturnLocation();

    if (!destination.page) {

        return "student/dashboard.html";

    }

    const parameters = new URLSearchParams();

    if (destination.plan) {

        parameters.set(

            "plan",

            destination.plan

        );

    }

    if (destination.useTrial) {

        parameters.set(

            "trial",

            "true"

        );

    }

    const query =

        parameters.toString();

    return query

        ? `${destination.page}?${query}`

        : destination.page;

}

// =========================================================
// REDIRECT AFTER AUTHENTICATION
// =========================================================

function redirectAfterLogin() {

    const url =

        buildReturnUrl();

    clearReturnLocation();

    window.location.replace(

        url

    );

}

// =========================================================
// PROTECT CURRENT PAGE
// =========================================================

function protectPage() {

    if (

        isLoggedIn()

    ) {

        return true;

    }

    const page =

        window.location.pathname

        .split("/")

        .pop();

    const parameters =

        new URLSearchParams(

            window.location.search

        );

    saveReturnLocation(

        page,

        parameters.get("plan"),

        parameters.get("trial") === "true"

    );

    window.location.replace(

        "login.html"

    );

    return false;

}

// =========================================================
// REDIRECT AUTHENTICATED USERS
// =========================================================

function redirectIfAuthenticated(

    page = "student/dashboard.html"

) {

    if (

        restoreSession()

    ) {

        window.location.replace(

            page

        );

    }

}

// =========================================================
// COMPLETE LOGIN
// =========================================================

function completeLogin(

    token,

    student

) {

    login(

        token,

        student

    );

    redirectAfterLogin();

}

// =========================================================
// COMPLETE REGISTRATION
// =========================================================

function completeRegistration(

    token,

    student

) {

    login(

        token,

        student

    );

    redirectAfterLogin();

}