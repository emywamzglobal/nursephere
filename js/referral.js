"use strict";

/*=========================================================
    NurseSphere Referral Controller
    File: js/referral.js

    Database-driven.
    No hardcoded referral codes.
    No hardcoded reward values.
    No hardcoded referral counts.
=========================================================*/


/*=========================================================
    CONFIGURATION
=========================================================*/

const API_BASE =
    "https://nursephere.wamalwaemily.workers.dev/api";


/*=========================================================
    DOM ELEMENTS
=========================================================*/

const referralCode =
    document.getElementById(
        "referralCode"
    );

const copyCodeBtn =
    document.getElementById(
        "copyCodeBtn"
    );

const copyLinkBtn =
    document.getElementById(
        "copyLinkBtn"
    );

const totalReferrals =
    document.getElementById(
        "totalReferrals"
    );

const successfulReferrals =
    document.getElementById(
        "successfulReferrals"
    );

const pendingReferrals =
    document.getElementById(
        "pendingReferrals"
    );

const referralRewards =
    document.getElementById(
        "referralRewards"
    );


/*=========================================================
    AUTHENTICATION
=========================================================*/

function getStudentToken() {

    return localStorage.getItem(
        "studentToken"
    );

}


/*=========================================================
    VERIFY LOGIN
=========================================================*/

function verifyLogin() {

    const token =
        getStudentToken();


    if (!token) {

        window.location.replace(
            "../login.html"
        );

        return false;

    }


    return true;

}


/*=========================================================
    API REQUEST
=========================================================*/

async function apiRequest(
    endpoint
) {

    const token =
        getStudentToken();


    if (!token) {

        throw new Error(
            "Your session has expired."
        );

    }


    const response =
        await fetch(

            `${API_BASE}${endpoint}`,

            {

                method: "GET",

                headers: {

                    "Authorization":
                        `Bearer ${token}`,

                    "Content-Type":
                        "application/json"

                }

            }

        );


    /*-----------------------------------------------------
        SESSION EXPIRED
    -----------------------------------------------------*/

    if (
        response.status ===
        401
    ) {

        localStorage.removeItem(
            "studentToken"
        );

        window.location.replace(
            "../login.html"
        );

        throw new Error(
            "Your session has expired."
        );

    }


    let result = null;


    try {

        result =
            await response.json();

    }

    catch {

        throw new Error(
            "Invalid response from the server."
        );

    }


    if (!response.ok) {

        throw new Error(

            result.message ||

            "Unable to load referral information."

        );

    }


    return result;

}


/*=========================================================
    LOAD REFERRAL
=========================================================*/

async function loadReferral() {

    if (!verifyLogin()) {

        return;

    }


    try {

        const result =
            await apiRequest(
                "/referral"
            );


        if (!result.success) {

            throw new Error(

                result.message ||

                "Unable to load referral information."

            );

        }


        populateReferral(
            result
        );

    }


    catch (error) {

        console.error(
            "Referral Error:",
            error
        );


        showReferralError(
            error.message
        );

    }

}


/*=========================================================
    POPULATE REFERRAL
=========================================================*/

function populateReferral(
    data
) {

    const referral =
        data.referral;


    if (!referral) {

        showReferralError(
            "Referral information is unavailable."
        );

        return;

    }


    /*-----------------------------------------------------
        REFERRAL CODE
    -----------------------------------------------------*/

    if (referralCode) {

        referralCode.textContent =
            referral.code ||
            "Not Available";

    }


    /*-----------------------------------------------------
        TOTAL REFERRALS
    -----------------------------------------------------*/

    if (totalReferrals) {

        totalReferrals.textContent =
            Number(
                referral.total_referrals || 0
            );

    }


    /*-----------------------------------------------------
        SUCCESSFUL REFERRALS
    -----------------------------------------------------*/

    if (successfulReferrals) {

        successfulReferrals.textContent =
            Number(
                referral.successful_referrals || 0
            );

    }


    /*-----------------------------------------------------
        PENDING REFERRALS
    -----------------------------------------------------*/

    if (pendingReferrals) {

        pendingReferrals.textContent =
            Number(
                referral.pending_referrals || 0
            );

    }


    /*-----------------------------------------------------
        REWARDS EARNED
    -----------------------------------------------------*/

    if (referralRewards) {

        referralRewards.textContent =
            Number(
                referral.rewards_earned || 0
            );

    }


    /*-----------------------------------------------------
        REFERRAL ACTIVITY

        The current HTML contains a static activity
        card and no dynamic activity container.

        Therefore we do not create or modify HTML
        that does not already exist.
    -----------------------------------------------------*/

}


