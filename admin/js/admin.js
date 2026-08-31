"use strict";

/*
=========================================================
    NURSEPHERE ADMINISTRATOR MANAGEMENT

    SUPER ADMIN ONLY

    ENDPOINTS:

    GET    /api/admin/admins
    GET    /api/admin/admins/:id
    POST   /api/admin/admins
    PUT    /api/admin/admins/:id
    PATCH  /api/admin/admins/:id/approve
    PATCH  /api/admin/admins/:id/reject
    PATCH  /api/admin/admins/:id/status
    PATCH  /api/admin/admins/:id/password
    DELETE /api/admin/admins/:id
=========================================================
*/


/* =========================================================
   APPLICATION STATE
========================================================= */

let administrators = [];

let filteredAdministrators = [];

let pendingConfirmation = null;


/* =========================================================
   DOM READY
========================================================= */

document.addEventListener(

    "DOMContentLoaded",

    async function () {

        /*
        ------------------------------------------------------
        AUTHENTICATION
        ------------------------------------------------------
        */

        try {

            Auth.requireAdmin();

        } catch (error) {

            console.error(
                "Authentication error:",
                error
            );

            return;

        }


        /*
        ------------------------------------------------------
        INITIALIZE EVENTS
        ------------------------------------------------------
        */

        initializeEventListeners();


        /*
        ------------------------------------------------------
        LOAD ADMINISTRATORS
        ------------------------------------------------------
        */

        await loadAdministrators();

    }

);


/* =========================================================
   INITIALIZE EVENT LISTENERS
========================================================= */

function initializeEventListeners() {


    /*
    ------------------------------------------------------
    CREATE ADMIN BUTTON
    ------------------------------------------------------
    */

    const createAdminBtn =
        document.getElementById(
            "createAdminBtn"
        );


    if (createAdminBtn) {

        createAdminBtn.addEventListener(

            "click",

            function () {

                openCreateAdminModal();

            }

        );

    }


    /*
    ------------------------------------------------------
    CREATE ADMIN FORM
    ------------------------------------------------------
    */

    const createAdminForm =
        document.getElementById(
            "createAdminForm"
        );


    if (createAdminForm) {

        createAdminForm.addEventListener(

            "submit",

            async function (event) {

                event.preventDefault();

                await createAdministrator();

            }

        );

    }


    /*
    ------------------------------------------------------
    CLOSE CREATE MODAL
    ------------------------------------------------------
    */

    const closeCreateAdminModal =
        document.getElementById(
            "closeCreateAdminModal"
        );


    if (closeCreateAdminModal) {

        closeCreateAdminModal.addEventListener(

            "click",

            closeCreateModal

        );

    }


    /*
    ------------------------------------------------------
    CANCEL CREATE ADMIN
    ------------------------------------------------------
    */

    const cancelCreateAdmin =
        document.getElementById(
            "cancelCreateAdmin"
        );


    if (cancelCreateAdmin) {

        cancelCreateAdmin.addEventListener(

            "click",

            closeCreateModal

        );

    }


    /*
    ------------------------------------------------------
    SEARCH ADMINISTRATORS
    ------------------------------------------------------
    */

    const searchAdmins =
        document.getElementById(
            "searchAdmins"
        );


    if (searchAdmins) {

        searchAdmins.addEventListener(

            "input",

            function () {

                applyFilters();

            }

        );

    }


    /*
    ------------------------------------------------------
    STATUS FILTER
    ------------------------------------------------------
    */

    const statusFilter =
        document.getElementById(
            "statusFilter"
        );


    if (statusFilter) {

        statusFilter.addEventListener(

            "change",

            function () {

                applyFilters();

            }

        );

    }


    /*
    ------------------------------------------------------
    CLOSE CONFIRM MODAL
    ------------------------------------------------------
    */

    const closeConfirmAdminModal =
        document.getElementById(
            "closeConfirmAdminModal"
        );


    if (closeConfirmAdminModal) {

        closeConfirmAdminModal.addEventListener(

            "click",

            closeConfirmModal

        );

    }


    /*
    ------------------------------------------------------
    CANCEL CONFIRMATION
    ------------------------------------------------------
    */

    const cancelConfirmAdmin =
        document.getElementById(
            "cancelConfirmAdmin"
        );


    if (cancelConfirmAdmin) {

        cancelConfirmAdmin.addEventListener(

            "click",

            closeConfirmModal

        );

    }


    /*
    ------------------------------------------------------
    CONFIRM ACTION
    ------------------------------------------------------
    */

    const confirmAdminAction =
        document.getElementById(
            "confirmAdminAction"
        );


    if (confirmAdminAction) {

        confirmAdminAction.addEventListener(

            "click",

            async function () {

                await executeConfirmedAction();

            }

        );

    }


    /*
    ------------------------------------------------------
    MODAL OVERLAYS
    ------------------------------------------------------
    */

    document.addEventListener(

        "click",

        function (event) {

            if (

                event.target.classList.contains(
                    "modal-overlay"
                )

            ) {

                closeCreateModal();

                closeConfirmModal();

            }

        }

    );


    /*
    ------------------------------------------------------
    ESCAPE KEY
    ------------------------------------------------------
    */

    document.addEventListener(

        "keydown",

        function (event) {

            if (

                event.key === "Escape"

            ) {

                closeCreateModal();

                closeConfirmModal();

            }

        }

    );

}


