/*
=========================================================
    Nursephere Shared API Client
    File: shared/api.js
=========================================================
*/

"use strict";

/*=========================================================
    Configuration
=========================================================*/

const API = {

    BASE_URL: "http://127.0.0.1:8787",

    ADMIN: "/api/admin",

    STUDENT: "/api"

};

/*=========================================================
    Session
=========================================================*/

function getToken() {

    return localStorage.getItem("accessToken") || "";

}

/*=========================================================
    Default Headers
=========================================================*/

function getHeaders(isJson = true) {

    const headers = {};

    if (isJson) {

        headers["Content-Type"] = "application/json";

    }

    const token = getToken();

    if (token) {

        headers["Authorization"] = `Bearer ${token}`;

    }

    return headers;

}

/*=========================================================
    Handle Unauthorized
=========================================================*/

function handleUnauthorized() {

    localStorage.clear();

    const path = window.location.pathname.toLowerCase();

    if (path.includes("/admin/")) {

        window.location.href = "../login.html";

    } else {

        window.location.href = "login.html";

    }

}

/*=========================================================
    Request Handler
=========================================================*/

async function request(endpoint, options = {}) {

    try {

        const response = await fetch(

            API.BASE_URL + endpoint,

            {

                ...options,

                headers: {

                    ...getHeaders(),

                    ...(options.headers || {})

                }

            }

        );

        let data = {};

        try {

            data = await response.json();

        }

        catch {

            data = {

                success: false,

                message: "Invalid server response."

            };

        }

        if (response.status === 401) {

            handleUnauthorized();

            return;

        }

        if (!response.ok) {

            throw new Error(

                data.message ||

                "Request failed."

            );

        }

        return data;

    }

    catch (error) {

        console.error(

            "[API]",

            error.message

        );

        throw error;

    }

}

/*=========================================================
    HTTP Methods
=========================================================*/

API.get = function (endpoint) {

    return request(endpoint, {

        method: "GET"

    });

};

API.post = function (

    endpoint,

    body = {}

) {

    return request(endpoint, {

        method: "POST",

        body: JSON.stringify(body)

    });

};

API.put = function (

    endpoint,

    body = {}

) {

    return request(endpoint, {

        method: "PUT",

        body: JSON.stringify(body)

    });

};

API.patch = function (

    endpoint,

    body = {}

) {

    return request(endpoint, {

        method: "PATCH",

        body: JSON.stringify(body)

    });

};

API.delete = function (endpoint) {

    return request(endpoint, {

        method: "DELETE"

    });

};

/*=========================================================
    File Upload
=========================================================*/

API.upload = async function (

    endpoint,

    formData

) {

    const token = getToken();

    const headers = {};

    if (token) {

        headers["Authorization"] = `Bearer ${token}`;

    }

    const response = await fetch(

        API.BASE_URL + endpoint,

        {

            method: "POST",

            headers,

            body: formData

        }

    );

    let data = {};

    try {

        data = await response.json();

    }

    catch {

        data = {

            success: false,

            message: "Invalid server response."

        };

    }

    if (response.status === 401) {

        handleUnauthorized();

        return;

    }

    if (!response.ok) {

        throw new Error(

            data.message ||

            "Upload failed."

        );

    }

    return data;

};

/*=========================================================
    Export
=========================================================*/

window.API = API;