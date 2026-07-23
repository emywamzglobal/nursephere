// =====================================================
// Nursephere Notification Service
// =====================================================

export async function createNotification(env, notification) {

    const {

        studentId,

        title,

        message,

        type = "general"

    } = notification;

    const id = crypto.randomUUID();

    const createdAt = new Date().toISOString();

    await env.DB.prepare(

        `
        INSERT INTO notifications (

            id,

            student_id,

            title,

            message,

            type,

            created_at

        )

        VALUES (?, ?, ?, ?, ?, ?)
        `

    )

    .bind(

        id,

        studentId,

        title,

        message,

        type,

        createdAt

    )

    .run();

}