/* =========================================================
   LOAD ADMINISTRATORS
========================================================= */

async function loadAdministrators() {

    showTableLoading();


    try {

        const response =
            await API.get(
                "/admin/admins"
            );


        if (

            !response ||

            response.success === false

        ) {

            throw new Error(

                response?.message ||

                "Unable to load administrators."

            );

        }


        administrators =
            Array.isArray(
                response.data
            )

                ? response.data

                : [];


        filteredAdministrators =
            [...administrators];


        updateStatistics();

        renderAdministrators();


    } catch (error) {

        console.error(
            "Load administrators error:",
            error
        );


        administrators = [];

        filteredAdministrators = [];


        updateStatistics();

        showTableError();

        showMessage(

            error.message ||

            "Unable to load administrators.",

            "error"

        );

    }

}


/* =========================================================
   UPDATE STATISTICS
========================================================= */

function updateStatistics() {


    const total =
        administrators.length;


    const active =
        administrators.filter(

            admin =>

                admin.status === "active"

        ).length;


    const inactive =
        administrators.filter(

            admin =>

                admin.status === "inactive"

        ).length;


    const pending =
        administrators.filter(

            admin =>

                admin.approval_status === "pending"

        ).length;


    setText(

        "totalAdmins",

        total

    );


    setText(

        "activeAdmins",

        active

    );


    setText(

        "pendingAdmins",

        pending

    );


    setText(

        "inactiveAdmins",

        inactive

    );

}


/* =========================================================
   APPLY SEARCH + STATUS FILTERS
========================================================= */

function applyFilters() {


    const searchValue =
        document.getElementById(
            "searchAdmins"
        )
            ?.value
            .trim()
            .toLowerCase()

        || "";


    const statusValue =
        document.getElementById(
            "statusFilter"
        )
            ?.value

        || "";


    filteredAdministrators =
        administrators.filter(

            admin => {


                const fullName =

                    `${

                        admin.first_name ||

                        ""

                    } ${

                        admin.last_name ||

                        ""

                    }`

                    .trim()

                    .toLowerCase();


                const email =
                    (
                        admin.email ||

                        ""
                    )
                        .toLowerCase();


                const role =
                    (
                        admin.role ||

                        ""
                    )
                        .toLowerCase();


                const matchesSearch =

                    !searchValue ||

                    fullName.includes(
                        searchValue
                    )

                    ||

                    email.includes(
                        searchValue
                    )

                    ||

                    role.includes(
                        searchValue
                    );


                let matchesStatus =
                    true;


                if (

                    statusValue === "pending"

                ) {

                    matchesStatus =

                        admin.approval_status ===
                        "pending";

                }


                else if (

                    statusValue === "active"

                ) {

                    matchesStatus =

                        admin.status ===
                        "active";

                }


                else if (

                    statusValue === "inactive"

                ) {

                    matchesStatus =

                        admin.status ===
                        "inactive";

                }


                return (

                    matchesSearch &&

                    matchesStatus

                );

            }

        );


    renderAdministrators();

}


/* =========================================================
   RENDER ADMINISTRATORS
========================================================= */

