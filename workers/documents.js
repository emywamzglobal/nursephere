// ======================================================
// Nursephere Documents Worker
// File: workers/documents.js
// ======================================================

import jwt from "@tsndr/cloudflare-worker-jwt";


/*=========================================================
        DOCUMENTS WORKER
=========================================================*/

export default async function documentsHandler(
    request,
    env
) {

    try {

        /*=================================================
                VERIFY JWT
        =================================================*/

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


        /*=================================================
                GET STUDENT ID
        =================================================*/

        const payload =
            jwt.decode(token).payload;


        const studentId =
            payload.studentId;


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


        /*=================================================
                VERIFY STUDENT
        =================================================*/

        const student =
            await env.DB.prepare(

                `
                SELECT

                    id,
                    subscription_status,
                    subscription_plan_id,
                    subscription_expires_at

                FROM students

                WHERE id = ?

                LIMIT 1
                `

            )
            .bind(studentId)
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


        /*=================================================
                VERIFY ANNUAL PLAN
        =================================================*/

        const yearlyPlan =
            await env.DB.prepare(

                `
                SELECT

                    id,
                    name,
                    code

                FROM subscription_plans

                WHERE

                    (
                        LOWER(code) = 'yearly'
                        OR
                        LOWER(code) = 'annual'
                        OR
                        LOWER(name) = 'yearly'
                        OR
                        LOWER(name) = 'annual'
                    )

                LIMIT 1
                `

            )
            .first();


        const isAnnualPlan =
            yearlyPlan &&
            student.subscription_plan_id ===
                yearlyPlan.id;


        const subscriptionActive =
            student.subscription_status ===
                "active";


        let annualAccess =
            isAnnualPlan &&
            subscriptionActive;


        /*=================================================
                CHECK EXPIRATION
        =================================================*/

        if (
            annualAccess &&
            student.subscription_expires_at
        ) {

            const expiresAt =
                new Date(
                    student.subscription_expires_at
                );


            if (
                expiresAt <= new Date()
            ) {

                annualAccess = false;

            }

        }


        /*=================================================
                BLOCK NON-ANNUAL STUDENTS
        =================================================*/

        if (!annualAccess) {

            return Response.json(

                {
                    success: false,

                    access: false,

                    message:
                        "Documents are available on the Annual Plan.",

                    upgrade_url:
                        "../checkout.html?plan=yearly"

                },

                {
                    status: 403
                }

            );

        }


        /*=================================================
                ROUTING
        =================================================*/

        const url =
            new URL(request.url);


        /*=================================================
                GET DOCUMENTS
        =================================================*/

        if (
            request.method === "GET" &&
            url.pathname === "/api/documents"
        ) {

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

                    ORDER BY created_at DESC
                    `

                )
                .bind(studentId)
                .all();


            return Response.json(

                {
                    success: true,

                    access: true,

                    documents:
                        documents.results || []

                },

                {
                    status: 200
                }

            );

        }


        /*=================================================
                UPLOAD DOCUMENT
        =================================================*/

        if (
            request.method === "POST" &&
            url.pathname === "/api/documents"
        ) {

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


            /*=============================================
                    BASIC FILE VALIDATION
            =============================================*/

            const fileName =
                file.name;


            const fileType =
                file.type ||
                "application/octet-stream";


            const fileSize =
                file.size;


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


            if (fileSize <= 0) {

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


            /*=============================================
                    FILE SIZE LIMIT
                   
                    25 MB
            =============================================*/

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


            /*=============================================
                    CREATE DOCUMENT ID
            =============================================*/

            const documentId =
                crypto.randomUUID();


            /*=============================================
                    CREATE SIMPLE R2 KEY
                   
                    No unnecessary folder hierarchy.
            =============================================*/

            const safeFileName =
                fileName
                    .replace(
                        /[^a-zA-Z0-9._-]/g,
                        "_"
                    );


            const documentKey =
                `${studentId}-${documentId}-${safeFileName}`;


            /*=============================================
                    UPLOAD TO R2
            =============================================*/

            await env.DOCUMENTS.put(

                documentKey,

                file.stream(),

                {

                    httpMetadata: {

                        contentType:
                            fileType,

                        contentDisposition:
                            `attachment; filename="${safeFileName}"`

                    }

                }

            );


            /*=============================================
                    SAVE D1 METADATA
            =============================================*/

            const now =
                new Date().toISOString();


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


            /*=============================================
                    SUCCESS
            =============================================*/

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


        /*=================================================
                DELETE DOCUMENT
        =================================================*/

        if (
            request.method === "DELETE" &&
            url.pathname === "/api/documents"
        ) {

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


            /*=============================================
                    FIND DOCUMENT
                   
                    Ownership is checked here.
            =============================================*/

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


            /*=============================================
                    DELETE R2 FILE
            =============================================*/

            await env.DOCUMENTS.delete(

                document.document_key

            );


            /*=============================================
                    DELETE D1 RECORD
            =============================================*/

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


            /*=============================================
                    SUCCESS
            =============================================*/

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


        /*=================================================
                DOWNLOAD DOCUMENT
        =================================================*/

        if (
            request.method === "GET" &&
            url.pathname === "/api/documents/download"
        ) {

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


            /*=============================================
                    FIND OWNED DOCUMENT
            =============================================*/

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


            /*=============================================
                    GET FROM R2
            =============================================*/

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


            /*=============================================
                    RETURN FILE
            =============================================*/

            return new Response(

                object.body,

                {

                    status: 200,

                    headers: {

                        "Content-Type":
                            document.file_type,

                        "Content-Disposition":
                            `attachment; filename="${document.file_name}"`

                    }

                }

            );

        }


        /*=================================================
                ROUTE NOT FOUND
        =================================================*/

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


    /*=====================================================
            ERROR HANDLER
    =====================================================*/

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