/*=========================================================
    REFERRAL ERROR
=========================================================*/

function showReferralError(
    message
) {

    if (referralCode) {

        referralCode.textContent =
            "Unable to Load";

    }


    if (totalReferrals) {

        totalReferrals.textContent =
            "0";

    }


    if (successfulReferrals) {

        successfulReferrals.textContent =
            "0";

    }


    if (pendingReferrals) {

        pendingReferrals.textContent =
            "0";

    }


    if (referralRewards) {

        referralRewards.textContent =
            "0";

    }


    console.error(
        "Referral Page Error:",
        message
    );

}


/*=========================================================
    COPY REFERRAL CODE
=========================================================*/

async function copyReferralCode() {

    if (!referralCode) {

        return;

    }


    const code =
        referralCode.textContent.trim();


    if (

        !code ||

        code ===
            "Loading..." ||

        code ===
            "Unable to Load" ||

        code ===
            "Not Available"

    ) {

        return;

    }


    try {

        await navigator.clipboard.writeText(
            code
        );


        showCopyFeedback(
            copyCodeBtn,
            "Copied!"

        );

    }

    catch (error) {

        console.error(
            "Copy Referral Code Error:",
            error
        );

    }

}


/*=========================================================
    COPY REFERRAL LINK
=========================================================*/

async function copyReferralLink() {

    if (!referralCode) {

        return;

    }


    const code =
        referralCode.textContent.trim();


    if (

        !code ||

        code ===
            "Loading..." ||

        code ===
            "Unable to Load" ||

        code ===
            "Not Available"

    ) {

        return;

    }


    const referralLink =
        buildReferralLink(
            code
        );


    try {

        await navigator.clipboard.writeText(
            referralLink
        );


        showCopyFeedback(
            copyLinkBtn,
            "Link Copied!"

        );

    }

    catch (error) {

        console.error(
            "Copy Referral Link Error:",
            error
        );

    }

}


/*=========================================================
    BUILD REFERRAL LINK
=========================================================*/

function buildReferralLink(
    code
) {

    const basePath =
        window.location.origin;


    return (

        `${basePath}/register.html?ref=` +

        `${encodeURIComponent(code)}`

    );

}


/*=========================================================
    COPY FEEDBACK
=========================================================*/

function showCopyFeedback(
    button,
    message
) {

    if (!button) {

        return;

    }


    const originalText =
        button.innerHTML;


    button.innerHTML =
        `<i class="fas fa-check"></i> ${message}`;


    button.disabled =
        true;


    setTimeout(

        function () {

            button.innerHTML =
                originalText;

            button.disabled =
                false;

        },

        1800

    );

}


/*=========================================================
    EVENT LISTENERS
=========================================================*/

if (copyCodeBtn) {

    copyCodeBtn.addEventListener(

        "click",

        copyReferralCode

    );

}


if (copyLinkBtn) {

    copyLinkBtn.addEventListener(

        "click",

        copyReferralLink

    );

}


/*=========================================================
    INITIALIZE
=========================================================*/

document.addEventListener(

    "DOMContentLoaded",

    async function () {

        await loadReferral();

    }

);