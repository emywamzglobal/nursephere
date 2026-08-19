// ======================================================
// NurseSphere - Student Avatar Upload
// ======================================================

import jwt from "@tsndr/cloudflare-worker-jwt";

const MAX_FILE_SIZE = 5 * 1024 * 1024;

const ALLOWED_TYPES = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp"
};

export default async function uploadHandler(request, env) {

    try {

        // ==================================================
        // METHOD
        // ==================================================

        if (request.method !== "POST") {

            return Response.json(
                {
                    success: false,
                    message: "Method not allowed."
                },
                { status: 405 }
            );

        }


        // ==================================================
        // AUTHENTICATION
        // ==================================================

        const authHeader =
            request.headers.get("Authorization");

        if (
            !authHeader ||
            !authHeader.startsWith("Bearer ")
        ) {

            return Response.json(
                {
                    success: false,
                    message: "Unauthorized."
                },
                { status: 401 }
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
                    message: "Invalid or expired session."
                },
                { status: 401 }
            );

        }


        const payload =
            jwt.decode(token).payload;

        const studentId =
            payload?.studentId;

        if (!studentId) {

            return Response.json(
                {
                    success: false,
                    message: "Invalid student session."
                },
                { status: 401 }
            );

        }


        // ==================================================
        // VERIFY STUDENT
        // ==================================================

        const student =
            await env.DB.prepare(`
                SELECT id
                FROM students
                WHERE id = ?
                LIMIT 1
            `)
            .bind(studentId)
            .first();

        if (!student) {

            return Response.json(
                {
                    success: false,
                    message: "Student not found."
                },
                { status: 404 }
            );

        }


        // ==================================================
        // FILE TYPE
        // ==================================================

        const contentType =
            request.headers.get("Content-Type");

        const extension =
            ALLOWED_TYPES[contentType];

        if (!extension) {

            return Response.json(
                {
                    success: false,
                    message:
                        "Only JPG, PNG and WEBP images are allowed."
                },
                { status: 400 }
            );

        }


        // ==================================================
        // READ FILE
        // ==================================================

        const image =
            await request.arrayBuffer();

        if (!image.byteLength) {

            return Response.json(
                {
                    success: false,
                    message: "No image was uploaded."
                },
                { status: 400 }
            );

        }

        if (image.byteLength > MAX_FILE_SIZE) {

            return Response.json(
                {
                    success: false,
                    message:
                        "Avatar must be smaller than 5 MB."
                },
                { status: 413 }
            );

        }


        // ==================================================
        // R2 KEY
        // ==================================================

        const avatarKey =
            `images/avatars/${studentId}.${extension}`;


        // ==================================================
        // REMOVE PREVIOUS AVATAR
        // ==================================================

        const oldExtensions = [
            "jpg",
            "png",
            "webp"
        ];

        for (const oldExtension of oldExtensions) {

            const oldKey =
                `images/avatars/${studentId}.${oldExtension}`;

            if (oldKey !== avatarKey) {

                await env.IMAGES.delete(oldKey);

            }

        }


        // ==================================================
        // UPLOAD TO R2
        // ==================================================

        await env.IMAGES.put(
            avatarKey,
            image,
            {
                httpMetadata: {
                    contentType: contentType,
                    cacheControl:
                        "private, max-age=3600"
                },

                customMetadata: {
                    studentId: String(studentId),
                    type: "student-avatar"
                }
            }
        );


        // ==================================================
        // SAVE R2 KEY IN DATABASE
        // ==================================================

        await env.DB.prepare(`
            UPDATE students
            SET
                avatar_url = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `)
        .bind(
            avatarKey,
            studentId
        )
        .run();


        // ==================================================
        // RESPONSE
        // ==================================================

        return Response.json({

            success: true,

            message:
                "Avatar uploaded successfully.",

            avatar_key:
                avatarKey

        });

    }

    catch (error) {

        console.error(
            "Avatar upload error:",
            error
        );

        return Response.json(
            {
                success: false,
                message:
                    "Unable to upload avatar."
            },
            { status: 500 }
        );

    }

}