// =====================================================
// NURSEPHERE — STUDY RESOURCES
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
//   • Student must exist and be active
//   • Active subscription required
//   • Subscription must be paid
//   • Subscription must not be expired
//   • plan_features controls access
//   • none     = denied
//   • view     = view only
//   • download = view + download
//   • R2 objects remain private
//
// =====================================================

import jwt from "@tsndr/cloudflare-worker-jwt";


// =====================================================
// MAIN RESOURCES HANDLER
// =====================================================

export default async function resourcesHandler(
    request,
    env
) {

    try {

        const url =
            new URL(request.url);

        const method =
            request.method;

        const pathname =
            url.pathname;


        // =====================================================
        // CONSTANTS
        // =====================================================

        const STUDY_BOOK_FILE_TYPES = [
            "pdf",
            "docx",
            "xlsx",
            "csv"
        ];

        const STUDY_BOOK_STATUSES = [
            "active",
            "inactive"
        ];

        const STUDY_BOOK_ACCESS_LEVELS = [
            "none",
            "view",
            "download"
        ];

        const STUDY_BOOK_DOCUMENT_FOLDER =
            "study-resources/documents/";

        const STUDY_BOOK_COVER_FOLDER =
            "study-resources/covers/";

        const STUDY_BOOK_DOCUMENT_MIME_TYPES = {

            pdf:
                "application/pdf",

            docx:
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document",

            xlsx:
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",

            csv:
                "text/csv"
        };

        const STUDY_BOOK_COVER_MIME_TYPES = [
            "image/jpeg",
            "image/png",
            "image/webp"
        ];


        // =====================================================
        // HELPERS
        // =====================================================

        function studyBookText(value) {

            return String(
                value ?? ""
            ).trim();

        }


        function studyBookFileType(value) {

            return studyBookText(
                value
            ).toLowerCase();

        }


        function studyBookStatus(value) {

            return studyBookText(
                value
            ).toLowerCase();

        }


        function studyBookResponse(
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

                body.data = data;

            }

            return Response.json(
                body,
                {
                    status,
                    headers: {
                        "Cache-Control": "no-store"
                    }
                }
            );

        }


        async function studyBookJson(
            request
        ) {

            try {

                return await request.json();

            }

            catch {

                return null;

            }

        }


        function studyBookId(
            pathname
        ) {

            return pathname
                .split("/")
                .filter(Boolean)
                .pop();

        }


        // =====================================================
        // SAFE CONTENT DISPOSITION
        // =====================================================

        function studyBookSafeFileName(
            value
        ) {

            return studyBookText(
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
                .slice(
                    0,
                    180
                )
                ||
                "study-resource";

        }


        // =====================================================
        // R2 KEY HELPER
        // =====================================================

        function studyBookR2Key(
            value
        ) {

            const storedValue =
                studyBookText(
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

                return decodeURIComponent(
                    url.pathname
                        .replace(
                            /^\/+/,
                            ""
                        )
                );

            }

            catch {

                return storedValue
                    .replace(
                        /^\/+/,
                        ""
                    );

            }

        }


        // =====================================================
        // DOCUMENT KEY VALIDATION
        // =====================================================

        function studyBookValidDocumentKey(
            value
        ) {

            const key =
                studyBookR2Key(
                    value
                );

            if (!key) {

                return null;

            }

            if (
                !key.startsWith(
                    STUDY_BOOK_DOCUMENT_FOLDER
                )
            ) {

                return null;

            }

            return key;

        }


        // =====================================================
        // COVER KEY VALIDATION
        // =====================================================

        function studyBookValidCoverKey(
            value
        ) {

            const key =
                studyBookR2Key(
                    value
                );

            if (!key) {

                return null;

            }

            if (
                !key.startsWith(
                    STUDY_BOOK_COVER_FOLDER
                )
            ) {

                return null;

            }

            return key;

        }


        // =====================================================
        // ACCESS LEVEL
        // =====================================================

        function studyBookAccessRank(
            level
        ) {

            const normalized =
                studyBookText(
                    level
                ).toLowerCase();

            if (
                normalized === "download"
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


        function studyBookHasAccess(
            actualLevel,
            requiredLevel
        ) {

            return (
                studyBookAccessRank(
                    actualLevel
                )
                >=
                studyBookAccessRank(
                    requiredLevel
                )
            );

        }


        // =====================================================
// STUDENT JWT
// =====================================================

async function studyBookAuthenticateStudent(
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


    const match =
        authorization.match(
            /^Bearer\s+(.+)$/i
        );


    if (!match) {

        return {
            ok: false,
            status: 401,
            message:
                "Invalid authorization header."
        };

    }


    const token =
        match[1].trim();


    if (!token) {

        return {
            ok: false,
            status: 401,
            message:
                "Authentication token is required."
        };

    }


    try {

        // -------------------------------------------------
        // VERIFY JWT SIGNATURE
        // -------------------------------------------------

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


        // -------------------------------------------------
        // DECODE VERIFIED TOKEN
        // -------------------------------------------------

        const decoded =
            jwt.decode(
                token
            );


        const payload =
            decoded?.payload || {};


        // -------------------------------------------------
        // NURSEPHERE JWT STUDENT ID
        // -------------------------------------------------

        const studentId =
            studyBookText(
                payload.studentId
            );


        if (!studentId) {

            console.error(
                "Study resources JWT has no studentId claim."
            );


            return {
                ok: false,
                status: 401,
                message:
                    "Invalid authentication token."
            };

        }


        // -------------------------------------------------
        // LOAD STUDENT
        // -------------------------------------------------

        const student =
            await env.DB.prepare(
                `
                SELECT
                    id,
                    email,
                    status
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


        // -------------------------------------------------
        // ACCOUNT STATUS
        // -------------------------------------------------

        if (
            student.status !==
            "active"
        ) {

            return {
                ok: false,
                status: 403,
                message:
                    "Student account is inactive."
            };

        }


        // -------------------------------------------------
        // SUCCESS
        // -------------------------------------------------

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
        // STUDENT SUBSCRIPTION + FEATURE ACCESS
        // =====================================================

        async function studyBookGetStudentAccess(
            studentId,
            env
        ) {

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

                        AND f.feature_key = 'study_resources'

                        AND datetime(s.start_date)
                            <= datetime('now')

                        AND datetime(s.end_date)
                            >= datetime('now')

                        ORDER BY
                            CASE
                                WHEN pf.access_level = 'download'
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
                        access_level: "none",
                        subscription: null
                    };

                }

                return {
                    ok: true,

                    access_level:
                        studyBookText(
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

        async function studyBookRequireAccess(
            request,
            env,
            requiredLevel
        ) {

            const authentication =
                await studyBookAuthenticateStudent(
                    request,
                    env
                );

            if (!authentication.ok) {

                return authentication;

            }

            const access =
                await studyBookGetStudentAccess(
                    authentication.student.id,
                    env
                );

            if (!access.ok) {

                return access;

            }

            if (
                !studyBookHasAccess(
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
        // R2 STREAM RESPONSE
        // =====================================================

        function studyBookStreamResponse(
            object,
            fileName,
            fileType,
            download = false
        ) {

            if (!object) {

                return null;

            }

            const contentType =
                STUDY_BOOK_DOCUMENT_MIME_TYPES[
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
// STUDENT — GET ALL ACTIVE SUBJECTS
// GET /api/subjects
//
// Purpose:
//   • Load all active subjects for the Resources page
//   • Student selects a subject
//   • Resources are then loaded for that subject
//
// Security:
//   • Student JWT required
//   • Student account must exist
//   • Student account must be active
//   • Only active subjects are returned
//   • Only active exams are included
// =====================================================

if (
    method === "GET" &&
    pathname === "/api/subjects"
) {

    const authentication =
        await studyBookAuthenticateStudent(
            request,
            env
        );

    if (!authentication.ok) {

        return studyBookResponse(
            false,
            authentication.message,
            null,
            authentication.status
        );

    }


    try {

        const { results } =
            await env.DB.prepare(
                `
                SELECT

                    s.id,
                    s.exam_id,

                    e.name AS exam_name,
                    e.code AS exam_code,

                    s.name,
                    s.description,
                    s.image_url,

                    s.display_order,
                    s.status

                FROM subjects s

                INNER JOIN exams e
                    ON e.id = s.exam_id

                WHERE
                    s.status = 'active'

                    AND e.status = 'active'

                ORDER BY

                    e.display_order ASC,
                    e.name COLLATE NOCASE ASC,

                    s.display_order ASC,
                    s.name COLLATE NOCASE ASC
                `
            )
            .all();


        return studyBookResponse(

            true,

            "Subjects retrieved successfully.",

            results || [],

            200

        );

    }

    catch (error) {

        console.error(
            "GET /api/subjects failed:",
            error
        );


        return studyBookResponse(

            false,

            "Failed to retrieve subjects.",

            null,

            500

        );

    }

}

// =====================================================
// STUDENT — GET SUBJECT STUDY RESOURCES
// GET /api/subjects/:subject_id/resources
//
// ACCESS:
//   study_resources feature required
//
//   none     = denied
//   view     = allowed
//   download = allowed
// =====================================================

if (
    method === "GET" &&
    pathname.startsWith("/api/subjects/") &&
    pathname.endsWith("/resources")
) {

    const parts =
        pathname
            .split("/")
            .filter(Boolean);

    const subjectId =
        parts[
            parts.length - 2
        ];

    if (!subjectId) {

        return studyBookResponse(
            false,
            "Subject ID is required.",
            null,
            400
        );

    }


    // =================================================
    // AUTHENTICATION + FEATURE ACCESS
    // =================================================

    const authorization =
        await studyBookRequireAccess(
            request,
            env,
            "view"
        );

    if (!authorization.ok) {

        return studyBookResponse(
            false,
            authorization.message,
            null,
            authorization.status
        );

    }


    try {

        // =================================================
        // SUBJECT
        // =================================================

        const subject =
            await env.DB.prepare(
                `
                SELECT
                    s.id,
                    s.name,
                    s.description,
                    s.image_url,
                    s.exam_id,
                    e.name AS exam_name,
                    e.code AS exam_code

                FROM subjects s

                INNER JOIN exams e
                    ON e.id = s.exam_id

                WHERE
                    s.id = ?
                    AND s.status = 'active'
                    AND e.status = 'active'

                LIMIT 1
                `
            )
            .bind(
                subjectId
            )
            .first();


        if (!subject) {

            return studyBookResponse(
                false,
                "Subject not found.",
                null,
                404
            );

        }


        // =================================================
        // STUDY BOOKS
        // =================================================

        const { results } =
            await env.DB.prepare(
                `
                SELECT
                    id,
                    subject_id,
                    title,
                    author,
                    description,
                    cover_image,
                    file_type,
                    status,
                    created_at,
                    updated_at

                FROM study_resources

                WHERE
                    subject_id = ?
                    AND status = 'active'

                ORDER BY
                    created_at DESC
                `
            )
            .bind(
                subjectId
            )
            .all();


        // =================================================
        // RETURN
        // =================================================

        return studyBookResponse(
            true,
            "Study resources retrieved successfully.",
            {
                subject,
                resources:
                    results || [],

                access_level:
                    authorization.access
                        ?.access_level ||
                    "none"
            },
            200
        );

    }

    catch (error) {

        console.error(
            "GET subject study resources failed:",
            error
        );

        return studyBookResponse(
            false,
            "Failed to retrieve study resources.",
            null,
            500
        );

    }

}


        // =====================================================
        // ADMIN — GET ALL STUDY BOOKS
        // GET /api/admin/resources
        // =====================================================

        if (
            method === "GET" &&
            pathname === "/api/admin/resources"
        ) {

            try {

                const { results } =
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

                return studyBookResponse(
                    true,
                    "Study books retrieved successfully.",
                    results || [],
                    200
                );

            }

            catch (error) {

                console.error(
                    "GET /api/admin/resources failed:",
                    error
                );

                return studyBookResponse(
                    false,
                    "Failed to retrieve study books.",
                    null,
                    500
                );

            }

        }


        // =====================================================
        // ADMIN — GET SINGLE STUDY BOOK
        // GET /api/admin/resources/:id
        // =====================================================

        if (
            method === "GET" &&
            pathname.startsWith(
                "/api/admin/resources/"
            ) &&
            !pathname.endsWith(
                "/status"
            ) &&
            !pathname.endsWith(
                "/view"
            ) &&
            !pathname.endsWith(
                "/download"
            ) &&
            !pathname.includes(
                "/upload/"
            )
        ) {

            const resourceId =
                studyBookId(
                    pathname
                );

            if (!resourceId) {

                return studyBookResponse(
                    false,
                    "Study book ID is required.",
                    null,
                    400
                );

            }

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

                    return studyBookResponse(
                        false,
                        "Study book not found.",
                        null,
                        404
                    );

                }

                return studyBookResponse(
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

                return studyBookResponse(
                    false,
                    "Failed to retrieve the study book.",
                    null,
                    500
                );

            }

        }


        // =====================================================
        // STUDENT — VIEW STUDY BOOK
        // GET /api/resources/:id/view
        // =====================================================

        if (
            method === "GET" &&
            pathname.startsWith(
                "/api/resources/"
            ) &&
            pathname.endsWith(
                "/view"
            )
        ) {

            const parts =
                pathname
                    .split("/")
                    .filter(Boolean);

            const resourceId =
                parts[
                    parts.length - 2
                ];

            if (!resourceId) {

                return studyBookResponse(
                    false,
                    "Study book ID is required.",
                    null,
                    400
                );

            }

            const authorization =
                await studyBookRequireAccess(
                    request,
                    env,
                    "view"
                );

            if (!authorization.ok) {

                return studyBookResponse(
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
                            id,
                            title,
                            file_url,
                            file_type,
                            status

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

                    return studyBookResponse(
                        false,
                        "Study book not found.",
                        null,
                        404
                    );

                }

                if (
                    resource.status !== "active"
                ) {

                    return studyBookResponse(
                        false,
                        "This study resource is currently unavailable.",
                        null,
                        404
                    );

                }

                const objectKey =
                    studyBookValidDocumentKey(
                        resource.file_url
                    );

                if (!objectKey) {

                    return studyBookResponse(
                        false,
                        "Study book file is unavailable.",
                        null,
                        404
                    );

                }

                const object =
                    await env.DOCUMENTS.get(
                        objectKey
                    );

                if (!object) {

                    return studyBookResponse(
                        false,
                        "Study book file was not found.",
                        null,
                        404
                    );

                }

                const fileName =
                    studyBookSafeFileName(
                        objectKey
                            .split("/")
                            .pop()
                    );

                return studyBookStreamResponse(
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

                return studyBookResponse(
                    false,
                    "Failed to open the study book.",
                    null,
                    500
                );

            }

        }


        // =====================================================
        // STUDENT — DOWNLOAD STUDY BOOK
        // GET /api/resources/:id/download
        // =====================================================

        if (
            method === "GET" &&
            pathname.startsWith(
                "/api/resources/"
            ) &&
            pathname.endsWith(
                "/download"
            )
        ) {

            const parts =
                pathname
                    .split("/")
                    .filter(Boolean);

            const resourceId =
                parts[
                    parts.length - 2
                ];

            if (!resourceId) {

                return studyBookResponse(
                    false,
                    "Study book ID is required.",
                    null,
                    400
                );

            }

            const authorization =
                await studyBookRequireAccess(
                    request,
                    env,
                    "download"
                );

            if (!authorization.ok) {

                return studyBookResponse(
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
                            id,
                            title,
                            file_url,
                            file_type,
                            status

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

                    return studyBookResponse(
                        false,
                        "Study book not found.",
                        null,
                        404
                    );

                }

                if (
                    resource.status !== "active"
                ) {

                    return studyBookResponse(
                        false,
                        "This study resource is currently unavailable.",
                        null,
                        404
                    );

                }

                const objectKey =
                    studyBookValidDocumentKey(
                        resource.file_url
                    );

                if (!objectKey) {

                    return studyBookResponse(
                        false,
                        "Study book file is unavailable.",
                        null,
                        404
                    );

                }

                const object =
                    await env.DOCUMENTS.get(
                        objectKey
                    );

                if (!object) {

                    return studyBookResponse(
                        false,
                        "Study book file was not found.",
                        null,
                        404
                    );

                }

                const fileName =
                    studyBookSafeFileName(
                        objectKey
                            .split("/")
                            .pop()
                    );

                return studyBookStreamResponse(
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

                return studyBookResponse(
                    false,
                    "Failed to download the study book.",
                    null,
                    500
                );

            }

        }


        // =====================================================
        // ADMIN — CREATE STUDY BOOK
        // POST /api/admin/resources
        // =====================================================

        if (
            method === "POST" &&
            pathname === "/api/admin/resources"
        ) {

            const body =
                await studyBookJson(
                    request
                );

            if (!body) {

                return studyBookResponse(
                    false,
                    "Invalid JSON request body.",
                    null,
                    400
                );

            }

            const subjectId =
                studyBookText(
                    body.subject_id
                );

            const title =
                studyBookText(
                    body.title
                );

            const author =
                studyBookText(
                    body.author
                );

            const description =
                studyBookText(
                    body.description
                );

            const fileUrl =
                studyBookText(
                    body.file_url
                );

            const coverImage =
                studyBookText(
                    body.cover_image
                );

            const fileType =
                studyBookFileType(
                    body.file_type
                );


            if (!subjectId) {

                return studyBookResponse(
                    false,
                    "Please select a subject.",
                    null,
                    400
                );

            }

            if (!title) {

                return studyBookResponse(
                    false,
                    "Study book title is required.",
                    null,
                    400
                );

            }

            if (!author) {

                return studyBookResponse(
                    false,
                    "Book author is required.",
                    null,
                    400
                );

            }

            if (!fileUrl) {

                return studyBookResponse(
                    false,
                    "Study book file is required.",
                    null,
                    400
                );

            }

            if (
                !STUDY_BOOK_FILE_TYPES.includes(
                    fileType
                )
            ) {

                return studyBookResponse(
                    false,
                    "Invalid study book file type.",
                    null,
                    400
                );

            }

            if (
                !studyBookValidDocumentKey(
                    fileUrl
                )
            ) {

                return studyBookResponse(
                    false,
                    "Invalid study book document location.",
                    null,
                    400
                );

            }

            if (
                coverImage &&
                !studyBookValidCoverKey(
                    coverImage
                )
            ) {

                return studyBookResponse(
                    false,
                    "Invalid study book cover location.",
                    null,
                    400
                );

            }

            try {

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

                    return studyBookResponse(
                        false,
                        "Selected subject does not exist.",
                        null,
                        404
                    );

                }

                if (
                    subject.subject_status !== "active"
                ) {

                    return studyBookResponse(
                        false,
                        "Selected subject is inactive.",
                        null,
                        409
                    );

                }

                if (
                    subject.exam_status !== "active"
                ) {

                    return studyBookResponse(
                        false,
                        "The examination associated with this subject is inactive.",
                        null,
                        409
                    );

                }

                const duplicate =
                    await env.DB.prepare(
                        `
                        SELECT id

                        FROM study_resources

                        WHERE subject_id = ?

                        AND LOWER(title) = LOWER(?)

                        LIMIT 1
                        `
                    )
                    .bind(
                        subjectId,
                        title
                    )
                    .first();

                if (duplicate) {

                    return studyBookResponse(
                        false,
                        "A study book with this title already exists for this subject.",
                        null,
                        409
                    );

                }

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
                        author,
                        description,
                        file_url,
                        cover_image,
                        file_type,
                        status,
                        created_at,
                        updated_at

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
                    author,
                    description,
                    fileUrl,
                    coverImage,
                    fileType,
                    "active",
                    now,
                    now
                )
                .run();

                return studyBookResponse(
                    true,
                    "Study book created successfully.",
                    {
                        id: resourceId
                    },
                    201
                );

            }

            catch (error) {

                console.error(
                    "CREATE study book failed:",
                    error
                );

                return studyBookResponse(
                    false,
                    "Failed to create the study book.",
                    null,
                    500
                );

            }

        }


        // =====================================================
        // ADMIN — UPDATE STUDY BOOK
        // PUT /api/admin/resources/:id
        // =====================================================

        if (
            method === "PUT" &&
            pathname.startsWith(
                "/api/admin/resources/"
            ) &&
            !pathname.endsWith(
                "/status"
            ) &&
            !pathname.includes(
                "/upload/"
            )
        ) {

            const resourceId =
                studyBookId(
                    pathname
                );

            if (!resourceId) {

                return studyBookResponse(
                    false,
                    "Study book ID is required.",
                    null,
                    400
                );

            }

            const body =
                await studyBookJson(
                    request
                );

            if (!body) {

                return studyBookResponse(
                    false,
                    "Invalid JSON request body.",
                    null,
                    400
                );

            }

            const subjectId =
                studyBookText(
                    body.subject_id
                );

            const title =
                studyBookText(
                    body.title
                );

            const author =
                studyBookText(
                    body.author
                );

            const description =
                studyBookText(
                    body.description
                );

            const fileUrl =
                studyBookText(
                    body.file_url
                );

            const coverImage =
                studyBookText(
                    body.cover_image
                );

            const fileType =
                studyBookFileType(
                    body.file_type
                );

            const status =
                studyBookStatus(
                    body.status ||
                    "active"
                );


            if (!subjectId) {

                return studyBookResponse(
                    false,
                    "Please select a subject.",
                    null,
                    400
                );

            }

            if (!title) {

                return studyBookResponse(
                    false,
                    "Study book title is required.",
                    null,
                    400
                );

            }

            if (!author) {

                return studyBookResponse(
                    false,
                    "Book author is required.",
                    null,
                    400
                );

            }

            if (!fileUrl) {

                return studyBookResponse(
                    false,
                    "Study book file is required.",
                    null,
                    400
                );

            }

            if (
                !STUDY_BOOK_FILE_TYPES.includes(
                    fileType
                )
            ) {

                return studyBookResponse(
                    false,
                    "Invalid study book file type.",
                    null,
                    400
                );

            }

            if (
                !STUDY_BOOK_STATUSES.includes(
                    status
                )
            ) {

                return studyBookResponse(
                    false,
                    "Invalid study book status.",
                    null,
                    400
                );

            }

            if (
                !studyBookValidDocumentKey(
                    fileUrl
                )
            ) {

                return studyBookResponse(
                    false,
                    "Invalid study book document location.",
                    null,
                    400
                );

            }

            if (
                coverImage &&
                !studyBookValidCoverKey(
                    coverImage
                )
            ) {

                return studyBookResponse(
                    false,
                    "Invalid study book cover location.",
                    null,
                    400
                );

            }

            try {

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

                    return studyBookResponse(
                        false,
                        "Study book not found.",
                        null,
                        404
                    );

                }

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

                    return studyBookResponse(
                        false,
                        "Selected subject does not exist.",
                        null,
                        404
                    );

                }

                if (
                    subject.subject_status !== "active"
                ) {

                    return studyBookResponse(
                        false,
                        "Selected subject is inactive.",
                        null,
                        409
                    );

                }

                if (
                    subject.exam_status !== "active"
                ) {

                    return studyBookResponse(
                        false,
                        "The examination associated with this subject is inactive.",
                        null,
                        409
                    );

                }

                const duplicate =
                    await env.DB.prepare(
                        `
                        SELECT id

                        FROM study_resources

                        WHERE subject_id = ?

                        AND LOWER(title) = LOWER(?)

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

                    return studyBookResponse(
                        false,
                        "Another study book with this title already exists for this subject.",
                        null,
                        409
                    );

                }

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
                    description,
                    fileUrl,
                    coverImage,
                    fileType,
                    status,
                    new Date().toISOString(),
                    resourceId
                )
                .run();

                return studyBookResponse(
                    true,
                    "Study book updated successfully.",
                    {
                        id: resourceId
                    },
                    200
                );

            }

            catch (error) {

                console.error(
                    "UPDATE study book failed:",
                    error
                );

                return studyBookResponse(
                    false,
                    "Failed to update the study book.",
                    null,
                    500
                );

            }

        }


        // =====================================================
        // ADMIN — ACTIVATE / DEACTIVATE
        // PATCH /api/admin/resources/:id/status
        // =====================================================

        if (
            method === "PATCH" &&
            pathname.startsWith(
                "/api/admin/resources/"
            ) &&
            pathname.endsWith(
                "/status"
            )
        ) {

            const parts =
                pathname
                    .split("/")
                    .filter(Boolean);

            const resourceId =
                parts[
                    parts.length - 2
                ];

            const body =
                await studyBookJson(
                    request
                );

            if (!resourceId) {

                return studyBookResponse(
                    false,
                    "Study book ID is required.",
                    null,
                    400
                );

            }

            if (!body) {

                return studyBookResponse(
                    false,
                    "Invalid JSON request body.",
                    null,
                    400
                );

            }

            const status =
                studyBookStatus(
                    body.status
                );

            if (
                !STUDY_BOOK_STATUSES.includes(
                    status
                )
            ) {

                return studyBookResponse(
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

                    return studyBookResponse(
                        false,
                        "Study book not found.",
                        null,
                        404
                    );

                }

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
                    new Date().toISOString(),
                    resourceId
                )
                .run();

                return studyBookResponse(
                    true,

                    status === "active"
                        ? "Study book activated successfully."
                        : "Study book deactivated successfully.",

                    {
                        id: resourceId,
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

                return studyBookResponse(
                    false,
                    "Failed to update study book status.",
                    null,
                    500
                );

            }

        }


        // =====================================================
        // ADMIN — SOFT DELETE
        // DELETE /api/admin/resources/:id
        // =====================================================

        if (
            method === "DELETE" &&
            pathname.startsWith(
                "/api/admin/resources/"
            )
        ) {

            const parts =
                pathname
                    .split("/")
                    .filter(Boolean);

            const resourceId =
                parts[
                    parts.length - 1
                ];

            if (!resourceId) {

                return studyBookResponse(
                    false,
                    "Study book ID is required.",
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

                    return studyBookResponse(
                        false,
                        "Study book not found.",
                        null,
                        404
                    );

                }

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
                    new Date().toISOString(),
                    resourceId
                )
                .run();

                return studyBookResponse(
                    true,
                    "Study book deactivated successfully.",
                    {
                        id: resourceId,
                        status: "inactive"
                    },
                    200
                );

            }

            catch (error) {

                console.error(
                    "DELETE study book failed:",
                    error
                );

                return studyBookResponse(
                    false,
                    "Failed to delete the study book.",
                    null,
                    500
                );

            }

        }


        // =====================================================
        // ROUTE NOT FOUND
        // =====================================================

        return studyBookResponse(
            false,
            "Study resource endpoint not found.",
            null,
            404
        );

    }

    catch (error) {

        console.error(
            "Resources Worker Error:",
            error
        );

        return Response.json(
            {
                success: false,
                message:
                    "Unable to process study resource request."
            },
            {
                status: 500,
                headers: {
                    "Cache-Control": "no-store"
                }
            }
        );

    }

}