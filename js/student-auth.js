"use strict";

/*=========================================================
    NurseSphere Student Authentication
    File: js/student-auth.js
=========================================================*/

function getStudentSession() {

    return {

        id: localStorage.getItem("studentId"),

        name: localStorage.getItem("studentName"),

        email: localStorage.getItem("studentEmail"),

        subscriptionStatus: localStorage.getItem("subscriptionStatus"),

        trialActive: localStorage.getItem("trialActive")

    };

}

function isStudentLoggedIn() {

    return !!localStorage.getItem("studentId");

}

function requireStudentLogin() {

    if (!isStudentLoggedIn()) {

        window.location.href = "../login.html";

        return false;

    }

    return true;

}

function logoutStudent() {

    localStorage.removeItem("studentId");

    localStorage.removeItem("studentName");

    localStorage.removeItem("studentEmail");

    localStorage.removeItem("subscriptionStatus");

    localStorage.removeItem("trialActive");

    window.location.href = "../login.html";

}