/*
=========================================================
    Nursephere Shared Utilities
    File: shared/utils.js
=========================================================
*/

"use strict";

/*=========================================================
    Utils Object
=========================================================*/

const Utils = {};

/*=========================================================
    Messages
=========================================================*/

Utils.showMessage = function (

    elementId,

    message,

    type = "success"

) {

    const element = document.getElementById(

        elementId

    );

    if (!element) return;

    element.textContent = message;

    element.className = `message ${type}`;

    element.style.display = "block";

};

Utils.clearMessage = function (

    elementId

) {

    const element = document.getElementById(

        elementId

    );

    if (!element) return;

    element.textContent = "";

    element.className = "message";

    element.style.display = "none";

};

/*=========================================================
    Loading Buttons
=========================================================*/

Utils.setButtonLoading = function (

    button,

    loadingText = "Loading..."

) {

    if (!button) return;

    button.dataset.originalText =

        button.innerHTML;

    button.disabled = true;

    button.innerHTML = loadingText;

};

Utils.resetButton = function (

    button

) {

    if (!button) return;

    button.disabled = false;

    button.innerHTML =

        button.dataset.originalText ||

        "Submit";

};

/*=========================================================
    Confirm Delete
=========================================================*/

Utils.confirmDelete = function (

    message = "Delete this record?"

) {

    return confirm(message);

};

/*=========================================================
    Date Formatting
=========================================================*/

Utils.formatDate = function (

    value

) {

    if (!value) return "-";

    return new Date(value)

        .toLocaleDateString();

};

Utils.formatDateTime = function (

    value

) {

    if (!value) return "-";

    return new Date(value)

        .toLocaleString();

};

/*=========================================================
    Currency
=========================================================*/

Utils.currency = function (

    amount,

    currency = "USD"

) {

    return new Intl.NumberFormat(

        "en-US",

        {

            style: "currency",

            currency

        }

    ).format(amount || 0);

};

/*=========================================================
    Numbers
=========================================================*/

Utils.number = function (

    value

) {

    return new Intl.NumberFormat()

        .format(value || 0);

};

/*=========================================================
    Loader
=========================================================*/

Utils.showLoader = function (

    elementId

) {

    const el = document.getElementById(

        elementId

    );

    if (!el) return;

    el.style.display = "flex";

};

Utils.hideLoader = function (

    elementId

) {

    const el = document.getElementById(

        elementId

    );

    if (!el) return;

    el.style.display = "none";

};

/*=========================================================
    Empty State
=========================================================*/

Utils.empty = function (

    value,

    placeholder = "-"

) {

    return value ||

        placeholder;

};

/*=========================================================
    Logout Helper
=========================================================*/

Utils.logout = function () {

    Auth.logout();

};

/*=========================================================
    Export
=========================================================*/

window.Utils = Utils;