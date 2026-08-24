/*=========================================================
    NurseSphere Checkout Controller
    File: js/checkout.js

    PayPal Checkout / PayPal Buttons

    Responsibilities:
    - Authenticate student
    - Read plan ID from URL
    - Load student information
    - Load selected subscription plan
    - Render plan information
    - Initialize PayPal Buttons
    - Create PayPal order through NurseSphere backend
    - Let PayPal handle payment UI
    - Capture payment through NurseSphere backend
    - Activate subscription
    - Handle errors and session expiration

    IMPORTANT:
    - No card fields exist in NurseSphere HTML.
    - NurseSphere never receives card number, CVV, or expiry.
    - Browser sends only planId to create-order.
    - Backend remains authoritative for price/currency.
=========================================================*/

"use strict";


/*=========================================================
    CONFIGURATION
=========================================================*/

const CHECKOUT_API_BASE =
    "https://nursephere.wamalwaemily.workers.dev/api";


const CHECKOUT_ENDPOINTS = {

    plan:
        `${CHECKOUT_API_BASE}/subscription-plans`,

    createOrder:
        `${CHECKOUT_API_BASE}/payments/create-order`,

    captureOrder:
        `${CHECKOUT_API_BASE}/payments/capture-order`

};


/*=========================================================
    STATE
=========================================================*/

const checkoutState = {

    token:
        null,

    student:
        null,

    planId:
        null,

    plan:
        null,

    orderId:
        null,

    isSubmitting:
        false,

    initialized:
        false,

    paypalRendered:
        false,

    paymentCompleted:
        false

};


/*=========================================================
    DOM ELEMENTS
=========================================================*/

const checkoutForm =
    document.getElementById(
        "checkoutForm"
    );


const fullNameInput =
    document.getElementById(
        "fullName"
    );


const emailInput =
    document.getElementById(
        "email"
    );


const planName =
    document.getElementById(
        "planName"
    );


const planDescription =
    document.getElementById(
        "planDescription"
    );


const planDuration =
    document.getElementById(
        "planDuration"
    );


const planPrice =
    document.getElementById(
        "planPrice"
    );


const totalPrice =
    document.getElementById(
        "totalPrice"
    );


const paypalContainer =
    document.getElementById(
        "paypal-button-container"
    );


/*=========================================================
    DOM VALIDATION
=========================================================*/

function validatePageElements() {

    const elements = {

        checkoutForm,

        fullNameInput,

        emailInput,

        planName,

        planDescription,

        planDuration,

        planPrice,

        totalPrice,

        paypalContainer

    };


    for (
        const [name, element]
        of Object.entries(
            elements
        )
    ) {

        if (!element) {

            console.error(
                `Missing checkout element: ${name}`
            );

            return false;

        }

    }


    return true;

}


/*=========================================================
    INITIALIZATION
=========================================================*/

document.addEventListener(

    "DOMContentLoaded",

    initializeCheckout

);


/*=========================================================
    INITIALIZE CHECKOUT
=========================================================*/

async function initializeCheckout() {

    if (
        !validatePageElements()
    ) {

        return;

    }


    setPaypalLoadingState(
        "Loading Checkout..."
    );


    try {

        /*=====================================================
            AUTHENTICATION
        =====================================================*/

        checkoutState.token =
            localStorage.getItem(
                "studentToken"
            );


        if (
            !checkoutState.token
        ) {

            redirectToLogin();

            return;

        }


        /*=====================================================
            PLAN ID FROM URL
        =====================================================*/

        const params =
            new URLSearchParams(
                window.location.search
            );


        checkoutState.planId =
            params.get(
                "plan"
            );


        if (
            !checkoutState.planId
        ) {

            showError(
                "No subscription plan was selected."
            );


            window.location.replace(
                "pricing.html"
            );


            return;

        }


        /*=====================================================
            LOAD STUDENT
        =====================================================*/

        await loadStudent();


        /*=====================================================
            LOAD PLAN
        =====================================================*/

        await loadPlan();


        /*=====================================================
            PAYPAL SDK
        =====================================================*/

        await waitForPayPal();


        /*=====================================================
            PAYPAL BUTTONS
        =====================================================*/

        await initializePayPalButtons();


        checkoutState.initialized =
            true;


    }

    catch (error) {

        console.error(
            "CHECKOUT INITIALIZATION ERROR:",
            error
        );


        showError(
            error?.message ||
            "Unable to initialize checkout."
        );


        setPaypalUnavailableState();

    }

}


