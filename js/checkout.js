/*=========================================================
    NurseSphere Checkout Controller
    File: js/checkout.js

    - Plan loading
    - Student loading
    - PayPal Checkout Buttons
    - Payment order creation
    - Payment capture
    - Subscription activation

    IMPORTANT:
    PayPal handles the payment UI.
    NurseSphere never receives or stores card details.
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

    token: null,

    student: null,

    planId: null,

    plan: null,

    orderId: null,

    isSubmitting: false,

    initialized: false,

    paypalRendered: false

};


/*=========================================================
    DOM
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


const payButton =
    document.getElementById(
        "payButton"
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

        payButton

    };


    for (
        const [name, element]
        of Object.entries(elements)
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


    setPayButtonPlaceholder(
        true,
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
            PLAN ID
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
            WAIT FOR PAYPAL
        =====================================================*/

        await waitForPayPal();


        /*=====================================================
            RENDER PAYPAL BUTTONS
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


        setPayButtonPlaceholder(
            true,
            "Payment Unavailable"
        );

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


    /*
        The existing HTML contains a normal button:

            #payButton

        PayPal Buttons require a container.

        We replace that button with a PayPal
        rendering container.
    */

    const paypalContainer =
        document.createElement(
            "div"
        );


    paypalContainer.id =
        "paypal-button-container";


    paypalContainer.className =
        "paypal-button-container";


    payButton.replaceWith(
        paypalContainer
    );


    const buttons =
        window.paypal.Buttons({

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
                APPROVE PAYMENT
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
                CANCEL
            =================================================*/

            onCancel:
                function () {

                    checkoutState.orderId =
                        null;


                    checkoutState.isSubmitting =
                        false;


                    restorePaypalButtons();


                    showError(
                        "Payment was cancelled."
                    );

                },


            /*=================================================
                ERROR
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


    const eligible =
        typeof buttons.isEligible ===
            "function"

            ? buttons.isEligible()

            : true;


    if (
        !eligible
    ) {

        throw new Error(
            "PayPal Checkout is currently unavailable."
        );

    }


    await buttons.render(
        "#paypal-button-container"
    );


    checkoutState.paypalRendered =
        true;


    checkoutState.initialized =
        true;

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
        IMPORTANT:

        Only the plan ID is sent by the browser.

        The backend must determine the authoritative
        price, currency and plan details from the database.

        The browser NEVER sends the price.
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
        Backend has confirmed payment and
        subscription activation.
    */

    showSuccess(
        "Subscription activated successfully."
    );


    checkoutState.isSubmitting =
        false;


    /*
        Disable further payment attempts.
    */

    const container =
        document.getElementById(
            "paypal-button-container"
        );


    if (
        container
    ) {

        container.innerHTML = `

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

    }


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

    const container =
        document.getElementById(
            "paypal-button-container"
        );


    if (
        !container
    ) {

        return;

    }


    container.style.pointerEvents =
        "none";


    container.style.opacity =
        "0.6";

}


/*=========================================================
    RESTORE PAYPAL BUTTONS
=========================================================*/

function restorePaypalButtons() {

    const container =
        document.getElementById(
            "paypal-button-container"
        );


    if (
        !container
    ) {

        return;

    }


    container.style.pointerEvents =
        "auto";


    container.style.opacity =
        "1";

}


/*=========================================================
    PARSE API RESPONSE
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


    if (
        response.status === 401
    ) {

        clearStudentSession();

        redirectToLogin();


        throw new Error(
            "Your session has expired. Please log in again."
        );

    }


    if (
        !response.ok
    ) {

        throw new Error(

            result?.message ||
            "The request could not be completed."

        );

    }


    if (
        !result
    ) {

        throw new Error(
            "Unexpected server response."
        );

    }


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
    PAY BUTTON PLACEHOLDER
=========================================================*/

function setPayButtonPlaceholder(
    disabled,
    text
) {

    if (
        !payButton
    ) {

        return;

    }


    payButton.disabled =
        disabled;


    payButton.innerHTML = `

        <i class="fas fa-spinner fa-spin"></i>

        ${escapeHtml(text)}

    `;

}


/*=========================================================
    ERROR
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
    SUCCESS
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
    CLEAR STUDENT SESSION
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
            "Please try again or use another payment method."
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
        /funds/i.test(
            message
        )
    ) {

        return (
            "The payment could not be completed because there were insufficient funds."
        );

    }


    if (
        /unauthorized|authentication/i.test(
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

        return `${currency} ${value.toFixed(2)}`;

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
    PAGE EXIT PROTECTION
=========================================================*/

window.addEventListener(

    "beforeunload",

    (event) => {

        if (
            checkoutState.isSubmitting
        ) {

            event.preventDefault();

        }

    }

);


/*=========================================================
    END
=========================================================*/