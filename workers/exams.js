/*
========================================================
    Nursephere Student Exams API
    File: workers/exams.js
========================================================
*/

export async function handleGetExams(request, env) {

    try {

        const { results } = await env.DB.prepare(`
            SELECT
                id,
                name,
                code,
                description,
                image_url,
                icon_url,
                color
            FROM exams
            WHERE status = 'active'
            ORDER BY display_order ASC
        `).all();

        return Response.json({
            success: true,
            exams: results || []
        });

    } catch (error) {

        console.error("Get Exams Error:", error);

        return Response.json({
            success: false,
            message: "Failed to load examinations."
        }, {
            status: 500
        });

    }

}