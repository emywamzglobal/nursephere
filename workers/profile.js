// ======================================================
// Nursephere Profile Worker
// File: workers/profile.js
//
// DATABASE-DRIVEN STUDENT PROFILE SYSTEM
//
// Student
//     ↓
// students
//     ↓
// student_profiles
//     ↓
// student_progress
//     ↓
// student_activity
//     ↓
// student_documents
//
// Subscription information is read from the existing
// subscriptions + subscription_plans structure.
//
// Authentication comes from the verified JWT.
// The browser does NOT determine student identity.
// ======================================================

import jwt from "@tsndr/cloudflare-worker-jwt";


export default async function profileHandler(
    request,
    env
) {

    try {

        const url =
            new URL(request.url);

        const pathname =
            url.pathname;

  // =========================================================
// AVATAR UPLOAD
//
// PUT /api/profile/avatar
//
// Receives a student's avatar,
// stores it permanently in R2,
// and saves the R2 key in D1.
// =========================================================

if (

    request.method === "PUT"

    &&

    pathname === "/api/profile/avatar"

) {

    // =====================================================
    // AUTHENTICATION
    // =====================================================

    const authHeader =
        request.headers.get(
            "Authorization"
        );


    if (

        !authHeader ||

        !authHeader.startsWith(
            "Bearer "
        )

    ) {

        return Response.json({

            success: false,

            message:
                "Unauthorized."

        }, {

            status: 401

        });

    }


    const token =
        authHeader.substring(7);


    const valid =
        await jwt.verify(
            token,
            env.JWT_SECRET
        );


    if (!valid) {

        return Response.json({

            success: false,

            message:
                "Invalid or expired session."

        }, {

            status: 401

        });

    }


    // =====================================================
    // VERIFIED STUDENT ID
    // =====================================================

    const payload =
        jwt.decode(token).payload;


    const studentId =
        payload.studentId;


    if (!studentId) {

        return Response.json({

            success: false,

            message:
                "Student identity missing."

        }, {

            status: 401

        });

    }


    // =====================================================
    // VERIFY R2 BINDING
    // =====================================================

    if (!env.IMAGES) {

        return Response.json({

            success: false,

            message:
                "Image storage is unavailable."

        }, {

            status: 500

        });

    }


    // =====================================================
    // READ FORM DATA
    // =====================================================

    const formData =
        await request.formData();


    const avatar =
        formData.get(
            "avatar"
        );


    if (

        !avatar ||

        typeof avatar === "string"

    ) {

        return Response.json({

            success: false,

            message:
                "Avatar image is required."

        }, {

            status: 400

        });

    }


    // =====================================================
    // VALIDATE FILE TYPE
    // =====================================================

    const allowedTypes = [

        "image/jpeg",

        "image/png",

        "image/webp"

    ];


    if (

        !allowedTypes.includes(
            avatar.type
        )

    ) {

        return Response.json({

            success: false,

            message:
                "Only JPG, PNG, and WebP images are allowed."

        }, {

            status: 400

        });

    }


    // =====================================================
    // VALIDATE FILE SIZE
    //
    // Maximum: 5 MB
    // =====================================================

    const maxFileSize =
        5 * 1024 * 1024;


    if (

        avatar.size >

        maxFileSize

    ) {

        return Response.json({

            success: false,

            message:
                "Avatar image must not exceed 5 MB."

        }, {

            status: 400

        });

    }


    // =====================================================
    // CREATE PERMANENT R2 KEY
    //
    // Example:
    //
    // avatars/STUDENT-ID/avatar-UUID.jpg
    // =====================================================

    let extension =
        "jpg";


    if (
        avatar.type ===
        "image/png"
    ) {

        extension =
            "png";

    }

    else if (
        avatar.type ===
        "image/webp"
    ) {

        extension =
            "webp";

    }


    const avatarKey =

        `avatars/${studentId}/avatar-${crypto.randomUUID()}.${extension}`;


    // =====================================================
    // GET EXISTING AVATAR
    //
    // We will delete the old file after
    // successfully saving the new one.
    // =====================================================

    const existingStudent =
        await env.DB.prepare(

            `
            SELECT

                avatar_key

            FROM students

            WHERE id = ?

            LIMIT 1
            `

        )

        .bind(
            studentId
        )

        .first();


    if (!existingStudent) {

        return Response.json({

            success: false,

            message:
                "Student not found."

        }, {

            status: 404

        });

    }


    const oldAvatarKey =
        existingStudent.avatar_key;


    // =====================================================
    // SAVE IMAGE TO R2
    // =====================================================

    await env.IMAGES.put(

        avatarKey,

        avatar.stream(),

        {

            httpMetadata: {

                contentType:
                    avatar.type

            }

        }

    );


    // =====================================================
    // SAVE R2 KEY IN D1
    // =====================================================

    const now =
        new Date()
            .toISOString();


    try {

        await env.DB.prepare(

            `
            UPDATE students

            SET

                avatar_key = ?,

                avatar_url = ?,

                updated_at = ?

            WHERE id = ?
            `

        )

        .bind(

            avatarKey,

            avatarKey,

            now,

            studentId

        )

        .run();


    }

    catch (databaseError) {

        // Remove uploaded file if database update fails

        await env.IMAGES.delete(
            avatarKey
        );


        throw databaseError;

    }


    // =====================================================
    // DELETE OLD AVATAR
    //
    // Only after new avatar is safely stored.
    // =====================================================

    if (

        oldAvatarKey

        &&

        oldAvatarKey !== avatarKey

    ) {

        try {

            await env.IMAGES.delete(
                oldAvatarKey
            );

        }

        catch (deleteError) {

            console.error(

                "Unable to delete old avatar:",

                deleteError

            );

        }

    }


    // =====================================================
    // SUCCESS
    // =====================================================

    return Response.json({

        success: true,

        message:
            "Avatar updated successfully.",

        avatar_key:
            avatarKey

    });

}          

/*=========================================================
            STUDENT AVATAR

            GET /api/avatar/:studentId

            Retrieves the student's private avatar
            directly from R2.
 =========================================================*/

        if (
            request.method === "GET" &&
            pathname.startsWith("/api/avatar/")
        ) {

            /*=====================================================
                AUTHENTICATION
            =====================================================*/

            const authHeader =
                request.headers.get("Authorization");

            if (
                !authHeader ||
                !authHeader.startsWith("Bearer ")
            ) {

                return new Response(
                    "Unauthorized.",
                    {
                        status: 401
                    }
                );

            }

            const token =
                authHeader.substring(7);

            const valid =
                await jwt.verify(
                    token,
                    env.JWT_SECRET
                );

            if (!valid) {

                return new Response(
                    "Invalid or expired session.",
                    {
                        status: 401
                    }
                );

            }

            /*=====================================================
                VERIFIED STUDENT ID
            =====================================================*/

            const payload =
                jwt.decode(token).payload;

            const studentId =
                payload.studentId;

            if (!studentId) {

                return new Response(
                    "Student identity missing.",
                    {
                        status: 401
                    }
                );

            }

            /*=====================================================
                PREVENT STUDENTS FROM REQUESTING
                ANOTHER STUDENT'S AVATAR
            =====================================================*/

            const requestedStudentId =
                decodeURIComponent(
                    pathname.substring(
                        "/api/avatar/".length
                    )
                );

            if (
                String(requestedStudentId) !==
                String(studentId)
            ) {

                return new Response(
                    "Forbidden.",
                    {
                        status: 403
                    }
                );

            }

            /*=====================================================
                GET AVATAR KEY FROM D1
            =====================================================*/

            const student =
                await env.DB.prepare(`
                    SELECT
                        avatar_key,
                        avatar_url
                    FROM students
                    WHERE id = ?
                    LIMIT 1
                `)
                .bind(studentId)
                .first();

            if (!student) {

                return new Response(
                    "Student not found.",
                    {
                        status: 404
                    }
                );

            }

            const avatarKey =
                student.avatar_key ||
                student.avatar_url;

            if (!avatarKey) {

                return new Response(
                    "Avatar not found.",
                    {
                        status: 404
                    }
                );

            }

            /*=====================================================
                GET IMAGE FROM R2
            =====================================================*/

            const object =
                await env.IMAGES.get(
                    avatarKey
                );

            if (!object) {

                return new Response(
                    "Avatar file not found.",
                    {
                        status: 404
                    }
                );

            }

            /*=====================================================
                RETURN IMAGE
            =====================================================*/

            const headers =
                new Headers();

            headers.set(
    "Content-Type",
    object.httpMetadata?.contentType ||
    "image/jpeg"
);

headers.set(
    "Cache-Control",
    "private, max-age=3600"
);

headers.set(
    "Access-Control-Allow-Origin",
    "https://nursephere.com"
);

headers.set(
    "Vary",
    "Origin"
);

            return new Response(
                object.body,
                {
                    status: 200,
                    headers
                }
            );
        }

        /*=========================================================
            STUDENT PROFILE

            GET /api/profile

            PUT /api/profile

            Authentication comes from the JWT.
        =========================================================*/

        if (

            (
                request.method === "GET" ||
                request.method === "PUT"
            )

            &&

            pathname ===
                "/api/profile"

        ) {

            /*=====================================================
                AUTHENTICATION
            =====================================================*/

            const authHeader =
                request.headers.get(
                    "Authorization"
                );


            if (

                !authHeader ||

                !authHeader.startsWith(
                    "Bearer "
                )

            ) {

                return Response.json({

                    success: false,

                    message:
                        "Unauthorized."

                }, {

                    status: 401

                });

            }


            const token =
                authHeader.substring(7);


            const valid =
                await jwt.verify(
                    token,
                    env.JWT_SECRET
                );


            if (!valid) {

                return Response.json({

                    success: false,

                    message:
                        "Invalid or expired session."

                }, {

                    status: 401

                });

            }


            /*=====================================================
                READ VERIFIED JWT IDENTITY
            =====================================================*/

            const payload =
                jwt.decode(token).payload;


            const studentId =
                payload.studentId;


            if (!studentId) {

                return Response.json({

                    success: false,

                    message:
                        "Student identity missing."

                }, {

                    status: 401

                });

            }


            /*=====================================================
                VERIFY STUDENT EXISTS
            =====================================================*/

            const student =
                await env.DB.prepare(

                    `
                    SELECT

                        id,
                        student_number,
                        full_name,
                        email,
                        account_status,
                        trial_active,
                        trial_started_at,
                        trial_expires_at,
                        subscription_status,
                        email_verified,
                        created_at,
                        updated_at,
                        exam_id,
                        subscription_expires_at,
                        subscription_plan_id,
                        avatar_key,
                        avatar_url

                    FROM students

                    WHERE id = ?

                    LIMIT 1
                    `

                )

                .bind(studentId)

                .first();


            if (!student) {

                return Response.json({

                    success: false,

                    message:
                        "Student not found."

                }, {

                    status: 404

                });

            }


            /*=====================================================
                GET PROFILE
            =====================================================*/

            if (
                request.method === "GET"
            ) {

                /*=================================================
                    STUDENT PERSONAL / ACADEMIC PROFILE
                =================================================*/

                const profile =
                    await env.DB.prepare(

                        `
                        SELECT

                            student_id,
                            first_name,
                            last_name,
                            phone_number,
                            country,
                            gender,
                            date_of_birth,
                            institution_name,
                            expected_graduation,
                            expected_exam_date,
                            study_level,
                            created_at,
                            updated_at

                        FROM student_profiles

                        WHERE student_id = ?

                        LIMIT 1
                        `

                    )

                    .bind(studentId)

                    .first();


                /*=================================================
                    STUDENT PROGRESS
                =================================================*/

                const progress =
                    await env.DB.prepare(

                        `
                        SELECT

                            subjects_started,
                            questions_answered,
                            questions_remaining,
                            success_rate,
                            exams_completed

                        FROM student_progress

                        WHERE student_id = ?

                        LIMIT 1
                        `

                    )

                    .bind(studentId)

                    .first();


                /*=================================================
                    DOCUMENT COUNT
                =================================================*/

                const documentResult =
                    await env.DB.prepare(

                        `
                        SELECT

                            COUNT(*) AS document_count

                        FROM student_documents

                        WHERE student_id = ?
                        `

                    )

                    .bind(studentId)

                    .first();


                const documentsUploaded =
                    Number(
                        documentResult?.document_count || 0
                    );


                /*=================================================
                    STUDENT ACTIVITY
                =================================================*/

                const activityResult =
                    await env.DB.prepare(

                        `
                        SELECT

                            activity_date,
                            questions_answered,
                            practice_sessions

                        FROM student_activity

                        WHERE student_id = ?

                        ORDER BY
                            date(activity_date) DESC
                        `

                    )

                    .bind(studentId)

                    .all();


                const activity =
                    activityResult.results || [];


                /*=================================================
                    PRACTICE SESSIONS
                =================================================*/

                let practiceSessions = 0;


                for (
                    const row
                    of activity
                ) {

                    practiceSessions +=
                        Number(
                            row.practice_sessions || 0
                        );

                }


                /*=================================================
                    STUDY STREAK
                =================================================*/

                const studyStreak =
                    calculateStudyStreak(
                        activity
                    );


                /*=================================================
                    EXAMINATION
                =================================================*/

                let examination =
                    null;


                if (
                    student.exam_id
                ) {

                    examination =
                        await env.DB.prepare(

                            `
                            SELECT *

                            FROM exams

                            WHERE id = ?

                            LIMIT 1
                            `

                        )

                        .bind(
                            student.exam_id
                        )

                        .first();

                }


                /*=================================================
                    ACTIVE SUBSCRIPTION

                    subscriptions is the source of truth.
                =================================================*/

                const subscription =
                    await env.DB.prepare(

                        `
                        SELECT

                            s.id AS subscription_id,

                            s.student_id,

                            s.plan_id,

                            s.start_date,

                            s.end_date,

                            s.payment_status,

                            s.status AS subscription_status,

                            s.created_at AS subscription_created_at,

                            s.updated_at AS subscription_updated_at,

                            sp.id AS plan_id,

                            sp.name AS plan_name,

                            sp.price AS plan_price,

                            sp.currency AS plan_currency,

                            sp.duration_days AS plan_duration_days,

                            sp.description AS plan_description,

                            sp.display_order AS plan_display_order,

                            sp.status AS plan_status,

                            sp.created_at AS plan_created_at,

                            sp.updated_at AS plan_updated_at

                        FROM subscriptions s

                        INNER JOIN subscription_plans sp

                            ON sp.id =
                               s.plan_id

                        WHERE s.student_id = ?

                        AND s.status = 'active'

                        AND sp.status = 'active'

                        AND datetime(s.end_date)
                            > datetime('now')

                        ORDER BY

                            datetime(s.end_date) DESC,

                            datetime(s.created_at) DESC

                        LIMIT 1
                        `

                    )

                    .bind(studentId)

                    .first();


                /*=================================================
                    CURRENT PLAN
                =================================================*/

                let currentPlan =
                    "No Active Plan";


                if (
                    subscription?.plan_name
                ) {

                    currentPlan =
                        subscription.plan_name;

                }

                else if (

                    student.subscription_status ===
                    "trial"

                ) {

                    currentPlan =
                        "Free Trial";

                }


                /*=================================================
                    EXAMINATION DISPLAY NAME
                =================================================*/

                let examinationName =
                    "";


                if (examination) {

                    examinationName =

                        examination.name ||

                        examination.title ||

                        examination.exam_name ||

                        examination.display_name ||

                        "";

                }


                /*=================================================
                    RETURN PROFILE
                =================================================*/

                return Response.json({

                    success: true,

                    profile: {

                        student_id:
                            student.id,

                        student_number:
                            student.student_number,

                        full_name:
                            student.full_name,

                        email:
                            student.email,

                        account_status:
                            student.account_status,

                        email_verified:
                            Boolean(
                                student.email_verified
                            ),

                        avatar_key:
                            student.avatar_key || null,

                        avatar_url:
                            student.avatar_url || null,

                        first_name:
                            profile?.first_name || "",

                        last_name:
                            profile?.last_name || "",

                        phone_number:
                            profile?.phone_number || "",

                        country:
                            profile?.country || "",

                        gender:
                            profile?.gender || "",

                        date_of_birth:
                            profile?.date_of_birth || "",

                        examination_id:
                            student.exam_id || null,

                        examination:
                            examinationName,

                        institution_name:
                            profile?.institution_name || "",

                        expected_graduation:
                            profile?.expected_graduation || "",

                        expected_exam_date:
                            profile?.expected_exam_date || "",

                        study_level:
                            profile?.study_level || ""

                    },

                    subscription: {

                        active:
                            Boolean(
                                subscription
                            ),

                        status:
                            subscription?.subscription_status ||
                            student.subscription_status ||
                            "inactive",

                        plan_id:
                            subscription?.plan_id ||
                            student.subscription_plan_id ||
                            null,

                        plan_name:
                            subscription?.plan_name ||
                            null,

                        start_date:
                            subscription?.start_date ||
                            null,

                        end_date:
                            subscription?.end_date ||
                            student.subscription_expires_at ||
                            null,

                        payment_status:
                            subscription?.payment_status ||
                            null,

                        trial_active:
                            Boolean(
                                student.trial_active
                            ),

                        trial_expires_at:
                            student.trial_expires_at

                    },

                    summary: {

                        member_since:
                            student.created_at,

                        current_plan:
                            currentPlan,

                        questions_answered:
                            Number(
                                progress?.questions_answered || 0
                            ),

                        practice_sessions:
                            practiceSessions,

                        documents_uploaded:
                            documentsUploaded,

                        study_streak:
                            studyStreak,

                        subjects_started:
                            Number(
                                progress?.subjects_started || 0
                            ),

                        exams_completed:
                            Number(
                                progress?.exams_completed || 0
                            ),

                        success_rate:
                            Number(
                                progress?.success_rate || 0
                            ),

                        questions_remaining:
                            Number(
                                progress?.questions_remaining || 0
                            )

                    }

                });

            }


            /*=====================================================
                UPDATE PROFILE
            =====================================================*/

            const body =
                await request.json();


            if (
                !body ||
                typeof body !== "object"
            ) {

                return Response.json({

                    success: false,

                    message:
                        "Invalid profile data."

                }, {

                    status: 400

                });

            }


            /*=====================================================
                NORMALIZE INPUT
            =====================================================*/

            const firstName =
                cleanString(
                    body.first_name
                );


            const lastName =
                cleanString(
                    body.last_name
                );


            const phoneNumber =
                cleanString(
                    body.phone_number
                );


            const country =
                cleanString(
                    body.country
                );


            const gender =
                cleanString(
                    body.gender
                );


            const dateOfBirth =
                cleanString(
                    body.date_of_birth
                );


            const institutionName =
                cleanString(
                    body.institution_name
                );


            const expectedGraduation =
                cleanString(
                    body.expected_graduation
                );


            const expectedExamDate =
                cleanString(
                    body.expected_exam_date
                );


            const studyLevel =
                cleanString(
                    body.study_level
                );


            const examinationId =
                cleanString(
                    body.examination_id
                );


            /*=====================================================
                VALIDATE GENDER
            =====================================================*/

            const allowedGenders = [

                "",
                "Male",
                "Female",
                "Prefer not to say"

            ];


            if (

                !allowedGenders.includes(
                    gender
                )

            ) {

                return Response.json({

                    success: false,

                    message:
                        "Invalid gender value."

                }, {

                    status: 400

                });

            }


            /*=====================================================
                VALIDATE STUDY LEVEL
            =====================================================*/

            const allowedStudyLevels = [

                "",
                "New to Preparation",
                "Actively Preparing",
                "Exam Scheduled",
                "Final Revision"

            ];


            if (

                !allowedStudyLevels.includes(
                    studyLevel
                )

            ) {

                return Response.json({

                    success: false,

                    message:
                        "Invalid study level."

                }, {

                    status: 400

                });

            }


            /*=====================================================
                VALIDATE EXAMINATION
            =====================================================*/

            if (
                examinationId
            ) {

                const exam =
                    await env.DB.prepare(

                        `
                        SELECT

                            id

                        FROM exams

                        WHERE id = ?

                        LIMIT 1
                        `

                    )

                    .bind(
                        examinationId
                    )

                    .first();


                if (!exam) {

                    return Response.json({

                        success: false,

                        message:
                            "Selected examination not found."

                    }, {

                        status: 400

                    });

                }

            }


            /*=====================================================
                TIMESTAMP
            =====================================================*/

            const now =
                new Date().toISOString();


            /*=====================================================
                UPSERT STUDENT PROFILE
            =====================================================*/

            await env.DB.prepare(

                `
                INSERT INTO student_profiles (

                    student_id,

                    first_name,

                    last_name,

                    phone_number,

                    country,

                    gender,

                    date_of_birth,

                    institution_name,

                    expected_graduation,

                    expected_exam_date,

                    study_level,

                    created_at,

                    updated_at

                )

                VALUES (

                    ?,
                    ?,
                    ?,
                    ?,
                    ?,
                    ?,
                    ?,
                    ?,
                    ?,
                    ?,
                    ?,
                    ?,
                    ?

                )

                ON CONFLICT(student_id)

                DO UPDATE SET

                    first_name =
                        excluded.first_name,

                    last_name =
                        excluded.last_name,

                    phone_number =
                        excluded.phone_number,

                    country =
                        excluded.country,

                    gender =
                        excluded.gender,

                    date_of_birth =
                        excluded.date_of_birth,

                    institution_name =
                        excluded.institution_name,

                    expected_graduation =
                        excluded.expected_graduation,

                    expected_exam_date =
                        excluded.expected_exam_date,

                    study_level =
                        excluded.study_level,

                    updated_at =
                        excluded.updated_at
                `

            )

            .bind(

                studentId,

                firstName,

                lastName,

                phoneNumber,

                country,

                gender,

                dateOfBirth,

                institutionName,

                expectedGraduation,

                expectedExamDate,

                studyLevel,

                now,

                now

            )

            .run();


            /*=====================================================
                UPDATE STUDENT EXAMINATION
            =====================================================*/

            await env.DB.prepare(

                `
                UPDATE students

                SET

                    exam_id = ?,

                    updated_at = ?

                WHERE id = ?
                `

            )

            .bind(

                examinationId || null,

                now,

                studentId

            )

            .run();


            /*=====================================================
                UPDATE FULL NAME
            =====================================================*/

            const nameParts = [

                firstName,

                lastName

            ]
            .filter(
                Boolean
            );


            const fullName =

                nameParts.length > 0

                    ? nameParts.join(" ")

                    : student.full_name;


            await env.DB.prepare(

                `
                UPDATE students

                SET

                    full_name = ?,

                    updated_at = ?

                WHERE id = ?
                `

            )

            .bind(

                fullName,

                now,

                studentId

            )

            .run();


            /*=====================================================
                SUCCESS
            =====================================================*/

            return Response.json({

                success: true,

                message:
                    "Profile updated successfully."

            });

        }


        /*=========================================================
            METHOD NOT ALLOWED
        =========================================================*/

        return Response.json({

            success: false,

            message:
                "Method Not Allowed."

        }, {

            status: 405

        });

    }


    catch (error) {

        console.error(
            "Profile Worker Error:",
            error
        );


        return Response.json({

            success: false,

            message:
                "Internal Server Error."

        }, {

            status: 500

        });

    }

}