/*=========================================================
    LOAD STUDENT
=========================================================*/

async function loadStudent() {

    const studentId =
        localStorage.getItem(
            "studentId"
        );


    const studentName =
        localStorage.getItem(
            "studentName"
        );


    const studentEmail =
        localStorage.getItem(
            "studentEmail"
        );


    if (
        !studentId ||
        !studentName ||
        !studentEmail
    ) {

        throw new Error(
            "Student information is unavailable. Please log in again."
        );

    }


    checkoutState.student = {

        id:
            studentId,

        fullName:
            studentName,

        email:
            studentEmail

    };


    fullNameInput.value =
        studentName;


    emailInput.value =
        studentEmail;

}


/*=========================================================
    LOAD PLAN
=========================================================*/

async function loadPlan() {

    const response =
        await fetch(

            `${CHECKOUT_ENDPOINTS.plan}/${encodeURIComponent(
                checkoutState.planId
            )}`,

            {

                method:
                    "GET",

                headers: {

                    "Authorization":
                        `Bearer ${checkoutState.token}`,

                    "Accept":
                        "application/json"

                },

                cache:
                    "no-store"

            }

        );


    const result =
        await parseResponse(
            response
        );


    if (
        !result.plan
    ) {

        throw new Error(
            "The selected subscription plan could not be loaded."
        );

    }


    checkoutState.plan =
        result.plan;


    renderPlan();

}


/*=========================================================
    RENDER PLAN
=========================================================*/

function renderPlan() {

    const plan =
        checkoutState.plan;


    planName.textContent =
        plan.name ||
        "Subscription";


    planDescription.textContent =
        plan.description ||
        "Subscription access";


    const duration =
        Number(
            plan.duration_days
        );


    planDuration.textContent =

        Number.isFinite(duration) &&
        duration > 0

            ? `${duration} Days`

            : "--";


    const price =
        Number(
            plan.price
        );


    if (
        !Number.isFinite(price) ||
        price < 0
    ) {

        throw new Error(
            "The selected subscription has an invalid price."
        );

    }


    const currency =
        plan.currency ||
        "USD";


    planPrice.textContent =
        formatCurrency(
            price,
            currency
        );


    totalPrice.textContent =
        formatCurrency(
            price,
            currency
        );

}


/*=========================================================
    WAIT FOR PAYPAL SDK
=========================================================*/

function waitForPayPal() {

    return new Promise(

        (resolve, reject) => {

            const started =
                Date.now();


            const timeout =
                15000;


            function check() {

                if (

                    window.paypal &&

                    typeof window.paypal.Buttons ===
                        "function"

                ) {

                    resolve();

                    return;

                }


                if (

                    Date.now() -
                    started >=
                    timeout

                ) {

                    reject(

                        new Error(
                            "PayPal Checkout could not be loaded."
                        )

                    );

                    return;

                }


                window.setTimeout(
                    check,
                    100
                );

            }


            check();

        }

    );

}


/*=========================================================
    INITIALIZE PAYPAL BUTTONS
=========================================================*/