function renderAdministrators() {


    const tableBody =
        document.getElementById(
            "adminsTableBody"
        );


    const emptyAdmins =
        document.getElementById(
            "emptyAdmins"
        );


    if (

        !tableBody

    ) {

        return;

    }


    /*
    ------------------------------------------------------
    EMPTY STATE
    ------------------------------------------------------
    */

    if (

        filteredAdministrators.length === 0

    ) {

        tableBody.innerHTML = "";


        if (emptyAdmins) {

            emptyAdmins.style.display =
                "block";

        }


        return;

    }


    if (emptyAdmins) {

        emptyAdmins.style.display =
            "none";

    }


    tableBody.innerHTML = "";


    filteredAdministrators.forEach(

        function (admin) {


            const row =
                document.createElement(
                    "tr"
                );


            const fullName =

                `${

                    admin.first_name ||

                    ""

                } ${

                    admin.last_name ||

                    ""

                }`

                .trim();


            row.innerHTML = `

                <td>

                    <div class="admin-user">

                        <div class="admin-avatar">

                            ${escapeHtml(
                                getInitials(
                                    admin.first_name,
                                    admin.last_name
                                )
                            )}

                        </div>

                        <div>

                            <strong>

                                ${escapeHtml(
                                    fullName ||
                                    "Unknown Administrator"
                                )}

                            </strong>

                        </div>

                    </div>

                </td>


                <td>

                    ${escapeHtml(
                        admin.email ||
                        "—"
                    )}

                </td>


                <td>

                    ${renderRoleBadge(
                        admin.role
                    )}

                </td>


                <td>

                    ${renderStatusBadge(
                        admin.status
                    )}

                </td>


                <td>

                    ${renderApprovalBadge(
                        admin.approval_status
                    )}

                </td>


                <td>

                    ${formatDateTime(
                        admin.last_login_at
                    )}

                </td>


                <td>

                    ${renderActions(
                        admin
                    )}

                </td>

            `;


            tableBody.appendChild(
                row
            );


            attachRowActions(
                row,
                admin
            );

        }

    );

}


/* =========================================================
   RENDER ROLE BADGE
========================================================= */

function renderRoleBadge(role) {


    if (

        role === "super_admin"

    ) {

        return `

            <span class="role-badge super-admin">

                Super Administrator

            </span>

        `;

    }


    return `

        <span class="role-badge admin">

            Administrator

        </span>

    `;

}


/* =========================================================
   RENDER STATUS BADGE
========================================================= */

function renderStatusBadge(status) {


    if (

        status === "active"

    ) {

        return `

            <span class="status-badge active">

                Active

            </span>

        `;

    }


    return `

        <span class="status-badge inactive">

            Inactive

        </span>

    `;

}


/* =========================================================
   RENDER APPROVAL BADGE
========================================================= */

function renderApprovalBadge(status) {


    if (

        status === "approved"

    ) {

        return `

            <span class="approval-badge approved">

                Approved

            </span>

        `;

    }


    if (

        status === "rejected"

    ) {

        return `

            <span class="approval-badge rejected">

                Rejected

            </span>

        `;

    }


    return `

        <span class="approval-badge pending">

            Pending

        </span>

    `;

}


/* =========================================================
   RENDER ACTION BUTTONS
========================================================= */

function renderActions(admin) {


    let actions = `

        <div class="action-buttons">

    `;


    /*
    ------------------------------------------------------
    PENDING APPROVAL
    ------------------------------------------------------
    */

    if (

        admin.approval_status === "pending"

    ) {

        actions += `

            <button
                type="button"
                class="action-btn approve-btn"
                data-action="approve"
                title="Approve Administrator"
            >

                <i class="fa-solid fa-check"></i>

            </button>


            <button
                type="button"
                class="action-btn reject-btn"
                data-action="reject"
                title="Reject Administrator"
            >

                <i class="fa-solid fa-xmark"></i>

            </button>

        `;

    }


    /*
    ------------------------------------------------------
    ACTIVE / INACTIVE
    ------------------------------------------------------
    */

    if (

        admin.status === "active"

    ) {

        actions += `

            <button
                type="button"
                class="action-btn deactivate-btn"
                data-action="deactivate"
                title="Deactivate Administrator"
            >

                <i class="fa-solid fa-user-slash"></i>

            </button>

        `;

    }


    else {

        actions += `

            <button
                type="button"
                class="action-btn activate-btn"
                data-action="activate"
                title="Activate Administrator"
            >

                <i class="fa-solid fa-user-check"></i>

            </button>

        `;

    }


    /*
    ------------------------------------------------------
    RESET PASSWORD
    ------------------------------------------------------
    */

    actions += `

        <button
            type="button"
            class="action-btn password-btn"
            data-action="password"
            title="Reset Password"
        >

            <i class="fa-solid fa-key"></i>

        </button>

    `;


    /*
    ------------------------------------------------------
    DELETE
    ------------------------------------------------------
    */

    if (

        admin.role !== "super_admin"

    ) {

        actions += `

            <button
                type="button"
                class="action-btn delete-btn"
                data-action="delete"
                title="Delete Administrator"
            >

                <i class="fa-solid fa-trash"></i>

            </button>

        `;

    }


    actions += `

        </div>

    `;


    return actions;

}


