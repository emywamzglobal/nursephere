// ======================================================
// Nursephere Documents Worker
// File: workers/documents.js
//
// DATABASE-DRIVEN DOCUMENT ACCESS
//
// Student
//     ↓
// subscriptions.student_id
//     ↓
// subscriptions.plan_id
//     ↓
// subscription_plans.id
//     ↓
// plan_features.plan_id
//     ↓
// features.id
//
// Feature:
//     feature_key = "documents"
//
// Access levels:
//     none
//     view
//     full
//     download
//
// No plan names or plan durations are hardcoded.
// ======================================================

import jwt from "@tsndr/cloudflare-worker-jwt";


// ======================================================
// DOCUMENTS WORKER
// ======================================================

export default async function documentsHandler(
    request,
    env
) {

    try {

        const url =
            new URL(request.url);


        // =================================================
        // AUTHENTICATION
        // =================================================

        const authHeader =
            request.headers.get(
                "Authorization"
            );


        if (
            !authHeader ||
            !authHeader.startsWith("Bearer ")
        ) {

            return Response.json(

                {
                    success: false,

                    message:
                        "Unauthorized."
                },

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

            return Response.json(

                {
                    success: false,

                    message:
                        "Invalid or expired session."
                },

                {
                    status: 401
                }

            );

        }


        // =================================================
        // GET STUDENT ID FROM JWT
        // =================================================

        const decoded =
            jwt.decode(token);


        const payload =
            decoded?.payload;


        const studentId =
            payload?.studentId;


        if (!studentId) {

            return Response.json(

                {
                    success: false,

                    message:
                        "Student identity missing."
                },

                {
                    status: 401
                }

            );

        }


        // =================================================
        // VERIFY STUDENT EXISTS
        // =================================================

        const student =
            await env.DB.prepare(

                `
                SELECT

                    id

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

            return Response.json(

                {
                    success: false,

                    message:
                        "Student not found."
                },

                {
                    status: 404
                }

            );

        }


        // =================================================
        // DATABASE-DRIVEN DOCUMENT ACCESS
        //
        // We do NOT check:
        //
        // students.subscription_status
        // students.subscription_plan_id
        // students.subscription_expires_at
        //
        // The active subscription comes from:
        //
        // subscriptions
        //      ↓
        // subscription_plans
        //      ↓
        // plan_features
        //      ↓
        // features
        // =================================================

        const entitlement =
            await env.DB.prepare(

                `
                SELECT

                    s.id AS subscription_id,

                    s.plan_id,

                    s.start_date,

                    s.end_date,

                    s.payment_status,

                    s.status AS subscription_status,

                    sp.status AS plan_status,

                    f.feature_key,

                    pf.access_level

                FROM subscriptions s

                INNER JOIN subscription_plans sp

                    ON sp.id =
                       s.plan_id

                INNER JOIN plan_features pf

                    ON pf.plan_id =
                       s.plan_id

                INNER JOIN features f

                    ON f.id =
                       pf.feature_id

                WHERE

                    s.student_id = ?

                    AND s.status = 'active'

                    AND sp.status = 'active'

                    AND f.status = 'active'

                    AND f.feature_key = 'documents'

                    AND datetime(s.end_date)
                        > datetime('now')

                ORDER BY

                    datetime(s.end_date) DESC,

                    datetime(s.created_at) DESC

                LIMIT 1
                `

            )
            .bind(
                studentId
            )
            .first();


        // =================================================
        // NO DOCUMENT ENTITLEMENT
        // =================================================

        if (!entitlement) {

            return Response.json(

                {
                    success: false,

                    access: false,

                    message:
                        "You do not have access to Documents."

                },

                {
                    status: 403
                }

            );

        }


        // =================================================
        // NORMALIZE ACCESS LEVEL
        // =================================================

        const accessLevel =
            String(
                entitlement.access_level || "none"
            )
            .trim()
            .toLowerCase();


        // =================================================
        // ACCESS CHECK HELPER
        // =================================================

        function hasAccess(
            requiredAccess
        ) {

            if (
                accessLevel === "full"
            ) {

                return true;

            }


            if (
                requiredAccess === "view" &&
                accessLevel === "view"
            ) {

                return true;

            }


            if (
                requiredAccess === "download" &&
                accessLevel === "download"
            ) {

                return true;

            }


            return false;

        }


        // =================================================
        // GET DOCUMENTS
        //
        // Required:
        // view / full / download
        // =================================================

        if (

            request.method === "GET" &&

            url.pathname === "/api/documents"

        ) {

            if (
                !hasAccess("view") &&
                !hasAccess("download")
            ) {

                return Response.json(

                    {
                        success: false,

                        access: false,

                        message:
                            "You do not have permission to view Documents."

                    },

                    {
                        status: 403
                    }

                );

            }


            const documents =
                await env.DB.prepare(

                    `
                    SELECT

                        id,
                        file_name,
                        file_type,
                        file_size,
                        created_at,
                        updated_at

                    FROM student_documents

                    WHERE student_id = ?

                    ORDER BY
                        datetime(created_at) DESC
                    `

                )
                .bind(
                    studentId
                )
                .all();


            return Response.json(

                {
                    success: true,

                    access: true,

                    access_level:
                        accessLevel,

                    documents:
                        documents.results || []

                },

                {
                    status: 200
                }

            );

        }


        // =================================================
        // UPLOAD DOCUMENT
        //
        // Required:
        // full
        // =================================================

        if (

            request.method === "POST" &&

            url.pathname === "/api/documents"

        ) {

            if (
                !hasAccess("full")
            ) {

                return Response.json(

                    {
                        success: false,

                        access: false,

                        message:
                            "You do not have permission to upload Documents."

                    },

                    {
                        status: 403
                    }

                );

            }


            // =============================================
            // READ FORM DATA
            // =============================================

            const formData =
                await request.formData();


            const file =
                formData.get("file");


            if (
                !file ||
                typeof file === "string"
            ) {

                return Response.json(

                    {
                        success: false,

                        message:
                            "No file was provided."
                    },

                    {
                        status: 400
                    }

                );

            }


            // =============================================
            // FILE INFORMATION
            // =============================================

            const fileName =
                String(
                    file.name || ""
                )
                .trim();


            const fileType =
                String(
                    file.type ||
                    "application/octet-stream"
                )
                .trim();


            const fileSize =
                Number(
                    file.size || 0
                );


            if (!fileName) {

                return Response.json(

                    {
                        success: false,

                        message:
                            "Invalid file name."
                    },

                    {
                        status: 400
                    }

                );

            }


            if (
                !Number.isFinite(fileSize) ||
                fileSize <= 0
            ) {

                return Response.json(

                    {
                        success: false,

                        message:
                            "The uploaded file is empty."
                    },

                    {
                        status: 400
                    }

                );

            }


            // =============================================
            // FILE SIZE LIMIT
            //
            // 25 MB
            // =============================================

            const MAX_FILE_SIZE =
                25 * 1024 * 1024;


            if (
                fileSize >
                MAX_FILE_SIZE
            ) {

                return Response.json(

                    {
                        success: false,

                        message:
                            "File size cannot exceed 25 MB."
                    },

                    {
                        status: 400
                    }

                );

            }


            // =============================================
            // CREATE DOCUMENT ID
            // =============================================

            const documentId =
                crypto.randomUUID();


            // =============================================
            // SAFE R2 FILE NAME
            // =============================================

            const safeFileName =
                fileName

                    .replace(
                        /[\r\n]/g,
                        "_"
                    )

                    .replace(
                        /[^a-zA-Z0-9._-]/g,
                        "_"
                    );


            // =============================================
            // R2 OBJECT KEY
            // =============================================

            const documentKey =
                `${studentId}-${documentId}-${safeFileName}`;


            // =============================================
            // UPLOAD TO R2
            // =============================================

            await env.DOCUMENTS.put(

                documentKey,

                file.stream(),

                {

                    httpMetadata: {

                        contentType:
                            fileType,

                        contentDisposition:
                            `attachment; filename="${safeFileName}"`

                    },

                    customMetadata: {

                        studentId:
                            String(studentId),

                        documentId:
                            String(documentId)

                    }

                }

            );


            // =============================================
            // SAVE D1 METADATA
            // =============================================

            const now =
                new Date().toISOString();


            try {

                await env.DB.prepare(

                    `
                    INSERT INTO student_documents (

                        id,
                        student_id,
                        file_name,
                        file_type,
                        file_size,
                        document_key,
                        created_at,
                        updated_at

                    )

                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    `

                )
                .bind(

                    documentId,
                    studentId,
                    fileName,
                    fileType,
                    fileSize,
                    documentKey,
                    now,
                    now

                )
                .run();

            }

            catch (databaseError) {

                // -----------------------------------------
                // CLEAN UP R2 OBJECT IF D1 INSERT FAILS
                // -----------------------------------------

                try {

                    await env.DOCUMENTS.delete(
                        documentKey
                    );

                }

                catch (cleanupError) {

                    console.error(
                        "DOCUMENT R2 CLEANUP ERROR:",
                        cleanupError
                    );

                }


                throw databaseError;

            }


            // =============================================
            // SUCCESS
            // =============================================

            return Response.json(

                {
                    success: true,

                    message:
                        "Document uploaded successfully.",

                    document: {

                        id:
                            documentId,

                        file_name:
                            fileName,

                        file_type:
                            fileType,

                        file_size:
                            fileSize,

                        created_at:
                            now

                    }

                },

                {
                    status: 201
                }

            );

        }


        // =================================================
        // DELETE DOCUMENT
        //
        // Required:
        // full
        // =================================================

        if (

            request.method === "DELETE" &&

            url.pathname === "/api/documents"

        ) {

            if (
                !hasAccess("full")
            ) {

                return Response.json(

                    {
                        success: false,

                        access: false,

                        message:
                            "You do not have permission to delete Documents."

                    },

                    {
                        status: 403
                    }

                );

            }


            const documentId =
                url.searchParams.get(
                    "id"
                );


            if (!documentId) {

                return Response.json(

                    {
                        success: false,

                        message:
                            "Document ID is required."
                    },

                    {
                        status: 400
                    }

                );

            }


            // =============================================
            // FIND OWNED DOCUMENT
            // =============================================

            const document =
                await env.DB.prepare(

                    `
                    SELECT

                        id,
                        document_key

                    FROM student_documents

                    WHERE

                        id = ?

                        AND student_id = ?

                    LIMIT 1
                    `

                )
                .bind(

                    documentId,
                    studentId

                )
                .first();


            if (!document) {

                return Response.json(

                    {
                        success: false,

                        message:
                            "Document not found."
                    },

                    {
                        status: 404
                    }

                );

            }


            // =============================================
            // DELETE R2 OBJECT
            // =============================================

            await env.DOCUMENTS.delete(

                document.document_key

            );


            // =============================================
            // DELETE D1 RECORD
            // =============================================

            await env.DB.prepare(

                `
                DELETE FROM student_documents

                WHERE

                    id = ?

                    AND student_id = ?
                `

            )
            .bind(

                documentId,
                studentId

            )
            .run();


            // =============================================
            // SUCCESS
            // =============================================

            return Response.json(

                {
                    success: true,

                    message:
                        "Document deleted successfully."

                },

                {
                    status: 200
                }

            );

        }


        // =================================================
        // DOWNLOAD DOCUMENT
        //
        // Required:
        // download / full
        // =================================================

        if (

            request.method === "GET" &&

            url.pathname ===
                "/api/documents/download"

        ) {

            if (
                !hasAccess("download")
            ) {

                return Response.json(

                    {
                        success: false,

                        access: false,

                        message:
                            "You do not have permission to download Documents."

                    },

                    {
                        status: 403
                    }

                );

            }


            const documentId =
                url.searchParams.get(
                    "id"
                );


            if (!documentId) {

                return Response.json(

                    {
                        success: false,

                        message:
                            "Document ID is required."
                    },

                    {
                        status: 400
                    }

                );

            }


            // =============================================
            // FIND OWNED DOCUMENT
            // =============================================

            const document =
                await env.DB.prepare(

                    `
                    SELECT

                        id,
                        file_name,
                        file_type,
                        document_key

                    FROM student_documents

                    WHERE

                        id = ?

                        AND student_id = ?

                    LIMIT 1
                    `

                )
                .bind(

                    documentId,
                    studentId

                )
                .first();


            if (!document) {

                return Response.json(

                    {
                        success: false,

                        message:
                            "Document not found."
                    },

                    {
                        status: 404
                    }

                );

            }


            // =============================================
            // GET FILE FROM R2
            // =============================================

            const object =
                await env.DOCUMENTS.get(

                    document.document_key

                );


            if (!object) {

                return Response.json(

                    {
                        success: false,

                        message:
                            "Document file not found."
                    },

                    {
                        status: 404
                    }

                );

            }


            // =============================================
            // SAFE DOWNLOAD FILE NAME
            // =============================================

            const downloadFileName =
                String(
                    document.file_name || "document"
                )

                .replace(
                    /[\r\n"]/g,
                    "_"
                );


            // =============================================
            // RETURN FILE
            // =============================================

            return new Response(

                object.body,

                {

                    status: 200,

                    headers: {

                        "Content-Type":
                            document.file_type ||
                            "application/octet-stream",

                        "Content-Disposition":
                            `attachment; filename="${downloadFileName}"`,

                        "Cache-Control":
                            "private, no-store"

                    }

                }

            );

        }


        // =================================================
        // ROUTE NOT FOUND
        // =================================================

        return Response.json(

            {
                success: false,

                message:
                    "Documents API route not found."
            },

            {
                status: 404
            }

        );

    }


    // =====================================================
    // ERROR HANDLER
    // =====================================================

    catch (error) {

        console.error(

            "DOCUMENTS WORKER ERROR:",

            error

        );


        return Response.json(

            {
                success: false,

                message:
                    "Unable to process document request."

            },

            {
                status: 500
            }

        );

    }

}