async function initializePayPalButtons() {

    if (
        !window.paypal ||
        typeof window.paypal.Buttons !==
            "function"
    ) {

        throw new Error(
            "PayPal Checkout is unavailable."
        );

    }


    if (
        !paypalContainer
    ) {

        throw new Error(
            "PayPal checkout container is missing."
        );

    }


    /*
        Make sure the container starts clean.
    */

    paypalContainer.innerHTML =
        "";


    paypalContainer.style.pointerEvents =
        "auto";


    paypalContainer.style.opacity =
        "1";


    /*=====================================================
        CREATE PAYPAL BUTTON INSTANCE
    =====================================================*/

    const buttons =
        window.paypal.Buttons({

            /*=================================================
                BUTTON STYLE
            =================================================*/

            style: {

                layout:
                    "vertical",

                shape:
                    "rect",

                label:
                    "paypal",

                height:
                    48

            },


            /*=================================================
                CREATE ORDER
            =================================================*/

            createOrder:
                async function () {

                    if (
                        checkoutState.paymentCompleted
                    ) {

                        throw new Error(
                            "This payment has already been completed."
                        );

                    }


                    if (
                        checkoutState.isSubmitting
                    ) {

                        throw new Error(
                            "A payment is already being processed."
                        );

                    }


                    checkoutState.isSubmitting =
                        true;


                    checkoutState.orderId =
                        null;


                    try {

                        const orderId =
                            await createOrder();


                        return orderId;

                    }

                    catch (error) {

                        checkoutState.isSubmitting =
                            false;


                        throw error;

                    }

                },


            /*=================================================
                PAYMENT APPROVED
            =================================================*/

            onApprove:
                async function (
                    data
                ) {

                    try {

                        if (
                            !data ||
                            !data.orderID
                        ) {

                            throw new Error(
                                "PayPal did not return a valid payment order."
                            );

                        }


                        checkoutState.orderId =
                            data.orderID;


                        setPaypalProcessingState();


                        await capturePayment();

                    }

                    catch (error) {

                        console.error(
                            "PAYPAL APPROVAL ERROR:",
                            error
                        );


                        checkoutState.orderId =
                            null;


                        checkoutState.isSubmitting =
                            false;


                        restorePaypalButtons();


                        showError(
                            getPaymentErrorMessage(
                                error
                            )
                        );

                    }

                },


            /*=================================================
                PAYMENT CANCELLED
            =================================================*/

            onCancel:
                function () {

                    console.info(
                        "PayPal checkout cancelled."
                    );


                    checkoutState.orderId =
                        null;


                    checkoutState.isSubmitting =
                        false;


                    restorePaypalButtons();


                },


            /*=================================================
                PAYPAL ERROR
            =================================================*/

            onError:
                function (
                    error
                ) {

                    console.error(
                        "PAYPAL CHECKOUT ERROR:",
                        error
                    );


                    checkoutState.orderId =
                        null;


                    checkoutState.isSubmitting =
                        false;


                    restorePaypalButtons();


                    showError(
                        getPaymentErrorMessage(
                            error
                        )
                    );

                }

        });


    if (
        !buttons
    ) {

        throw new Error(
            "Unable to initialize PayPal Checkout."
        );

    }


    /*=====================================================
        CHECK ELIGIBILITY
    =====================================================*/

    if (
        typeof buttons.isEligible ===
            "function"
    ) {

        const eligible =
            buttons.isEligible();


        if (
            !eligible
        ) {

            throw new Error(
                "PayPal Checkout is currently unavailable for this payment."
            );

        }

    }


    /*=====================================================
        RENDER
    =====================================================*/

    await buttons.render(
        "#paypal-button-container"
    );


    checkoutState.paypalRendered =
        true;


    checkoutState.initialized =
        true;


    paypalContainer.style.pointerEvents =
        "auto";


    paypalContainer.style.opacity =
        "1";

}


/*=========================================================
    CREATE PAYPAL ORDER
=========================================================*/

async function createOrder() {

    if (
        !checkoutState.token
    ) {

        clearStudentSession();

        redirectToLogin();


        throw new Error(
            "Authentication required."
        );

    }


    if (
        !checkoutState.planId
    ) {

        throw new Error(
            "No subscription plan was selected."
        );

    }


    /*
        SECURITY RULE:

        The browser sends ONLY planId.

        The browser does NOT send:

        - price
        - currency
        - duration
        - amount
        - PayPal client secret
        - card information

        The backend must determine the authoritative
        subscription price and currency from the database.
    */

    const response =
        await fetch(

            CHECKOUT_ENDPOINTS.createOrder,

            {

                method:
                    "POST",

                headers: {

                    "Content-Type":
                        "application/json",

                    "Authorization":
                        `Bearer ${checkoutState.token}`,

                    "Accept":
                        "application/json"

                },

                body:
                    JSON.stringify({

                        planId:
                            checkoutState.planId

                    })

            }

        );


    const result =
        await parseResponse(
            response
        );


    if (
        !result.orderId
    ) {

        throw new Error(
            "PayPal did not return a payment order."
        );

    }


    checkoutState.orderId =
        result.orderId;


    return result.orderId;

}


/*=========================================================
    CAPTURE PAYMENT
=========================================================*/