/* =========================================================
   ATTACH ROW ACTIONS
========================================================= */

function attachRowActions(
    row,
    admin
) {


    const buttons =
        row.querySelectorAll(
            "[data-action]"
        );


    buttons.forEach(

        function (button) {

            button.addEventListener(

                "click",

                function () {


                    const action =
                        button.dataset.action;


                    handleAdminAction(

                        action,

                        admin

                    );

                }

            );

        }

    );

}


/* =========================================================
   HANDLE ADMIN ACTION
========================================================= */

function handleAdminAction(
    action,
    admin
) {


    const fullName =

        `${

            admin.first_name ||

            ""

        } ${

            admin.last_name ||

            ""

        }`

        .trim();


    /*
    ------------------------------------------------------
    APPROVE
    ------------------------------------------------------
    */

    if (

        action === "approve"

    ) {

        openConfirmationModal({

            title:
                "Approve Administrator",

            message:

                `Are you sure you want to approve ${fullName}?`,

            buttonText:
                "Approve",

            buttonClass:
                "primary-btn",

            action:
                "approve",

            admin

        });

        return;

    }


    /*
    ------------------------------------------------------
    REJECT
    ------------------------------------------------------
    */

    if (

        action === "reject"

    ) {

        openConfirmationModal({

            title:
                "Reject Administrator",

            message:

                `Are you sure you want to reject ${fullName}?`,

            buttonText:
                "Reject",

            buttonClass:
                "danger-btn",

            action:
                "reject",

            admin

        });

        return;

    }


    /*
    ------------------------------------------------------
    ACTIVATE
    ------------------------------------------------------
    */

    if (

        action === "activate"

    ) {

        openConfirmationModal({

            title:
                "Activate Administrator",

            message:

                `Are you sure you want to activate ${fullName}?`,

            buttonText:
                "Activate",

            buttonClass:
                "primary-btn",

            action:
                "activate",

            admin

        });

        return;

    }


    /*
    ------------------------------------------------------
    DEACTIVATE
    ------------------------------------------------------
    */

    if (

        action === "deactivate"

    ) {

        openConfirmationModal({

            title:
                "Deactivate Administrator",

            message:

                `Are you sure you want to deactivate ${fullName}?`,

            buttonText:
                "Deactivate",

            buttonClass:
                "danger-btn",

            action:
                "deactivate",

            admin

        });

        return;

    }


    /*
    ------------------------------------------------------
    RESET PASSWORD
    ------------------------------------------------------
    */

    if (

        action === "password"

    ) {

        requestPasswordReset(
            admin
        );

        return;

    }


    /*
    ------------------------------------------------------
    DELETE
    ------------------------------------------------------
    */

    if (

        action === "delete"

    ) {

        openConfirmationModal({

            title:
                "Delete Administrator",

            message:

                `Are you sure you want to permanently delete ${fullName}? This action cannot be undone.`,

            buttonText:
                "Delete",

            buttonClass:
                "danger-btn",

            action:
                "delete",

            admin

        });

    }

}


/* =========================================================
   CREATE ADMINISTRATOR
========================================================= */

