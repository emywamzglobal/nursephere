// ======================================================
// Nursephere Email Worker
// File: workers/email.js
// ======================================================

// ======================================================
// Resend API
// ======================================================

const RESEND_API_URL =
    "https://api.resend.com/emails";

const RESEND_TIMEOUT_MS =
    10000;


// ======================================================
// SEND EMAIL
//
// Generic Nursephere email delivery service.
//
// Caller provides:
// - env
// - studentId
// - recipientEmail
// - templateKey
// - eventKey
// - preferenceKey
// - variables
//
// Email content comes from D1.
// Email configuration comes from system_settings.
// ======================================================

export async function sendEmail({

    env,

    studentId,

    recipientEmail,

    templateKey,

    eventKey,

    preferenceKey,

    variables = {}

}) {

    let logId = null;

    try {

        // ==================================================
        // VALIDATE ENVIRONMENT
        // ==================================================

        if (
            !env ||
            !env.DB
        ) {

            throw new Error(
                "Database environment is unavailable."
            );

        }


        if (
            !env.RESEND_API_KEY
        ) {

            throw new Error(
                "Resend API key is not configured."
            );

        }


        // ==================================================
        // VALIDATE INPUT
        // ==================================================

        if (
            !recipientEmail ||
            typeof recipientEmail !== "string"
        ) {

            throw new Error(
                "Recipient email is required."
            );

        }


        recipientEmail =
            recipientEmail
                .trim()
                .toLowerCase();


        if (
            !isValidEmail(
                recipientEmail
            )
        ) {

            throw new Error(
                "Invalid recipient email address."
            );

        }


        if (
            !templateKey ||
            typeof templateKey !== "string"
        ) {

            throw new Error(
                "Email template key is required."
            );

        }


        if (
            !eventKey ||
            typeof eventKey !== "string"
        ) {

            throw new Error(
                "Email event key is required."
            );

        }


        if (
            !preferenceKey ||
            typeof preferenceKey !== "string"
        ) {

            throw new Error(
                "Email preference key is required."
            );

        }


        // ==================================================
        // CHECK EXISTING EMAIL EVENT
        //
        // sent     -> never send again
        // pending  -> do not create another send
        // failed   -> allow controlled retry
        // ==================================================

        const existingLog =
            await env.DB.prepare(

                `
                SELECT
                    id,
                    status,
                    resend_id

                FROM email_logs

                WHERE event_key = ?

                LIMIT 1
                `

            )

            .bind(
                eventKey
            )

            .first();


        if (
            existingLog
        ) {

            const existingStatus =
                String(
                    existingLog.status || ""
                ).toLowerCase();


            if (
                existingStatus ===
                "sent"
            ) {

                return {

                    success: true,

                    sent: false,

                    duplicate: true,

                    message:
                        "Email already sent."

                };

            }


            if (
                existingStatus ===
                "pending"
            ) {

                return {

                    success: true,

                    sent: false,

                    duplicate: true,

                    message:
                        "Email is already being processed."

                };

            }


            // Failed events are allowed to retry.
            // The existing failed log is reused below.

            logId =
                existingLog.id;

        }


        // ==================================================
        // CHECK EMAIL PREFERENCES
        // ==================================================

        if (
            studentId
        ) {

            const preferences =
                await env.DB.prepare(

                    `
                    SELECT *

                    FROM email_preferences

                    WHERE student_id = ?

                    LIMIT 1
                    `

                )

                .bind(
                    studentId
                )

                .first();


            if (
                preferences
            ) {

                const preferenceValue =
                    preferences[
                        preferenceKey
                    ];


                // Only explicitly disabled values
                // prevent sending.

                if (
                    preferenceValue === 0 ||
                    preferenceValue === "0" ||
                    preferenceValue === false ||
                    String(
                        preferenceValue
                    ).toLowerCase() ===
                    "false"
                ) {

                    return {

                        success: true,

                        sent: false,

                        skipped: true,

                        reason:
                            "Email preference disabled."

                    };

                }

            }

        }


        // ==================================================
        // LOAD TEMPLATE
        // ==================================================

        const template =
            await env.DB.prepare(

                `
                SELECT
                    id,
                    template_key,
                    subject,
                    body,
                    status

                FROM email_templates

                WHERE template_key = ?

                LIMIT 1
                `

            )

            .bind(
                templateKey
            )

            .first();


        if (
            !template
        ) {

            throw new Error(

                `Email template not found: ${templateKey}`

            );

        }


        // ==================================================
        // CHECK TEMPLATE STATUS
        // ==================================================

        if (
            String(
                template.status || ""
            ).toLowerCase() !==
            "active"
        ) {

            return {

                success: true,

                sent: false,

                skipped: true,

                reason:
                    "Email template is inactive."

            };

        }


        // ==================================================
        // LOAD EMAIL SETTINGS
        // ==================================================

        const emailSettings =
            await getEmailSettings(
                env
            );


        // ==================================================
        // PROCESS TEMPLATE
        // ==================================================

        const subject =
            renderTemplate(

                template.subject,

                variables

            );


        const body =
            renderTemplate(

                template.body,

                variables

            );


        // ==================================================
        // VALIDATE RENDERED CONTENT
        // ==================================================

        if (
            !subject.trim()
        ) {

            throw new Error(
                "Rendered email subject is empty."
            );

        }


        if (
            !body.trim()
        ) {

            throw new Error(
                "Rendered email body is empty."
            );

        }


        // ==================================================
        // CREATE / REUSE EMAIL LOG
        // ==================================================

        if (
            !logId
        ) {

            logId =
                crypto.randomUUID();


            const createdAt =
                new Date().toISOString();


            try {

                await env.DB.prepare(

                    `
                    INSERT INTO email_logs (

                        id,
                        student_id,
                        template_key,
                        recipient_email,
                        status,
                        resend_id,
                        sent_at,
                        created_at,
                        event_key

                    )

                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                    `

                )

                .bind(

                    logId,

                    studentId || null,

                    templateKey,

                    recipientEmail,

                    "pending",

                    null,

                    null,

                    createdAt,

                    eventKey

                )

                .run();

            }

            catch (
                logError
            ) {

                // Another request may have created
                // this event concurrently.

                if (
                    isUniqueConstraintError(
                        logError
                    )
                ) {

                    const concurrentLog =
                        await env.DB.prepare(

                            `
                            SELECT
                                id,
                                status,
                                resend_id

                            FROM email_logs

                            WHERE event_key = ?

                            LIMIT 1
                            `

                        )

                        .bind(
                            eventKey
                        )

                        .first();


                    if (
                        concurrentLog
                    ) {

                        return {

                            success: true,

                            sent: false,

                            duplicate: true,

                            message:
                                "Email event is already being processed."

                        };

                    }

                }


                throw logError;

            }

        }
        else {

            // Existing failed event.
            // Reset it to pending before retrying.

            await env.DB.prepare(

                `
                UPDATE email_logs

                SET
                    status = ?,
                    template_key = ?,
                    recipient_email = ?,
                    resend_id = NULL,
                    sent_at = NULL

                WHERE id = ?
                `

            )

            .bind(

                "pending",

                templateKey,

                recipientEmail,

                logId

            )

            .run();

        }


        // ==================================================
        // SEND THROUGH RESEND
        // ==================================================

        const controller =
            new AbortController();


        const timeout =
            setTimeout(

                () => {

                    controller.abort();

                },

                RESEND_TIMEOUT_MS

            );


        let resendResponse;


        try {

            resendResponse =
                await fetch(

                    RESEND_API_URL,

                    {

                        method: "POST",

                        headers: {

                            "Authorization":
                                `Bearer ${env.RESEND_API_KEY}`,

                            "Content-Type":
                                "application/json"

                        },

                        body:
                            JSON.stringify({

                                from:
                                    emailSettings.from,

                                to: [
                                    recipientEmail
                                ],

                                subject,

                                html:
                                    body,

                                ...(emailSettings.replyTo
                                    ? {
                                        reply_to:
                                            emailSettings.replyTo
                                    }
                                    : {})

                            }),

                        signal:
                            controller.signal

                    }

                );

        }

        catch (
            resendError
        ) {

            await updateEmailLog(

                env,

                logId,

                "failed",

                null,

                null

            );


            if (
                resendError?.name ===
                "AbortError"
            ) {

                throw new Error(
                    "Email service request timed out."
                );

            }


            throw new Error(
                "Unable to connect to email service."
            );

        }

        finally {

            clearTimeout(
                timeout
            );

        }


        // ==================================================
        // READ RESEND RESPONSE
        // ==================================================

        let resendResult = null;


        try {

            resendResult =
                await resendResponse.json();

        }

        catch {

            resendResult = null;

        }


        // ==================================================
        // RESEND FAILURE
        // ==================================================

        if (
            !resendResponse.ok
        ) {

            await updateEmailLog(

                env,

                logId,

                "failed",

                null,

                null

            );


            console.error(

                "Nursephere Resend Error:",

                {

                    status:
                        resendResponse.status,

                    response:
                        resendResult

                }

            );


            return {

                success: false,

                sent: false,

                message:
                    "Email could not be sent."

            };

        }


        // ==================================================
        // RESEND SUCCESS
        // ==================================================

        const resendId =
            resendResult?.id ||
            null;


        const sentAt =
            new Date().toISOString();


        await updateEmailLog(

            env,

            logId,

            "sent",

            resendId,

            sentAt

        );


        return {

            success: true,

            sent: true,

            duplicate: false,

            resendId

        };

    }

    catch (
        error
    ) {

        console.error(

            "Nursephere Email Worker Error:",

            error

        );


        // If a log already exists, make sure a
        // failed operation is not left as pending.

        if (
            logId
        ) {

            try {

                await updateEmailLog(

                    env,

                    logId,

                    "failed",

                    null,

                    null

                );

            }

            catch (
                logError
            ) {

                console.error(

                    "Nursephere Email Log Error:",

                    logError

                );

            }

        }


        return {

            success: false,

            sent: false,

            message:
                "Unable to process email."

        };

    }

}