async function capturePayment() {

    if (
        !checkoutState.orderId
    ) {

        throw new Error(
            "Payment order ID is missing."
        );

    }


    if (
        !checkoutState.planId
    ) {

        throw new Error(
            "Subscription plan ID is missing."
        );

    }


    if (
        !checkoutState.token
    ) {

        throw new Error(
            "Authentication required."
        );

    }


    /*
        Capture is performed by the NurseSphere backend.

        The browser does NOT capture the PayPal payment
        directly and does NOT receive card details.
    */

    const response =
        await fetch(

            CHECKOUT_ENDPOINTS.captureOrder,

            {

                method:
                    "POST",

                headers: {

                    "Content-Type":
                        "application/json",

                    "Authorization":
                        `Bearer ${checkoutState.token}`,

                    "Accept":
                        "application/json"

                },

                body:
                    JSON.stringify({

                        orderId:
                            checkoutState.orderId,

                        planId:
                            checkoutState.planId

                    })

            }

        );


    const result =
        await parseResponse(
            response
        );


    if (
        !result.success
    ) {

        throw new Error(

            result.message ||
            "Payment could not be completed."

        );

    }


    /*
        Backend has confirmed the payment and
        subscription activation.
    */

    checkoutState.paymentCompleted =
        true;


    checkoutState.isSubmitting =
        false;


    showSuccess(
        "Subscription activated successfully."
    );


    showPaymentSuccess();


    window.setTimeout(

        () => {

            window.location.replace(
                "dashboard.html"
            );

        },

        700

    );

}


/*=========================================================
    PAYPAL PROCESSING STATE
=========================================================*/

function setPaypalProcessingState() {

    if (
        !paypalContainer
    ) {

        return;

    }


    paypalContainer.style.pointerEvents =
        "none";


    paypalContainer.style.opacity =
        "0.6";

}


/*=========================================================
    RESTORE PAYPAL BUTTONS
=========================================================*/

function restorePaypalButtons() {

    if (
        checkoutState.paymentCompleted
    ) {

        return;

    }


    if (
        !paypalContainer
    ) {

        return;

    }


    paypalContainer.style.pointerEvents =
        "auto";


    paypalContainer.style.opacity =
        "1";

}


/*=========================================================
    PAYMENT SUCCESS UI
=========================================================*/

function showPaymentSuccess() {

    if (
        !paypalContainer
    ) {

        return;

    }


    paypalContainer.innerHTML = `

        <div
            class="payment-success"
            style="
                padding:16px;
                text-align:center;
                border-radius:8px;
                background:#ecfdf5;
                color:#166534;
                font-weight:600;
            "
        >

            <i class="fas fa-check-circle"></i>

            Payment Successful

        </div>

    `;


    paypalContainer.style.pointerEvents =
        "none";


    paypalContainer.style.opacity =
        "1";

}


/*=========================================================
    PAYPAL UNAVAILABLE
=========================================================*/

function setPaypalUnavailableState() {

    if (
        !paypalContainer
    ) {

        return;

    }


    paypalContainer.innerHTML = `

        <div
            class="payment-unavailable"
            style="
                padding:16px;
                text-align:center;
                border-radius:8px;
                background:#f3f4f6;
                color:#6b7280;
                font-weight:600;
            "
        >

            <i class="fas fa-circle-exclamation"></i>

            Payment Unavailable

        </div>

    `;


    paypalContainer.style.pointerEvents =
        "none";


    paypalContainer.style.opacity =
        "1";

}


/*=========================================================
    PAYPAL LOADING STATE
=========================================================*/

function setPaypalLoadingState(
    message
) {

    if (
        !paypalContainer
    ) {

        return;

    }


    paypalContainer.innerHTML = `

        <div
            class="payment-loading"
            style="
                padding:16px;
                text-align:center;
                color:#6b7280;
                font-weight:600;
            "
        >

            <i class="fas fa-spinner fa-spin"></i>

            ${escapeHtml(
                message ||
                "Loading Checkout..."
            )}

        </div>

    `;


    paypalContainer.style.pointerEvents =
        "none";

}


/*=========================================================
    API RESPONSE PARSER
=========================================================*/