async function createAdministrator() {


    const firstName =
        document.getElementById(
            "adminFirstName"
        )
            ?.value
            .trim();


    const lastName =
        document.getElementById(
            "adminLastName"
        )
            ?.value
            .trim();


    const email =
        document.getElementById(
            "adminEmail"
        )
            ?.value
            .trim()
            .toLowerCase();


    const password =
        document.getElementById(
            "adminPassword"
        )
            ?.value;


    const role =
        document.getElementById(
            "adminRole"
        )
            ?.value;


    const saveButton =
        document.getElementById(
            "saveAdminBtn"
        );


    clearCreateAdminMessage();


    /*
    ------------------------------------------------------
    VALIDATION
    ------------------------------------------------------
    */

    if (

        !firstName ||

        !lastName ||

        !email ||

        !password ||

        !role

    ) {

        showCreateAdminMessage(

            "Please complete all required fields.",

            "error"

        );

        return;

    }


    if (

        password.length < 8

    ) {

        showCreateAdminMessage(

            "Password must be at least 8 characters.",

            "error"

        );

        return;

    }


    /*
    ------------------------------------------------------
    LOADING STATE
    ------------------------------------------------------
    */

    setButtonLoading(

        saveButton,

        true,

        "Creating..."

    );


    try {

        const response =
            await API.post(

                "/admin/admins",

                {

                    first_name:
                        firstName,

                    last_name:
                        lastName,

                    email,

                    password,

                    role

                }

            );


        if (

            !response ||

            response.success === false

        ) {

            throw new Error(

                response?.message ||

                "Unable to create administrator."

            );

        }


        showMessage(

            response.message ||

            "Administrator created successfully.",

            "success"

        );


        closeCreateModal();


        await loadAdministrators();


    } catch (error) {

        console.error(
            "Create administrator error:",
            error
        );


        showCreateAdminMessage(

            error.message ||

            "Unable to create administrator.",

            "error"

        );

    }


    finally {

        setButtonLoading(

            saveButton,

            false

        );

    }

}


/* =========================================================
   OPEN CREATE MODAL
========================================================= */

function openCreateAdminModal() {


    const modal =
        document.getElementById(
            "createAdminModal"
        );


    if (!modal) {

        return;

    }


    const form =
        document.getElementById(
            "createAdminForm"
        );


    if (form) {

        form.reset();

    }


    clearCreateAdminMessage();


    modal.classList.add(
        "show"
    );


    document.body.style.overflow =
        "hidden";


    setTimeout(

        function () {

            document.getElementById(
                "adminFirstName"
            )
                ?.focus();

        },

        100

    );

}


/* =========================================================
   CLOSE CREATE MODAL
========================================================= */

function closeCreateModal() {


    const modal =
        document.getElementById(
            "createAdminModal"
        );


    if (!modal) {

        return;

    }


    modal.classList.remove(
        "show"
    );


    document.body.style.overflow =
        "";


    clearCreateAdminMessage();

}


/* =========================================================
   OPEN CONFIRMATION MODAL
========================================================= */

function openConfirmationModal(
    configuration
) {


    pendingConfirmation =
        configuration;


    const modal =
        document.getElementById(
            "confirmAdminModal"
        );


    const title =
        document.getElementById(
            "confirmAdminTitle"
        );


    const message =
        document.getElementById(
            "confirmAdminMessage"
        );


    const button =
        document.getElementById(
            "confirmAdminAction"
        );


    if (

        !modal ||

        !title ||

        !message ||

        !button

    ) {

        return;

    }


    title.textContent =
        configuration.title;


    message.textContent =
        configuration.message;


    button.textContent =
        configuration.buttonText ||
        "Confirm";


    button.className =
        configuration.buttonClass ||
        "danger-btn";


    modal.classList.add(
        "show"
    );


    document.body.style.overflow =
        "hidden";

}


/* =========================================================
   CLOSE CONFIRM MODAL
========================================================= */

function closeConfirmModal() {


    const modal =
        document.getElementById(
            "confirmAdminModal"
        );


    if (modal) {

        modal.classList.remove(
            "show"
        );

    }


    document.body.style.overflow =
        "";


    pendingConfirmation =
        null;

}

/* =========================================================
   EXECUTE CONFIRMED ACTION
========================================================= */