// ======================================================
// CALCULATE STUDY STREAK
// ======================================================

function calculateStudyStreak(
    activity
) {

    if (

        !Array.isArray(activity) ||

        activity.length === 0

    ) {

        return 0;

    }


    const activeDates =
        new Set();


    for (
        const row
        of activity
    ) {

        if (
            !row.activity_date
        ) {

            continue;

        }


        const date =
            normalizeActivityDate(
                row.activity_date
            );


        if (!date) {

            continue;

        }


        const hasActivity =

            Number(
                row.questions_answered || 0
            ) > 0

            ||

            Number(
                row.practice_sessions || 0
            ) > 0;


        if (
            hasActivity
        ) {

            activeDates.add(
                date
            );

        }

    }


    if (
        activeDates.size === 0
    ) {

        return 0;

    }


    const today =
        getTodayDate();


    const yesterday =
        shiftDate(
            today,
            -1
        );


    let currentDate;


    if (
        activeDates.has(
            today
        )
    ) {

        currentDate =
            today;

    }

    else if (
        activeDates.has(
            yesterday
        )
    ) {

        currentDate =
            yesterday;

    }

    else {

        return 0;

    }


    let streak = 0;


    while (
        activeDates.has(
            currentDate
        )
    ) {

        streak += 1;


        currentDate =
            shiftDate(
                currentDate,
                -1
            );

    }


    return streak;

}


