/*
=========================================================
    Nursephere Authentication Manager
    File: shared/auth.js
=========================================================
*/

"use strict";

/*=========================================================
    Auth Object
=========================================================*/

const Auth = {};

/*=========================================================
    Session Keys
=========================================================*/

Auth.KEYS = {

    TOKEN: "adminToken",

    USER_ID: "adminId",

    USER_NAME: "adminFirstName",

    USER_EMAIL: "adminEmail",

    USER_ROLE: "adminRole"

};

/*=========================================================
    Save Session
=========================================================*/

Auth.saveSession = function (user = {}) {

    localStorage.setItem(

        Auth.KEYS.TOKEN,

        user.token || ""

    );

    localStorage.setItem(

        Auth.KEYS.USER_ID,

        user.id || ""

    );

    localStorage.setItem(

        Auth.KEYS.USER_NAME,

        user.name || ""

    );

    localStorage.setItem(

        Auth.KEYS.USER_EMAIL,

        user.email || ""

    );

    localStorage.setItem(

        Auth.KEYS.USER_ROLE,

        user.role || ""

    );

};

/*=========================================================
    Get Session
=========================================================*/

Auth.getUser = function () {

    return {

        token: localStorage.getItem(Auth.KEYS.TOKEN),

        id: localStorage.getItem(Auth.KEYS.USER_ID),

        name: localStorage.getItem(Auth.KEYS.USER_NAME),

        email: localStorage.getItem(Auth.KEYS.USER_EMAIL),

        role: localStorage.getItem(Auth.KEYS.USER_ROLE)

    };

};

/*=========================================================
    Check Login
=========================================================*/

Auth.isLoggedIn = function () {

    return !!localStorage.getItem(

        Auth.KEYS.TOKEN

    );

};

/*=========================================================
    Require Login
=========================================================*/

Auth.requireLogin = function () {

    if (!Auth.isLoggedIn()) {

        window.location.href = "../admin/login.html";

    }

};

/*=========================================================
    Require Admin
=========================================================*/

Auth.requireRole = function (roles = []) {

    Auth.requireLogin();

    const role = localStorage.getItem(

        Auth.KEYS.USER_ROLE

    );

    if (!roles.includes(role)) {

        window.location.href = "../admin/login.html";

    }

};

Auth.requireAdmin = function () {

    Auth.requireRole([

        "admin",

        "super_admin"

    ]);

};

/*=========================================================
    Logout
=========================================================*/

Auth.logout = function () {

    localStorage.clear();

    window.location.href = "../admin/login.html";

};

/*=========================================================
    Display Logged User
=========================================================*/

Auth.loadUser = function (

    elementId = "userName"

) {

    const element = document.getElementById(

        elementId

    );

    if (!element) return;

    element.textContent =

        localStorage.getItem(

            Auth.KEYS.USER_NAME

        ) || "User";

};

/*=========================================================
    Export
=========================================================*/

window.Auth = Auth;