async function executeConfirmedAction() {


    if (!pendingConfirmation) {

        return;

    }


    const configuration =
        pendingConfirmation;


    const button =
        document.getElementById(
            "confirmAdminAction"
        );


    setButtonLoading(

        button,

        true,

        "Processing..."

    );


    try {


        const adminId =
            configuration.admin?.id;


        if (!adminId) {

            throw new Error(
                "Administrator ID is missing."
            );

        }


        let response;


        /*
        --------------------------------------------------
        APPROVE
        --------------------------------------------------
        */

        if (

            configuration.action ===
            "approve"

        ) {

            response =
                await API.patch(

                    `/admin/admins/${adminId}/approve`

                );

        }


        /*
        --------------------------------------------------
        REJECT
        --------------------------------------------------
        */

        else if (

            configuration.action ===
            "reject"

        ) {

            response =
                await API.patch(

                    `/admin/admins/${adminId}/reject`

                );

        }


        /*
        --------------------------------------------------
        ACTIVATE
        --------------------------------------------------
        */

        else if (

            configuration.action ===
            "activate"

        ) {

            response =
                await API.patch(

                    `/admin/admins/${adminId}/status`,

                    {
                        status: "active"
                    }

                );

        }


        /*
        --------------------------------------------------
        DEACTIVATE
        --------------------------------------------------
        */

        else if (

            configuration.action ===
            "deactivate"

        ) {

            response =
                await API.patch(

                    `/admin/admins/${adminId}/status`,

                    {
                        status: "inactive"
                    }

                );

        }


        /*
        --------------------------------------------------
        PASSWORD RESET
        --------------------------------------------------
        */

        else if (

            configuration.action ===
            "password-reset"

        ) {

            response =
                await API.patch(

                    `/admin/admins/${adminId}/password`,

                    {
                        password:
                            configuration.password
                    }

                );

        }


        /*
        --------------------------------------------------
        DELETE
        --------------------------------------------------
        */

        else if (

            configuration.action ===
            "delete"

        ) {

            response =
                await API.delete(

                    `/admin/admins/${adminId}`

                );

        }


        /*
        --------------------------------------------------
        UNKNOWN ACTION
        --------------------------------------------------
        */

        else {

            throw new Error(
                "Unknown administrator action."
            );

        }


        /*
        --------------------------------------------------
        VALIDATE RESPONSE
        --------------------------------------------------
        */

        if (

            !response ||

            response.success === false

        ) {

            throw new Error(

                response?.message ||

                "Unable to complete administrator action."

            );

        }


        /*
        --------------------------------------------------
        CLOSE MODAL
        --------------------------------------------------
        */

        closeConfirmModal();


        /*
        --------------------------------------------------
        SUCCESS MESSAGE
        --------------------------------------------------
        */

        showMessage(

            response.message ||

            "Administrator updated successfully.",

            "success"

        );


        /*
        --------------------------------------------------
        REFRESH ADMINISTRATORS
        --------------------------------------------------
        */

        await loadAdministrators();


    } catch (error) {


        console.error(

            "Administrator action error:",

            error

        );


        showMessage(

            error.message ||

            "Unable to complete administrator action.",

            "error"

        );

    }


    finally {


        setButtonLoading(

            button,

            false

        );

    }

}


/* =========================================================
   RESET ADMIN PASSWORD
========================================================= */

function requestPasswordReset(
    admin
) {


    if (!admin) {

        return;

    }


    const fullName =
        `${

            admin.first_name ||

            ""

        } ${

            admin.last_name ||

            ""

        }`
            .trim()


        ||

        admin.email

        ||

        "this administrator";


    const password =
        window.prompt(

            `Enter a new password for ${fullName}. Password must be at least 8 characters.`

        );


    /*
    ------------------------------------------------------
    USER CANCELLED
    ------------------------------------------------------
    */

    if (

        password === null

    ) {

        return;

    }


    /*
    ------------------------------------------------------
    CLEAN PASSWORD
    ------------------------------------------------------
    */

    const cleanedPassword =
        password.trim();


    /*
    ------------------------------------------------------
    VALIDATE PASSWORD
    ------------------------------------------------------
    */

    if (

        cleanedPassword.length < 8

    ) {

        showMessage(

            "Password must be at least 8 characters.",

            "error"

        );


        return;

    }


    /*
    ------------------------------------------------------
    OPEN CONFIRMATION
    ------------------------------------------------------
    */

    openConfirmationModal({

        title:
            "Reset Password",

        message:

            `Are you sure you want to reset the password for ${fullName}?`,

        buttonText:
            "Reset Password",

        buttonClass:
            "danger-btn",

        action:
            "password-reset",

        admin,

        password:
            cleanedPassword

    });

}


/* =========================================================
   SHOW TABLE LOADING
========================================================= */

