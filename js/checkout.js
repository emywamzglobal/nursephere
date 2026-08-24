/*=========================================================
    NurseSphere Checkout Controller
    File: js/checkout.js

    - Plan loading
    - Student loading
    - PayPal Hosted Fields
    - Payment order creation
    - Payment capture
    - Subscription activation
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

    hostedFields: null,

    isSubmitting: false,

    initialized: false

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
    INITIALIZE
=========================================================*/

async function initializeCheckout() {

    if (
        !validatePageElements()
    ) {

        return;

    }


    setPaymentButtonState(
        true,
        "Loading Checkout..."
    );


    try {

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


        await loadStudent();


        await loadPlan();


        /*
            Important:

            Hosted Fields must only be initialized
            after the PayPal SDK is available.
        */

        await waitForPayPal();


        await initializePayPalHostedFields();


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


        setPaymentButtonState(
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
                    window.paypal.HostedFields
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
                            "PayPal secure card fields could not be loaded."
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
    PAYPAL HOSTED FIELDS
=========================================================*/

async function initializePayPalHostedFields() {

    if (
        !window.paypal ||
        !window.paypal.HostedFields
    ) {

        throw new Error(
            "PayPal Hosted Fields are unavailable."
        );

    }


    const eligible =
        await window.paypal.HostedFields.isEligible();


    if (
        !eligible
    ) {

        throw new Error(
            "Secure card payments are unavailable."
        );

    }


    /*
        This is the important part.

        The actual HTML card containers are:

        #card-number
        #expiration-date
        #cvv

        Hosted Fields injects the secure PayPal
        card inputs into those existing elements.
    */

    checkoutState.hostedFields =
        await window.paypal.HostedFields.render({

            createOrder,

            styles: {

                input: {

                    "font-size":
                        "16px",

                    "font-family":
                        "Arial, sans-serif",

                    color:
                        "#1f2937"

                },

                ":focus": {

                    color:
                        "#111827"

                },

                ".invalid": {

                    color:
                        "#dc2626"

                },

                ".valid": {

                    color:
                        "#16a34a"

                }

            },

            fields: {

                number: {

                    selector:
                        "#card-number"

                },

                expirationDate: {

                    selector:
                        "#expiration-date"

                },

                cvv: {

                    selector:
                        "#cvv"

                }

            }

        });


    if (
        !checkoutState.hostedFields
    ) {

        throw new Error(
            "Unable to initialize secure card fields."
        );

    }


    checkoutForm.addEventListener(
        "submit",
        handleCheckout
    );


    payButton.addEventListener(
        "click",
        handleCheckout
    );


    setPaymentButtonState(
        false,
        "Complete Secure Payment"
    );

}


/*=========================================================
    CREATE PAYPAL ORDER
=========================================================*/

async function createOrder() {

    if (
        !checkoutState.token
    ) {

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
    SUBMIT PAYMENT
=========================================================*/

async function handleCheckout(
    event
) {

    if (
        event
    ) {

        event.preventDefault();

    }


    if (
        checkoutState.isSubmitting
    ) {

        return;

    }


    if (
        !checkoutState.initialized ||
        !checkoutState.hostedFields
    ) {

        showError(
            "Secure card payment is not ready yet."
        );

        return;

    }


    checkoutState.isSubmitting =
        true;


    setPaymentButtonState(
        true,
        "Processing Payment..."
    );


    try {

        const result =
            await checkoutState.hostedFields.submit({

                cardholderName:
                    checkoutState.student.fullName ||
                    checkoutState.student.full_name ||
                    ""

            });


        if (
            result?.orderID
        ) {

            checkoutState.orderId =
                result.orderID;

        }


        if (
            !checkoutState.orderId
        ) {

            throw new Error(
                "Payment order was not created."
            );

        }


        await capturePayment();

    }

    catch (error) {

        console.error(
            "PAYMENT ERROR:",
            error
        );


        showError(
            getPaymentErrorMessage(
                error
            )
        );


        checkoutState.orderId =
            null;

    }

    finally {

        checkoutState.isSubmitting =
            false;


        if (
            checkoutState.initialized
        ) {

            setPaymentButtonState(
                false,
                "Complete Secure Payment"
            );

        }

    }

}


/*=========================================================
    CAPTURE PAYMENT
=========================================================*/

async function capturePayment() {

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


    showSuccess(
        "Subscription activated successfully."
    );


    setPaymentButtonState(
        true,
        "Payment Successful"
    );


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
    API RESPONSE
=========================================================*/

async function parseResponse(
    response
) {

    let result = null;


    try {

        result =
            await response.json();

    }

    catch {

        result = null;

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
    BUTTON STATE
=========================================================*/

function setPaymentButtonState(
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


    if (
        text ===
        "Complete Secure Payment"
    ) {

        payButton.innerHTML = `

            <i class="fas fa-lock"></i>

            Complete Secure Payment

        `;

        return;

    }


    if (
        text ===
        "Payment Successful"
    ) {

        payButton.innerHTML = `

            <i class="fas fa-check-circle"></i>

            Payment Successful

        `;

        return;

    }


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
            "Your card was declined. " +
            "Please check your card details or use another card."
        );

    }


    if (
        /invalid card/i.test(
            message
        )
    ) {

        return (
            "Please check your card details and try again."
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