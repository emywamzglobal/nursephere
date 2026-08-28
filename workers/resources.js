// =====================================================
// NURSEPHERE — STUDY RESOURCES WORKER
// PRODUCTION VERSION
// =====================================================
//
// ADMIN
//   GET    /api/admin/resources
//   GET    /api/admin/resources/:id
//   POST   /api/admin/resources
//   PUT    /api/admin/resources/:id
//   PATCH  /api/admin/resources/:id/status
//   DELETE /api/admin/resources/:id
//
// STUDENT
//   GET /api/resources/:id/view
//   GET /api/resources/:id/download
//
// SECURITY
//   • Student JWT required
//   • Student must exist
//   • Student account must be active
//   • Active subscription required
//   • Subscription must be paid
//   • Subscription must not be expired
//   • Active subscription plan required
//   • plan_features controls access
//   • none     = denied
//   • view     = view only
//   • full     = full access
//   • download = view + download
//   • R2 objects remain private
//
// IMPORTANT
//   Admin authentication is intentionally NOT implemented here.
//   Admin verification is the next security task.
//   These admin routes should therefore be protected by the
//   existing admin layer/router until that task is completed.
//
// =====================================================


// =====================================================
// DEPENDENCIES
// =====================================================

import jwt from "@tsndr/cloudflare-worker-jwt";


// =====================================================
// CONSTANTS
// =====================================================

const STUDY_RESOURCE_FILE_TYPES = [
    "pdf",
    "docx",
    "xlsx",
    "csv"
];


const STUDY_RESOURCE_STATUSES = [
    "active",
    "inactive"
];


const STUDY_RESOURCE_ACCESS_LEVELS = [
    "none",
    "view",
    "full",
    "download"
];


const STUDY_RESOURCE_DOCUMENT_FOLDER =
    "study-resources/documents/";


const STUDY_RESOURCE_COVER_FOLDER =
    "study-resources/covers/";


const STUDY_RESOURCE_DOCUMENT_MIME_TYPES = {

    pdf:
        "application/pdf",

    docx:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",

    xlsx:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",

    csv:
        "text/csv"

};


const STUDY_RESOURCE_COVER_MIME_TYPES = [
    "image/jpeg",
    "image/png",
    "image/webp"
];


// =====================================================
// MAIN WORKER
// =====================================================

export default async function resourcesHandler(
    request,
    env
) {

    const url =
        new URL(request.url);

    const method =
        request.method.toUpperCase();

    const pathname =
        url.pathname;


    try {

        // =================================================
        // ADMIN ROUTES
        // =================================================

        if (
            pathname === "/api/admin/resources" ||
            pathname.startsWith("/api/admin/resources/")
        ) {

            return await handleAdminResourceRoutes(
                request,
                env,
                method,
                pathname
            );

        }


        // =================================================
        // STUDENT ROUTES
        // =================================================

        if (
            pathname.startsWith("/api/resources/")
        ) {

            return await handleStudentResourceRoutes(
                request,
                env,
                method,
                pathname
            );

        }


        // =================================================
        // ROUTE NOT FOUND
        // =================================================

        return studyResourceResponse(
            false,
            "Resource endpoint not found.",
            null,
            404
        );

    }

    catch (error) {

        console.error(
            "Study Resources Worker Error:",
            error
        );

        return studyResourceResponse(
            false,
            "Unable to process study resource request.",
            null,
            500
        );

    }

}


// =====================================================
// RESPONSE HELPER
// =====================================================

function studyResourceResponse(
    success,
    message,
    data = null,
    status = 200
) {

    const body = {
        success,
        message
    };


    if (
        data !== null
    ) {

        body.data =
            data;

    }


    return Response.json(
        body,
        {
            status,
            headers: {

                "Cache-Control":
                    "no-store",

                "X-Content-Type-Options":
                    "nosniff"

            }
        }
    );

}


// =====================================================
// JSON BODY HELPER
// =====================================================

async function studyResourceJson(
    request
) {

    try {

        const contentType =
            request.headers.get(
                "Content-Type"
            ) || "";


        if (
            !contentType
                .toLowerCase()
                .includes("application/json")
        ) {

            return null;

        }


        return await request.json();

    }

    catch {

        return null;

    }

}


// =====================================================
// TEXT NORMALIZATION
// =====================================================

function studyResourceText(
    value
) {

    return String(
        value ?? ""
    ).trim();

}


// =====================================================
// FILE TYPE NORMALIZATION
// =====================================================

function studyResourceFileType(
    value
) {

    return studyResourceText(
        value
    ).toLowerCase();

}


// =====================================================
// STATUS NORMALIZATION
// =====================================================

function studyResourceStatus(
    value
) {

    return studyResourceText(
        value
    ).toLowerCase();

}


// =====================================================
// RESOURCE ID EXTRACTION
// =====================================================