function showTableLoading() {


    const tableBody =
        document.getElementById(
            "adminsTableBody"
        );


    const emptyAdmins =
        document.getElementById(
            "emptyAdmins"
        );


    if (tableBody) {

        tableBody.innerHTML = `

            <tr>

                <td
                    colspan="7"
                    class="table-loading"
                >

                    <i class="fa-solid fa-spinner fa-spin"></i>

                    Loading administrators...

                </td>

            </tr>

        `;

    }


    if (emptyAdmins) {

        emptyAdmins.style.display =
            "none";

    }

}


/* =========================================================
   SHOW TABLE ERROR
========================================================= */

function showTableError() {


    const tableBody =
        document.getElementById(
            "adminsTableBody"
        );


    const emptyAdmins =
        document.getElementById(
            "emptyAdmins"
        );


    if (!tableBody) {

        return;

    }


    tableBody.innerHTML = `

        <tr>

            <td
                colspan="7"
                class="table-loading"
            >

                <i class="fa-solid fa-circle-exclamation"></i>

                Unable to load administrators.

            </td>

        </tr>

    `;


    if (emptyAdmins) {

        emptyAdmins.style.display =
            "none";

    }

}


/* =========================================================
   SHOW PAGE MESSAGE
========================================================= */

function showMessage(
    message,
    type = "success"
) {


    const container =
        document.getElementById(
            "message"
        );


    if (!container) {

        return;

    }


    container.textContent =
        message;


    container.className =
        type === "success"

            ? "success"

            : "error";


    clearTimeout(
        showMessage.timeout
    );


    showMessage.timeout =
        setTimeout(

            function () {


                container.textContent =
                    "";


                container.className =
                    "";


            },

            5000

        );

}


/* =========================================================
   CREATE ADMIN MESSAGE
========================================================= */

function showCreateAdminMessage(
    message,
    type = "error"
) {


    const container =
        document.getElementById(
            "createAdminMessage"
        );


    if (!container) {

        return;

    }


    container.textContent =
        message;


    container.className =
        type === "success"

            ? "success"

            : "error";

}


/* =========================================================
   CLEAR CREATE ADMIN MESSAGE
========================================================= */

function clearCreateAdminMessage() {


    const container =
        document.getElementById(
            "createAdminMessage"
        );


    if (!container) {

        return;

    }


    container.textContent =
        "";


    container.className =
        "";

}


/* =========================================================
   BUTTON LOADING STATE
========================================================= */

function setButtonLoading(
    button,
    loading,
    loadingText = "Loading..."
) {


    if (!button) {

        return;

    }


    /*
    ------------------------------------------------------
    ENABLE LOADING
    ------------------------------------------------------
    */

    if (loading) {


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


    /*
    ------------------------------------------------------
    DISABLE LOADING
    ------------------------------------------------------
    */

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
   GET INITIALS
========================================================= */

function getInitials(
    firstName,
    lastName
) {


    const first =
        firstName
            ? String(firstName)
                .charAt(0)
            : "";


    const last =
        lastName
            ? String(lastName)
                .charAt(0)
            : "";


    const initials =
        `${first}${last}`
            .toUpperCase();


    return initials || "A";

}


/* =========================================================
   FORMAT DATE / TIME
========================================================= */

function formatDateTime(
    value
) {


    if (!value) {

        return "Never";

    }


    try {


        if (

            typeof Utils !== "undefined" &&

            typeof Utils.formatDateTime ===
            "function"

        ) {

            return Utils.formatDateTime(
                value
            );

        }


        const date =
            new Date(
                value
            );


        if (

            Number.isNaN(
                date.getTime()
            )

        ) {

            return "—";

        }


        return date.toLocaleString();


    } catch {

        return "—";

    }

}


/* =========================================================
   SET TEXT
========================================================= */

function setText(
    elementId,
    value
) {


    const element =
        document.getElementById(
            elementId
        );


    if (!element) {

        return;

    }


    const number =
        Number(value) || 0;


    if (

        typeof Utils !== "undefined" &&

        typeof Utils.number ===
        "function"

    ) {

        element.textContent =
            Utils.number(
                number
            );


        return;

    }


    element.textContent =
        number.toLocaleString();

}


/* =========================================================
   ESCAPE HTML
========================================================= */

function escapeHtml(
    value
) {


    if (

        value === null ||

        value === undefined

    ) {

        return "";

    }


    const div =
        document.createElement(
            "div"
        );


    div.textContent =
        String(
            value
        );


    return div.innerHTML;

}