// ======================================================
// NORMALIZE ACTIVITY DATE
// ======================================================

function normalizeActivityDate(
    value
) {

    const stringValue =
        String(
            value
        )
        .trim();


    if (!stringValue) {

        return null;

    }


    const match =
        stringValue.match(
            /^(\d{4}-\d{2}-\d{2})/
        );


    if (match) {

        return match[1];

    }


    return null;

}


// ======================================================
// GET TODAY
// ======================================================

function getTodayDate() {

    const now =
        new Date();


    const year =
        now.getFullYear();


    const month =
        String(
            now.getMonth() + 1
        )
        .padStart(
            2,
            "0"
        );


    const day =
        String(
            now.getDate()
        )
        .padStart(
            2,
            "0"
        );


    return (

        `${year}-${month}-${day}`

    );

}


// ======================================================
// SHIFT DATE
// ======================================================

function shiftDate(
    dateString,
    days
) {

    const parts =
        dateString.split("-");


    const date =
        new Date(

            Number(
                parts[0]
            ),

            Number(
                parts[1]
            ) - 1,

            Number(
                parts[2]
            )

        );


    date.setDate(
        date.getDate() + days
    );


    const year =
        date.getFullYear();


    const month =
        String(
            date.getMonth() + 1
        )
        .padStart(
            2,
            "0"
        );


    const day =
        String(
            date.getDate()
        )
        .padStart(
            2,
            "0"
        );


    return (

        `${year}-${month}-${day}`

    );

}


// ======================================================
// CLEAN STRING
// ======================================================

function cleanString(
    value
) {

    if (

        value === null ||

        value === undefined

    ) {

        return "";

    }


    return String(
        value
    )
    .trim();

}