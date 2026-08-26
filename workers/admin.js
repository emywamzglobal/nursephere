import jwt from "@tsndr/cloudflare-worker-jwt";
import bcrypt from "bcryptjs";

// ======================================================
// JWT Authentication Helpers
// ======================================================

function getBearerToken(request) {

    const authHeader = request.headers.get("Authorization");

    if (!authHeader || !authHeader.startsWith("Bearer ")) {

        return null;

    }

    return authHeader.substring(7);

}

async function createToken(admin, env) {

    console.log("JWT_SECRET:", typeof env.JWT_SECRET);

    return await jwt.sign(
        {
            id: admin.id,
            email: admin.email,
            role: admin.role,
            exp: Math.floor(Date.now() / 1000) + (60 * 60 * 24)
        },
        env.JWT_SECRET
    );

}

async function verifyToken(request, env) {

    const token = getBearerToken(request);

    if (!token) {

        return null;

    }

    const valid = await jwt.verify(token, env.JWT_SECRET);

    if (!valid) {

        return null;

    }

    const decoded = jwt.decode(token);

    return decoded.payload;

}

async function requireAdmin(request, env) {

    return {
        id: 1,
        role: "super_admin"
    };

}

export default async function adminHandler(request, env) {

    try {

        const url = new URL(request.url);

        const pathname = url.pathname;

        const method = request.method;

        // ======================================================
// ADMIN LOGIN
// POST /api/admin/login
// ======================================================

if (

    method === "POST" &&

    pathname === "/api/admin/login"

) {

    const { email, password } = await request.json();

    if (!email || !password) {

        return Response.json({

            success: false,

            message: "Email and password are required."

        }, {

            status: 400

        });

    }

    const admin = await env.DB.prepare(`

        SELECT

            id,

            first_name,

            last_name,

            email,

            password_hash,

            role,

            status

        FROM admins

        WHERE email = ?

        LIMIT 1

    `)

    .bind(email)

    .first();

    if (!admin) {

        return Response.json({

            success: false,

            message: "Invalid email or password."

        }, {

            status: 401

        });

    }

    if (admin.status !== "active") {

        return Response.json({

            success: false,

            message: "Administrator account is inactive."

        }, {

            status: 403

        });

    }

    const passwordMatches = await bcrypt.compare(

        password,

        admin.password_hash

    );

    if (!passwordMatches) {

        return Response.json({

            success: false,

            message: "Invalid email or password."

        }, {

            status: 401

        });

    }

    const token = "admin-session";

    await env.DB.prepare(`

        UPDATE admins

        SET last_login_at = ?

        WHERE id = ?

    `)

    .bind(

        new Date().toISOString(),

        admin.id

    )

    .run();

    return Response.json({

        success: true,

        token,

        admin: {

            id: admin.id,

            first_name: admin.first_name,

            last_name: admin.last_name,

            email: admin.email,

            role: admin.role

        }

    });

}
// =====================================================
// ADMIN DASHBOARD
// GET /api/admin/dashboard
// =====================================================

if (

    method === "GET" &&

    pathname === "/api/admin/dashboard"

) {

    // -----------------------------------------
    // Total Students
    // -----------------------------------------

    const totalStudents = await env.DB.prepare(`

        SELECT COUNT(*) AS total

        FROM students

    `).first();

    // -----------------------------------------
    // Total Practice Questions
    // -----------------------------------------

    const totalQuestions = await env.DB.prepare(`

        SELECT COUNT(*) AS total

        FROM practice_questions

        WHERE status = 'active'

    `).first();

    // -----------------------------------------
    // Active Subscriptions
    // -----------------------------------------

    const activeSubscriptions = await env.DB.prepare(`

        SELECT COUNT(*) AS total

        FROM subscriptions

        WHERE status = 'active'

    `).first();

    // -----------------------------------------
    // Today's Exam Attempts
    // (Uses exam_attempts table)
    // -----------------------------------------

    let todayAttempts = { total: 0 };

    try {

        todayAttempts = await env.DB.prepare(`

            SELECT COUNT(*) AS total

            FROM exam_attempts

            WHERE DATE(created_at) = DATE('now')

        `).first();

    } catch {

        // Table may not exist yet.

    }

    // -----------------------------------------
    // Unread Notifications
    // -----------------------------------------

    const unreadNotifications = await env.DB.prepare(`

        SELECT COUNT(*) AS total

        FROM notifications

        WHERE is_read = 0

    `).first();

    // -----------------------------------------
    // Recent Activity
    // (Latest Notifications for now)
    // -----------------------------------------

    const { results: recentActivity } = await env.DB.prepare(`

        SELECT

            title,

            message,

            notification_type,

            created_at

        FROM notifications

        ORDER BY created_at DESC

        LIMIT 10

    `).all();

    return Response.json({

        success: true,

        data: {

            admin: {

                first_name: "Administrator",

                last_name: ""

            },

            stats: {

                students: totalStudents?.total || 0,

                questions: totalQuestions?.total || 0,

                today_attempts: todayAttempts?.total || 0,

                active_subscriptions: activeSubscriptions?.total || 0,

                notifications: unreadNotifications?.total || 0

            },

            recent_activity: recentActivity

        }

    });

}

 // =====================================================
// EXAM MANAGEMENT
// =====================================================

// -----------------------------------------
// CONSTANTS
// -----------------------------------------

const EXAM_STATUSES = ["active", "inactive"];

const MAX_EXAM_NAME_LENGTH = 150;
const MAX_EXAM_CODE_LENGTH = 50;
const MAX_EXAM_DESCRIPTION_LENGTH = 2000;
const MAX_URL_LENGTH = 1000;
const MAX_COLOR_LENGTH = 50;


// -----------------------------------------
// HELPERS
// -----------------------------------------

function cleanText(value) {

    return typeof value === "string"
        ? value.trim()
        : "";

}

function cleanCode(value) {

    return cleanText(value).toUpperCase();

}

function validateUrl(value) {

    if (!value) return true;

    if (value.length > MAX_URL_LENGTH) {
        return false;
    }

    try {

        const url = new URL(value);

        return (
            url.protocol === "http:" ||
            url.protocol === "https:"
        );

    }

    catch {

        return false;

    }

}

function validateColor(value) {

    if (!value) return true;

    if (value.length > MAX_COLOR_LENGTH) {
        return false;
    }

    // Supports values such as:
    // #2563EB
    // rgb(...)
    // named colors
    // CSS variables

    return true;

}

function parseDisplayOrder(value) {

    if (
        value === undefined ||
        value === null ||
        value === ""
    ) {

        return 0;

    }

    const number = Number(value);

    if (
        !Number.isInteger(number) ||
        number < 0
    ) {

        return null;

    }

    return number;

}


// =====================================================
// GET ALL EXAMS
// GET /api/admin/exams
// =====================================================

if (

    method === "GET" &&

    pathname === "/api/admin/exams"

) {

    const { results } = await env.DB.prepare(

        `SELECT
            id,
            name,
            code,
            description,
            image_url,
            icon_url,
            color,
            display_order,
            status,
            created_at,
            updated_at
         FROM exams
         ORDER BY
            display_order ASC,
            name COLLATE NOCASE ASC`

    ).all();

    return Response.json({

        success: true,

        message:
            "Exams retrieved successfully.",

        data: results

    });

}


// =====================================================
// GET SINGLE EXAM
// GET /api/admin/exams/:id
// =====================================================

if (

    method === "GET" &&

    /^\/api\/admin\/exams\/[^/]+$/.test(pathname)

) {

    const examId =
        pathname.split("/").pop();

    const exam = await env.DB.prepare(

        `SELECT
            id,
            name,
            code,
            description,
            image_url,
            icon_url,
            color,
            display_order,
            status,
            created_at,
            updated_at
         FROM exams
         WHERE id = ?`

    )

    .bind(examId)

    .first();

    if (!exam) {

        return Response.json({

            success: false,

            message:
                "Exam not found."

        }, {

            status: 404

        });

    }

    return Response.json({

        success: true,

        message:
            "Exam retrieved successfully.",

        data: exam

    });

}


// =====================================================
// CREATE EXAM
// POST /api/admin/exams
// =====================================================

if (

    method === "POST" &&

    pathname === "/api/admin/exams"

) {

    let body;

    try {

        body = await request.json();

    }

    catch {

        return Response.json({

            success: false,

            message:
                "Invalid JSON request body."

        }, {

            status: 400

        });

    }

    const name =
        cleanText(body.name);

    const code =
        cleanCode(body.code);

    const description =
        cleanText(body.description);

    const image_url =
        cleanText(body.image_url);

    const icon_url =
        cleanText(body.icon_url);

    const color =
        cleanText(body.color);

    const display_order =
        parseDisplayOrder(
            body.display_order
        );


    // -----------------------------------------
    // VALIDATION
    // -----------------------------------------

    if (!name) {

        return Response.json({

            success: false,

            message:
                "Exam name is required."

        }, {

            status: 400

        });

    }

    if (
        name.length >
        MAX_EXAM_NAME_LENGTH
    ) {

        return Response.json({

            success: false,

            message:
                `Exam name cannot exceed ${MAX_EXAM_NAME_LENGTH} characters.`

        }, {

            status: 400

        });

    }

    if (!code) {

        return Response.json({

            success: false,

            message:
                "Exam code is required."

        }, {

            status: 400

        });

    }

    if (
        code.length >
        MAX_EXAM_CODE_LENGTH
    ) {

        return Response.json({

            success: false,

            message:
                `Exam code cannot exceed ${MAX_EXAM_CODE_LENGTH} characters.`

        }, {

            status: 400

        });

    }

    if (
        description.length >
        MAX_EXAM_DESCRIPTION_LENGTH
    ) {

        return Response.json({

            success: false,

            message:
                `Description cannot exceed ${MAX_EXAM_DESCRIPTION_LENGTH} characters.`

        }, {

            status: 400

        });

    }

    if (
        display_order === null
    ) {

        return Response.json({

            success: false,

            message:
                "Display order must be a non-negative whole number."

        }, {

            status: 400

        });

    }

    if (!validateUrl(image_url)) {

        return Response.json({

            success: false,

            message:
                "Image URL must be a valid HTTP or HTTPS URL."

        }, {

            status: 400

        });

    }

    if (!validateUrl(icon_url)) {

        return Response.json({

            success: false,

            message:
                "Icon URL must be a valid HTTP or HTTPS URL."

        }, {

            status: 400

        });

    }

    if (!validateColor(color)) {

        return Response.json({

            success: false,

            message:
                "Invalid exam color."

        }, {

            status: 400

        });

    }


    // -----------------------------------------
    // DUPLICATE NAME
    // -----------------------------------------

    const duplicateName =
        await env.DB.prepare(

            `SELECT id
             FROM exams
             WHERE LOWER(TRIM(name)) = LOWER(TRIM(?))
             LIMIT 1`

        )

        .bind(name)

        .first();

    if (duplicateName) {

        return Response.json({

            success: false,

            message:
                "An exam with this name already exists."

        }, {

            status: 409

        });

    }


    // -----------------------------------------
    // DUPLICATE CODE
    // -----------------------------------------

    const duplicateCode =
        await env.DB.prepare(

            `SELECT id
             FROM exams
             WHERE LOWER(TRIM(code)) = LOWER(TRIM(?))
             LIMIT 1`

        )

        .bind(code)

        .first();

    if (duplicateCode) {

        return Response.json({

            success: false,

            message:
                "An exam with this code already exists."

        }, {

            status: 409

        });

    }


    // -----------------------------------------
    // CREATE
    // -----------------------------------------

    const examId =
        crypto.randomUUID();

    const now =
        new Date().toISOString();

    await env.DB.prepare(

        `INSERT INTO exams (
            id,
            name,
            code,
            description,
            image_url,
            icon_url,
            color,
            display_order,
            status,
            created_at,
            updated_at
         )
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`

    )

    .bind(

        examId,
        name,
        code,
        description,
        image_url,
        icon_url,
        color,
        display_order,
        "active",
        now,
        now

    )

    .run();


    return Response.json({

        success: true,

        message:
            "Exam created successfully.",

        data: {

            id: examId

        }

    }, {

        status: 201

    });

}


// =====================================================
// UPDATE EXAM
// PUT /api/admin/exams/:id
// =====================================================

if (

    method === "PUT" &&

    /^\/api\/admin\/exams\/[^/]+$/.test(pathname)

) {

    const examId =
        pathname.split("/").pop();

    let body;

    try {

        body = await request.json();

    }

    catch {

        return Response.json({

            success: false,

            message:
                "Invalid JSON request body."

        }, {

            status: 400

        });

    }


    const name =
        cleanText(body.name);

    const code =
        cleanCode(body.code);

    const description =
        cleanText(body.description);

    const image_url =
        cleanText(body.image_url);

    const icon_url =
        cleanText(body.icon_url);

    const color =
        cleanText(body.color);

    const display_order =
        parseDisplayOrder(
            body.display_order
        );

    const status =
        cleanText(body.status)
            .toLowerCase();


    // -----------------------------------------
    // VALIDATION
    // -----------------------------------------

    if (!name) {

        return Response.json({

            success: false,

            message:
                "Exam name is required."

        }, {

            status: 400

        });

    }

    if (
        name.length >
        MAX_EXAM_NAME_LENGTH
    ) {

        return Response.json({

            success: false,

            message:
                `Exam name cannot exceed ${MAX_EXAM_NAME_LENGTH} characters.`

        }, {

            status: 400

        });

    }

    if (!code) {

        return Response.json({

            success: false,

            message:
                "Exam code is required."

        }, {

            status: 400

        });

    }

    if (
        code.length >
        MAX_EXAM_CODE_LENGTH
    ) {

        return Response.json({

            success: false,

            message:
                `Exam code cannot exceed ${MAX_EXAM_CODE_LENGTH} characters.`

        }, {

            status: 400

        });

    }

    if (
        description.length >
        MAX_EXAM_DESCRIPTION_LENGTH
    ) {

        return Response.json({

            success: false,

            message:
                `Description cannot exceed ${MAX_EXAM_DESCRIPTION_LENGTH} characters.`

        }, {

            status: 400

        });

    }

    if (
        display_order === null
    ) {

        return Response.json({

            success: false,

            message:
                "Display order must be a non-negative whole number."

        }, {

            status: 400

        });

    }

    if (
        !EXAM_STATUSES.includes(status)
    ) {

        return Response.json({

            success: false,

            message:
                "Status must be active or inactive."

        }, {

            status: 400

        });

    }

    if (!validateUrl(image_url)) {

        return Response.json({

            success: false,

            message:
                "Image URL must be a valid HTTP or HTTPS URL."

        }, {

            status: 400

        });

    }

    if (!validateUrl(icon_url)) {

        return Response.json({

            success: false,

            message:
                "Icon URL must be a valid HTTP or HTTPS URL."

        }, {

            status: 400

        });

    }

    if (!validateColor(color)) {

        return Response.json({

            success: false,

            message:
                "Invalid exam color."

        }, {

            status: 400

        });

    }


    // -----------------------------------------
    // VERIFY EXAM
    // -----------------------------------------

    const existingExam =
        await env.DB.prepare(

            `SELECT id
             FROM exams
             WHERE id = ?
             LIMIT 1`

        )

        .bind(examId)

        .first();

    if (!existingExam) {

        return Response.json({

            success: false,

            message:
                "Exam not found."

        }, {

            status: 404

        });

    }


    // -----------------------------------------
    // DUPLICATE NAME
    // -----------------------------------------

    const duplicateName =
        await env.DB.prepare(

            `SELECT id
             FROM exams
             WHERE LOWER(TRIM(name)) = LOWER(TRIM(?))
             AND id <> ?
             LIMIT 1`

        )

        .bind(
            name,
            examId
        )

        .first();

    if (duplicateName) {

        return Response.json({

            success: false,

            message:
                "Another exam already uses this name."

        }, {

            status: 409

        });

    }


    // -----------------------------------------
    // DUPLICATE CODE
    // -----------------------------------------

    const duplicateCode =
        await env.DB.prepare(

            `SELECT id
             FROM exams
             WHERE LOWER(TRIM(code)) = LOWER(TRIM(?))
             AND id <> ?
             LIMIT 1`

        )

        .bind(
            code,
            examId
        )

        .first();

    if (duplicateCode) {

        return Response.json({

            success: false,

            message:
                "Another exam already uses this code."

        }, {

            status: 409

        });

    }


    // -----------------------------------------
    // UPDATE
    // -----------------------------------------

    const now =
        new Date().toISOString();

    await env.DB.prepare(

        `UPDATE exams
         SET
            name = ?,
            code = ?,
            description = ?,
            image_url = ?,
            icon_url = ?,
            color = ?,
            display_order = ?,
            status = ?,
            updated_at = ?
         WHERE id = ?`

    )

    .bind(

        name,
        code,
        description,
        image_url,
        icon_url,
        color,
        display_order,
        status,
        now,
        examId

    )

    .run();


    return Response.json({

        success: true,

        message:
            "Exam updated successfully."

    });

}


// =====================================================
// SOFT DELETE / DEACTIVATE EXAM
// DELETE /api/admin/exams/:id
// =====================================================

if (

    method === "DELETE" &&

    /^\/api\/admin\/exams\/[^/]+$/.test(pathname)

) {

    const examId =
        pathname.split("/").pop();


    // -----------------------------------------
    // VERIFY EXAM
    // -----------------------------------------

    const exam =
        await env.DB.prepare(

            `SELECT
                id,
                name,
                status
             FROM exams
             WHERE id = ?
             LIMIT 1`

        )

        .bind(examId)

        .first();

    if (!exam) {

        return Response.json({

            success: false,

            message:
                "Exam not found."

        }, {

            status: 404

        });

    }


    // -----------------------------------------
    // ALREADY INACTIVE
    // -----------------------------------------

    if (
        exam.status === "inactive"
    ) {

        return Response.json({

            success: true,

            message:
                "Exam is already inactive."

        });

    }


    // -----------------------------------------
    // DEACTIVATE
    // -----------------------------------------

    const now =
        new Date().toISOString();

    await env.DB.prepare(

        `UPDATE exams
         SET
            status = 'inactive',
            updated_at = ?
         WHERE id = ?`

    )

    .bind(

        now,
        examId

    )

    .run();


    return Response.json({

        success: true,

        message:
            "Exam deactivated successfully."

    });

}


// =====================================================
// SUBJECT MANAGEMENT
// =====================================================

// -----------------------------------------
// CONSTANTS
// -----------------------------------------

const SUBJECT_STATUSES = ["active", "inactive"];

const MAX_SUBJECT_NAME_LENGTH = 150;
const MAX_SUBJECT_DESCRIPTION_LENGTH = 2000;
const MAX_SUBJECT_IMAGE_URL_LENGTH = 1000;


// -----------------------------------------
// HELPERS
// -----------------------------------------

function cleanSubjectText(value) {

    return typeof value === "string"
        ? value.trim()
        : "";

}

function validateSubjectImageUrl(value) {

    if (!value) return true;

    if (
        value.length >
        MAX_SUBJECT_IMAGE_URL_LENGTH
    ) {

        return false;

    }

    try {

        const url = new URL(value);

        return (
            url.protocol === "http:" ||
            url.protocol === "https:"
        );

    }

    catch {

        return false;

    }

}

function parseSubjectDisplayOrder(value) {

    if (
        value === undefined ||
        value === null ||
        value === ""
    ) {

        return 0;

    }

    const number = Number(value);

    if (
        !Number.isInteger(number) ||
        number < 0
    ) {

        return null;

    }

    return number;

}


// =====================================================
// GET ALL SUBJECTS
// GET /api/admin/subjects
// =====================================================

if (

    method === "GET" &&

    pathname === "/api/admin/subjects"

) {

    const { results } = await env.DB.prepare(

        `SELECT
            s.id,
            s.exam_id,
            e.name AS exam_name,
            e.code AS exam_code,
            s.name,
            s.description,
            s.image_url,
            s.display_order,
            s.status,
            s.created_at,
            s.updated_at

         FROM subjects s

         INNER JOIN exams e
            ON s.exam_id = e.id

         ORDER BY
            e.display_order ASC,
            e.name COLLATE NOCASE ASC,
            s.display_order ASC,
            s.name COLLATE NOCASE ASC`

    ).all();

    return Response.json({

        success: true,

        message:
            "Subjects retrieved successfully.",

        data: results

    });

}


// =====================================================
// GET SUBJECTS FOR EXAM
// GET /api/admin/subjects?exam_id=...
// =====================================================

if (

    method === "GET" &&

    pathname === "/api/admin/subjects" &&

    url.searchParams.has("exam_id")

) {

    const examId =
        cleanSubjectText(
            url.searchParams.get("exam_id")
        );

    if (!examId) {

        return Response.json({

            success: false,

            message:
                "Exam ID is required."

        }, {

            status: 400

        });

    }

    const { results } = await env.DB.prepare(

        `SELECT
            id,
            exam_id,
            name,
            description,
            image_url,
            display_order,
            status,
            created_at,
            updated_at

         FROM subjects

         WHERE exam_id = ?

         ORDER BY
            display_order ASC,
            name COLLATE NOCASE ASC`

    )

    .bind(examId)

    .all();

    return Response.json({

        success: true,

        message:
            "Subjects retrieved successfully.",

        data: results

    });

}


// =====================================================
// GET SINGLE SUBJECT
// GET /api/admin/subjects/:id
// =====================================================

if (

    method === "GET" &&

    /^\/api\/admin\/subjects\/[^/]+$/.test(pathname)

) {

    const subjectId =
        pathname.split("/").pop();

    const subject = await env.DB.prepare(

        `SELECT
            s.id,
            s.exam_id,
            e.name AS exam_name,
            e.code AS exam_code,
            s.name,
            s.description,
            s.image_url,
            s.display_order,
            s.status,
            s.created_at,
            s.updated_at

         FROM subjects s

         INNER JOIN exams e
            ON s.exam_id = e.id

         WHERE s.id = ?`

    )

    .bind(subjectId)

    .first();

    if (!subject) {

        return Response.json({

            success: false,

            message:
                "Subject not found."

        }, {

            status: 404

        });

    }

    return Response.json({

        success: true,

        message:
            "Subject retrieved successfully.",

        data: subject

    });

}


// =====================================================
// CREATE SUBJECT
// POST /api/admin/subjects
// =====================================================

if (

    method === "POST" &&

    pathname === "/api/admin/subjects"

) {

    let body;

    try {

        body = await request.json();

    }

    catch {

        return Response.json({

            success: false,

            message:
                "Invalid JSON request body."

        }, {

            status: 400

        });

    }

    const exam_id =
        cleanSubjectText(body.exam_id);

    const name =
        cleanSubjectText(body.name);

    const description =
        cleanSubjectText(body.description);

    const image_url =
        cleanSubjectText(body.image_url);

    const display_order =
        parseSubjectDisplayOrder(
            body.display_order
        );


    // -----------------------------------------
    // VALIDATION
    // -----------------------------------------

    if (!exam_id) {

        return Response.json({

            success: false,

            message:
                "Please select an exam."

        }, {

            status: 400

        });

    }

    if (!name) {

        return Response.json({

            success: false,

            message:
                "Subject name is required."

        }, {

            status: 400

        });

    }

    if (
        name.length >
        MAX_SUBJECT_NAME_LENGTH
    ) {

        return Response.json({

            success: false,

            message:
                `Subject name cannot exceed ${MAX_SUBJECT_NAME_LENGTH} characters.`

        }, {

            status: 400

        });

    }

    if (
        description.length >
        MAX_SUBJECT_DESCRIPTION_LENGTH
    ) {

        return Response.json({

            success: false,

            message:
                `Description cannot exceed ${MAX_SUBJECT_DESCRIPTION_LENGTH} characters.`

        }, {

            status: 400

        });

    }

    if (
        display_order === null
    ) {

        return Response.json({

            success: false,

            message:
                "Display order must be a non-negative whole number."

        }, {

            status: 400

        });

    }

    if (
        !validateSubjectImageUrl(image_url)
    ) {

        return Response.json({

            success: false,

            message:
                "Image URL must be a valid HTTP or HTTPS URL."

        }, {

            status: 400

        });

    }


    // -----------------------------------------
    // VERIFY ACTIVE EXAM
    // -----------------------------------------

    const exam = await env.DB.prepare(

        `SELECT
            id,
            name,
            status

         FROM exams

         WHERE id = ?

         LIMIT 1`

    )

    .bind(exam_id)

    .first();

    if (!exam) {

        return Response.json({

            success: false,

            message:
                "Selected exam does not exist."

        }, {

            status: 404

        });

    }

    if (
        exam.status !== "active"
    ) {

        return Response.json({

            success: false,

            message:
                "Subjects can only be created under an active exam."

        }, {

            status: 409

        });

    }


    // -----------------------------------------
    // DUPLICATE SUBJECT
    // -----------------------------------------

    const duplicate =
        await env.DB.prepare(

            `SELECT id

             FROM subjects

             WHERE exam_id = ?

             AND LOWER(TRIM(name))
                 = LOWER(TRIM(?))

             LIMIT 1`

        )

        .bind(

            exam_id,
            name

        )

        .first();

    if (duplicate) {

        return Response.json({

            success: false,

            message:
                "This subject already exists under the selected exam."

        }, {

            status: 409

        });

    }


    // -----------------------------------------
    // CREATE
    // -----------------------------------------

    const subjectId =
        crypto.randomUUID();

    const now =
        new Date().toISOString();

    await env.DB.prepare(

        `INSERT INTO subjects (
            id,
            exam_id,
            name,
            description,
            image_url,
            display_order,
            status,
            created_at,
            updated_at
         )

         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`

    )

    .bind(

        subjectId,
        exam_id,
        name,
        description,
        image_url,
        display_order,
        "active",
        now,
        now

    )

    .run();

    return Response.json({

        success: true,

        message:
            "Subject created successfully.",

        data: {

            id: subjectId

        }

    }, {

        status: 201

    });

}


// =====================================================
// UPDATE SUBJECT
// PUT /api/admin/subjects/:id
// =====================================================

if (

    method === "PUT" &&

    /^\/api\/admin\/subjects\/[^/]+$/.test(pathname)

) {

    const subjectId =
        pathname.split("/").pop();

    let body;

    try {

        body = await request.json();

    }

    catch {

        return Response.json({

            success: false,

            message:
                "Invalid JSON request body."

        }, {

            status: 400

        });

    }

    const exam_id =
        cleanSubjectText(body.exam_id);

    const name =
        cleanSubjectText(body.name);

    const description =
        cleanSubjectText(body.description);

    const image_url =
        cleanSubjectText(body.image_url);

    const display_order =
        parseSubjectDisplayOrder(
            body.display_order
        );

    const status =
        cleanSubjectText(body.status)
            .toLowerCase();


    // -----------------------------------------
    // VALIDATION
    // -----------------------------------------

    if (!exam_id) {

        return Response.json({

            success: false,

            message:
                "Please select an exam."

        }, {

            status: 400

        });

    }

    if (!name) {

        return Response.json({

            success: false,

            message:
                "Subject name is required."

        }, {

            status: 400

        });

    }

    if (
        name.length >
        MAX_SUBJECT_NAME_LENGTH
    ) {

        return Response.json({

            success: false,

            message:
                `Subject name cannot exceed ${MAX_SUBJECT_NAME_LENGTH} characters.`

        }, {

            status: 400

        });

    }

    if (
        description.length >
        MAX_SUBJECT_DESCRIPTION_LENGTH
    ) {

        return Response.json({

            success: false,

            message:
                `Description cannot exceed ${MAX_SUBJECT_DESCRIPTION_LENGTH} characters.`

        }, {

            status: 400

        });

    }

    if (
        display_order === null
    ) {

        return Response.json({

            success: false,

            message:
                "Display order must be a non-negative whole number."

        }, {

            status: 400

        });

    }

    if (
        !SUBJECT_STATUSES.includes(status)
    ) {

        return Response.json({

            success: false,

            message:
                "Status must be active or inactive."

        }, {

            status: 400

        });

    }

    if (
        !validateSubjectImageUrl(image_url)
    ) {

        return Response.json({

            success: false,

            message:
                "Image URL must be a valid HTTP or HTTPS URL."

        }, {

            status: 400

        });

    }


    // -----------------------------------------
    // VERIFY SUBJECT
    // -----------------------------------------

    const existingSubject =
        await env.DB.prepare(

            `SELECT id

             FROM subjects

             WHERE id = ?

             LIMIT 1`

        )

        .bind(subjectId)

        .first();

    if (!existingSubject) {

        return Response.json({

            success: false,

            message:
                "Subject not found."

        }, {

            status: 404

        });

    }


    // -----------------------------------------
    // VERIFY ACTIVE EXAM
    // -----------------------------------------

    const exam =
        await env.DB.prepare(

            `SELECT
                id,
                status

             FROM exams

             WHERE id = ?

             LIMIT 1`

        )

        .bind(exam_id)

        .first();

    if (!exam) {

        return Response.json({

            success: false,

            message:
                "Selected exam does not exist."

        }, {

            status: 404

        });

    }

    if (
        exam.status !== "active"
    ) {

        return Response.json({

            success: false,

            message:
                "Subjects can only belong to an active exam."

        }, {

            status: 409

        });

    }


    // -----------------------------------------
    // DUPLICATE SUBJECT
    // -----------------------------------------

    const duplicate =
        await env.DB.prepare(

            `SELECT id

             FROM subjects

             WHERE exam_id = ?

             AND LOWER(TRIM(name))
                 = LOWER(TRIM(?))

             AND id <> ?

             LIMIT 1`

        )

        .bind(

            exam_id,
            name,
            subjectId

        )

        .first();

    if (duplicate) {

        return Response.json({

            success: false,

            message:
                "Another subject with this name already exists under the selected exam."

        }, {

            status: 409

        });

    }


    // -----------------------------------------
    // UPDATE
    // -----------------------------------------

    const now =
        new Date().toISOString();

    await env.DB.prepare(

        `UPDATE subjects

         SET
            exam_id = ?,
            name = ?,
            description = ?,
            image_url = ?,
            display_order = ?,
            status = ?,
            updated_at = ?

         WHERE id = ?`

    )

    .bind(

        exam_id,
        name,
        description,
        image_url,
        display_order,
        status,
        now,
        subjectId

    )

    .run();

    return Response.json({

        success: true,

        message:
            "Subject updated successfully."

    });

}


// =====================================================
// SOFT DELETE / DEACTIVATE SUBJECT
// DELETE /api/admin/subjects/:id
// =====================================================

if (

    method === "DELETE" &&

    /^\/api\/admin\/subjects\/[^/]+$/.test(pathname)

) {

    const subjectId =
        pathname.split("/").pop();


    // -----------------------------------------
    // VERIFY SUBJECT
    // -----------------------------------------

    const subject =
        await env.DB.prepare(

            `SELECT
                id,
                name,
                status

             FROM subjects

             WHERE id = ?

             LIMIT 1`

        )

        .bind(subjectId)

        .first();

    if (!subject) {

        return Response.json({

            success: false,

            message:
                "Subject not found."

        }, {

            status: 404

        });

    }


    // -----------------------------------------
    // ALREADY INACTIVE
    // -----------------------------------------

    if (
        subject.status === "inactive"
    ) {

        return Response.json({

            success: true,

            message:
                "Subject is already inactive."

        });

    }


    // -----------------------------------------
    // DEACTIVATE
    // -----------------------------------------

    const now =
        new Date().toISOString();

    await env.DB.prepare(

        `UPDATE subjects

         SET
            status = 'inactive',
            updated_at = ?

         WHERE id = ?`

    )

    .bind(

        now,
        subjectId

    )

    .run();

    return Response.json({

        success: true,

        message:
            "Subject deactivated successfully."

    });

}

/*
=========================================================
    PRACTICE QUESTION MANAGEMENT
=========================================================

    RELATIONSHIP:

        EXAM
          ↓
        SUBJECT
          ↓
        PRACTICE QUESTION

    practice_questions stores subject_id.
    exam_id is derived through subjects.exam_id.

    Endpoints:

        GET    /api/admin/questions
        GET    /api/admin/questions/:id
        POST   /api/admin/questions
        PUT    /api/admin/questions/:id
        DELETE /api/admin/questions/:id

=========================================================
*/


/*=========================================================
    CONSTANTS
=========================================================*/

const QUESTION_STATUSES = [
    "active",
    "inactive"
];

const QUESTION_DIFFICULTIES = [
    "easy",
    "medium",
    "hard"
];

const VALID_QUESTION_ANSWERS = [
    "A",
    "B",
    "C",
    "D"
];

const MAX_QUESTION_LENGTH = 10000;
const MAX_OPTION_LENGTH = 2000;
const MAX_EXPLANATION_LENGTH = 10000;
const MAX_IMAGE_URL_LENGTH = 1000;


/*=========================================================
    HELPERS
=========================================================*/

function cleanQuestionText(value) {

    return typeof value === "string"
        ? value.trim()
        : "";

}


function validateQuestionImageUrl(value) {

    if (!value) {

        return true;

    }


    if (
        value.length >
        MAX_IMAGE_URL_LENGTH
    ) {

        return false;

    }


    try {

        const url =
            new URL(value);


        return (

            url.protocol === "http:" ||

            url.protocol === "https:"

        );

    }

    catch {

        return false;

    }

}


/*=========================================================
    JSON ERROR HELPER
=========================================================*/

function questionError(

    message,

    status = 400

) {

    return Response.json({

        success: false,

        message

    }, {

        status

    });

}


/*=========================================================
    VERIFY EXAM + SUBJECT RELATIONSHIP
=========================================================

    This is the central relationship check.

    It guarantees:

        submitted exam_id
                ↓
        submitted subject_id
                ↓
        subject.exam_id

    all match.

=========================================================*/

async function verifyQuestionPlacement(

    env,

    examId,

    subjectId

) {

    if (!examId) {

        return {

            ok: false,

            response:
                questionError(
                    "Please select an exam.",
                    400
                )

        };

    }


    if (!subjectId) {

        return {

            ok: false,

            response:
                questionError(
                    "Please select a subject.",
                    400
                )

        };

    }


    const subject =
        await env.DB.prepare(

            `SELECT

                s.id,
                s.exam_id,
                s.status AS subject_status,

                e.id AS exam_id,
                e.status AS exam_status

             FROM subjects s

             INNER JOIN exams e

                ON s.exam_id = e.id

             WHERE s.id = ?

             LIMIT 1`

        )

        .bind(subjectId)

        .first();


    if (!subject) {

        return {

            ok: false,

            response:
                questionError(
                    "Selected subject does not exist.",
                    404
                )

        };

    }


    /*
    -----------------------------------------------------
        CRITICAL RELATIONSHIP CHECK
    -----------------------------------------------------
    */

    if (

        String(subject.exam_id) !==
        String(examId)

    ) {

        return {

            ok: false,

            response:
                questionError(

                    "Selected subject does not belong to the selected exam.",

                    409

                )

        };

    }


    if (
        subject.subject_status !== "active"
    ) {

        return {

            ok: false,

            response:
                questionError(

                    "Practice questions can only be added to an active subject.",

                    409

                )

        };

    }


    if (
        subject.exam_status !== "active"
    ) {

        return {

            ok: false,

            response:
                questionError(

                    "The selected subject belongs to an inactive exam.",

                    409

                )

        };

    }


    return {

        ok: true,

        subject

    };

}


/*=========================================================
    VALIDATE QUESTION DATA
=========================================================*/

function validateQuestionData(

    data,

    isCreate = true

) {

    const errors = [];


    if (
        isCreate &&
        !data.exam_id
    ) {

        errors.push(
            "Please select an exam."
        );

    }


    if (!data.subject_id) {

        errors.push(
            "Please select a subject."
        );

    }


    if (!data.question) {

        errors.push(
            "Question is required."
        );

    }

    else if (
        data.question.length >
        MAX_QUESTION_LENGTH
    ) {

        errors.push(

            `Question cannot exceed ${MAX_QUESTION_LENGTH} characters.`

        );

    }


    if (
        !data.option_a ||
        !data.option_b ||
        !data.option_c ||
        !data.option_d
    ) {

        errors.push(
            "All answer options are required."
        );

    }


    if (

        data.option_a.length >
        MAX_OPTION_LENGTH ||

        data.option_b.length >
        MAX_OPTION_LENGTH ||

        data.option_c.length >
        MAX_OPTION_LENGTH ||

        data.option_d.length >
        MAX_OPTION_LENGTH

    ) {

        errors.push(

            `Answer options cannot exceed ${MAX_OPTION_LENGTH} characters.`

        );

    }


    if (
        !VALID_QUESTION_ANSWERS.includes(
            data.correct_answer
        )
    ) {

        errors.push(
            "Correct answer must be A, B, C or D."
        );

    }


    if (
        !QUESTION_DIFFICULTIES.includes(
            data.difficulty
        )
    ) {

        errors.push(
            "Difficulty must be easy, medium or hard."
        );

    }


    if (
        data.explanation.length >
        MAX_EXPLANATION_LENGTH
    ) {

        errors.push(

            `Explanation cannot exceed ${MAX_EXPLANATION_LENGTH} characters.`

        );

    }


    if (
        !validateQuestionImageUrl(
            data.image_url
        )
    ) {

        errors.push(
            "Image URL must be a valid HTTP or HTTPS URL."
        );

    }


    if (
        errors.length
    ) {

        return {

            ok: false,

            response:
                Response.json({

                    success: false,

                    message:
                        errors[0],

                    errors

                }, {

                    status: 400

                })

        };

    }


    return {

        ok: true

    };

}


/*=========================================================
    GET ALL QUESTIONS
=========================================================*/

if (

    method === "GET" &&

    pathname === "/api/admin/questions"

) {

    try {

        const { results } =

            await env.DB.prepare(

                `SELECT

                    q.id,

                    q.subject_id,

                    s.name AS subject_name,

                    s.exam_id,

                    e.name AS exam_name,
                    e.code AS exam_code,

                    q.question,
                    q.image_url,

                    q.option_a,
                    q.option_b,
                    q.option_c,
                    q.option_d,

                    q.correct_answer,
                    q.explanation,
                    q.difficulty,
                    q.status,

                    q.created_at,
                    q.updated_at

                 FROM practice_questions q

                 INNER JOIN subjects s

                    ON q.subject_id = s.id

                 INNER JOIN exams e

                    ON s.exam_id = e.id

                 ORDER BY

                    e.display_order ASC,

                    e.name COLLATE NOCASE ASC,

                    s.display_order ASC,

                    s.name COLLATE NOCASE ASC,

                    q.created_at DESC`

            )

            .all();


        return Response.json({

            success: true,

            message:
                "Practice questions retrieved successfully.",

            data:
                results || []

        });

    }

    catch (error) {

        console.error(
            "GET QUESTIONS:",
            error
        );


        return questionError(

            "Failed to retrieve practice questions.",

            500

        );

    }

}


/*=========================================================
    GET SINGLE QUESTION
=========================================================*/

if (

    method === "GET" &&

    /^\/api\/admin\/questions\/[^/]+$/.test(
        pathname
    )

) {

    const questionId =
        pathname.split("/").pop();


    try {

        const question =
            await env.DB.prepare(

                `SELECT

                    q.id,

                    q.subject_id,

                    s.name AS subject_name,

                    s.exam_id,

                    e.name AS exam_name,
                    e.code AS exam_code,

                    q.question,
                    q.image_url,

                    q.option_a,
                    q.option_b,
                    q.option_c,
                    q.option_d,

                    q.correct_answer,
                    q.explanation,
                    q.difficulty,
                    q.status,

                    q.created_at,
                    q.updated_at

                 FROM practice_questions q

                 INNER JOIN subjects s

                    ON q.subject_id = s.id

                 INNER JOIN exams e

                    ON s.exam_id = e.id

                 WHERE q.id = ?

                 LIMIT 1`

            )

            .bind(questionId)

            .first();


        if (!question) {

            return questionError(

                "Practice question not found.",

                404

            );

        }


        return Response.json({

            success: true,

            message:
                "Practice question retrieved successfully.",

            data:
                question

        });

    }

    catch (error) {

        console.error(
            "GET QUESTION:",
            error
        );


        return questionError(

            "Failed to retrieve practice question.",

            500

        );

    }

}


/*=========================================================
    CREATE QUESTION
=========================================================*/

if (

    method === "POST" &&

    pathname === "/api/admin/questions"

) {

    let body;


    try {

        body =
            await request.json();

    }

    catch {

        return questionError(

            "Invalid JSON request body.",

            400

        );

    }


    body =
        body || {};


    const data = {

        exam_id:
            cleanQuestionText(
                body.exam_id
            ),

        subject_id:
            cleanQuestionText(
                body.subject_id
            ),

        question:
            cleanQuestionText(
                body.question
            ),

        image_url:
            cleanQuestionText(
                body.image_url
            ),

        option_a:
            cleanQuestionText(
                body.option_a
            ),

        option_b:
            cleanQuestionText(
                body.option_b
            ),

        option_c:
            cleanQuestionText(
                body.option_c
            ),

        option_d:
            cleanQuestionText(
                body.option_d
            ),

        correct_answer:
            cleanQuestionText(
                body.correct_answer
            ).toUpperCase(),

        explanation:
            cleanQuestionText(
                body.explanation
            ),

        difficulty:
            cleanQuestionText(
                body.difficulty ||
                "medium"
            ).toLowerCase()

    };


    /*
    -----------------------------------------------------
        VALIDATE DATA
    -----------------------------------------------------
    */

    const validation =
        validateQuestionData(
            data,
            true
        );


    if (!validation.ok) {

        return validation.response;

    }


    try {

        /*
        -------------------------------------------------
            VERIFY:

                EXAM
                  ↓
                SUBJECT
        -------------------------------------------------
        */

        const placement =
            await verifyQuestionPlacement(

                env,

                data.exam_id,

                data.subject_id

            );


        if (!placement.ok) {

            return placement.response;

        }


        /*
        -------------------------------------------------
            DUPLICATE CHECK
        -------------------------------------------------
        */

        const duplicate =
            await env.DB.prepare(

                `SELECT id

                 FROM practice_questions

                 WHERE subject_id = ?

                 AND LOWER(TRIM(question))
                     = LOWER(TRIM(?))

                 LIMIT 1`

            )

            .bind(

                data.subject_id,

                data.question

            )

            .first();


        if (duplicate) {

            return questionError(

                "This question already exists for the selected subject.",

                409

            );

        }


        /*
        -------------------------------------------------
            CREATE
        -------------------------------------------------
        */

        const questionId =
            crypto.randomUUID();

        const now =
            new Date().toISOString();


        await env.DB.prepare(

            `INSERT INTO practice_questions (

                id,
                subject_id,

                question,
                image_url,

                option_a,
                option_b,
                option_c,
                option_d,

                correct_answer,
                explanation,
                difficulty,
                status,

                created_at,
                updated_at

            )

            VALUES (
                ?, ?, ?, ?, ?, ?, ?, ?,
                ?, ?, ?, ?, ?, ?
            )`

        )

        .bind(

            questionId,

            data.subject_id,

            data.question,

            data.image_url,

            data.option_a,
            data.option_b,
            data.option_c,
            data.option_d,

            data.correct_answer,

            data.explanation,

            data.difficulty,

            "active",

            now,
            now

        )

        .run();


        return Response.json({

            success: true,

            message:
                "Practice question created successfully.",

            data: {

                id:
                    questionId,

                exam_id:
                    data.exam_id,

                subject_id:
                    data.subject_id

            }

        }, {

            status: 201

        });

    }

    catch (error) {

        console.error(
            "CREATE QUESTION:",
            error
        );


        return questionError(

            "Failed to create practice question.",

            500

        );

    }

}


/*=========================================================
    UPDATE QUESTION
=========================================================*/

if (

    method === "PUT" &&

    /^\/api\/admin\/questions\/[^/]+$/.test(
        pathname
    )

) {

    const questionId =
        pathname.split("/").pop();


    let body;


    try {

        body =
            await request.json();

    }

    catch {

        return questionError(

            "Invalid JSON request body.",

            400

        );

    }


    body =
        body || {};


    const data = {

        /*
            UPDATE now accepts exam_id too.

            This makes the relationship explicit
            from the admin UI.
        */

        exam_id:
            cleanQuestionText(
                body.exam_id
            ),

        subject_id:
            cleanQuestionText(
                body.subject_id
            ),

        question:
            cleanQuestionText(
                body.question
            ),

        image_url:
            cleanQuestionText(
                body.image_url
            ),

        option_a:
            cleanQuestionText(
                body.option_a
            ),

        option_b:
            cleanQuestionText(
                body.option_b
            ),

        option_c:
            cleanQuestionText(
                body.option_c
            ),

        option_d:
            cleanQuestionText(
                body.option_d
            ),

        correct_answer:
            cleanQuestionText(
                body.correct_answer
            ).toUpperCase(),

        explanation:
            cleanQuestionText(
                body.explanation
            ),

        difficulty:
            cleanQuestionText(
                body.difficulty ||
                "medium"
            ).toLowerCase(),

        status:
            cleanQuestionText(
                body.status ||
                "active"
            ).toLowerCase()

    };


    /*
    -----------------------------------------------------
        QUESTION MUST EXIST
    -----------------------------------------------------
    */

    let existingQuestion;


    try {

        existingQuestion =
            await env.DB.prepare(

                `SELECT
                    id,
                    subject_id

                 FROM practice_questions

                 WHERE id = ?

                 LIMIT 1`

            )

            .bind(questionId)

            .first();

    }

    catch (error) {

        console.error(
            "FIND QUESTION FOR UPDATE:",
            error
        );


        return questionError(

            "Failed to find practice question.",

            500

        );

    }


    if (!existingQuestion) {

        return questionError(

            "Practice question not found.",

            404

        );

    }


    /*
    -----------------------------------------------------
        UPDATE VALIDATION

        exam_id is required so the admin cannot
        accidentally move a question to a subject
        without specifying the exam relationship.
    -----------------------------------------------------
    */

    const validation =
        validateQuestionData(
            data,
            true
        );


    if (!validation.ok) {

        return validation.response;

    }


    if (
        !QUESTION_STATUSES.includes(
            data.status
        )
    ) {

        return questionError(

            "Status must be active or inactive.",

            400

        );

    }


    try {

        /*
        -------------------------------------------------
            VERIFY NEW EXAM + SUBJECT RELATIONSHIP
        -------------------------------------------------
        */

        const placement =
            await verifyQuestionPlacement(

                env,

                data.exam_id,

                data.subject_id

            );


        if (!placement.ok) {

            return placement.response;

        }


        /*
        -------------------------------------------------
            DUPLICATE CHECK

            Exclude current question.
        -------------------------------------------------
        */

        const duplicate =
            await env.DB.prepare(

                `SELECT id

                 FROM practice_questions

                 WHERE subject_id = ?

                 AND LOWER(TRIM(question))
                     = LOWER(TRIM(?))

                 AND id <> ?

                 LIMIT 1`

            )

            .bind(

                data.subject_id,

                data.question,

                questionId

            )

            .first();


        if (duplicate) {

            return questionError(

                "Another identical question already exists for this subject.",

                409

            );

        }


        /*
        -------------------------------------------------
            UPDATE
        -------------------------------------------------
        */

        const now =
            new Date().toISOString();


        await env.DB.prepare(

            `UPDATE practice_questions

             SET

                subject_id = ?,

                question = ?,
                image_url = ?,

                option_a = ?,
                option_b = ?,
                option_c = ?,
                option_d = ?,

                correct_answer = ?,
                explanation = ?,

                difficulty = ?,
                status = ?,

                updated_at = ?

             WHERE id = ?`

        )

        .bind(

            data.subject_id,

            data.question,

            data.image_url,

            data.option_a,
            data.option_b,
            data.option_c,
            data.option_d,

            data.correct_answer,

            data.explanation,

            data.difficulty,

            data.status,

            now,

            questionId

        )

        .run();


        return Response.json({

            success: true,

            message:
                "Practice question updated successfully.",

            data: {

                id:
                    questionId,

                exam_id:
                    data.exam_id,

                subject_id:
                    data.subject_id

            }

        });

    }

    catch (error) {

        console.error(
            "UPDATE QUESTION:",
            error
        );


        return questionError(

            "Failed to update practice question.",

            500

        );

    }

}


/*=========================================================
    SOFT DELETE QUESTION
=========================================================*/

if (

    method === "DELETE" &&

    /^\/api\/admin\/questions\/[^/]+$/.test(
        pathname
    )

) {

    const questionId =
        pathname.split("/").pop();


    try {

        const question =
            await env.DB.prepare(

                `SELECT

                    id,
                    status

                 FROM practice_questions

                 WHERE id = ?

                 LIMIT 1`

            )

            .bind(questionId)

            .first();


        if (!question) {

            return questionError(

                "Practice question not found.",

                404

            );

        }


        if (
            question.status === "inactive"
        ) {

            return Response.json({

                success: true,

                message:
                    "Practice question is already inactive."

            });

        }


        const now =
            new Date().toISOString();


        await env.DB.prepare(

            `UPDATE practice_questions

             SET

                status = 'inactive',

                updated_at = ?

             WHERE id = ?`

        )

        .bind(

            now,

            questionId

        )

        .run();


        return Response.json({

            success: true,

            message:
                "Practice question deactivated successfully."

        });

    }

    catch (error) {

        console.error(
            "DELETE QUESTION:",
            error
        );


        return questionError(

            "Failed to deactivate practice question.",

            500

        );

    }

}

// =====================================================
// STUDY RESOURCE MANAGEMENT
// Production-ready CRUD layer
// =====================================================


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


// =====================================================
// HELPERS
// =====================================================

function normalizeText(value) {

    return String(value ?? "")
        .trim();

}


function normalizeFileType(value) {

    return String(value ?? "")
        .trim()
        .toLowerCase();

}


function normalizeStatus(value) {

    return String(value ?? "")
        .trim()
        .toLowerCase();

}


function resourceJson(
    success,
    message,
    data = null,
    status = 200
) {

    const body = {
        success,
        message
    };

    if (data !== null) {

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


async function readJsonBody(request) {

    try {

        return await request.json();

    } catch {

        return null;

    }

}


// =====================================================
// GET ALL STUDY RESOURCES
// GET /api/admin/resources
// =====================================================

if (

    method === "GET" &&

    pathname === "/api/admin/resources"

) {

    try {

        const { results } =
            await env.DB.prepare(

                `SELECT

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
                    ON r.subject_id = s.id

                INNER JOIN exams e
                    ON s.exam_id = e.id

                ORDER BY

                    e.display_order ASC,

                    s.display_order ASC,

                    r.created_at DESC`

            )
            .all();


        return resourceJson(

            true,

            "Study resources retrieved successfully.",

            results || [],

            200

        );

    } catch (error) {

        console.error(
            "GET study resources failed:",
            error
        );

        return resourceJson(

            false,

            "Failed to retrieve study resources.",

            null,

            500

        );

    }

}


// =====================================================
// GET SINGLE STUDY RESOURCE
// GET /api/admin/resources/:id
// =====================================================

if (

    method === "GET" &&

    pathname.startsWith(
        "/api/admin/resources/"
    ) &&

    !pathname.endsWith("/status")

) {

    const resourceId =
        pathname
            .split("/")
            .filter(Boolean)
            .pop();


    if (!resourceId) {

        return resourceJson(

            false,

            "Study resource ID is required.",

            null,

            400

        );

    }


    try {

        const resource =
            await env.DB.prepare(

                `SELECT

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
                    ON r.subject_id = s.id

                INNER JOIN exams e
                    ON s.exam_id = e.id

                WHERE r.id = ?

                LIMIT 1`

            )
            .bind(resourceId)
            .first();


        if (!resource) {

            return resourceJson(

                false,

                "Study resource not found.",

                null,

                404

            );

        }


        return resourceJson(

            true,

            "Study resource retrieved successfully.",

            resource,

            200

        );

    } catch (error) {

        console.error(
            "GET single study resource failed:",
            error
        );

        return resourceJson(

            false,

            "Failed to retrieve the study resource.",

            null,

            500

        );

    }

}


// =====================================================
// ADD STUDY RESOURCE
// POST /api/admin/resources
//
// IMPORTANT:
// This endpoint creates the D1 record.
// The actual R2 upload will be handled by the
// dedicated upload pipeline we connect next.
//
// file_url must therefore be a valid stored URL.
// =====================================================

if (

    method === "POST" &&

    pathname === "/api/admin/resources"

) {

    const body =
        await readJsonBody(request);


    if (!body) {

        return resourceJson(

            false,

            "Invalid JSON request body.",

            null,

            400

        );

    }


    const subjectId =
        normalizeText(body.subject_id);

    const title =
        normalizeText(body.title);

    const author =
        normalizeText(body.author);

    const description =
        normalizeText(body.description);

    const fileUrl =
        normalizeText(body.file_url);

    const coverImage =
        normalizeText(body.cover_image);

    const fileType =
        normalizeFileType(body.file_type);


    // -----------------------------------------
    // REQUIRED FIELDS
    // -----------------------------------------

    if (!subjectId) {

        return resourceJson(

            false,

            "Please select a subject.",

            null,

            400

        );

    }


    if (!title) {

        return resourceJson(

            false,

            "Resource title is required.",

            null,

            400

        );

    }


    if (!author) {

        return resourceJson(

            false,

            "Book author is required.",

            null,

            400

        );

    }


    // -----------------------------------------
    // FILE URL
    // -----------------------------------------

    if (!fileUrl) {

        return resourceJson(

            false,

            "Study resource file URL is required.",

            null,

            400

        );

    }


    // -----------------------------------------
    // FILE TYPE
    // -----------------------------------------

    if (

        !fileType ||

        !STUDY_RESOURCE_FILE_TYPES.includes(
            fileType
        )

    ) {

        return resourceJson(

            false,

            "Invalid study resource file type.",

            null,

            400

        );

    }


    // -----------------------------------------
    // VERIFY SUBJECT
    //
    // The exam is deliberately NOT accepted
    // from the browser.
    //
    // The exam is derived from the database.
    // -----------------------------------------

    try {

        const subject =
            await env.DB.prepare(

                `SELECT

                    s.id,

                    s.exam_id,

                    s.status AS subject_status,

                    e.status AS exam_status

                FROM subjects s

                INNER JOIN exams e
                    ON s.exam_id = e.id

                WHERE s.id = ?

                LIMIT 1`

            )
            .bind(subjectId)
            .first();


        if (!subject) {

            return resourceJson(

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

            return resourceJson(

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

            return resourceJson(

                false,

                "The examination associated with this subject is inactive.",

                null,

                409

            );

        }


        // -----------------------------------------
        // DUPLICATE TITLE
        // -----------------------------------------

        const duplicate =
            await env.DB.prepare(

                `SELECT id

                FROM study_resources

                WHERE subject_id = ?

                AND LOWER(title) = LOWER(?)

                LIMIT 1`

            )
            .bind(

                subjectId,

                title

            )
            .first();


        if (duplicate) {

            return resourceJson(

                false,

                "A study resource with this title already exists for this subject.",

                null,

                409

            );

        }


        // -----------------------------------------
        // CREATE RESOURCE
        // -----------------------------------------

        const resourceId =
            crypto.randomUUID();

        const now =
            new Date().toISOString();


        await env.DB.prepare(

            `INSERT INTO study_resources (

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

            )`

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


        return resourceJson(

            true,

            "Study resource created successfully.",

            {
                id: resourceId
            },

            201

        );

    } catch (error) {

        console.error(
            "CREATE study resource failed:",
            error
        );

        return resourceJson(

            false,

            "Failed to create the study resource.",

            null,

            500

        );

    }

}


// =====================================================
// UPDATE STUDY RESOURCE
// PUT /api/admin/resources/:id
//
// Metadata can be changed without replacing the
// existing R2 files.
//
// R2 replacement will be handled separately.
// =====================================================

if (

    method === "PUT" &&

    pathname.startsWith(
        "/api/admin/resources/"
    ) &&

    !pathname.endsWith("/status")

) {

    const resourceId =
        pathname
            .split("/")
            .filter(Boolean)
            .pop();


    if (!resourceId) {

        return resourceJson(

            false,

            "Study resource ID is required.",

            null,

            400

        );

    }


    const body =
        await readJsonBody(request);


    if (!body) {

        return resourceJson(

            false,

            "Invalid JSON request body.",

            null,

            400

        );

    }


    const subjectId =
        normalizeText(body.subject_id);

    const title =
        normalizeText(body.title);

    const author =
        normalizeText(body.author);

    const description =
        normalizeText(body.description);

    const fileUrl =
        normalizeText(body.file_url);

    const coverImage =
        normalizeText(body.cover_image);

    const fileType =
        normalizeFileType(body.file_type);

    const status =
        normalizeStatus(
            body.status || "active"
        );


    // -----------------------------------------
    // VALIDATION
    // -----------------------------------------

    if (!subjectId) {

        return resourceJson(

            false,

            "Please select a subject.",

            null,

            400

        );

    }


    if (!title) {

        return resourceJson(

            false,

            "Resource title is required.",

            null,

            400

        );

    }


    if (!author) {

        return resourceJson(

            false,

            "Book author is required.",

            null,

            400

        );

    }


    if (!fileUrl) {

        return resourceJson(

            false,

            "Study resource file URL is required.",

            null,

            400

        );

    }


    if (

        !STUDY_RESOURCE_FILE_TYPES.includes(
            fileType
        )

    ) {

        return resourceJson(

            false,

            "Invalid study resource file type.",

            null,

            400

        );

    }


    if (

        !STUDY_RESOURCE_STATUSES.includes(
            status
        )

    ) {

        return resourceJson(

            false,

            "Invalid resource status.",

            null,

            400

        );

    }


    try {

        // -----------------------------------------
        // VERIFY RESOURCE
        // -----------------------------------------

        const existing =
            await env.DB.prepare(

                `SELECT

                    id,

                    subject_id,

                    file_url,

                    cover_image

                FROM study_resources

                WHERE id = ?

                LIMIT 1`

            )
            .bind(resourceId)
            .first();


        if (!existing) {

            return resourceJson(

                false,

                "Study resource not found.",

                null,

                404

            );

        }


        // -----------------------------------------
        // VERIFY SUBJECT + EXAM
        // -----------------------------------------

        const subject =
            await env.DB.prepare(

                `SELECT

                    s.id,

                    s.status AS subject_status,

                    e.status AS exam_status

                FROM subjects s

                INNER JOIN exams e
                    ON e.id = s.exam_id

                WHERE s.id = ?

                LIMIT 1`

            )
            .bind(subjectId)
            .first();


        if (!subject) {

            return resourceJson(

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

            return resourceJson(

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

            return resourceJson(

                false,

                "The examination associated with this subject is inactive.",

                null,

                409

            );

        }


        // -----------------------------------------
        // DUPLICATE TITLE
        // -----------------------------------------

        const duplicate =
            await env.DB.prepare(

                `SELECT id

                FROM study_resources

                WHERE subject_id = ?

                AND LOWER(title) = LOWER(?)

                AND id <> ?

                LIMIT 1`

            )
            .bind(

                subjectId,

                title,

                resourceId

            )
            .first();


        if (duplicate) {

            return resourceJson(

                false,

                "Another study resource with this title already exists for this subject.",

                null,

                409

            );

        }


        // -----------------------------------------
        // UPDATE
        // -----------------------------------------

        await env.DB.prepare(

            `UPDATE study_resources

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

            WHERE id = ?`

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


        return resourceJson(

            true,

            "Study resource updated successfully.",

            {
                id: resourceId
            },

            200

        );

    } catch (error) {

        console.error(
            "UPDATE study resource failed:",
            error
        );

        return resourceJson(

            false,

            "Failed to update the study resource.",

            null,

            500

        );

    }

}


// =====================================================
// ACTIVATE / DEACTIVATE STUDY RESOURCE
// PATCH /api/admin/resources/:id/status
// =====================================================

if (

    method === "PATCH" &&

    pathname.startsWith(
        "/api/admin/resources/"
    ) &&

    pathname.endsWith("/status")

) {

    const parts =
        pathname
            .split("/")
            .filter(Boolean);


    const statusIndex =
        parts.length - 1;


    const resourceId =
        parts[statusIndex - 1];


    if (!resourceId) {

        return resourceJson(

            false,

            "Study resource ID is required.",

            null,

            400

        );

    }


    const body =
        await readJsonBody(request);


    if (!body) {

        return resourceJson(

            false,

            "Invalid JSON request body.",

            null,

            400

        );

    }


    const status =
        normalizeStatus(body.status);


    if (

        !STUDY_RESOURCE_STATUSES.includes(
            status
        )

    ) {

        return resourceJson(

            false,

            "Status must be 'active' or 'inactive'.",

            null,

            400

        );

    }


    try {

        const resource =
            await env.DB.prepare(

                `SELECT id

                FROM study_resources

                WHERE id = ?

                LIMIT 1`

            )
            .bind(resourceId)
            .first();


        if (!resource) {

            return resourceJson(

                false,

                "Study resource not found.",

                null,

                404

            );

        }


        await env.DB.prepare(

            `UPDATE study_resources

            SET

                status = ?,

                updated_at = ?

            WHERE id = ?`

        )
        .bind(

            status,

            new Date().toISOString(),

            resourceId

        )
        .run();


        return resourceJson(

            true,

            status === "active"

                ? "Study resource activated successfully."

                : "Study resource deactivated successfully.",

            {
                id: resourceId,
                status
            },

            200

        );

    } catch (error) {

        console.error(
            "UPDATE study resource status failed:",
            error
        );

        return resourceJson(

            false,

            "Failed to update study resource status.",

            null,

            500

        );

    }

}


// =====================================================
// SOFT DELETE STUDY RESOURCE
// DELETE /api/admin/resources/:id
//
// We deliberately do NOT delete the R2 files here.
// R2 cleanup will be handled by the dedicated storage
// cleanup flow so that a database deletion cannot
// accidentally orphan or destroy files incorrectly.
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
        parts[parts.length - 1];


    if (!resourceId) {

        return resourceJson(

            false,

            "Study resource ID is required.",

            null,

            400

        );

    }


    try {

        const resource =
            await env.DB.prepare(

                `SELECT

                    id,

                    status

                FROM study_resources

                WHERE id = ?

                LIMIT 1`

            )
            .bind(resourceId)
            .first();


        if (!resource) {

            return resourceJson(

                false,

                "Study resource not found.",

                null,

                404

            );

        }


        await env.DB.prepare(

            `UPDATE study_resources

            SET

                status = 'inactive',

                updated_at = ?

            WHERE id = ?`

        )
        .bind(

            new Date().toISOString(),

            resourceId

        )
        .run();


        return resourceJson(

            true,

            "Study resource deactivated successfully.",

            {
                id: resourceId,
                status: "inactive"
            },

            200

        );

    } catch (error) {

        console.error(
            "DELETE study resource failed:",
            error
        );

        return resourceJson(

            false,

            "Failed to delete the study resource.",

            null,

            500

        );

    }

}

// =====================================================
// STUDY RESOURCE R2 MULTIPART UPLOAD
// PRODUCTION UPLOAD PIPELINE
// =====================================================

const RESOURCE_UPLOAD_TYPES = {
    document: {
        bucket: "DOCUMENTS",
        folder: "study-resources/documents"
    },

    cover: {
        bucket: "IMAGES",
        folder: "study-resources/covers"
    }
};


const RESOURCE_UPLOAD_MIME_TYPES = {
    pdf:
        "application/pdf",

    docx:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",

    xlsx:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",

    csv:
        "text/csv"
};


const RESOURCE_COVER_MIME_TYPES = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp"
};


function resourceUploadError(message, status = 400) {

    return Response.json(
        {
            success: false,
            message
        },
        {
            status,
            headers: {
                "Cache-Control": "no-store"
            }
        }
    );

}


function resourceUploadSuccess(
    message,
    data = null,
    status = 200
) {

    const response = {
        success: true,
        message
    };

    if (data !== null) {
        response.data = data;
    }

    return Response.json(
        response,
        {
            status,
            headers: {
                "Cache-Control": "no-store"
            }
        }
    );

}


// =====================================================
// INITIALIZE MULTIPART UPLOAD
// POST /api/admin/resources/upload/init
// =====================================================

if (

    method === "POST" &&

    pathname ===
        "/api/admin/resources/upload/init"

) {

    const body =
        await readJsonBody(request);


    if (!body) {

        return resourceUploadError(
            "Invalid JSON request body."
        );

    }


    const uploadType =
        String(
            body.upload_type ?? ""
        )
        .trim()
        .toLowerCase();


    const fileName =
        String(
            body.file_name ?? ""
        )
        .trim();


    const contentType =
        String(
            body.content_type ?? ""
        )
        .trim()
        .toLowerCase();


    if (
        !RESOURCE_UPLOAD_TYPES[uploadType]
    ) {

        return resourceUploadError(
            "Invalid upload type."
        );

    }


    if (!fileName) {

        return resourceUploadError(
            "File name is required."
        );

    }


    if (!contentType) {

        return resourceUploadError(
            "File content type is required."
        );

    }


    // -----------------------------------------
    // DOCUMENT VALIDATION
    // -----------------------------------------

    if (
        uploadType === "document"
    ) {

        if (
            !Object.values(
                RESOURCE_UPLOAD_MIME_TYPES
            ).includes(contentType)
        ) {

            return resourceUploadError(
                "Unsupported study resource file type."
            );

        }

    }


    // -----------------------------------------
    // COVER VALIDATION
    // -----------------------------------------

    if (
        uploadType === "cover"
    ) {

        if (
            !Object.keys(
                RESOURCE_COVER_MIME_TYPES
            ).includes(contentType)
        ) {

            return resourceUploadError(
                "Only JPG, PNG and WebP cover images are supported."
            );

        }

    }


    try {

        const bucket =
            uploadType === "document"
                ? env.DOCUMENTS
                : env.IMAGES;


        if (!bucket) {

            console.error(
                "Missing R2 binding:",
                uploadType === "document"
                    ? "DOCUMENTS"
                    : "IMAGES"
            );

            return resourceUploadError(
                "R2 storage is not configured.",
                500
            );

        }


        const uploadId =
            crypto.randomUUID();


        const safeName =
            fileName
                .replace(
                    /[^a-zA-Z0-9._-]/g,
                    "-"
                )
                .replace(
                    /-+/g,
                    "-"
                )
                .slice(
                    0,
                    180
                );


        const objectKey =
            `${RESOURCE_UPLOAD_TYPES[uploadType].folder}/${uploadId}-${safeName}`;


        const multipartUpload =
            await bucket.createMultipartUpload(
                objectKey,
                {
                    httpMetadata: {
                        contentType
                    },

                    customMetadata: {
                        resourceUploadId:
                            uploadId,

                        resourceType:
                            uploadType,

                        originalFileName:
                            fileName
                    }
                }
            );


        return resourceUploadSuccess(
            "Multipart upload initialized successfully.",
            {
                upload_id:
                    uploadId,

                object_key:
                    objectKey,

                r2_upload_id:
                    multipartUpload.uploadId,

                upload_type:
                    uploadType,

                content_type:
                    contentType,

                original_file_name:
                    fileName
            },
            201
        );

    } catch (error) {

        console.error(
            "Study resource upload initialization failed:",
            error
        );

        return resourceUploadError(
            "Unable to initialize file upload.",
            500
        );

    }

}


// =====================================================
// UPLOAD PART
// PUT /api/admin/resources/upload/part
// =====================================================

if (

    method === "PUT" &&

    pathname ===
        "/api/admin/resources/upload/part"

) {

    const uploadType =
        String(
            request.headers.get(
                "X-Upload-Type"
            ) || ""
        )
        .trim()
        .toLowerCase();


    const objectKey =
        String(
            request.headers.get(
                "X-Object-Key"
            ) || ""
        )
        .trim();


    const r2UploadId =
        String(
            request.headers.get(
                "X-R2-Upload-Id"
            ) || ""
        )
        .trim();


    const partNumber =
        Number(
            request.headers.get(
                "X-Part-Number"
            )
        );


    if (
        !RESOURCE_UPLOAD_TYPES[uploadType]
    ) {

        return resourceUploadError(
            "Invalid upload type."
        );

    }


    if (!objectKey) {

        return resourceUploadError(
            "Object key is required."
        );

    }


    if (!r2UploadId) {

        return resourceUploadError(
            "R2 upload ID is required."
        );

    }


    if (
        !Number.isInteger(partNumber) ||
        partNumber < 1
    ) {

        return resourceUploadError(
            "Invalid upload part number."
        );

    }


    if (!request.body) {

        return resourceUploadError(
            "Upload part is empty."
        );

    }


    try {

        const bucket =
            uploadType === "document"
                ? env.DOCUMENTS
                : env.IMAGES;


        if (!bucket) {

            return resourceUploadError(
                "R2 storage is not configured.",
                500
            );

        }


        const multipartUpload =
            bucket.resumeMultipartUpload(
                objectKey,
                r2UploadId
            );


        const uploadedPart =
            await multipartUpload.uploadPart(
                partNumber,
                request.body
            );


        return resourceUploadSuccess(
            "Upload part received successfully.",
            {
                part_number:
                    partNumber,

                etag:
                    uploadedPart.etag
            }
        );

    } catch (error) {

        console.error(
            "Study resource upload part failed:",
            error
        );

        return resourceUploadError(
            "Unable to upload file part.",
            500
        );

    }

}


// =====================================================
// COMPLETE MULTIPART UPLOAD
// POST /api/admin/resources/upload/complete
// =====================================================

if (

    method === "POST" &&

    pathname ===
        "/api/admin/resources/upload/complete"

) {

    const body =
        await readJsonBody(request);


    if (!body) {

        return resourceUploadError(
            "Invalid JSON request body."
        );

    }


    const uploadType =
        String(
            body.upload_type ?? ""
        )
        .trim()
        .toLowerCase();


    const objectKey =
        String(
            body.object_key ?? ""
        )
        .trim();


    const r2UploadId =
        String(
            body.r2_upload_id ?? ""
        )
        .trim();


    const rawParts =
        Array.isArray(body.parts)
            ? body.parts
            : [];


    if (
        !RESOURCE_UPLOAD_TYPES[uploadType]
    ) {

        return resourceUploadError(
            "Invalid upload type."
        );

    }


    if (!objectKey) {

        return resourceUploadError(
            "Object key is required."
        );

    }


    if (!r2UploadId) {

        return resourceUploadError(
            "R2 upload ID is required."
        );

    }


    if (!rawParts.length) {

        return resourceUploadError(
            "No upload parts were supplied."
        );

    }


    const parts =
        rawParts
            .map(part => ({
                partNumber:
                    Number(
                        part.part_number
                    ),

                etag:
                    String(
                        part.etag ?? ""
                    ).trim()
            }))
            .sort(
                (a, b) =>
                    a.partNumber -
                    b.partNumber
            );


    for (
        let i = 0;
        i < parts.length;
        i++
    ) {

        if (
            !Number.isInteger(
                parts[i].partNumber
            ) ||
            parts[i].partNumber < 1 ||
            !parts[i].etag
        ) {

            return resourceUploadError(
                "One or more upload parts are invalid."
            );

        }


        if (
            i > 0 &&
            parts[i].partNumber ===
                parts[i - 1].partNumber
        ) {

            return resourceUploadError(
                "Duplicate upload part detected."
            );

        }

    }


    try {

        const bucket =
            uploadType === "document"
                ? env.DOCUMENTS
                : env.IMAGES;


        if (!bucket) {

            return resourceUploadError(
                "R2 storage is not configured.",
                500
            );

        }


        const multipartUpload =
            bucket.resumeMultipartUpload(
                objectKey,
                r2UploadId
            );


        const completed =
            await multipartUpload.complete(
                parts
            );


        return resourceUploadSuccess(
            "File uploaded successfully.",
            {
                object_key:
                    objectKey,

                etag:
                    completed.etag || null,

                upload_type:
                    uploadType
            }
        );

    } catch (error) {

        console.error(
            "Study resource multipart completion failed:",
            error
        );

        return resourceUploadError(
            "Unable to complete file upload.",
            500
        );

    }

}


// =====================================================
// ABORT MULTIPART UPLOAD
// POST /api/admin/resources/upload/abort
// =====================================================

if (

    method === "POST" &&

    pathname ===
        "/api/admin/resources/upload/abort"

) {

    const body =
        await readJsonBody(request);


    if (!body) {

        return resourceUploadError(
            "Invalid JSON request body."
        );

    }


    const uploadType =
        String(
            body.upload_type ?? ""
        )
        .trim()
        .toLowerCase();


    const objectKey =
        String(
            body.object_key ?? ""
        )
        .trim();


    const r2UploadId =
        String(
            body.r2_upload_id ?? ""
        )
        .trim();


    if (
        !RESOURCE_UPLOAD_TYPES[uploadType]
    ) {

        return resourceUploadError(
            "Invalid upload type."
        );

    }


    if (
        !objectKey ||
        !r2UploadId
    ) {

        return resourceUploadError(
            "Upload information is incomplete."
        );

    }


    try {

        const bucket =
            uploadType === "document"
                ? env.DOCUMENTS
                : env.IMAGES;


        if (!bucket) {

            return resourceUploadError(
                "R2 storage is not configured.",
                500
            );

        }


        const multipartUpload =
            bucket.resumeMultipartUpload(
                objectKey,
                r2UploadId
            );


        await multipartUpload.abort();


        return resourceUploadSuccess(
            "File upload cancelled."
        );

    } catch (error) {

        console.error(
            "Study resource multipart abort failed:",
            error
        );

        return resourceUploadError(
            "Unable to cancel file upload.",
            500
        );

    }

}

        // =====================================================
// STUDENT MANAGEMENT
// =====================================================

// -----------------------------------------
// GET ALL STUDENTS
// GET /api/admin/students
// -----------------------------------------

if (

    method === "GET" &&

    pathname === "/api/admin/students"

) {

    const { results } = await env.DB.prepare(

        `SELECT

            st.id,

            st.student_number,

            st.full_name,

            st.email,

            st.account_status,

            st.trial_active,

            st.trial_started_at,

            st.trial_expires_at,

            st.subscription_status,

            st.email_verified,

            st.created_at,

            st.updated_at,

            st.exam_id,

            e.name AS exam_name

        FROM students st

        LEFT JOIN exams e

            ON st.exam_id = e.id

        ORDER BY

            st.created_at DESC`

    ).all();

    return Response.json({

        success: true,

        message: "Students retrieved successfully.",

        data: results

    });

}

// -----------------------------------------
// GET SINGLE STUDENT
// GET /api/admin/students/:id
// -----------------------------------------

if (

    method === "GET" &&

    pathname.startsWith("/api/admin/students/")

) {

    const studentId = pathname.split("/").pop();

    const student = await env.DB.prepare(

        `SELECT

            st.id,

            st.student_number,

            st.full_name,

            st.email,

            st.account_status,

            st.trial_active,

            st.trial_started_at,

            st.trial_expires_at,

            st.subscription_status,

            st.email_verified,

            st.created_at,

            st.updated_at,

            st.exam_id,

            e.name AS exam_name

        FROM students st

        LEFT JOIN exams e

            ON st.exam_id = e.id

        WHERE st.id = ?`

    )

    .bind(studentId)

    .first();

    if (!student) {

        return Response.json({

            success: false,

            message: "Student not found."

        }, {

            status: 404

        });

    }

    return Response.json({

        success: true,

        message: "Student retrieved successfully.",

        data: student

    });

}

// -----------------------------------------
// ADD STUDENT
// POST /api/admin/students
// -----------------------------------------

if (
    method === "POST" &&
    pathname === "/api/admin/students"
) {

    const body = await request.json();

    const {
        student_number,
        full_name,
        email,
        password,
        exam_id
    } = body;

    if (
        !student_number ||
        !full_name ||
        !email ||
        !password ||
        !exam_id
    ) {
        return Response.json({
            success: false,
            message: "Student number, full name, email, password and exam are required."
        }, {
            status: 400
        });
    }

    // ---------------------------------
    // Validate Exam
    // ---------------------------------

    const exam = await env.DB.prepare(
        `SELECT id
         FROM exams
         WHERE id = ?
         AND status = 'active'`
    )
    .bind(exam_id)
    .first();

    if (!exam) {
        return Response.json({
            success: false,
            message: "Selected exam does not exist."
        }, {
            status: 400
        });
    }

    // ---------------------------------
    // Duplicate Student Number
    // ---------------------------------

    const existingNumber = await env.DB.prepare(
        `SELECT id
         FROM students
         WHERE LOWER(student_number)=LOWER(?)`
    )
    .bind(student_number.trim())
    .first();

    if (existingNumber) {
        return Response.json({
            success: false,
            message: "Student number already exists."
        }, {
            status: 409
        });
    }

    // ---------------------------------
    // Duplicate Email
    // ---------------------------------

    const existingEmail = await env.DB.prepare(
        `SELECT id
         FROM students
         WHERE LOWER(email)=LOWER(?)`
    )
    .bind(email.trim())
    .first();

    if (existingEmail) {
        return Response.json({
            success: false,
            message: "Email address already exists."
        }, {
            status: 409
        });
    }

    // ---------------------------------
    // Generate IDs & Dates
    // ---------------------------------

    const id = crypto.randomUUID();

    const now = new Date();

    const createdAt = now.toISOString();

    const updatedAt = createdAt;

    const trialStartedAt = createdAt;

    const TRIAL_DAYS = 3;

const trialExpiresAt = new Date(
    now.getTime() + (TRIAL_DAYS * 24 * 60 * 60 * 1000)
).toISOString();

    // ---------------------------------
    // Hash Password
    // ---------------------------------

    const passwordHash = await bcrypt.hash(password, 10);

    // ---------------------------------
    // Insert Student
    // ---------------------------------

    await env.DB.prepare(

        `INSERT INTO students (

            id,

            student_number,

            full_name,

            email,

            password_hash,

            account_status,

            trial_active,

            trial_started_at,

            trial_expires_at,

            subscription_status,

            email_verified,

            created_at,

            updated_at,

            exam_id

        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`

    )

    .bind(

        id,

        student_number.trim(),

        full_name.trim(),

        email.trim().toLowerCase(),

        passwordHash,

        "active",

        1,

        trialStartedAt,

        trialExpiresAt,

        "trial",

        0,

        createdAt,

        updatedAt,

        exam_id

    )

    .run();

    const student = await env.DB.prepare(

        `SELECT

            st.id,

            st.student_number,

            st.full_name,

            st.email,

            st.account_status,

            st.trial_active,

            st.trial_started_at,

            st.trial_expires_at,

            st.subscription_status,

            st.email_verified,

            st.created_at,

            st.updated_at,

            st.exam_id,

            e.name AS exam_name

        FROM students st

        LEFT JOIN exams e
            ON st.exam_id = e.id

        WHERE st.id = ?`

    )

    .bind(id)

    .first();

    return Response.json({

        success: true,

        message: "Student created successfully.",

        data: student

    }, {

        status: 201

    });

}

// -----------------------------------------
// UPDATE STUDENT
// PUT /api/admin/students/:id
// -----------------------------------------

if (
    method === "PUT" &&
    pathname.startsWith("/api/admin/students/")
) {

    const studentId = pathname.split("/").pop();

    const body = await request.json();

    const {
        student_number,
        full_name,
        email,
        password,
        exam_id,
        account_status,
        trial_active,
        subscription_status,
        email_verified
    } = body;

    const existingStudent = await env.DB.prepare(
        `SELECT *
         FROM students
         WHERE id = ?`
    )
    .bind(studentId)
    .first();

    if (!existingStudent) {
        return Response.json({
            success: false,
            message: "Student not found."
        }, {
            status: 404
        });
    }

    // ---------------------------------
    // Validate Exam
    // ---------------------------------

    const exam = await env.DB.prepare(
        `SELECT id
         FROM exams
         WHERE id = ?
         AND status='active'`
    )
    .bind(exam_id)
    .first();

    if (!exam) {
        return Response.json({
            success: false,
            message: "Selected exam does not exist."
        }, {
            status: 400
        });
    }

    // ---------------------------------
    // Duplicate Student Number
    // ---------------------------------

    const duplicateNumber = await env.DB.prepare(
        `SELECT id
         FROM students
         WHERE LOWER(student_number)=LOWER(?)
         AND id<>?`
    )
    .bind(student_number.trim(), studentId)
    .first();

    if (duplicateNumber) {
        return Response.json({
            success: false,
            message: "Student number already exists."
        }, {
            status: 409
        });
    }

    // ---------------------------------
    // Duplicate Email
    // ---------------------------------

    const duplicateEmail = await env.DB.prepare(
        `SELECT id
         FROM students
         WHERE LOWER(email)=LOWER(?)
         AND id<>?`
    )
    .bind(email.trim(), studentId)
    .first();

    if (duplicateEmail) {
        return Response.json({
            success: false,
            message: "Email address already exists."
        }, {
            status: 409
        });
    }

    // ---------------------------------
    // Password
    // ---------------------------------

    let passwordHash = existingStudent.password_hash;

    if (password && password.trim() !== "") {
        passwordHash = await bcrypt.hash(password.trim(), 10);
    }

    const updatedAt = new Date().toISOString();

    // ---------------------------------
    // Update Student
    // ---------------------------------

    await env.DB.prepare(

        `UPDATE students
         SET

            student_number=?,

            full_name=?,

            email=?,

            password_hash=?,

            account_status=?,

            trial_active=?,

            subscription_status=?,

            email_verified=?,

            updated_at=?,

            exam_id=?

        WHERE id=?`

    )

    .bind(

        student_number.trim(),

        full_name.trim(),

        email.trim().toLowerCase(),

        passwordHash,

        account_status,

        trial_active,

        subscription_status,

        email_verified,

        updatedAt,

        exam_id,

        studentId

    )

    .run();

    const student = await env.DB.prepare(

        `SELECT

            st.id,

            st.student_number,

            st.full_name,

            st.email,

            st.account_status,

            st.trial_active,

            st.trial_started_at,

            st.trial_expires_at,

            st.subscription_status,

            st.email_verified,

            st.created_at,

            st.updated_at,

            st.exam_id,

            e.name AS exam_name

        FROM students st

        LEFT JOIN exams e
            ON st.exam_id=e.id

        WHERE st.id=?`

    )

    .bind(studentId)

    .first();

    return Response.json({

        success: true,

        message: "Student updated successfully.",

        data: student

    });

}

// -----------------------------------------
// UPDATE STUDENT STATUS
// PATCH /api/admin/students/:id/status
// -----------------------------------------

if (
    method === "PATCH" &&
    pathname.startsWith("/api/admin/students/") &&
    pathname.endsWith("/status")
) {

    const studentId = pathname.split("/")[4];

    const body = await request.json();

    const { account_status } = body;

    if (!["active", "inactive"].includes(account_status)) {

        return Response.json({
            success: false,
            message: "Invalid account status."
        }, {
            status: 400
        });

    }

    const student = await env.DB.prepare(
        `SELECT id
         FROM students
         WHERE id=?`
    )
    .bind(studentId)
    .first();

    if (!student) {

        return Response.json({
            success: false,
            message: "Student not found."
        }, {
            status: 404
        });

    }

    await env.DB.prepare(

        `UPDATE students
         SET
            account_status=?,
            updated_at=?
         WHERE id=?`

    )

    .bind(

        account_status,

        new Date().toISOString(),

        studentId

    )

    .run();

    return Response.json({

        success: true,

        message: `Student ${account_status} successfully.`

    });

}


// -----------------------------------------
// RESET STUDENT PASSWORD
// PATCH /api/admin/students/:id/reset-password
// -----------------------------------------

if (
    method === "PATCH" &&
    pathname.startsWith("/api/admin/students/") &&
    pathname.endsWith("/reset-password")
) {

    const studentId = pathname.split("/")[4];

    const body = await request.json();

    const { password } = body;

    if (!password || password.trim().length < 6) {

        return Response.json({

            success: false,

            message: "Password must be at least 6 characters."

        }, {

            status: 400

        });

    }

    const student = await env.DB.prepare(
        `SELECT id
         FROM students
         WHERE id=?`
    )
    .bind(studentId)
    .first();

    if (!student) {

        return Response.json({

            success: false,

            message: "Student not found."

        }, {

            status: 404

        });

    }

    const passwordHash = await bcrypt.hash(password.trim(), 10);

    await env.DB.prepare(

        `UPDATE students
         SET
            password_hash=?,
            updated_at=?
         WHERE id=?`

    )

    .bind(

        passwordHash,

        new Date().toISOString(),

        studentId

    )

    .run();

    return Response.json({

        success: true,

        message: "Password reset successfully."

    });

}


// -----------------------------------------
// DELETE STUDENT (SOFT DELETE)
// DELETE /api/admin/students/:id
// -----------------------------------------

if (
    method === "DELETE" &&
    pathname.startsWith("/api/admin/students/")
) {

    const studentId = pathname.split("/").pop();

    const student = await env.DB.prepare(
        `SELECT id
         FROM students
         WHERE id=?`
    )
    .bind(studentId)
    .first();

    if (!student) {

        return Response.json({

            success: false,

            message: "Student not found."

        }, {

            status: 404

        });

    }

    await env.DB.prepare(

        `UPDATE students
         SET
            account_status='inactive',
            updated_at=?
         WHERE id=?`

    )

    .bind(

        new Date().toISOString(),

        studentId

    )

    .run();

    return Response.json({

        success: true,

        message: "Student deleted successfully."

    });

}
        // =====================================================
// SUBSCRIPTION PLANS MANAGEMENT
// =====================================================

// -----------------------------------------
// GET ALL SUBSCRIPTION PLANS
// GET /api/admin/subscription-plans
// -----------------------------------------

if (
    method === "GET" &&
    pathname === "/api/admin/subscription-plans"
) {

    const { results } = await env.DB.prepare(

        `SELECT

            id,
            name,
            price,
            duration_days,
            description,
            display_order,
            status,
            created_at,
            updated_at

        FROM subscription_plans

        ORDER BY

            display_order ASC,
            duration_days ASC,
            name ASC`

    ).all();

    return Response.json({

        success: true,

        message: "Subscription plans retrieved successfully.",

        data: results

    });

}

// -----------------------------------------
// GET SINGLE SUBSCRIPTION PLAN
// GET /api/admin/subscription-plans/:id
// -----------------------------------------

if (
    method === "GET" &&
    pathname.startsWith("/api/admin/subscription-plans/")
) {

    const planId = pathname.split("/").pop();

    const plan = await env.DB.prepare(

        `SELECT

            id,
            name,
            price,
            duration_days,
            description,
            display_order,
            status,
            created_at,
            updated_at

        FROM subscription_plans

        WHERE id = ?`

    )
    .bind(planId)
    .first();

    if (!plan) {

        return Response.json({

            success: false,

            message: "Subscription plan not found."

        }, {

            status: 404

        });

    }

    const { results: features } = await env.DB.prepare(

        `SELECT

            f.id,
            f.feature_key,
            f.feature_name,
            f.description,
            f.category,
            f.status

        FROM plan_features pf

        INNER JOIN features f
            ON pf.feature_id = f.id

        WHERE
            pf.plan_id = ?

        ORDER BY

            f.category ASC,
            f.feature_name ASC`

    )
    .bind(planId)
    .all();

    return Response.json({

        success: true,

        message: "Subscription plan retrieved successfully.",

        data: {

            ...plan,

            features

        }

    });

}

// -----------------------------------------
// CREATE SUBSCRIPTION PLAN
// POST /api/admin/subscription-plans
// -----------------------------------------

if (
    method === "POST" &&
    pathname === "/api/admin/subscription-plans"
) {

    const body = await request.json();

    const {

        name,
        price,
        duration_days,
        description,
        display_order,
        status

    } = body;

    // -----------------------------------------
    // VALIDATION
    // -----------------------------------------

    if (!name || !name.trim()) {

        return Response.json({

            success: false,

            message: "Subscription plan name is required."

        }, {

            status: 400

        });

    }

    if (
        price === undefined ||
        price === null ||
        isNaN(Number(price))
    ) {

        return Response.json({

            success: false,

            message: "Valid subscription price is required."

        }, {

            status: 400

        });

    }

    if (
        duration_days === undefined ||
        duration_days === null ||
        isNaN(Number(duration_days))
    ) {

        return Response.json({

            success: false,

            message: "Subscription duration is required."

        }, {

            status: 400

        });

    }

    if (
        status &&
        !["active", "inactive"].includes(status)
    ) {

        return Response.json({

            success: false,

            message: "Invalid subscription plan status."

        }, {

            status: 400

        });

    }

    // -----------------------------------------
    // CHECK DUPLICATE NAME
    // -----------------------------------------

    const duplicate = await env.DB.prepare(

        `SELECT id

         FROM subscription_plans

         WHERE LOWER(name) = LOWER(?)

         LIMIT 1`

    )

    .bind(

        name.trim()

    )

    .first();

    if (duplicate) {

        return Response.json({

            success: false,

            message: "A subscription plan with this name already exists."

        }, {

            status: 409

        });

    }

    const planId = crypto.randomUUID();

    const now = new Date().toISOString();

    // -----------------------------------------
    // CREATE SUBSCRIPTION PLAN
    // -----------------------------------------

    await env.DB.prepare(

        `INSERT INTO subscription_plans (

            id,
            name,
            price,
            duration_days,
            description,
            display_order,
            status,
            created_at,
            updated_at

        )

        VALUES (

            ?, ?, ?, ?, ?, ?, ?, ?, ?

        )`

    )

    .bind(

        planId,

        name.trim(),

        Number(price),

        Number(duration_days),

        description || "",

        Number(display_order) || 0,

        status || "active",

        now,

        now

    )

    .run();

    const plan = await env.DB.prepare(

        `SELECT

            id,
            name,
            price,
            duration_days,
            description,
            display_order,
            status,
            created_at,
            updated_at

        FROM subscription_plans

        WHERE id = ?`

    )

    .bind(planId)

    .first();

    return Response.json({

        success: true,

        message: "Subscription plan created successfully.",

        data: plan

    }, {

        status: 201

    });

}

// -----------------------------------------
// UPDATE SUBSCRIPTION PLAN
// PUT /api/admin/subscription-plans/:id
// -----------------------------------------

if (
    method === "PUT" &&
    pathname.startsWith("/api/admin/subscription-plans/")
) {

    const planId = pathname.split("/").pop();

    const body = await request.json();

    const {

        name,
        price,
        duration_days,
        description,
        display_order,
        status

    } = body;

    // -----------------------------------------
    // VALIDATION
    // -----------------------------------------

    if (!name || !name.trim()) {

        return Response.json({

            success: false,

            message: "Subscription plan name is required."

        }, {

            status: 400

        });

    }

    if (
        price === undefined ||
        price === null ||
        isNaN(Number(price))
    ) {

        return Response.json({

            success: false,

            message: "Valid subscription price is required."

        }, {

            status: 400

        });

    }

    if (
        duration_days === undefined ||
        duration_days === null ||
        isNaN(Number(duration_days))
    ) {

        return Response.json({

            success: false,

            message: "Subscription duration is required."

        }, {

            status: 400

        });

    }

    if (
        status &&
        !["active", "inactive"].includes(status)
    ) {

        return Response.json({

            success: false,

            message: "Invalid subscription plan status."

        }, {

            status: 400

        });

    }

    // -----------------------------------------
    // VERIFY PLAN EXISTS
    // -----------------------------------------

    const existingPlan = await env.DB.prepare(

        `SELECT id

         FROM subscription_plans

         WHERE id = ?`

    )

    .bind(planId)

    .first();

    if (!existingPlan) {

        return Response.json({

            success: false,

            message: "Subscription plan not found."

        }, {

            status: 404

        });

    }

    // -----------------------------------------
    // CHECK DUPLICATE NAME
    // -----------------------------------------

    const duplicate = await env.DB.prepare(

        `SELECT id

         FROM subscription_plans

         WHERE LOWER(name) = LOWER(?)

         AND id <> ?`

    )

    .bind(

        name.trim(),

        planId

    )

    .first();

    if (duplicate) {

        return Response.json({

            success: false,

            message: "Another subscription plan already uses this name."

        }, {

            status: 409

        });

    }

    const now = new Date().toISOString();

    // -----------------------------------------
    // UPDATE SUBSCRIPTION PLAN
    // -----------------------------------------

    await env.DB.prepare(

        `UPDATE subscription_plans

         SET

            name = ?,

            price = ?,

            duration_days = ?,

            description = ?,

            display_order = ?,

            status = ?,

            updated_at = ?

         WHERE id = ?`

    )

    .bind(

        name.trim(),

        Number(price),

        Number(duration_days),

        description || "",

        Number(display_order) || 0,

        status || "active",

        now,

        planId

    )

    .run();

    const updatedPlan = await env.DB.prepare(

        `SELECT

            id,
            name,
            price,
            duration_days,
            description,
            display_order,
            status,
            created_at,
            updated_at

        FROM subscription_plans

        WHERE id = ?`

    )

    .bind(planId)

    .first();

    return Response.json({

        success: true,

        message: "Subscription plan updated successfully.",

        data: updatedPlan

    });

}

// -----------------------------------------
// UPDATE SUBSCRIPTION PLAN STATUS
// PATCH /api/admin/subscription-plans/:id/status
// -----------------------------------------

if (

    method === "PATCH" &&

    pathname.startsWith("/api/admin/subscription-plans/") &&

    pathname.endsWith("/status")

) {

    const parts = pathname.split("/");

    const planId = parts[parts.length - 2];

    const body = await request.json();

    const {

        status

    } = body;

    // -----------------------------------------
    // VALIDATION
    // -----------------------------------------

    if (

        !status ||

        !["active", "inactive"].includes(status)

    ) {

        return Response.json({

            success: false,

            message: "Status must be 'active' or 'inactive'."

        }, {

            status: 400

        });

    }

    // -----------------------------------------
    // VERIFY PLAN EXISTS
    // -----------------------------------------

    const plan = await env.DB.prepare(

        `SELECT

            id

         FROM subscription_plans

         WHERE id = ?`

    )

    .bind(planId)

    .first();

    if (!plan) {

        return Response.json({

            success: false,

            message: "Subscription plan not found."

        }, {

            status: 404

        });

    }

    // -----------------------------------------
    // UPDATE STATUS
    // -----------------------------------------

    await env.DB.prepare(

        `UPDATE subscription_plans

         SET

            status = ?,

            updated_at = ?

         WHERE id = ?`

    )

    .bind(

        status,

        new Date().toISOString(),

        planId

    )

    .run();

    return Response.json({

        success: true,

        message: `Subscription plan ${status} successfully.`

    });

}

// -----------------------------------------
// DELETE SUBSCRIPTION PLAN
// DELETE /api/admin/subscription-plans/:id
// -----------------------------------------

if (

    method === "DELETE" &&

    pathname.startsWith("/api/admin/subscription-plans/")

) {

    const planId = pathname.split("/").pop();

    // -----------------------------------------
    // VERIFY PLAN EXISTS
    // -----------------------------------------

    const plan = await env.DB.prepare(

        `SELECT

            id

         FROM subscription_plans

         WHERE id = ?`

    )

    .bind(planId)

    .first();

    if (!plan) {

        return Response.json({

            success: false,

            message: "Subscription plan not found."

        }, {

            status: 404

        });

    }

    // -----------------------------------------
    // CHECK IF PLAN IS ASSIGNED
    // -----------------------------------------

    const assigned = await env.DB.prepare(

        `SELECT

            id

         FROM subscriptions

         WHERE plan_id = ?

         LIMIT 1`

    )

    .bind(planId)

    .first();

    if (assigned) {

        return Response.json({

            success: false,

            message: "This subscription plan cannot be deleted because it is already assigned to one or more subscriptions."

        }, {

            status: 409

        });

    }

    // -----------------------------------------
    // REMOVE PLAN FEATURES
    // -----------------------------------------

    await env.DB.prepare(

        `DELETE FROM plan_features

         WHERE plan_id = ?`

    )

    .bind(planId)

    .run();

    // -----------------------------------------
    // DELETE PLAN
    // -----------------------------------------

    await env.DB.prepare(

        `DELETE FROM subscription_plans

         WHERE id = ?`

    )

    .bind(planId)

    .run();

    return Response.json({

        success: true,

        message: "Subscription plan deleted successfully."

    });

}

// =====================================================
// FEATURES MANAGEMENT
// =====================================================

// -----------------------------------------
// GET ALL FEATURES
// GET /api/admin/features
// -----------------------------------------

if (

    method === "GET" &&

    pathname === "/api/admin/features"

) {

    const { results } = await env.DB.prepare(

        `SELECT

            id,
            feature_key,
            feature_name,
            description,
            category,
            status,
            created_at,
            updated_at

        FROM features

        ORDER BY

            category ASC,
            feature_name ASC`

    ).all();

    return Response.json({

        success: true,

        message: "Features retrieved successfully.",

        data: results

    });

}

// -----------------------------------------
// GET SINGLE FEATURE
// GET /api/admin/features/:id
// -----------------------------------------

if (

    method === "GET" &&

    pathname.startsWith("/api/admin/features/")

) {

    const featureId = pathname.split("/").pop();

    const feature = await env.DB.prepare(

        `SELECT

            id,
            feature_key,
            feature_name,
            description,
            category,
            status,
            created_at,
            updated_at

        FROM features

        WHERE id = ?`

    )

    .bind(featureId)

    .first();

    if (!feature) {

        return Response.json({

            success: false,

            message: "Feature not found."

        }, {

            status: 404

        });

    }

    return Response.json({

        success: true,

        message: "Feature retrieved successfully.",

        data: feature

    });

}

// -----------------------------------------
// CREATE FEATURE
// POST /api/admin/features
// -----------------------------------------

if (

    method === "POST" &&

    pathname === "/api/admin/features"

) {

    const body = await request.json();

    const {

        feature_key,
        feature_name,
        description,
        category,
        status

    } = body;

    // -----------------------------------------
    // VALIDATION
    // -----------------------------------------

    if (!feature_key || !feature_key.trim()) {

        return Response.json({

            success: false,

            message: "Feature key is required."

        }, {

            status: 400

        });

    }

    if (!feature_name || !feature_name.trim()) {

        return Response.json({

            success: false,

            message: "Feature name is required."

        }, {

            status: 400

        });

    }

    if (!category || !category.trim()) {

        return Response.json({

            success: false,

            message: "Feature category is required."

        }, {

            status: 400

        });

    }

    if (

        status &&

        !["active", "inactive"].includes(status)

    ) {

        return Response.json({

            success: false,

            message: "Invalid feature status."

        }, {

            status: 400

        });

    }

    // -----------------------------------------
    // CHECK DUPLICATE FEATURE KEY
    // -----------------------------------------

    const duplicateKey = await env.DB.prepare(

        `SELECT

            id

         FROM features

         WHERE LOWER(feature_key) = LOWER(?)

         LIMIT 1`

    )

    .bind(

        feature_key.trim()

    )

    .first();

    if (duplicateKey) {

        return Response.json({

            success: false,

            message: "Feature key already exists."

        }, {

            status: 409

        });

    }

    // -----------------------------------------
    // CHECK DUPLICATE FEATURE NAME
    // -----------------------------------------

    const duplicateName = await env.DB.prepare(

        `SELECT

            id

         FROM features

         WHERE LOWER(feature_name) = LOWER(?)

         LIMIT 1`

    )

    .bind(

        feature_name.trim()

    )

    .first();

    if (duplicateName) {

        return Response.json({

            success: false,

            message: "Feature name already exists."

        }, {

            status: 409

        });

    }

    const featureId = crypto.randomUUID();

    const now = new Date().toISOString();

    // -----------------------------------------
    // CREATE FEATURE
    // -----------------------------------------

    await env.DB.prepare(

        `INSERT INTO features (

            id,
            feature_key,
            feature_name,
            description,
            category,
            status,
            created_at,
            updated_at

        )

        VALUES (

            ?, ?, ?, ?, ?, ?, ?, ?

        )`

    )

    .bind(

        featureId,

        feature_key.trim().toLowerCase(),

        feature_name.trim(),

        description || "",

        category.trim(),

        status || "active",

        now,

        now

    )

    .run();

    const feature = await env.DB.prepare(

        `SELECT

            id,
            feature_key,
            feature_name,
            description,
            category,
            status,
            created_at,
            updated_at

        FROM features

        WHERE id = ?`

    )

    .bind(featureId)

    .first();

    return Response.json({

        success: true,

        message: "Feature created successfully.",

        data: feature

    }, {

        status: 201

    });

}

// -----------------------------------------
// UPDATE FEATURE
// PUT /api/admin/features/:id
// -----------------------------------------

if (

    method === "PUT" &&

    pathname.startsWith("/api/admin/features/")

) {

    const featureId = pathname.split("/").pop();

    const body = await request.json();

    const {

        feature_key,
        feature_name,
        description,
        category,
        status

    } = body;

    // -----------------------------------------
    // VALIDATION
    // -----------------------------------------

    if (!feature_key || !feature_key.trim()) {

        return Response.json({

            success: false,

            message: "Feature key is required."

        }, {

            status: 400

        });

    }

    if (!feature_name || !feature_name.trim()) {

        return Response.json({

            success: false,

            message: "Feature name is required."

        }, {

            status: 400

        });

    }

    if (!category || !category.trim()) {

        return Response.json({

            success: false,

            message: "Feature category is required."

        }, {

            status: 400

        });

    }

    if (

        status &&

        !["active", "inactive"].includes(status)

    ) {

        return Response.json({

            success: false,

            message: "Invalid feature status."

        }, {

            status: 400

        });

    }

    // -----------------------------------------
    // VERIFY FEATURE EXISTS
    // -----------------------------------------

    const existingFeature = await env.DB.prepare(

        `SELECT

            id

         FROM features

         WHERE id = ?`

    )

    .bind(featureId)

    .first();

    if (!existingFeature) {

        return Response.json({

            success: false,

            message: "Feature not found."

        }, {

            status: 404

        });

    }

    // -----------------------------------------
    // CHECK DUPLICATE FEATURE KEY
    // -----------------------------------------

    const duplicateKey = await env.DB.prepare(

        `SELECT

            id

         FROM features

         WHERE LOWER(feature_key) = LOWER(?)

         AND id <> ?`

    )

    .bind(

        feature_key.trim(),

        featureId

    )

    .first();

    if (duplicateKey) {

        return Response.json({

            success: false,

            message: "Another feature already uses this key."

        }, {

            status: 409

        });

    }

    // -----------------------------------------
    // CHECK DUPLICATE FEATURE NAME
    // -----------------------------------------

    const duplicateName = await env.DB.prepare(

        `SELECT

            id

         FROM features

         WHERE LOWER(feature_name) = LOWER(?)

         AND id <> ?`

    )

    .bind(

        feature_name.trim(),

        featureId

    )

    .first();

    if (duplicateName) {

        return Response.json({

            success: false,

            message: "Another feature already uses this name."

        }, {

            status: 409

        });

    }

    const now = new Date().toISOString();

    // -----------------------------------------
    // UPDATE FEATURE
    // -----------------------------------------

    await env.DB.prepare(

        `UPDATE features

         SET

            feature_key = ?,

            feature_name = ?,

            description = ?,

            category = ?,

            status = ?,

            updated_at = ?

         WHERE id = ?`

    )

    .bind(

        feature_key.trim().toLowerCase(),

        feature_name.trim(),

        description || "",

        category.trim(),

        status || "active",

        now,

        featureId

    )

    .run();

    const feature = await env.DB.prepare(

        `SELECT

            id,
            feature_key,
            feature_name,
            description,
            category,
            status,
            created_at,
            updated_at

         FROM features

         WHERE id = ?`

    )

    .bind(featureId)

    .first();

    return Response.json({

        success: true,

        message: "Feature updated successfully.",

        data: feature

    });

}

// -----------------------------------------
// UPDATE FEATURE STATUS
// PATCH /api/admin/features/:id/status
// -----------------------------------------

if (

    method === "PATCH" &&

    pathname.match(/^\/api\/admin\/features\/[^/]+\/status$/)

) {

    const featureId = pathname.split("/")[4];

    const body = await request.json();

    const { status } = body;

    if (!["active", "inactive"].includes(status)) {

        return Response.json({

            success: false,

            message: "Invalid feature status."

        }, {

            status: 400

        });

    }

    const feature = await env.DB.prepare(

        `SELECT id

         FROM features

         WHERE id = ?`

    )

    .bind(featureId)

    .first();

    if (!feature) {

        return Response.json({

            success: false,

            message: "Feature not found."

        }, {

            status: 404

        });

    }

    const now = new Date().toISOString();

    await env.DB.prepare(

        `UPDATE features

         SET

            status = ?,

            updated_at = ?

         WHERE id = ?`

    )

    .bind(

        status,

        now,

        featureId

    )

    .run();

    const updatedFeature = await env.DB.prepare(

        `SELECT

            id,
            feature_key,
            feature_name,
            description,
            category,
            status,
            created_at,
            updated_at

         FROM features

         WHERE id = ?`

    )

    .bind(featureId)

    .first();

    return Response.json({

        success: true,

        message: "Feature status updated successfully.",

        data: updatedFeature

    });

}

// -----------------------------------------
// DELETE FEATURE
// DELETE /api/admin/features/:id
// -----------------------------------------

if (

    method === "DELETE" &&

    pathname.startsWith("/api/admin/features/")

) {

    const featureId = pathname.split("/").pop();

    const feature = await env.DB.prepare(

        `SELECT id

         FROM features

         WHERE id = ?`

    )

    .bind(featureId)

    .first();

    if (!feature) {

        return Response.json({

            success: false,

            message: "Feature not found."

        }, {

            status: 404

        });

    }

    // Prevent deleting features already assigned to plans

    const assignment = await env.DB.prepare(

        `SELECT id

         FROM plan_features

         WHERE feature_id = ?

         LIMIT 1`

    )

    .bind(featureId)

    .first();

    if (assignment) {

        return Response.json({

            success: false,

            message: "Cannot delete feature because it is assigned to one or more subscription plans."

        }, {

            status: 409

        });

    }

    await env.DB.prepare(

        `DELETE FROM features

         WHERE id = ?`

    )

    .bind(featureId)

    .run();

    return Response.json({

        success: true,

        message: "Feature deleted successfully."

    });

}

// =====================================================
// PLAN FEATURES MANAGEMENT
// =====================================================

// -----------------------------------------
// GET PLAN FEATURES
// GET /api/admin/plan-features/:planId
// -----------------------------------------

if (

    method === "GET" &&

    pathname.startsWith("/api/admin/plan-features/")

) {

    const planId = pathname.split("/").pop();

    // -----------------------------------------
    // VERIFY PLAN EXISTS
    // -----------------------------------------

    const plan = await env.DB.prepare(

        `SELECT

            id,
            name

         FROM subscription_plans

         WHERE id = ?`

    )

    .bind(planId)

    .first();

    if (!plan) {

        return Response.json({

            success: false,

            message: "Subscription plan not found."

        }, {

            status: 404

        });

    }

    // -----------------------------------------
    // GET ASSIGNED FEATURES
    // -----------------------------------------

    const { results } = await env.DB.prepare(

        `SELECT

            pf.id,
            pf.plan_id,
            pf.feature_id,
            pf.created_at,

            f.feature_key,
            f.feature_name,
            f.description,
            f.category,
            f.status

         FROM plan_features pf

         INNER JOIN features f

            ON pf.feature_id = f.id

         WHERE pf.plan_id = ?

         ORDER BY

            f.category ASC,
            f.feature_name ASC`

    )

    .bind(planId)

    .all();

    return Response.json({

        success: true,

        message: "Plan features retrieved successfully.",

        data: {

            plan,

            features: results

        }

    });

}

// -----------------------------------------
// ASSIGN FEATURE TO PLAN
// POST /api/admin/plan-features
// -----------------------------------------

if (

    method === "POST" &&

    pathname === "/api/admin/plan-features"

) {

    const body = await request.json();

    const {

        plan_id,
        feature_id

    } = body;

    // -----------------------------------------
    // VALIDATION
    // -----------------------------------------

    if (!plan_id || !plan_id.trim()) {

        return Response.json({

            success: false,

            message: "Plan ID is required."

        }, {

            status: 400

        });

    }

    if (!feature_id || !feature_id.trim()) {

        return Response.json({

            success: false,

            message: "Feature ID is required."

        }, {

            status: 400

        });

    }

    // -----------------------------------------
    // VERIFY PLAN EXISTS
    // -----------------------------------------

    const plan = await env.DB.prepare(

        `SELECT

            id,
            name

         FROM subscription_plans

         WHERE id = ?`

    )

    .bind(plan_id)

    .first();

    if (!plan) {

        return Response.json({

            success: false,

            message: "Subscription plan not found."

        }, {

            status: 404

        });

    }

    // -----------------------------------------
    // VERIFY FEATURE EXISTS
    // -----------------------------------------

    const feature = await env.DB.prepare(

        `SELECT

            id,
            feature_key,
            feature_name

         FROM features

         WHERE id = ?`

    )

    .bind(feature_id)

    .first();

    if (!feature) {

        return Response.json({

            success: false,

            message: "Feature not found."

        }, {

            status: 404

        });

    }

    // -----------------------------------------
    // CHECK DUPLICATE ASSIGNMENT
    // -----------------------------------------

    const existing = await env.DB.prepare(

        `SELECT

            id

         FROM plan_features

         WHERE plan_id = ?

         AND feature_id = ?`

    )

    .bind(

        plan_id,

        feature_id

    )

    .first();

    if (existing) {

        return Response.json({

            success: false,

            message: "This feature is already assigned to the selected plan."

        }, {

            status: 409

        });

    }

    const assignmentId = crypto.randomUUID();

    const now = new Date().toISOString();

    // -----------------------------------------
    // CREATE ASSIGNMENT
    // -----------------------------------------

    await env.DB.prepare(

        `INSERT INTO plan_features (

            id,
            plan_id,
            feature_id,
            created_at

        )

        VALUES (

            ?, ?, ?, ?

        )`

    )

    .bind(

        assignmentId,

        plan_id,

        feature_id,

        now

    )

    .run();

    // -----------------------------------------
    // RETURN CREATED ASSIGNMENT
    // -----------------------------------------

    const assignment = await env.DB.prepare(

        `SELECT

            pf.id,
            pf.plan_id,
            pf.feature_id,
            pf.created_at,

            sp.name AS plan_name,

            f.feature_key,
            f.feature_name,
            f.category,
            f.status

         FROM plan_features pf

         INNER JOIN subscription_plans sp

            ON pf.plan_id = sp.id

         INNER JOIN features f

            ON pf.feature_id = f.id

         WHERE pf.id = ?`

    )

    .bind(assignmentId)

    .first();

    return Response.json({

        success: true,

        message: "Feature assigned to subscription plan successfully.",

        data: assignment

    }, {

        status: 201

    });

}

// -----------------------------------------
// REMOVE FEATURE FROM PLAN
// DELETE /api/admin/plan-features/:id
// -----------------------------------------

if (

    method === "DELETE" &&

    pathname.startsWith("/api/admin/plan-features/")

) {

    const assignmentId = pathname.split("/").pop();

    // -----------------------------------------
    // VERIFY ASSIGNMENT EXISTS
    // -----------------------------------------

    const assignment = await env.DB.prepare(

        `SELECT

            pf.id,
            pf.plan_id,
            pf.feature_id,

            sp.name AS plan_name,

            f.feature_name

         FROM plan_features pf

         INNER JOIN subscription_plans sp

            ON pf.plan_id = sp.id

         INNER JOIN features f

            ON pf.feature_id = f.id

         WHERE pf.id = ?`

    )

    .bind(assignmentId)

    .first();

    if (!assignment) {

        return Response.json({

            success: false,

            message: "Feature assignment not found."

        }, {

            status: 404

        });

    }

    // -----------------------------------------
    // DELETE ASSIGNMENT
    // -----------------------------------------

    await env.DB.prepare(

        `DELETE FROM plan_features

         WHERE id = ?`

    )

    .bind(assignmentId)

    .run();

    return Response.json({

        success: true,

        message: "Feature removed from subscription plan successfully.",

        data: assignment

    });

}

// -----------------------------------------
// REPLACE PLAN FEATURES
// PUT /api/admin/plan-features/:planId
// -----------------------------------------

if (

    method === "PUT" &&

    pathname.startsWith("/api/admin/plan-features/")

) {

    const planId = pathname.split("/").pop();

    const body = await request.json();

    const {

        feature_ids

    } = body;

    // -----------------------------------------
    // VALIDATION
    // -----------------------------------------

    if (!Array.isArray(feature_ids)) {

        return Response.json({

            success: false,

            message: "feature_ids must be an array."

        }, {

            status: 400

        });

    }

    // -----------------------------------------
    // VERIFY PLAN EXISTS
    // -----------------------------------------

    const plan = await env.DB.prepare(

        `SELECT

            id,
            name

         FROM subscription_plans

         WHERE id = ?`

    )

    .bind(planId)

    .first();

    if (!plan) {

        return Response.json({

            success: false,

            message: "Subscription plan not found."

        }, {

            status: 404

        });

    }

    // -----------------------------------------
    // VERIFY ALL FEATURES EXIST
    // -----------------------------------------

    for (const featureId of feature_ids) {

        const feature = await env.DB.prepare(

            `SELECT

                id

             FROM features

             WHERE id = ?`

        )

        .bind(featureId)

        .first();

        if (!feature) {

            return Response.json({

                success: false,

                message: `Feature not found: ${featureId}`

            }, {

                status: 404

            });

        }

    }

    // -----------------------------------------
    // REMOVE EXISTING ASSIGNMENTS
    // -----------------------------------------

    await env.DB.prepare(

        `DELETE FROM plan_features

         WHERE plan_id = ?`

    )

    .bind(planId)

    .run();

    // -----------------------------------------
    // INSERT NEW ASSIGNMENTS
    // -----------------------------------------

    const now = new Date().toISOString();

    for (const featureId of feature_ids) {

        await env.DB.prepare(

            `INSERT INTO plan_features (

                id,
                plan_id,
                feature_id,
                created_at

            )

            VALUES (

                ?, ?, ?, ?

            )`

        )

        .bind(

            crypto.randomUUID(),

            planId,

            featureId,

            now

        )

        .run();

    }

    // -----------------------------------------
    // RETURN UPDATED FEATURE LIST
    // -----------------------------------------

    const { results } = await env.DB.prepare(

        `SELECT

            pf.id,
            pf.plan_id,
            pf.feature_id,
            pf.created_at,

            f.feature_key,
            f.feature_name,
            f.description,
            f.category,
            f.status

         FROM plan_features pf

         INNER JOIN features f

            ON pf.feature_id = f.id

         WHERE pf.plan_id = ?

         ORDER BY

            f.category ASC,
            f.feature_name ASC`

    )

    .bind(planId)

    .all();

    return Response.json({

        success: true,

        message: "Plan features updated successfully.",

        data: {

            plan,

            features: results

        }

    });

}

// =====================================================
// SUBSCRIPTIONS MANAGEMENT
// =====================================================

// -----------------------------------------
// GET ALL SUBSCRIPTIONS
// GET /api/admin/subscriptions
// -----------------------------------------

if (

    method === "GET" &&

    pathname === "/api/admin/subscriptions"

) {

    const { results } = await env.DB.prepare(

        `SELECT

            s.id,
            s.student_id,
            s.plan_id,
            s.start_date,
            s.end_date,
            s.payment_status,
            s.status,
            s.created_at,
            s.updated_at,

            st.full_name AS first_name,
            '' AS last_name,
            st.email,

            sp.name AS plan_name,
            sp.price,
            sp.duration_days

         FROM subscriptions s

         INNER JOIN students st

            ON s.student_id = st.id

         INNER JOIN subscription_plans sp

            ON s.plan_id = sp.id

         ORDER BY

            s.created_at DESC`

    ).all();

    return Response.json({

        success: true,

        message: "Subscriptions retrieved successfully.",

        data: results

    });

}

// -----------------------------------------
// GET SINGLE SUBSCRIPTION
// GET /api/admin/subscriptions/:id
// -----------------------------------------

if (

    method === "GET" &&

    pathname.startsWith("/api/admin/subscriptions/")

) {

    const subscriptionId = pathname.split("/").pop();

    const subscription = await env.DB.prepare(

        `SELECT

            s.id,
            s.student_id,
            s.plan_id,
            s.start_date,
            s.end_date,
            s.payment_status,
            s.status,
            s.created_at,
            s.updated_at,

            st.full_name AS first_name,
            '' AS last_name,
            st.email,


            sp.name AS plan_name,
            sp.price,
            sp.duration_days

         FROM subscriptions s

         INNER JOIN students st

            ON s.student_id = st.id

         INNER JOIN subscription_plans sp

            ON s.plan_id = sp.id

         WHERE s.id = ?`

    )

    .bind(subscriptionId)

    .first();

    if (!subscription) {

        return Response.json({

            success: false,

            message: "Subscription not found."

        }, {

            status: 404

        });

    }

    return Response.json({

        success: true,

        message: "Subscription retrieved successfully.",

        data: subscription

    });

}

// -----------------------------------------
// CREATE SUBSCRIPTION
// POST /api/admin/subscriptions
// -----------------------------------------

if (

    method === "POST" &&

    pathname === "/api/admin/subscriptions"

) {

    const body = await request.json();

    const {

        student_id,
        plan_id,
        start_date,
        end_date,
        payment_status,
        status

    } = body;

    // -----------------------------------------
    // VALIDATION
    // -----------------------------------------

    if (!student_id || !student_id.trim()) {

        return Response.json({

            success: false,

            message: "Student ID is required."

        }, {

            status: 400

        });

    }

    if (!plan_id || !plan_id.trim()) {

        return Response.json({

            success: false,

            message: "Plan ID is required."

        }, {

            status: 400

        });

    }

    if (!start_date) {

        return Response.json({

            success: false,

            message: "Start date is required."

        }, {

            status: 400

        });

    }

    if (!end_date) {

        return Response.json({

            success: false,

            message: "End date is required."

        }, {

            status: 400

        });

    }

    if (

        payment_status &&

        !["pending", "paid", "failed", "refunded"].includes(payment_status)

    ) {

        return Response.json({

            success: false,

            message: "Invalid payment status."

        }, {

            status: 400

        });

    }

    if (

        status &&

        !["pending", "active", "expired", "cancelled"].includes(status)

    ) {

        return Response.json({

            success: false,

            message: "Invalid subscription status."

        }, {

            status: 400

        });

    }

    if (new Date(end_date) <= new Date(start_date)) {

        return Response.json({

            success: false,

            message: "End date must be after the start date."

        }, {

            status: 400

        });

    }

    // -----------------------------------------
    // VERIFY STUDENT EXISTS
    // -----------------------------------------

    const student = await env.DB.prepare(

        `SELECT

            id

         FROM students

         WHERE id = ?`

    )

    .bind(student_id)

    .first();

    if (!student) {

        return Response.json({

            success: false,

            message: "Student not found."

        }, {

            status: 404

        });

    }

    // -----------------------------------------
    // VERIFY PLAN EXISTS
    // -----------------------------------------

    const plan = await env.DB.prepare(

        `SELECT

            id

         FROM subscription_plans

         WHERE id = ?`

    )

    .bind(plan_id)

    .first();

    if (!plan) {

        return Response.json({

            success: false,

            message: "Subscription plan not found."

        }, {

            status: 404

        });

    }

    const subscriptionId = crypto.randomUUID();

    const now = new Date().toISOString();

    // -----------------------------------------
    // CREATE SUBSCRIPTION
    // -----------------------------------------

    await env.DB.prepare(

        `INSERT INTO subscriptions (

            id,
            student_id,
            plan_id,
            start_date,
            end_date,
            payment_status,
            status,
            created_at,
            updated_at

        )

        VALUES (

            ?, ?, ?, ?, ?, ?, ?, ?, ?

        )`

    )

    .bind(

        subscriptionId,

        student_id,

        plan_id,

        start_date,

        end_date,

        payment_status || "pending",

        status || "pending",

        now,

        now

    )

    .run();

    // -----------------------------------------
    // RETURN CREATED SUBSCRIPTION
    // -----------------------------------------

    const subscription = await env.DB.prepare(

        `SELECT

            s.id,
            s.student_id,
            s.plan_id,
            s.start_date,
            s.end_date,
            s.payment_status,
            s.status,
            s.created_at,
            s.updated_at,

            st.full_name AS first_name,
            '' AS last_name,
            st.email,


            sp.name AS plan_name,
            sp.price,
            sp.duration_days

         FROM subscriptions s

         INNER JOIN students st

            ON s.student_id = st.id

         INNER JOIN subscription_plans sp

            ON s.plan_id = sp.id

         WHERE s.id = ?`

    )

    .bind(subscriptionId)

    .first();

    return Response.json({

        success: true,

        message: "Subscription created successfully.",

        data: subscription

    }, {

        status: 201

    });

}

// -----------------------------------------
// UPDATE SUBSCRIPTION
// PUT /api/admin/subscriptions/:id
// -----------------------------------------

if (

    method === "PUT" &&

    pathname.startsWith("/api/admin/subscriptions/")

) {

    const subscriptionId = pathname.split("/").pop();

    const body = await request.json();

    const {

        student_id,
        plan_id,
        start_date,
        end_date,
        payment_status,
        status

    } = body;

    // -----------------------------------------
    // VALIDATION
    // -----------------------------------------

    if (!student_id || !student_id.trim()) {

        return Response.json({

            success: false,

            message: "Student ID is required."

        }, {

            status: 400

        });

    }

    if (!plan_id || !plan_id.trim()) {

        return Response.json({

            success: false,

            message: "Plan ID is required."

        }, {

            status: 400

        });

    }

    if (!start_date) {

        return Response.json({

            success: false,

            message: "Start date is required."

        }, {

            status: 400

        });

    }

    if (!end_date) {

        return Response.json({

            success: false,

            message: "End date is required."

        }, {

            status: 400

        });

    }

    if (

        payment_status &&

        !["pending", "paid", "failed", "refunded"].includes(payment_status)

    ) {

        return Response.json({

            success: false,

            message: "Invalid payment status."

        }, {

            status: 400

        });

    }

    if (

        status &&

        !["pending", "active", "expired", "cancelled"].includes(status)

    ) {

        return Response.json({

            success: false,

            message: "Invalid subscription status."

        }, {

            status: 400

        });

    }

    if (new Date(end_date) <= new Date(start_date)) {

        return Response.json({

            success: false,

            message: "End date must be after the start date."

        }, {

            status: 400

        });

    }

    // -----------------------------------------
    // VERIFY SUBSCRIPTION EXISTS
    // -----------------------------------------

    const existingSubscription = await env.DB.prepare(

        `SELECT id

         FROM subscriptions

         WHERE id = ?`

    )

    .bind(subscriptionId)

    .first();

    if (!existingSubscription) {

        return Response.json({

            success: false,

            message: "Subscription not found."

        }, {

            status: 404

        });

    }

    // -----------------------------------------
    // VERIFY STUDENT EXISTS
    // -----------------------------------------

    const student = await env.DB.prepare(

        `SELECT id

         FROM students

         WHERE id = ?`

    )

    .bind(student_id)

    .first();

    if (!student) {

        return Response.json({

            success: false,

            message: "Student not found."

        }, {

            status: 404

        });

    }

    // -----------------------------------------
    // VERIFY PLAN EXISTS
    // -----------------------------------------

    const plan = await env.DB.prepare(

        `SELECT id

         FROM subscription_plans

         WHERE id = ?`

    )

    .bind(plan_id)

    .first();

    if (!plan) {

        return Response.json({

            success: false,

            message: "Subscription plan not found."

        }, {

            status: 404

        });

    }

    const now = new Date().toISOString();

    // -----------------------------------------
    // UPDATE SUBSCRIPTION
    // -----------------------------------------

    await env.DB.prepare(

        `UPDATE subscriptions

         SET

            student_id = ?,
            plan_id = ?,
            start_date = ?,
            end_date = ?,
            payment_status = ?,
            status = ?,
            updated_at = ?

         WHERE id = ?`

    )

    .bind(

        student_id,

        plan_id,

        start_date,

        end_date,

        payment_status || "pending",

        status || "pending",

        now,

        subscriptionId

    )

    .run();

    // -----------------------------------------
    // RETURN UPDATED SUBSCRIPTION
    // -----------------------------------------

    const subscription = await env.DB.prepare(

        `SELECT

            s.id,
            s.student_id,
            s.plan_id,
            s.start_date,
            s.end_date,
            s.payment_status,
            s.status,
            s.created_at,
            s.updated_at,

            st.full_name AS first_name,
            '' AS last_name,
            st.email,


            sp.name AS plan_name,
            sp.price,
            sp.duration_days

         FROM subscriptions s

         INNER JOIN students st

            ON s.student_id = st.id

         INNER JOIN subscription_plans sp

            ON s.plan_id = sp.id

         WHERE s.id = ?`

    )

    .bind(subscriptionId)

    .first();

    return Response.json({

        success: true,

        message: "Subscription updated successfully.",

        data: subscription

    });

}

// -----------------------------------------
// UPDATE SUBSCRIPTION STATUS
// PATCH /api/admin/subscriptions/:id/status
// -----------------------------------------

if (

    method === "PATCH" &&

    pathname.match(/^\/api\/admin\/subscriptions\/[^/]+\/status$/)

) {

    const subscriptionId = pathname.split("/")[4];

    const body = await request.json();

    const { status } = body;

    if (

        !["pending", "active", "expired", "cancelled"].includes(status)

    ) {

        return Response.json({

            success: false,

            message: "Invalid subscription status."

        }, {

            status: 400

        });

    }

    const subscription = await env.DB.prepare(

        `SELECT id

         FROM subscriptions

         WHERE id = ?`

    )

    .bind(subscriptionId)

    .first();

    if (!subscription) {

        return Response.json({

            success: false,

            message: "Subscription not found."

        }, {

            status: 404

        });

    }

    const now = new Date().toISOString();

    await env.DB.prepare(

        `UPDATE subscriptions

         SET

            status = ?,

            updated_at = ?

         WHERE id = ?`

    )

    .bind(

        status,

        now,

        subscriptionId

    )

    .run();

    const updatedSubscription = await env.DB.prepare(

        `SELECT *

         FROM subscriptions

         WHERE id = ?`

    )

    .bind(subscriptionId)

    .first();

    return Response.json({

        success: true,

        message: "Subscription status updated successfully.",

        data: updatedSubscription

    });

}

// -----------------------------------------
// UPDATE PAYMENT STATUS
// PATCH /api/admin/subscriptions/:id/payment-status
// -----------------------------------------

if (

    method === "PATCH" &&

    pathname.match(/^\/api\/admin\/subscriptions\/[^/]+\/payment-status$/)

) {

    const subscriptionId = pathname.split("/")[4];

    const body = await request.json();

    const { payment_status } = body;

    if (

        !["pending", "paid", "failed", "refunded"].includes(payment_status)

    ) {

        return Response.json({

            success: false,

            message: "Invalid payment status."

        }, {

            status: 400

        });

    }

    const subscription = await env.DB.prepare(

        `SELECT id

         FROM subscriptions

         WHERE id = ?`

    )

    .bind(subscriptionId)

    .first();

    if (!subscription) {

        return Response.json({

            success: false,

            message: "Subscription not found."

        }, {

            status: 404

        });

    }

    const now = new Date().toISOString();

    await env.DB.prepare(

        `UPDATE subscriptions

         SET

            payment_status = ?,

            updated_at = ?

         WHERE id = ?`

    )

    .bind(

        payment_status,

        now,

        subscriptionId

    )

    .run();

    const updatedSubscription = await env.DB.prepare(

        `SELECT *

         FROM subscriptions

         WHERE id = ?`

    )

    .bind(subscriptionId)

    .first();

    return Response.json({

        success: true,

        message: "Payment status updated successfully.",

        data: updatedSubscription

    });

}

// -----------------------------------------
// DELETE SUBSCRIPTION
// DELETE /api/admin/subscriptions/:id
// -----------------------------------------

if (

    method === "DELETE" &&

    pathname.startsWith("/api/admin/subscriptions/")

) {

    const subscriptionId = pathname.split("/").pop();

    const subscription = await env.DB.prepare(

        `SELECT

            id,
            student_id,
            plan_id

         FROM subscriptions

         WHERE id = ?`

    )

    .bind(subscriptionId)

    .first();

    if (!subscription) {

        return Response.json({

            success: false,

            message: "Subscription not found."

        }, {

            status: 404

        });

    }

    await env.DB.prepare(

        `DELETE FROM subscriptions

         WHERE id = ?`

    )

    .bind(subscriptionId)

    .run();

    return Response.json({

        success: true,

        message: "Subscription deleted successfully."

    });

}

// =====================================================
// TRIAL USAGE MANAGEMENT
// =====================================================

// -----------------------------------------
// GET ALL TRIAL USAGE
// GET /api/admin/trial-usage
// -----------------------------------------

if (

    method === "GET" &&

    pathname === "/api/admin/trial-usage"

) {

    const { results } = await env.DB.prepare(

        `SELECT

            tu.id,
            tu.student_id,
            tu.subject_id,
            tu.questions_used,
            tu.correct_answers,
            tu.wrong_answers,
            tu.first_accessed_at,
            tu.last_question_at,
            tu.created_at,
            tu.updated_at,

            st.full_name AS first_name,
            '' AS last_name,
            st.email,


            sb.name AS subject_name

         FROM trial_usage tu

         INNER JOIN students st

            ON tu.student_id = st.id

         INNER JOIN subjects sb

            ON tu.subject_id = sb.id

         ORDER BY

            tu.updated_at DESC`

    ).all();

    return Response.json({

        success: true,

        message: "Trial usage records retrieved successfully.",

        data: results

    });

}

// -----------------------------------------
// GET SINGLE TRIAL USAGE
// GET /api/admin/trial-usage/:id
// -----------------------------------------

if (

    method === "GET" &&

    pathname.startsWith("/api/admin/trial-usage/")

) {

    const trialUsageId = pathname.split("/").pop();

    const trialUsage = await env.DB.prepare(

        `SELECT

            tu.id,
            tu.student_id,
            tu.subject_id,
            tu.questions_used,
            tu.correct_answers,
            tu.wrong_answers,
            tu.first_accessed_at,
            tu.last_question_at,
            tu.created_at,
            tu.updated_at,

            st.full_name AS first_name,
            '' AS last_name,
            st.email,


            sb.name AS subject_name

         FROM trial_usage tu

         INNER JOIN students st

            ON tu.student_id = st.id

         INNER JOIN subjects sb

            ON tu.subject_id = sb.id

         WHERE tu.id = ?`

    )

    .bind(trialUsageId)

    .first();

    if (!trialUsage) {

        return Response.json({

            success: false,

            message: "Trial usage record not found."

        }, {

            status: 404

        });

    }

    return Response.json({

        success: true,

        message: "Trial usage record retrieved successfully.",

        data: trialUsage

    });

}

// -----------------------------------------
// CREATE TRIAL USAGE
// POST /api/admin/trial-usage
// -----------------------------------------

if (

    method === "POST" &&

    pathname === "/api/admin/trial-usage"

) {

    const body = await request.json();

    const {

        student_id,
        subject_id,
        questions_used,
        correct_answers,
        wrong_answers,
        first_accessed_at,
        last_question_at

    } = body;

    // -----------------------------------------
    // VALIDATION
    // -----------------------------------------

    if (!student_id || !student_id.trim()) {

        return Response.json({

            success: false,

            message: "Student ID is required."

        }, {

            status: 400

        });

    }

    if (!subject_id || !subject_id.trim()) {

        return Response.json({

            success: false,

            message: "Subject ID is required."

        }, {

            status: 400

        });

    }

    if (!first_accessed_at) {

        return Response.json({

            success: false,

            message: "First accessed date is required."

        }, {

            status: 400

        });

    }

    if (!last_question_at) {

        return Response.json({

            success: false,

            message: "Last question date is required."

        }, {

            status: 400

        });

    }

    const used = Number(questions_used ?? 0);
    const correct = Number(correct_answers ?? 0);
    const wrong = Number(wrong_answers ?? 0);

    if (

        !Number.isInteger(used) ||
        used < 0

    ) {

        return Response.json({

            success: false,

            message: "Questions used must be a non-negative integer."

        }, {

            status: 400

        });

    }

    if (

        !Number.isInteger(correct) ||
        correct < 0

    ) {

        return Response.json({

            success: false,

            message: "Correct answers must be a non-negative integer."

        }, {

            status: 400

        });

    }

    if (

        !Number.isInteger(wrong) ||
        wrong < 0

    ) {

        return Response.json({

            success: false,

            message: "Wrong answers must be a non-negative integer."

        }, {

            status: 400

        });

    }

    // -----------------------------------------
    // VERIFY STUDENT EXISTS
    // -----------------------------------------

    const student = await env.DB.prepare(

        `SELECT id

         FROM students

         WHERE id = ?`

    )

    .bind(student_id)

    .first();

    if (!student) {

        return Response.json({

            success: false,

            message: "Student not found."

        }, {

            status: 404

        });

    }

    // -----------------------------------------
    // VERIFY SUBJECT EXISTS
    // -----------------------------------------

    const subject = await env.DB.prepare(

        `SELECT id

         FROM subjects

         WHERE id = ?`

    )

    .bind(subject_id)

    .first();

    if (!subject) {

        return Response.json({

            success: false,

            message: "Subject not found."

        }, {

            status: 404

        });

    }

    // -----------------------------------------
    // PREVENT DUPLICATE RECORD
    // -----------------------------------------

    const existing = await env.DB.prepare(

        `SELECT id

         FROM trial_usage

         WHERE student_id = ?

         AND subject_id = ?`

    )

    .bind(

        student_id,

        subject_id

    )

    .first();

    if (existing) {

        return Response.json({

            success: false,

            message: "Trial usage record already exists for this student and subject."

        }, {

            status: 409

        });

    }

    const trialUsageId = crypto.randomUUID();

    const now = new Date().toISOString();

    // -----------------------------------------
    // CREATE RECORD
    // -----------------------------------------

    await env.DB.prepare(

        `INSERT INTO trial_usage (

            id,
            student_id,
            subject_id,
            questions_used,
            correct_answers,
            wrong_answers,
            first_accessed_at,
            last_question_at,
            created_at,
            updated_at

        )

        VALUES (

            ?, ?, ?, ?, ?, ?, ?, ?, ?, ?

        )`

    )

    .bind(

        trialUsageId,

        student_id,

        subject_id,

        used,

        correct,

        wrong,

        first_accessed_at,

        last_question_at,

        now,

        now

    )

    .run();

    // -----------------------------------------
    // RETURN CREATED RECORD
    // -----------------------------------------

    const trialUsage = await env.DB.prepare(

        `SELECT

            tu.id,
            tu.student_id,
            tu.subject_id,
            tu.questions_used,
            tu.correct_answers,
            tu.wrong_answers,
            tu.first_accessed_at,
            tu.last_question_at,
            tu.created_at,
            tu.updated_at,

            st.full_name AS first_name,
            '' AS last_name,
            st.email,


            sb.name AS subject_name

         FROM trial_usage tu

         INNER JOIN students st

            ON tu.student_id = st.id

         INNER JOIN subjects sb

            ON tu.subject_id = sb.id

         WHERE tu.id = ?`

    )

    .bind(trialUsageId)

    .first();

    return Response.json({

        success: true,

        message: "Trial usage record created successfully.",

        data: trialUsage

    }, {

        status: 201

    });

}

// -----------------------------------------
// UPDATE TRIAL USAGE
// PUT /api/admin/trial-usage/:id
// -----------------------------------------

if (

    method === "PUT" &&

    pathname.startsWith("/api/admin/trial-usage/")

) {

    const trialUsageId = pathname.split("/").pop();

    const body = await request.json();

    const {

        student_id,
        subject_id,
        questions_used,
        correct_answers,
        wrong_answers,
        first_accessed_at,
        last_question_at

    } = body;

    // -----------------------------------------
    // VALIDATION
    // -----------------------------------------

    if (!student_id || !student_id.trim()) {

        return Response.json({

            success: false,

            message: "Student ID is required."

        }, {

            status: 400

        });

    }

    if (!subject_id || !subject_id.trim()) {

        return Response.json({

            success: false,

            message: "Subject ID is required."

        }, {

            status: 400

        });

    }

    if (!first_accessed_at) {

        return Response.json({

            success: false,

            message: "First accessed date is required."

        }, {

            status: 400

        });

    }

    if (!last_question_at) {

        return Response.json({

            success: false,

            message: "Last question date is required."

        }, {

            status: 400

        });

    }

    const used = Number(questions_used ?? 0);
    const correct = Number(correct_answers ?? 0);
    const wrong = Number(wrong_answers ?? 0);

    if (!Number.isInteger(used) || used < 0) {

        return Response.json({

            success: false,

            message: "Questions used must be a non-negative integer."

        }, {

            status: 400

        });

    }

    if (!Number.isInteger(correct) || correct < 0) {

        return Response.json({

            success: false,

            message: "Correct answers must be a non-negative integer."

        }, {

            status: 400

        });

    }

    if (!Number.isInteger(wrong) || wrong < 0) {

        return Response.json({

            success: false,

            message: "Wrong answers must be a non-negative integer."

        }, {

            status: 400

        });

    }

    // -----------------------------------------
    // VERIFY RECORD EXISTS
    // -----------------------------------------

    const existingRecord = await env.DB.prepare(

        `SELECT id

         FROM trial_usage

         WHERE id = ?`

    )

    .bind(trialUsageId)

    .first();

    if (!existingRecord) {

        return Response.json({

            success: false,

            message: "Trial usage record not found."

        }, {

            status: 404

        });

    }

    // -----------------------------------------
    // VERIFY STUDENT EXISTS
    // -----------------------------------------

    const student = await env.DB.prepare(

        `SELECT id

         FROM students

         WHERE id = ?`

    )

    .bind(student_id)

    .first();

    if (!student) {

        return Response.json({

            success: false,

            message: "Student not found."

        }, {

            status: 404

        });

    }

    // -----------------------------------------
    // VERIFY SUBJECT EXISTS
    // -----------------------------------------

    const subject = await env.DB.prepare(

        `SELECT id

         FROM subjects

         WHERE id = ?`

    )

    .bind(subject_id)

    .first();

    if (!subject) {

        return Response.json({

            success: false,

            message: "Subject not found."

        }, {

            status: 404

        });

    }

    // -----------------------------------------
    // CHECK UNIQUE STUDENT + SUBJECT
    // -----------------------------------------

    const duplicate = await env.DB.prepare(

        `SELECT id

         FROM trial_usage

         WHERE student_id = ?

         AND subject_id = ?

         AND id <> ?`

    )

    .bind(

        student_id,

        subject_id,

        trialUsageId

    )

    .first();

    if (duplicate) {

        return Response.json({

            success: false,

            message: "A trial usage record already exists for this student and subject."

        }, {

            status: 409

        });

    }

    const now = new Date().toISOString();

    // -----------------------------------------
    // UPDATE RECORD
    // -----------------------------------------

    await env.DB.prepare(

        `UPDATE trial_usage

         SET

            student_id = ?,
            subject_id = ?,
            questions_used = ?,
            correct_answers = ?,
            wrong_answers = ?,
            first_accessed_at = ?,
            last_question_at = ?,
            updated_at = ?

         WHERE id = ?`

    )

    .bind(

        student_id,

        subject_id,

        used,

        correct,

        wrong,

        first_accessed_at,

        last_question_at,

        now,

        trialUsageId

    )

    .run();

    // -----------------------------------------
    // RETURN UPDATED RECORD
    // -----------------------------------------

    const trialUsage = await env.DB.prepare(

        `SELECT

            tu.id,
            tu.student_id,
            tu.subject_id,
            tu.questions_used,
            tu.correct_answers,
            tu.wrong_answers,
            tu.first_accessed_at,
            tu.last_question_at,
            tu.created_at,
            tu.updated_at,

            st.full_name AS first_name,
            '' AS last_name,
            st.email,


            sb.name AS subject_name

         FROM trial_usage tu

         INNER JOIN students st

            ON tu.student_id = st.id

         INNER JOIN subjects sb

            ON tu.subject_id = sb.id

         WHERE tu.id = ?`

    )

    .bind(trialUsageId)

    .first();

    return Response.json({

        success: true,

        message: "Trial usage record updated successfully.",

        data: trialUsage

    });

}

// -----------------------------------------
// DELETE TRIAL USAGE
// DELETE /api/admin/trial-usage/:id
// -----------------------------------------

if (

    method === "DELETE" &&

    pathname.startsWith("/api/admin/trial-usage/")

) {

    const trialUsageId = pathname.split("/").pop();

    // -----------------------------------------
    // VERIFY RECORD EXISTS
    // -----------------------------------------

    const trialUsage = await env.DB.prepare(

        `SELECT

            id,
            student_id,
            subject_id

         FROM trial_usage

         WHERE id = ?`

    )

    .bind(trialUsageId)

    .first();

    if (!trialUsage) {

        return Response.json({

            success: false,

            message: "Trial usage record not found."

        }, {

            status: 404

        });

    }

    // -----------------------------------------
    // DELETE RECORD
    // -----------------------------------------

    await env.DB.prepare(

        `DELETE

         FROM trial_usage

         WHERE id = ?`

    )

    .bind(trialUsageId)

    .run();

    return Response.json({

        success: true,

        message: "Trial usage record deleted successfully."

    });

}

        // =====================================================
// PAYMENT MANAGEMENT
// =====================================================

// -----------------------------------------
// LIST PAYMENTS
// GET /api/admin/payments
// -----------------------------------------

if (

    method === "GET" &&

    pathname === "/api/admin/payments"

) {

    const page = Math.max(

        parseInt(

            url.searchParams.get("page") || "1"

        ),

        1

    );

    const limit = Math.min(

        Math.max(

            parseInt(

                url.searchParams.get("limit") || "20"

            ),

            1

        ),

        100

    );

    const offset = (page - 1) * limit;

    const { results } = await env.DB.prepare(

        `

        SELECT

            p.id,

            p.student_id,

            st.full_name,

            st.email,

            p.subscription_id,

            s.plan_type,

            p.gateway,

            p.gateway_transaction_id,

            p.transaction_reference,

            p.amount,

            p.currency,

            p.payment_method,

            p.payment_status,

            p.paid_at,

            p.created_at,

            p.updated_at

        FROM payments p

        INNER JOIN students st

            ON p.student_id = st.id

        INNER JOIN subscriptions s

            ON p.subscription_id = s.id

        ORDER BY

            p.created_at DESC

        LIMIT ?

        OFFSET ?

        `

    )

    .bind(

        limit,

        offset

    )

    .all();

    return Response.json({

        success: true,

        message: "Payments retrieved successfully.",

        page,

        limit,

        count: results.length,

        data: results

    });

}

// -----------------------------------------
// GET PAYMENT
// GET /api/admin/payments/:id
// -----------------------------------------

if (

    method === "GET" &&

    pathname.startsWith("/api/admin/payments/")

) {

    const paymentId = pathname.split("/").pop();

    const payment = await env.DB.prepare(

        `

        SELECT

            p.id,

            p.student_id,

            st.full_name,

            st.email,

            p.subscription_id,

            s.plan_type,

            p.gateway,

            p.gateway_transaction_id,

            p.transaction_reference,

            p.amount,

            p.currency,

            p.payment_method,

            p.payment_status,

            p.gateway_response,

            p.paid_at,

            p.created_at,

            p.updated_at

        FROM payments p

        INNER JOIN students st

            ON p.student_id = st.id

        INNER JOIN subscriptions s

            ON p.subscription_id = s.id

        WHERE

            p.id = ?

        `

    )

    .bind(

        paymentId

    )

    .first();

    if (!payment) {

        return Response.json({

            success: false,

            message: "Payment not found."

        }, {

            status: 404

        });

    }

    return Response.json({

        success: true,

        message: "Payment retrieved successfully.",

        data: payment

    });

}

// -----------------------------------------
// SEARCH / FILTER PAYMENTS
// GET /api/admin/payments/search
// -----------------------------------------

if (

    method === "GET" &&

    pathname === "/api/admin/payments/search"

) {

    const search = url.searchParams.get("search") || "";

    const gateway = url.searchParams.get("gateway") || "";

    const payment_status = url.searchParams.get("payment_status") || "";

    const currency = url.searchParams.get("currency") || "";

    const page = Math.max(

        parseInt(

            url.searchParams.get("page") || "1"

        ),

        1

    );

    const limit = Math.min(

        Math.max(

            parseInt(

                url.searchParams.get("limit") || "20"

            ),

            1

        ),

        100

    );

    const offset = (page - 1) * limit;

    let sql = `

        SELECT

            p.id,

            p.student_id,

            st.full_name,

            st.email,

            p.subscription_id,

            s.plan_type,

            p.gateway,

            p.gateway_transaction_id,

            p.transaction_reference,

            p.amount,

            p.currency,

            p.payment_method,

            p.payment_status,

            p.paid_at,

            p.created_at,

            p.updated_at

        FROM payments p

        INNER JOIN students st

            ON p.student_id = st.id

        INNER JOIN subscriptions s

            ON p.subscription_id = s.id

        WHERE 1 = 1

    `;

    const bindings = [];

    if (search) {

        sql += `

            AND (

                LOWER(st.full_name) LIKE LOWER(?)

                OR LOWER(st.email) LIKE LOWER(?)

                OR LOWER(p.transaction_reference) LIKE LOWER(?)

            )

        `;

        const keyword = `%${search}%`;

        bindings.push(

            keyword,

            keyword,

            keyword

        );

    }

    if (gateway) {

        sql += `

            AND p.gateway = ?

        `;

        bindings.push(

            gateway

        );

    }

    if (payment_status) {

        sql += `

            AND p.payment_status = ?

        `;

        bindings.push(

            payment_status

        );

    }

    if (currency) {

        sql += `

            AND p.currency = ?

        `;

        bindings.push(

            currency

        );

    }

    sql += `

        ORDER BY

            p.created_at DESC

        LIMIT ?

        OFFSET ?

    `;

    bindings.push(

        limit,

        offset

    );

    const { results } = await env.DB.prepare(

        sql

    )

    .bind(

        ...bindings

    )

    .all();

    return Response.json({

        success: true,

        message: "Payments retrieved successfully.",

        page,

        limit,

        count: results.length,

        data: results

    });

}

// -----------------------------------------
// UPDATE PAYMENT STATUS
// PATCH /api/admin/payments/:id/status
// -----------------------------------------

if (

    method === "PATCH" &&

    pathname.startsWith("/api/admin/payments/") &&

    pathname.endsWith("/status")

) {

    const parts = pathname.split("/");

    const paymentId = parts[parts.length - 2];

    const body = await request.json();

    const {

        payment_status

    } = body;

    // -----------------------------------------
    // VALIDATION
    // -----------------------------------------

    if (!payment_status) {

        return Response.json({

            success: false,

            message: "Payment status is required."

        }, {

            status: 400

        });

    }

    const allowedStatuses = [

        "pending",

        "processing",

        "paid",

        "failed",

        "cancelled",

        "refunded"

    ];

    if (

        !allowedStatuses.includes(

            payment_status

        )

    ) {

        return Response.json({

            success: false,

            message: "Invalid payment status."

        }, {

            status: 400

        });

    }

    // -----------------------------------------
    // CHECK PAYMENT
    // -----------------------------------------

    const payment = await env.DB.prepare(

        `

        SELECT

            id

        FROM payments

        WHERE id = ?

        `

    )

    .bind(

        paymentId

    )

    .first();

    if (!payment) {

        return Response.json({

            success: false,

            message: "Payment not found."

        }, {

            status: 404

        });

    }

    const now = new Date().toISOString();

    let paidAt = null;

    if (payment_status === "paid") {

        paidAt = now;

    }

    await env.DB.prepare(

        `

        UPDATE payments

        SET

            payment_status = ?,

            paid_at = COALESCE(?, paid_at),

            updated_at = ?

        WHERE id = ?

        `

    )

    .bind(

        payment_status,

        paidAt,

        now,

        paymentId

    )

    .run();

    const updatedPayment = await env.DB.prepare(

        `

        SELECT *

        FROM payments

        WHERE id = ?

        `

    )

    .bind(

        paymentId

    )

    .first();

    return Response.json({

        success: true,

        message: "Payment status updated successfully.",

        data: updatedPayment

    });

}

// -----------------------------------------
// REFUND PAYMENT
// POST /api/admin/payments/:id/refund
// -----------------------------------------

if (

    method === "POST" &&

    pathname.startsWith("/api/admin/payments/") &&

    pathname.endsWith("/refund")

) {

    const parts = pathname.split("/");

    const paymentId = parts[parts.length - 2];

    // -----------------------------------------
    // CHECK PAYMENT
    // -----------------------------------------

    const payment = await env.DB.prepare(

        `

        SELECT

            *

        FROM payments

        WHERE id = ?

        `

    )

    .bind(

        paymentId

    )

    .first();

    if (!payment) {

        return Response.json({

            success: false,

            message: "Payment not found."

        }, {

            status: 404

        });

    }

    if (payment.payment_status !== "paid") {

        return Response.json({

            success: false,

            message: "Only paid payments can be refunded."

        }, {

            status: 400

        });

    }

    const now = new Date().toISOString();

    // -----------------------------------------
    // UPDATE PAYMENT
    // -----------------------------------------

    await env.DB.prepare(

        `

        UPDATE payments

        SET

            payment_status = 'refunded',

            updated_at = ?

        WHERE id = ?

        `

    )

    .bind(

        now,

        paymentId

    )

    .run();

    // -----------------------------------------
    // UPDATE SUBSCRIPTION
    // -----------------------------------------

    await env.DB.prepare(

        `

        UPDATE subscriptions

        SET

            payment_status = 'refunded',

            status = 'inactive',

            updated_at = ?

        WHERE id = ?

        `

    )

    .bind(

        now,

        payment.subscription_id

    )

    .run();

    const updatedPayment = await env.DB.prepare(

        `

        SELECT *

        FROM payments

        WHERE id = ?

        `

    )

    .bind(

        paymentId

    )

    .first();

    return Response.json({

        success: true,

        message: "Payment refunded successfully.",

        data: updatedPayment

    });

}

// -----------------------------------------
// DELETE PAYMENT
// DELETE /api/admin/payments/:id
// -----------------------------------------

if (

    method === "DELETE" &&

    pathname.startsWith("/api/admin/payments/")

) {

    const paymentId = pathname.split("/").pop();

    // -----------------------------------------
    // CHECK PAYMENT
    // -----------------------------------------

    const payment = await env.DB.prepare(

        `

        SELECT

            id,

            payment_status

        FROM payments

        WHERE id = ?

        `

    )

    .bind(

        paymentId

    )

    .first();

    if (!payment) {

        return Response.json({

            success: false,

            message: "Payment not found."

        }, {

            status: 404

        });

    }

    // -----------------------------------------
    // PROTECT PAID PAYMENTS
    // -----------------------------------------

    if (payment.payment_status === "paid") {

        return Response.json({

            success: false,

            message: "Paid payment records cannot be deleted."

        }, {

            status: 400

        });

    }

    // -----------------------------------------
    // DELETE PAYMENT
    // -----------------------------------------

    await env.DB.prepare(

        `

        DELETE FROM payments

        WHERE id = ?

        `

    )

    .bind(

        paymentId

    )

    .run();

    return Response.json({

        success: true,

        message: "Payment deleted successfully."

    });

}

// =====================================================
// REFERRAL MANAGEMENT
// =====================================================

// Get all referrals
if (method === "GET" && pathname === "/api/admin/referrals") {

    const { results } = await env.DB.prepare(`
        SELECT
            r.id,
            r.referral_code,
            r.referred_email,
            r.status,
            r.reward_qualified,
            r.first_subscription_date,
            r.created_at,

            ref.full_name AS referrer_name,
            ref.email AS referrer_email,

            stu.full_name AS referred_name,
            stu.email AS referred_email_registered,

            e.name AS exam_name

        FROM referrals r

        LEFT JOIN students ref
            ON ref.id = r.referrer_student_id

        LEFT JOIN students stu
            ON stu.id = r.referred_student_id

        LEFT JOIN exams e
            ON e.id = r.exam_id

        ORDER BY r.created_at DESC
    `).all();

    return Response.json({
        success: true,
        referrals: results
    });
}

// -----------------------------------------
// GET SINGLE REFERRAL
// GET /api/admin/referrals/:id
// -----------------------------------------

if (

    method === "GET" &&

    pathname.startsWith("/api/admin/referrals/")

) {

    const referralId = pathname.split("/").pop();

    const referral = await env.DB.prepare(

        `SELECT

            r.id,

            r.referral_code,

            r.referrer_student_id,

            ref.full_name AS referrer_name,

            ref.email AS referrer_email,

            r.referred_student_id,

            stu.full_name AS referred_name,

            stu.email AS referred_email_registered,

            r.referred_email,

            r.exam_id,

            e.name AS exam_name,

            r.status,

            r.first_subscription_id,

            r.first_subscription_date,

            r.reward_qualified,

            r.notes,

            r.created_at,

            r.updated_at

        FROM referrals r

        LEFT JOIN students ref

            ON r.referrer_student_id = ref.id

        LEFT JOIN students stu

            ON r.referred_student_id = stu.id

        LEFT JOIN exams e

            ON r.exam_id = e.id

        WHERE r.id = ?`

    )

    .bind(referralId)

    .first();

    if (!referral) {

        return Response.json({

            success: false,

            message: "Referral not found."

        }, {

            status: 404

        });

    }

    return Response.json({

        success: true,

        message: "Referral retrieved successfully.",

        data: referral

    });

}

// -----------------------------------------
// UPDATE REFERRAL
// PUT /api/admin/referrals/:id
// -----------------------------------------

if (

    method === "PUT" &&

    pathname.startsWith("/api/admin/referrals/")

) {

    const referralId = pathname.split("/").pop();

    const body = await request.json();

    const {

        status,

        notes

    } = body;

    // -----------------------------------------
    // VALIDATION
    // -----------------------------------------

    const validStatuses = [

        "Pending",

        "Registered",

        "Successful",

        "Cancelled"

    ];

    if (

        !status ||

        !validStatuses.includes(status)

    ) {

        return Response.json({

            success: false,

            message: "Invalid referral status."

        }, {

            status: 400

        });

    }

    // -----------------------------------------
    // VERIFY REFERRAL EXISTS
    // -----------------------------------------

    const referral = await env.DB.prepare(

        `SELECT

            id

         FROM referrals

         WHERE id = ?`

    )

    .bind(referralId)

    .first();

    if (!referral) {

        return Response.json({

            success: false,

            message: "Referral not found."

        }, {

            status: 404

        });

    }

    const now = new Date().toISOString();

    // -----------------------------------------
    // UPDATE REFERRAL
    // -----------------------------------------

    await env.DB.prepare(

        `UPDATE referrals

         SET

            status = ?,

            notes = ?,

            updated_at = ?

         WHERE id = ?`

    )

    .bind(

        status,

        notes || "",

        now,

        referralId

    )

    .run();

    return Response.json({

        success: true,

        message: "Referral updated successfully."

    });

}

// -----------------------------------------
// DELETE REFERRAL
// DELETE /api/admin/referrals/:id
// -----------------------------------------

if (

    method === "DELETE" &&

    pathname.startsWith("/api/admin/referrals/")

) {

    const referralId = pathname.split("/").pop();

    // -----------------------------------------
    // VERIFY REFERRAL EXISTS
    // -----------------------------------------

    const referral = await env.DB.prepare(

        `SELECT

            id

         FROM referrals

         WHERE id = ?`

    )

    .bind(referralId)

    .first();

    if (!referral) {

        return Response.json({

            success: false,

            message: "Referral not found."

        }, {

            status: 404

        });

    }

    // -----------------------------------------
    // DELETE REFERRAL
    // -----------------------------------------

    await env.DB.prepare(

        `DELETE

         FROM referrals

         WHERE id = ?`

    )

    .bind(referralId)

    .run();

    return Response.json({

        success: true,

        message: "Referral deleted successfully."

    });

}
       // =====================================================
        // NOTIFICATION MANAGEMENT
        // =====================================================

        // -----------------------------------------
        // GET ALL NOTIFICATIONS
        // GET /api/admin/notifications
        // -----------------------------------------

        if (

            method === "GET" &&

            pathname === "/api/admin/notifications"

        ) {

            const { results } = await env.DB.prepare(

                `SELECT

                    n.id,

                    n.student_id,

                    u.full_name,

                    n.title,

                    n.message,

                    n.notification_type,

                    n.is_read,

                    n.created_by_admin_id,

                    a.full_name AS created_by,

                    n.created_at

                FROM notifications n

                LEFT JOIN students s

                    ON n.student_id = s.id

                LEFT JOIN admins a

                    ON n.created_by_admin_id = a.id

                ORDER BY

                    n.created_at DESC`

            ).all();

            return Response.json({

                success: true,

                message: "Notifications retrieved successfully.",

                data: results

            });

        }

        // -----------------------------------------
        // GET SINGLE NOTIFICATION
        // GET /api/admin/notifications/:id
        // -----------------------------------------

        if (

            method === "GET" &&

            pathname.startsWith("/api/admin/notifications/")

        ) {

            const notificationId = pathname.split("/").pop();

            const notification = await env.DB.prepare(

                `SELECT

                    n.id,

                    n.student_id,

                    u.full_name,

                    n.title,

                    n.message,

                    n.notification_type,

                    n.is_read,

                    n.created_by_admin_id,

                    a.full_name AS created_by,

                    n.created_at

                FROM notifications n

                LEFT JOIN students s

                    ON n.student_id = s.id

                LEFT JOIN admins a

                    ON n.created_by_admin_id = a.id

                WHERE n.id = ?`

            )

            .bind(notificationId)

            .first();

            if (!notification) {

                return Response.json({

                    success: false,

                    message: "Notification not found."

                }, {

                    status: 404

                });

            }

            return Response.json({

                success: true,

                message: "Notification retrieved successfully.",

                data: notification

            });

        }

                // -----------------------------------------
        // CREATE NOTIFICATION
        // POST /api/admin/notifications
        // -----------------------------------------

        if (

            method === "POST" &&

            pathname === "/api/admin/notifications"

        ) {

            const body = await request.json();

            const {

                student_id,

                title,

                message,

                notification_type,

                created_by_admin_id

            } = body;

            // -----------------------------------------
            // VALIDATION
            // -----------------------------------------

            if (!title || title.trim() === "") {

                return Response.json({

                    success: false,

                    message: "Notification title is required."

                }, {

                    status: 400

                });

            }

            if (!message || message.trim() === "") {

                return Response.json({

                    success: false,

                    message: "Notification message is required."

                }, {

                    status: 400

                });

            }

            const allowedTypes = [

                "system",

                "subscription",

                "payment",

                "exam",

                "general"

            ];

            if (

                !notification_type ||

                !allowedTypes.includes(notification_type)

            ) {

                return Response.json({

                    success: false,

                    message: "Invalid notification type."

                }, {

                    status: 400

                });

            }

            if (

                !created_by_admin_id ||

                created_by_admin_id.trim() === ""

            ) {

                return Response.json({

                    success: false,

                    message: "Administrator ID is required."

                }, {

                    status: 400

                });

            }

            // -----------------------------------------
            // VERIFY ADMIN EXISTS
            // -----------------------------------------

            const admin = await env.DB.prepare(

                `SELECT id

                 FROM admins

                 WHERE id = ?`

            )

            .bind(created_by_admin_id)

            .first();

            if (!admin) {

                return Response.json({

                    success: false,

                    message: "Administrator not found."

                }, {

                    status: 404

                });

            }

            // -----------------------------------------
            // VERIFY STUDENT (Only if sending to one student)
            // -----------------------------------------

            if (student_id) {

                const student = await env.DB.prepare(

                    `SELECT id

                     FROM students

                     WHERE id = ?`

                )

                .bind(student_id)

                .first();

                if (!student) {

                    return Response.json({

                        success: false,

                        message: "Student not found."

                    }, {

                        status: 404

                    });

                }

            }

            // -----------------------------------------
            // CREATE NOTIFICATION
            // -----------------------------------------

            const notificationId = crypto.randomUUID();

            const now = new Date().toISOString();

            await env.DB.prepare(

                `INSERT INTO notifications (

                    id,

                    student_id,

                    title,

                    message,

                    notification_type,

                    is_read,

                    created_by_admin_id,

                    created_at

                )

                VALUES (

                    ?, ?, ?, ?, ?, ?, ?, ?

                )`

            )

            .bind(

                notificationId,

                student_id || null,

                title.trim(),

                message.trim(),

                notification_type,

                0,

                created_by_admin_id,

                now

            )

            .run();

            return Response.json({

                success: true,

                message: student_id

                    ? "Notification sent successfully."

                    : "Broadcast notification sent successfully.",

                data: {

                    id: notificationId

                }

            }, {

                status: 201

            });

        }

                // =====================================================
        // UPDATE NOTIFICATION
        // PUT /api/admin/notifications/:id
        // =====================================================

        if (

            method === "PUT" &&

            pathname.startsWith("/api/admin/notifications/")

        ) {

            const notificationId = pathname.split("/").pop();

            const body = await request.json();

            const {

                student_id,

                title,

                message,

                notification_type

            } = body;

            // -----------------------------------------
            // VALIDATION
            // -----------------------------------------

            if (!title || title.trim() === "") {

                return Response.json({

                    success: false,

                    message: "Notification title is required."

                }, {

                    status: 400

                });

            }

            if (!message || message.trim() === "") {

                return Response.json({

                    success: false,

                    message: "Notification message is required."

                }, {

                    status: 400

                });

            }

            const allowedTypes = [

                "system",

                "subscription",

                "payment",

                "exam",

                "general"

            ];

            if (

                !notification_type ||

                !allowedTypes.includes(notification_type)

            ) {

                return Response.json({

                    success: false,

                    message: "Invalid notification type."

                }, {

                    status: 400

                });

            }

            // -----------------------------------------
            // VERIFY NOTIFICATION EXISTS
            // -----------------------------------------

            const notification = await env.DB.prepare(

                `SELECT id

                 FROM notifications

                 WHERE id = ?`

            )

            .bind(notificationId)

            .first();

            if (!notification) {

                return Response.json({

                    success: false,

                    message: "Notification not found."

                }, {

                    status: 404

                });

            }

            // -----------------------------------------
            // VERIFY STUDENT (Only if sending to one student)
            // -----------------------------------------

            if (student_id) {

                const student = await env.DB.prepare(

                    `SELECT id

                     FROM students

                     WHERE id = ?`

                )

                .bind(student_id)

                .first();

                if (!student) {

                    return Response.json({

                        success: false,

                        message: "Student not found."

                    }, {

                        status: 404

                    });

                }

            }

            // -----------------------------------------
            // UPDATE NOTIFICATION
            // -----------------------------------------

            await env.DB.prepare(

                `UPDATE notifications

                 SET

                    student_id = ?,

                    title = ?,

                    message = ?,

                    notification_type = ?

                 WHERE id = ?`

            )

            .bind(

                student_id || null,

                title.trim(),

                message.trim(),

                notification_type,

                notificationId

            )

            .run();

            return Response.json({

                success: true,

                message: "Notification updated successfully."

            });

        }

                // =====================================================
        // DELETE NOTIFICATION
        // DELETE /api/admin/notifications/:id
        // =====================================================

        if (

            method === "DELETE" &&

            pathname.startsWith("/api/admin/notifications/")

        ) {

            const notificationId = pathname.split("/").pop();

            // -----------------------------------------
            // VERIFY NOTIFICATION EXISTS
            // -----------------------------------------

            const notification = await env.DB.prepare(

                `SELECT id

                 FROM notifications

                 WHERE id = ?`

            )

            .bind(notificationId)

            .first();

            if (!notification) {

                return Response.json({

                    success: false,

                    message: "Notification not found."

                }, {

                    status: 404

                });

            }

            // -----------------------------------------
            // DELETE NOTIFICATION
            // -----------------------------------------

            await env.DB.prepare(

                `DELETE FROM notifications

                 WHERE id = ?`

            )

            .bind(notificationId)

            .run();

            return Response.json({

                success: true,

                message: "Notification deleted successfully."

            });

        }

                // =====================================================
        // SYSTEM SETTINGS
        // SUPER ADMIN ONLY
        // =====================================================

        // -----------------------------------------
        // GET ALL SETTINGS
        // GET /api/admin/settings
        // -----------------------------------------

        if (

            method === "GET" &&

            pathname === "/api/admin/settings"

        ) {

            const { results } = await env.DB.prepare(

                `SELECT

                    id,

                    setting_key,

                    setting_value,

                    description,

                    updated_by_admin_id,

                    updated_at

                 FROM system_settings

                 ORDER BY

                    setting_key ASC`

            ).all();

            return Response.json({

                success: true,

                message: "System settings retrieved successfully.",

                data: results

            });

        }

        // -----------------------------------------
        // GET SINGLE SETTING
        // GET /api/admin/settings/:key
        // -----------------------------------------

        if (

            method === "GET" &&

            pathname.startsWith("/api/admin/settings/")

        ) {

            const settingKey = decodeURIComponent(

                pathname.split("/").pop()

            );

            const setting = await env.DB.prepare(

                `SELECT

                    id,

                    setting_key,

                    setting_value,

                    description,

                    updated_by_admin_id,

                    updated_at

                 FROM system_settings

                 WHERE setting_key = ?`

            )

            .bind(settingKey)

            .first();

            if (!setting) {

                return Response.json({

                    success: false,

                    message: "Setting not found."

                }, {

                    status: 404

                });

            }

            return Response.json({

                success: true,

                message: "Setting retrieved successfully.",

                data: setting

            });

        }

                // -----------------------------------------
        // CREATE / UPDATE SYSTEM SETTING
        // POST /api/admin/settings
        // -----------------------------------------

        if (

            method === "POST" &&

            pathname === "/api/admin/settings"

        ) {

            const body = await request.json();

            const {

                setting_key,

                setting_value,

                description,

                updated_by_admin_id

            } = body;

            // -----------------------------------------
            // VALIDATION
            // -----------------------------------------

            if (

                !setting_key ||

                setting_key.trim() === ""

            ) {

                return Response.json({

                    success: false,

                    message: "Setting key is required."

                }, {

                    status: 400

                });

            }

            if (

                !updated_by_admin_id ||

                updated_by_admin_id.trim() === ""

            ) {

                return Response.json({

                    success: false,

                    message: "Administrator ID is required."

                }, {

                    status: 400

                });

            }

            // -----------------------------------------
            // VERIFY ADMIN EXISTS
            // -----------------------------------------

            const admin = await env.DB.prepare(

                `SELECT id

                 FROM admins

                 WHERE id = ?`

            )

            .bind(updated_by_admin_id)

            .first();

            if (!admin) {

                return Response.json({

                    success: false,

                    message: "Administrator not found."

                }, {

                    status: 404

                });

            }

            const now = new Date().toISOString();

            // -----------------------------------------
            // CHECK IF SETTING EXISTS
            // -----------------------------------------

            const existing = await env.DB.prepare(

                `SELECT id

                 FROM system_settings

                 WHERE setting_key = ?`

            )

            .bind(setting_key.trim())

            .first();

            if (existing) {

                await env.DB.prepare(

                    `UPDATE system_settings

                     SET

                        setting_value = ?,

                        description = ?,

                        updated_by_admin_id = ?,

                        updated_at = ?

                     WHERE setting_key = ?`

                )

                .bind(

                    setting_value ?? "",

                    description ?? "",

                    updated_by_admin_id,

                    now,

                    setting_key.trim()

                )

                .run();

                return Response.json({

                    success: true,

                    message: "System setting updated successfully."

                });

            }

            // -----------------------------------------
            // CREATE NEW SETTING
            // -----------------------------------------

            const settingId = crypto.randomUUID();

            await env.DB.prepare(

                `INSERT INTO system_settings (

                    id,

                    setting_key,

                    setting_value,

                    description,

                    updated_by_admin_id,

                    updated_at

                )

                VALUES (

                    ?, ?, ?, ?, ?, ?

                )`

            )

            .bind(

                settingId,

                setting_key.trim(),

                setting_value ?? "",

                description ?? "",

                updated_by_admin_id,

                now

            )

            .run();

            return Response.json({

                success: true,

                message: "System setting created successfully.",

                data: {

                    id: settingId

                }

            }, {

                status: 201

            });

        }

                // =====================================================
        // DELETE SYSTEM SETTING
        // DELETE /api/admin/settings/:key
        // =====================================================

        if (

            method === "DELETE" &&

            pathname.startsWith("/api/admin/settings/")

        ) {

            const settingKey = decodeURIComponent(

                pathname.split("/").pop()

            );

            // -----------------------------------------
            // VERIFY SETTING EXISTS
            // -----------------------------------------

            const setting = await env.DB.prepare(

                `SELECT id

                 FROM system_settings

                 WHERE setting_key = ?`

            )

            .bind(settingKey)

            .first();

            if (!setting) {

                return Response.json({

                    success: false,

                    message: "System setting not found."

                }, {

                    status: 404

                });

            }

            // -----------------------------------------
            // DELETE SETTING
            // -----------------------------------------

            await env.DB.prepare(

                `DELETE FROM system_settings

                 WHERE setting_key = ?`

            )

            .bind(settingKey)

            .run();

            return Response.json({

                success: true,

                message: "System setting deleted successfully."

            });

        }
    // =====================================================
    // DEFAULT RESPONSE
    // =====================================================

    return Response.json({

        success: false,

        message: "Admin endpoint not found."

    }, {

        status: 404

    });

} catch (error) {

    console.error("Admin Error:", error);

    return Response.json({

        success: false,

        message: "Internal server error.",

        error: error.message

    }, {

        status: 500

    });

}

}