async function parseResponse(
    response
) {

    let result =
        null;


    try {

        result =
            await response.json();

    }

    catch {

        result =
            null;

    }


    /*=====================================================
        AUTHENTICATION
    =====================================================*/

    if (
        response.status ===
        401
    ) {

        clearStudentSession();


        redirectToLogin();


        throw new Error(
            "Your session has expired. Please log in again."
        );

    }


    /*=====================================================
        HTTP ERROR
    =====================================================*/

    if (
        !response.ok
    ) {

        throw new Error(

            result?.message ||

            "The request could not be completed."

        );

    }


    /*=====================================================
        EMPTY RESPONSE
    =====================================================*/

    if (
        !result
    ) {

        throw new Error(
            "Unexpected server response."
        );

    }


    /*=====================================================
        APPLICATION ERROR
    =====================================================*/

    if (
        result.success === false
    ) {

        throw new Error(

            result.message ||

            "The request could not be completed."

        );

    }


    return result;

}


/*=========================================================
    ERROR MESSAGE
=========================================================*/

function showError(
    message
) {

    window.alert(

        message ||

        "Something went wrong. Please try again."

    );

}


/*=========================================================
    SUCCESS MESSAGE
=========================================================*/

function showSuccess(
    message
) {

    window.alert(

        message ||

        "Payment completed successfully."

    );

}


/*=========================================================
    SESSION
=========================================================*/

function clearStudentSession() {

    localStorage.removeItem(
        "studentToken"
    );


    localStorage.removeItem(
        "studentId"
    );


    localStorage.removeItem(
        "studentName"
    );


    localStorage.removeItem(
        "studentEmail"
    );


    localStorage.removeItem(
        "subscriptionStatus"
    );


    localStorage.removeItem(
        "trialActive"
    );

}


/*=========================================================
    REDIRECT TO LOGIN
=========================================================*/

function redirectToLogin() {

    clearStudentSession();


    window.location.replace(
        "login.html"
    );

}


/*=========================================================
    PAYMENT ERROR
=========================================================*/

function getPaymentErrorMessage(
    error
) {

    const message =
        error?.message ||
        "";


    if (
        /declined/i.test(
            message
        )
    ) {

        return (
            "Your payment was declined. " +
            "Please try another payment method."
        );

    }


    if (
        /insufficient|funds/i.test(
            message
        )
    ) {

        return (
            "The payment could not be completed because " +
            "there were insufficient funds."
        );

    }


    if (
        /cancel/i.test(
            message
        )
    ) {

        return (
            "Payment was cancelled."
        );

    }


    if (
        /unauthorized|authentication|session/i.test(
            message
        )
    ) {

        return (
            "Your session has expired. Please log in again."
        );

    }


    return (

        message ||

        "Payment could not be completed. Please try again."

    );

}


/*=========================================================
    CURRENCY
=========================================================*/

function formatCurrency(
    amount,
    currency = "USD"
) {

    const value =
        Number(
            amount
        );


    if (
        !Number.isFinite(value)
    ) {

        return "$0.00";

    }


    try {

        return new Intl.NumberFormat(

            "en-US",

            {

                style:
                    "currency",

                currency

            }

        ).format(
            value
        );

    }

    catch {

        return (
            `${currency} ${value.toFixed(2)}`
        );

    }

}


/*=========================================================
    HTML ESCAPE
=========================================================*/

function escapeHtml(
    value
) {

    return String(
        value
    )

        .replace(
            /&/g,
            "&amp;"
        )

        .replace(
            /</g,
            "&lt;"
        )

        .replace(
            />/g,
            "&gt;"
        )

        .replace(
            /"/g,
            "&quot;"
        )

        .replace(
            /'/g,
            "&#039;"
        );

}


/*=========================================================
    FORM SUBMISSION PROTECTION
=========================================================*/

/*
    PayPal Buttons handle the payment action.

    The checkout form itself must never perform a
    traditional browser submission.
*/

if (
    checkoutForm
) {

    checkoutForm.addEventListener(

        "submit",

        (event) => {

            event.preventDefault();

        }

    );

}


/*=========================================================
    PAGE EXIT PROTECTION
=========================================================*/

window.addEventListener(

    "beforeunload",

    (event) => {

        if (

            checkoutState.isSubmitting &&

            !checkoutState.paymentCompleted

        ) {

            event.preventDefault();

        }

    }

);


/*=========================================================
    END
=========================================================*/