// ======================================================
// EMAIL SETTINGS
//
// Reads configurable email settings from
// system_settings.
//
// Expected keys:
//
// email_from
// email_reply_to
//
// Example:
// email_from = Nursephere <welcome@nursephere.com>
// ======================================================

async function getEmailSettings(
    env
) {

    const settings =
        await env.DB.prepare(

            `
            SELECT
                setting_key,
                setting_value

            FROM system_settings

            WHERE setting_key IN (
                'email_from',
                'email_reply_to'
            )
            `

        )
        .all();


    const map = {};


    for (
        const row
        of settings.results || []
    ) {

        map[
            row.setting_key
        ] =
            row.setting_value;

    }


    const from =
        map.email_from;


    if (
        !from ||
        !String(from).trim()
    ) {

        throw new Error(
            "Email sender is not configured in system_settings."
        );

    }


    return {

        from:
            String(from).trim(),

        replyTo:
            map.email_reply_to
                ? String(
                    map.email_reply_to
                ).trim()
                : null

    };

}


// ======================================================
// TEMPLATE RENDERER
//
// Replaces:
// {{student_name}}
// {{dashboard_url}}
// etc.
//
// Unknown variables are NOT silently removed.
// This prevents broken production emails.
// ======================================================

function renderTemplate(
    content,
    variables
) {

    if (
        typeof content !==
        "string"
    ) {

        throw new Error(
            "Email template content is invalid."
        );

    }


    return content.replace(

        /{{\s*([a-zA-Z0-9_]+)\s*}}/g,

        function (
            match,
            key
        ) {

            if (
                variables[key] ===
                undefined ||
                variables[key] ===
                null
            ) {

                throw new Error(

                    `Missing email template variable: ${key}`

                );

            }


            return escapeHtml(
                String(
                    variables[key]
                )
            );

        }

    );

}


// ======================================================
// HTML ESCAPING
//
// Prevents variable values from injecting HTML
// into email templates.
//
// URLs are expected to be supplied as complete
// trusted application URLs by the caller.
// ======================================================

function escapeHtml(
    value
) {

    return value

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


// ======================================================
// EMAIL VALIDATION
// ======================================================

function isValidEmail(
    email
) {

    if (
        email.length >
        254
    ) {

        return false;

    }


    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        .test(email);

}


// ======================================================
// UPDATE EMAIL LOG
// ======================================================

async function updateEmailLog(

    env,

    logId,

    status,

    resendId,

    sentAt

) {

    await env.DB.prepare(

        `
        UPDATE email_logs

        SET
            status = ?,
            resend_id = ?,
            sent_at = ?

        WHERE id = ?
        `

    )

    .bind(

        status,

        resendId,

        sentAt,

        logId

    )

    .run();

}


// ======================================================
// UNIQUE CONSTRAINT CHECK
// ======================================================

function isUniqueConstraintError(
    error
) {

    const message =
        String(
            error?.message || ""
        ).toLowerCase();


    return (

        message.includes(
            "unique"
        ) &&

        message.includes(
            "constraint"
        )

    );

}