function studyResourceIdFromPath(
    pathname,
    suffix
) {

    const prefix =
        "/api/resources/";

    if (
        !pathname.startsWith(prefix)
    ) {

        return null;

    }


    const remaining =
        pathname.slice(
            prefix.length
        );


    if (
        !remaining.endsWith(
            suffix
        )
    ) {

        return null;

    }


    const resourceId =
        remaining.slice(
            0,
            remaining.length -
                suffix.length
        )
        .replace(
            /\/+$/,
            ""
        );


    if (
        !resourceId ||
        resourceId.includes("/")
    ) {

        return null;

    }


    return resourceId;

}


// =====================================================
// ADMIN RESOURCE ID
// =====================================================

function studyAdminResourceId(
    pathname
) {

    const prefix =
        "/api/admin/resources/";

    if (
        !pathname.startsWith(prefix)
    ) {

        return null;

    }


    const remaining =
        pathname.slice(
            prefix.length
        );


    if (
        !remaining ||
        remaining.includes("/")
    ) {

        return null;

    }


    return remaining;

}


// =====================================================
// SAFE FILE NAME
// =====================================================

function studyResourceSafeFileName(
    value
) {

    const cleaned =
        studyResourceText(
            value
        )
        .replace(
            /[\r\n"]/g,
            ""
        )
        .replace(
            /[\\/:*?<>|]/g,
            "_"
        )
        .replace(
            /[\u0000-\u001F\u007F]/g,
            ""
        )
        .trim()
        .slice(
            0,
            180
        );


    return cleaned ||
        "study-resource";

}


// =====================================================
// R2 KEY EXTRACTION
// =====================================================

function studyResourceR2Key(
    value
) {

    const storedValue =
        studyResourceText(
            value
        );


    if (!storedValue) {

        return null;

    }


    try {

        const url =
            new URL(
                storedValue
            );


        const pathname =
            decodeURIComponent(
                url.pathname
            );


        return pathname
            .replace(
                /^\/+/,
                ""
            );

    }

    catch {

        return decodeURIComponent(
            storedValue
                .replace(
                    /^\/+/,
                    ""
                )
        );

    }

}


// =====================================================
// DOCUMENT R2 KEY VALIDATION
// =====================================================

function studyResourceValidDocumentKey(
    value
) {

    const key =
        studyResourceR2Key(
            value
        );


    if (!key) {

        return null;

    }


    if (
        !key.startsWith(
            STUDY_RESOURCE_DOCUMENT_FOLDER
        )
    ) {

        return null;

    }


    if (
        key.includes("..")
    ) {

        return null;

    }


    return key;

}


// =====================================================
// COVER R2 KEY VALIDATION
// =====================================================

function studyResourceValidCoverKey(
    value
) {

    const key =
        studyResourceR2Key(
            value
        );


    if (!key) {

        return null;

    }


    if (
        !key.startsWith(
            STUDY_RESOURCE_COVER_FOLDER
        )
    ) {

        return null;

    }


    if (
        key.includes("..")
    ) {

        return null;

    }


    return key;

}


// =====================================================
// ACCESS LEVEL RANK
// =====================================================
//
// none
//   0
//
// view
//   1
//
// full
//   2
//
// download
//   2
//
// "full" is intentionally treated as download-capable
// access because it represents full access to the feature.
//
// =====================================================

function studyResourceAccessRank(
    level
) {

    const normalized =
        studyResourceText(
            level
        ).toLowerCase();


    if (
        normalized === "download"
    ) {

        return 2;

    }


    if (
        normalized === "full"
    ) {

        return 2;

    }


    if (
        normalized === "view"
    ) {

        return 1;

    }


    return 0;

}


// =====================================================
// ACCESS CHECK
// =====================================================

function studyResourceHasAccess(
    actualLevel,
    requiredLevel
) {

    return (
        studyResourceAccessRank(
            actualLevel
        )
        >=
        studyResourceAccessRank(
            requiredLevel
        )
    );

}


// =====================================================
// STUDENT JWT AUTHENTICATION
// =====================================================

async function authenticateStudent(
    request,
    env
) {

    const authorization =
        request.headers.get(
            "Authorization"
        );


    if (!authorization) {

        return {

            ok: false,

            status: 401,

            message:
                "Authentication required."

        };

    }


    if (
        !authorization
            .toLowerCase()
            .startsWith(
                "bearer "
            )
    ) {

        return {

            ok: false,

            status: 401,

            message:
                "Invalid authorization header."

        };

    }


    const token =
        authorization
            .slice(7)
            .trim();


    if (!token) {

        return {

            ok: false,

            status: 401,

            message:
                "Authentication token is required."

        };

    }


    if (
        !env.JWT_SECRET
    ) {

        console.error(
            "JWT_SECRET is not configured."
        );

        return {

            ok: false,

            status: 500,

            message:
                "Authentication service is not configured."

        };

    }


    try {

        const valid =
            await jwt.verify(
                token,
                env.JWT_SECRET
            );


        if (!valid) {

            return {

                ok: false,

                status: 401,

                message:
                    "Invalid or expired authentication token."

            };

        }


        const decoded =
            jwt.decode(
                token
            );


        const studentId =
            studyResourceText(
                decoded?.payload?.studentId
            );


        if (!studentId) {

            return {

                ok: false,

                status: 401,

                message:
                    "Invalid authentication token."

            };

        }


        const student =
            await env.DB.prepare(
                `
                SELECT

                    id,
                    student_number,
                    full_name,
                    email,
                    account_status,
                    email_verified,
                    subscription_status,
                    trial_active

                FROM students

                WHERE id = ?

                LIMIT 1
                `
            )
            .bind(
                studentId
            )
            .first();


        if (!student) {

            return {

                ok: false,

                status: 401,

                message:
                    "Student account was not found."

            };

        }


        if (
            student.account_status !==
            "active"
        ) {

            return {

                ok: false,

                status: 403,

                message:
                    "Student account is inactive."

            };

        }


        return {

            ok: true,

            student

        };

    }

    catch (error) {

        console.error(
            "Student authentication failed:",
            error
        );


        return {

            ok: false,

            status: 401,

            message:
                "Authentication failed."

        };

    }

}


// =====================================================
// STUDENT SUBSCRIPTION ACCESS
// =====================================================

async function getStudentResourceAccess(
    studentId,
    env
) {

    if (!studentId) {

        return {

            ok: false,

            status: 400,

            message:
                "Student ID is required."

        };

    }


    try {

        const access =
            await env.DB.prepare(
                `
                SELECT

                    s.id AS subscription_id,

                    s.start_date,

                    s.end_date,

                    s.payment_status,

                    s.status AS subscription_status,

                    sp.id AS plan_id,

                    sp.name AS plan_name,

                    pf.access_level,

                    f.feature_key,

                    f.feature_name

                FROM subscriptions s

                INNER JOIN subscription_plans sp
                    ON sp.id = s.plan_id

                INNER JOIN plan_features pf
                    ON pf.plan_id = sp.id

                INNER JOIN features f
                    ON f.id = pf.feature_id

                WHERE s.student_id = ?

                AND s.status = 'active'

                AND s.payment_status = 'paid'

                AND sp.status = 'active'

                AND pf.access_level <> 'none'

                AND f.status = 'active'

                AND f.feature_key = 'study_resources'

                AND datetime(s.start_date)
                    <= datetime('now')

                AND datetime(s.end_date)
                    >= datetime('now')

                ORDER BY

                    CASE

                        WHEN pf.access_level = 'download'
                            THEN 3

                        WHEN pf.access_level = 'full'
                            THEN 2

                        WHEN pf.access_level = 'view'
                            THEN 1

                        ELSE 0

                    END DESC

                LIMIT 1
                `
            )
            .bind(
                studentId
            )
            .first();


        if (!access) {

            return {

                ok: true,

                access_level:
                    "none",

                subscription:
                    null

            };

        }


        return {

            ok: true,

            access_level:
                studyResourceText(
                    access.access_level
                ).toLowerCase(),

            subscription:
                access

        };

    }

    catch (error) {

        console.error(
            "Study resource subscription lookup failed:",
            error
        );


        return {

            ok: false,

            status: 500,

            message:
                "Unable to verify study resource access."

        };

    }

}


// =====================================================
// REQUIRE STUDY RESOURCE ACCESS
// =====================================================

async function requireStudentResourceAccess(
    request,
    env,
    requiredLevel
) {

    const authentication =
        await authenticateStudent(
            request,
            env
        );


    if (!authentication.ok) {

        return authentication;

    }


    const access =
        await getStudentResourceAccess(
            authentication.student.id,
            env
        );


    if (!access.ok) {

        return access;

    }


    if (
        !studyResourceHasAccess(
            access.access_level,
            requiredLevel
        )
    ) {

        return {

            ok: false,

            status: 403,

            message:
                requiredLevel === "download"
                    ? "Your subscription does not include study resource downloads."
                    : "Your subscription does not include study resources."

        };

    }


    return {

        ok: true,

        student:
            authentication.student,

        access

    };

}


// =====================================================
// R2 DOCUMENT RESPONSE
// =====================================================

function studyResourceStreamResponse(
    object,
    fileName,
    fileType,
    download = false
) {

    if (!object) {

        return null;

    }


    const contentType =
        STUDY_RESOURCE_DOCUMENT_MIME_TYPES[
            fileType
        ]
        ||
        object.httpMetadata?.contentType
        ||
        "application/octet-stream";


    const headers =
        new Headers();


    headers.set(
        "Content-Type",
        contentType
    );


    if (
        Number.isFinite(
            object.size
        )
    ) {

        headers.set(
            "Content-Length",
            String(
                object.size
            )
        );

    }


    headers.set(
        "Cache-Control",
        "private, no-store"
    );


    headers.set(
        "X-Content-Type-Options",
        "nosniff"
    );


    headers.set(
        "Content-Disposition",

        download

            ? `attachment; filename="${fileName}"`

            : `inline; filename="${fileName}"`
    );


    return new Response(
        object.body,
        {

            status: 200,

            headers

        }
    );

}


// =====================================================
// STUDENT ROUTES
// =====================================================

async function handleStudentResourceRoutes(
    request,
    env,
    method,
    pathname
) {

    // =================================================
    // STUDENT VIEW
    // =================================================

    if (
        method === "GET" &&
        pathname.endsWith(
            "/view"
        )
    ) {

        return await viewStudyResource(
            request,
            env,
            pathname
        );

    }


    // =================================================
    // STUDENT DOWNLOAD
    // =================================================

    if (
        method === "GET" &&
        pathname.endsWith(
            "/download"
        )
    ) {

        return await downloadStudyResource(
            request,
            env,
            pathname
        );

    }


    return studyResourceResponse(
        false,
        "Study resource endpoint not found.",
        null,
        404
    );

}


// =====================================================
// STUDENT VIEW
// =====================================================

async function viewStudyResource(
    request,
    env,
    pathname
) {

    const resourceId =
        studyResourceIdFromPath(
            pathname,
            "/view"
        );


    if (!resourceId) {

        return studyResourceResponse(
            false,
            "Study book ID is required.",
            null,
            400
        );

    }


    const authorization =
        await requireStudentResourceAccess(
            request,
            env,
            "view"
        );


    if (!authorization.ok) {

        return studyResourceResponse(
            false,
            authorization.message,
            null,
            authorization.status
        );

    }


    try {

        const resource =
            await env.DB.prepare(
                `
                SELECT

                    r.id,
                    r.title,
                    r.file_url,
                    r.file_type,
                    r.status,

                    s.status AS subject_status,

                    e.status AS exam_status

                FROM study_resources r

                INNER JOIN subjects s
                    ON s.id = r.subject_id

                INNER JOIN exams e
                    ON e.id = s.exam_id

                WHERE r.id = ?

                LIMIT 1
                `
            )
            .bind(
                resourceId
            )
            .first();


        if (!resource) {

            return studyResourceResponse(
                false,
                "Study book not found.",
                null,
                404
            );

        }


        if (
            resource.status !==
            "active"
        ) {

            return studyResourceResponse(
                false,
                "This study resource is currently unavailable.",
                null,
                404
            );

        }


        if (
            resource.subject_status !==
            "active" ||
            resource.exam_status !==
            "active"
        ) {

            return studyResourceResponse(
                false,
                "This study resource is currently unavailable.",
                null,
                404
            );

        }


        const objectKey =
            studyResourceValidDocumentKey(
                resource.file_url
            );


        if (!objectKey) {

            return studyResourceResponse(
                false,
                "Study book file is unavailable.",
                null,
                404
            );

        }


        if (
            !env.DOCUMENTS
        ) {

            console.error(
                "DOCUMENTS R2 bucket is not configured."
            );

            return studyResourceResponse(
                false,
                "Study resource storage is unavailable.",
                null,
                500
            );

        }


        const object =
            await env.DOCUMENTS.get(
                objectKey
            );


        if (!object) {

            return studyResourceResponse(
                false,
                "Study book file was not found.",
                null,
                404
            );

        }


        const fileName =
            studyResourceSafeFileName(
                objectKey
                    .split("/")
                    .pop()
            );


        return studyResourceStreamResponse(
            object,
            fileName,
            resource.file_type,
            false
        );

    }

    catch (error) {

        console.error(
            "VIEW study book failed:",
            error
        );


        return studyResourceResponse(
            false,
            "Failed to open the study book.",
            null,
            500
        );

    }

}


// =====================================================
// STUDENT DOWNLOAD
// =====================================================

async function downloadStudyResource(
    request,
    env,
    pathname
) {

    const resourceId =
        studyResourceIdFromPath(
            pathname,
            "/download"
        );


    if (!resourceId) {

        return studyResourceResponse(
            false,
            "Study book ID is required.",
            null,
            400
        );

    }


    const authorization =
        await requireStudentResourceAccess(
            request,
            env,
            "download"
        );


    if (!authorization.ok) {

        return studyResourceResponse(
            false,
            authorization.message,
            null,
            authorization.status
        );

    }


    try {

        const resource =
            await env.DB.prepare(
                `
                SELECT

                    r.id,
                    r.title,
                    r.file_url,
                    r.file_type,
                    r.status,

                    s.status AS subject_status,

                    e.status AS exam_status

                FROM study_resources r

                INNER JOIN subjects s
                    ON s.id = r.subject_id

                INNER JOIN exams e
                    ON e.id = s.exam_id

                WHERE r.id = ?

                LIMIT 1
                `
            )
            .bind(
                resourceId
            )
            .first();


        if (!resource) {

            return studyResourceResponse(
                false,
                "Study book not found.",
                null,
                404
            );

        }


        if (
            resource.status !==
            "active"
        ) {

            return studyResourceResponse(
                false,
                "This study resource is currently unavailable.",
                null,
                404
            );

        }


        if (
            resource.subject_status !==
            "active" ||
            resource.exam_status !==
            "active"
        ) {

            return studyResourceResponse(
                false,
                "This study resource is currently unavailable.",
                null,
                404
            );

        }


        const objectKey =
            studyResourceValidDocumentKey(
                resource.file_url
            );


        if (!objectKey) {

            return studyResourceResponse(
                false,
                "Study book file is unavailable.",
                null,
                404
            );

        }


        if (
            !env.DOCUMENTS
        ) {

            console.error(
                "DOCUMENTS R2 bucket is not configured."
            );

            return studyResourceResponse(
                false,
                "Study resource storage is unavailable.",
                null,
                500
            );

        }


        const object =
            await env.DOCUMENTS.get(
                objectKey
            );


        if (!object) {

            return studyResourceResponse(
                false,
                "Study book file was not found.",
                null,
                404
            );

        }


        const fileName =
            studyResourceSafeFileName(
                objectKey
                    .split("/")
                    .pop()
            );


        return studyResourceStreamResponse(
            object,
            fileName,
            resource.file_type,
            true
        );

    }

    catch (error) {

        console.error(
            "DOWNLOAD study book failed:",
            error
        );


        return studyResourceResponse(
            false,
            "Failed to download the study book.",
            null,
            500
        );

    }

}


// =====================================================
// ADMIN ROUTES
// =====================================================
//
// IMPORTANT:
// Admin authentication is deliberately not implemented yet.
// This is the next task.
//
// DO NOT put admin passwords, demo credentials, or hardcoded
// admin tokens into this Worker.
//
// =====================================================

async function handleAdminResourceRoutes(
    request,
    env,
    method,
    pathname
) {

    // =================================================
    // GET ALL
    // =================================================

    if (
        method === "GET" &&
        pathname ===
            "/api/admin/resources"
    ) {

        return await getAllStudyResources(
            env
        );

    }


    // =================================================
    // GET SINGLE
    // =================================================

    if (
        method === "GET" &&
        pathname.startsWith(
            "/api/admin/resources/"
        )
    ) {

        const resourceId =
            studyAdminResourceId(
                pathname
            );


        if (!resourceId) {

            return studyResourceResponse(
                false,
                "Study book ID is required.",
                null,
                400
            );

        }


        return await getSingleStudyResource(
            env,
            resourceId
        );

    }


    // =================================================
    // CREATE
    // =================================================

    if (
        method === "POST" &&
        pathname ===
            "/api/admin/resources"
    ) {

        return await createStudyResource(
            request,
            env
        );

    }


    // =================================================
    // UPDATE
    // =================================================

    if (
        method === "PUT" &&
        pathname.startsWith(
            "/api/admin/resources/"
        ) &&
        !pathname.endsWith(
            "/status"
        )
    ) {

        const resourceId =
            pathname
                .slice(
                    "/api/admin/resources/"
                        .length
                );


        if (
            !resourceId ||
            resourceId.includes("/")
        ) {

            return studyResourceResponse(
                false,
                "Study book ID is required.",
                null,
                400
            );

        }


        return await updateStudyResource(
            request,
            env,
            resourceId
        );

    }


    // =================================================
    // STATUS
    // =================================================

    if (
        method === "PATCH" &&
        pathname.startsWith(
            "/api/admin/resources/"
        ) &&
        pathname.endsWith(
            "/status"
        )
    ) {

        const prefix =
            "/api/admin/resources/";

        const resourceId =
            pathname
                .slice(
                    prefix.length
                )
                .replace(
                    /\/status$/,
                    ""
                );


        if (
            !resourceId ||
            resourceId.includes("/")
        ) {

            return studyResourceResponse(
                false,
                "Study book ID is required.",
                null,
                400
            );

        }


        return await updateStudyResourceStatus(
            request,
            env,
            resourceId
        );

    }


    // =================================================
    // DELETE
    // =================================================

    if (
        method === "DELETE" &&
        pathname.startsWith(
            "/api/admin/resources/"
        )
    ) {

        const resourceId =
            studyAdminResourceId(
                pathname
            );


        if (!resourceId) {

            return studyResourceResponse(
                false,
                "Study book ID is required.",
                null,
                400
            );

        }


        return await deleteStudyResource(
            env,
            resourceId
        );

    }


    return studyResourceResponse(
        false,
        "Admin study resource endpoint not found.",
        null,
        404
    );

}


// =====================================================
// ADMIN — GET ALL
// =====================================================

async function getAllStudyResources(
    env
) {

    try {

        const result =
            await env.DB.prepare(
                `
                SELECT

                    r.id,
                    r.subject_id,

                    s.name AS subject_name,

                    s.exam_id,

                    e.name AS exam_name,

                    r.title,
                    r.author,
                    r.description,
                    r.file_url,
                    r.cover_image,
                    r.file_type,
                    r.status,
                    r.created_at,
                    r.updated_at

                FROM study_resources r

                INNER JOIN subjects s
                    ON s.id = r.subject_id

                INNER JOIN exams e
                    ON e.id = s.exam_id

                ORDER BY

                    e.display_order ASC,

                    s.display_order ASC,

                    r.created_at DESC
                `
            )
            .all();


        return studyResourceResponse(
            true,
            "Study books retrieved successfully.",
            result?.results || [],
            200
        );

    }

    catch (error) {

        console.error(
            "GET /api/admin/resources failed:",
            error
        );


        return studyResourceResponse(
            false,
            "Failed to retrieve study books.",
            null,
            500
        );

    }

}


// =====================================================
// ADMIN — GET SINGLE
// =====================================================

async function getSingleStudyResource(
    env,
    resourceId
) {

    try {

        const resource =
            await env.DB.prepare(
                `
                SELECT

                    r.id,
                    r.subject_id,

                    s.name AS subject_name,

                    s.exam_id,

                    e.name AS exam_name,

                    r.title,
                    r.author,
                    r.description,
                    r.file_url,
                    r.cover_image,
                    r.file_type,
                    r.status,
                    r.created_at,
                    r.updated_at

                FROM study_resources r

                INNER JOIN subjects s
                    ON s.id = r.subject_id

                INNER JOIN exams e
                    ON e.id = s.exam_id

                WHERE r.id = ?

                LIMIT 1
                `
            )
            .bind(
                resourceId
            )
            .first();


        if (!resource) {

            return studyResourceResponse(
                false,
                "Study book not found.",
                null,
                404
            );

        }


        return studyResourceResponse(
            true,
            "Study book retrieved successfully.",
            resource,
            200
        );

    }

    catch (error) {

        console.error(
            "GET single study book failed:",
            error
        );


        return studyResourceResponse(
            false,
            "Failed to retrieve the study book.",
            null,
            500
        );

    }

}


// =====================================================
// ADMIN — CREATE
// =====================================================

async function createStudyResource(
    request,
    env
) {

    const body =
        await studyResourceJson(
            request
        );


    if (!body) {

        return studyResourceResponse(
            false,
            "Invalid JSON request body.",
            null,
            400
        );

    }


    const subjectId =
        studyResourceText(
            body.subject_id
        );


    const title =
        studyResourceText(
            body.title
        );


    const author =
        studyResourceText(
            body.author
        );


    const description =
        studyResourceText(
            body.description
        );


    const fileUrl =
        studyResourceText(
            body.file_url
        );


    const coverImage =
        studyResourceText(
            body.cover_image
        );


    const fileType =
        studyResourceFileType(
            body.file_type
        );


    // =================================================
    // VALIDATION
    // =================================================

    if (!subjectId) {

        return studyResourceResponse(
            false,
            "Please select a subject.",
            null,
            400
        );

    }


    if (!title) {

        return studyResourceResponse(
            false,
            "Study book title is required.",
            null,
            400
        );

    }


    if (
        title.length > 300
    ) {

        return studyResourceResponse(
            false,
            "Study book title is too long.",
            null,
            400
        );

    }


    if (!author) {

        return studyResourceResponse(
            false,
            "Book author is required.",
            null,
            400
        );

    }


    if (
        author.length > 300
    ) {

        return studyResourceResponse(
            false,
            "Book author is too long.",
            null,
            400
        );

    }


    if (!fileUrl) {

        return studyResourceResponse(
            false,
            "Study book file is required.",
            null,
            400
        );

    }


    if (
        !STUDY_RESOURCE_FILE_TYPES.includes(
            fileType
        )
    ) {

        return studyResourceResponse(
            false,
            "Invalid study book file type.",
            null,
            400
        );

    }


    if (
        !studyResourceValidDocumentKey(
            fileUrl
        )
    ) {

        return studyResourceResponse(
            false,
            "Invalid study book document location.",
            null,
            400
        );

    }


    if (
        coverImage &&
        !studyResourceValidCoverKey(
            coverImage
        )
    ) {

        return studyResourceResponse(
            false,
            "Invalid study book cover location.",
            null,
            400
        );

    }


    try {

        // =============================================
        // SUBJECT
        // =============================================

        const subject =
            await env.DB.prepare(
                `
                SELECT

                    s.id,
                    s.status AS subject_status,
                    e.status AS exam_status

                FROM subjects s

                INNER JOIN exams e
                    ON e.id = s.exam_id

                WHERE s.id = ?

                LIMIT 1
                `
            )
            .bind(
                subjectId
            )
            .first();


        if (!subject) {

            return studyResourceResponse(
                false,
                "Selected subject does not exist.",
                null,
                404
            );

        }


        if (
            subject.subject_status !==
            "active"
        ) {

            return studyResourceResponse(
                false,
                "Selected subject is inactive.",
                null,
                409
            );

        }


        if (
            subject.exam_status !==
            "active"
        ) {

            return studyResourceResponse(
                false,
                "The examination associated with this subject is inactive.",
                null,
                409
            );

        }


        // =============================================
        // DUPLICATE
        // =============================================

        const duplicate =
            await env.DB.prepare(
                `
                SELECT id

                FROM study_resources

                WHERE subject_id = ?

                AND LOWER(title) =
                    LOWER(?)

                LIMIT 1
                `
            )
            .bind(
                subjectId,
                title
            )
            .first();


        if (duplicate) {

            return studyResourceResponse(
                false,
                "A study book with this title already exists for this subject.",
                null,
                409
            );

        }


        // =============================================
        // CREATE
        // =============================================

        const resourceId =
            crypto.randomUUID();


        const now =
            new Date().toISOString();


        await env.DB.prepare(
            `
            INSERT INTO study_resources (

                id,
                subject_id,
                title,
                description,
                file_url,
                cover_image,
                file_type,
                status,
                created_at,
                updated_at,
                author

            )

            VALUES (
                ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
            )
            `
        )
        .bind(

            resourceId,

            subjectId,

            title,

            description || null,

            fileUrl,

            coverImage || null,

            fileType,

            "active",

            now,

            now,

            author

        )
        .run();


        return studyResourceResponse(
            true,
            "Study book created successfully.",
            {
                id:
                    resourceId
            },
            201
        );

    }

    catch (error) {

        console.error(
            "CREATE study book failed:",
            error
        );


        return studyResourceResponse(
            false,
            "Failed to create the study book.",
            null,
            500
        );

    }

}


// =====================================================
// ADMIN — UPDATE
// =====================================================

async function updateStudyResource(
    request,
    env,
    resourceId
) {

    const body =
        await studyResourceJson(
            request
        );


    if (!body) {

        return studyResourceResponse(
            false,
            "Invalid JSON request body.",
            null,
            400
        );

    }


    const subjectId =
        studyResourceText(
            body.subject_id
        );


    const title =
        studyResourceText(
            body.title
        );


    const author =
        studyResourceText(
            body.author
        );


    const description =
        studyResourceText(
            body.description
        );


    const fileUrl =
        studyResourceText(
            body.file_url
        );


    const coverImage =
        studyResourceText(
            body.cover_image
        );


    const fileType =
        studyResourceFileType(
            body.file_type
        );


    const status =
        studyResourceStatus(
            body.status ||
            "active"
        );


    // =================================================
    // VALIDATION
    // =================================================

    if (!subjectId) {

        return studyResourceResponse(
            false,
            "Please select a subject.",
            null,
            400
        );

    }


    if (!title) {

        return studyResourceResponse(
            false,
            "Study book title is required.",
            null,
            400
        );

    }


    if (!author) {

        return studyResourceResponse(
            false,
            "Book author is required.",
            null,
            400
        );

    }


    if (!fileUrl) {

        return studyResourceResponse(
            false,
            "Study book file is required.",
            null,
            400
        );

    }


    if (
        !STUDY_RESOURCE_FILE_TYPES.includes(
            fileType
        )
    ) {

        return studyResourceResponse(
            false,
            "Invalid study book file type.",
            null,
            400
        );

    }


    if (
        !STUDY_RESOURCE_STATUSES.includes(
            status
        )
    ) {

        return studyResourceResponse(
            false,
            "Invalid study book status.",
            null,
            400
        );

    }


    if (
        !studyResourceValidDocumentKey(
            fileUrl
        )
    ) {

        return studyResourceResponse(
            false,
            "Invalid study book document location.",
            null,
            400
        );

    }


    if (
        coverImage &&
        !studyResourceValidCoverKey(
            coverImage
        )
    ) {

        return studyResourceResponse(
            false,
            "Invalid study book cover location.",
            null,
            400
        );

    }


    try {

        // =============================================
        // EXISTING RESOURCE
        // =============================================

        const existing =
            await env.DB.prepare(
                `
                SELECT id

                FROM study_resources

                WHERE id = ?

                LIMIT 1
                `
            )
            .bind(
                resourceId
            )
            .first();


        if (!existing) {

            return studyResourceResponse(
                false,
                "Study book not found.",
                null,
                404
            );

        }


        // =============================================
        // SUBJECT
        // =============================================

        const subject =
            await env.DB.prepare(
                `
                SELECT

                    s.id,
                    s.status AS subject_status,
                    e.status AS exam_status

                FROM subjects s

                INNER JOIN exams e
                    ON e.id = s.exam_id

                WHERE s.id = ?

                LIMIT 1
                `
            )
            .bind(
                subjectId
            )
            .first();


        if (!subject) {

            return studyResourceResponse(
                false,
                "Selected subject does not exist.",
                null,
                404
            );

        }


        if (
            subject.subject_status !==
            "active"
        ) {

            return studyResourceResponse(
                false,
                "Selected subject is inactive.",
                null,
                409
            );

        }


        if (
            subject.exam_status !==
            "active"
        ) {

            return studyResourceResponse(
                false,
                "The examination associated with this subject is inactive.",
                null,
                409
            );

        }


        // =============================================
        // DUPLICATE
        // =============================================

        const duplicate =
            await env.DB.prepare(
                `
                SELECT id

                FROM study_resources

                WHERE subject_id = ?

                AND LOWER(title) =
                    LOWER(?)

                AND id <> ?

                LIMIT 1
                `
            )
            .bind(
                subjectId,
                title,
                resourceId
            )
            .first();


        if (duplicate) {

            return studyResourceResponse(
                false,
                "Another study book with this title already exists for this subject.",
                null,
                409
            );

        }


        // =============================================
        // UPDATE
        // =============================================

        const now =
            new Date().toISOString();


        await env.DB.prepare(
            `
            UPDATE study_resources

            SET

                subject_id = ?,
                title = ?,
                author = ?,
                description = ?,
                file_url = ?,
                cover_image = ?,
                file_type = ?,
                status = ?,
                updated_at = ?

            WHERE id = ?
            `
        )
        .bind(

            subjectId,

            title,

            author,

            description || null,

            fileUrl,

            coverImage || null,

            fileType,

            status,

            now,

            resourceId

        )
        .run();


        return studyResourceResponse(
            true,
            "Study book updated successfully.",
            {
                id:
                    resourceId
            },
            200
        );

    }

    catch (error) {

        console.error(
            "UPDATE study book failed:",
            error
        );


        return studyResourceResponse(
            false,
            "Failed to update the study book.",
            null,
            500
        );

    }

}


// =====================================================
// ADMIN — STATUS
// =====================================================

async function updateStudyResourceStatus(
    request,
    env,
    resourceId
) {

    const body =
        await studyResourceJson(
            request
        );


    if (!body) {

        return studyResourceResponse(
            false,
            "Invalid JSON request body.",
            null,
            400
        );

    }


    const status =
        studyResourceStatus(
            body.status
        );


    if (
        !STUDY_RESOURCE_STATUSES.includes(
            status
        )
    ) {

        return studyResourceResponse(
            false,
            "Status must be 'active' or 'inactive'.",
            null,
            400
        );

    }


    try {

        const resource =
            await env.DB.prepare(
                `
                SELECT id

                FROM study_resources

                WHERE id = ?

                LIMIT 1
                `
            )
            .bind(
                resourceId
            )
            .first();


        if (!resource) {

            return studyResourceResponse(
                false,
                "Study book not found.",
                null,
                404
            );

        }


        const now =
            new Date().toISOString();


        await env.DB.prepare(
            `
            UPDATE study_resources

            SET

                status = ?,

                updated_at = ?

            WHERE id = ?
            `
        )
        .bind(
            status,
            now,
            resourceId
        )
        .run();


        return studyResourceResponse(
            true,

            status === "active"
                ? "Study book activated successfully."
                : "Study book deactivated successfully.",

            {

                id:
                    resourceId,

                status

            },

            200
        );

    }

    catch (error) {

        console.error(
            "UPDATE study book status failed:",
            error
        );


        return studyResourceResponse(
            false,
            "Failed to update study book status.",
            null,
            500
        );

    }

}


// =====================================================
// ADMIN — SOFT DELETE
// =====================================================

async function deleteStudyResource(
    env,
    resourceId
) {

    try {

        const resource =
            await env.DB.prepare(
                `
                SELECT id

                FROM study_resources

                WHERE id = ?

                LIMIT 1
                `
            )
            .bind(
                resourceId
            )
            .first();


        if (!resource) {

            return studyResourceResponse(
                false,
                "Study book not found.",
                null,
                404
            );

        }


        const now =
            new Date().toISOString();


        await env.DB.prepare(
            `
            UPDATE study_resources

            SET

                status = 'inactive',

                updated_at = ?

            WHERE id = ?
            `
        )
        .bind(
            now,
            resourceId
        )
        .run();


        return studyResourceResponse(
            true,
            "Study book deactivated successfully.",
            {

                id:
                    resourceId,

                status:
                    "inactive"

            },
            200
        );

    }

    catch (error) {

        console.error(
            "DELETE study book failed:",
            error
        );


        return studyResourceResponse(
            false,
            "Failed to delete the study book.",
            null,
            500
        );

    }

}