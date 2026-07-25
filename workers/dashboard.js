// ======================================================
// Nursephere Dashboard Worker
// ======================================================

import jwt from "@tsndr/cloudflare-worker-jwt";

export default async function dashboardHandler(request, env) {

    try {

        /*=========================================
                BUSINESS CONSTANTS
        =========================================*/

        const TRIAL_TOTAL_QUESTIONS = 30;
        const TRIAL_MAX_PER_SUBJECT = 10;

        /*=========================================
                VERIFY JWT
        =========================================*/

        const authHeader = request.headers.get("Authorization");

        if (!authHeader || !authHeader.startsWith("Bearer ")) {

            return Response.json({

                success: false,
                message: "Unauthorized."

            }, {

                status: 401

            });

        }

        const token = authHeader.substring(7);

        const valid = await jwt.verify(
            token,
            env.JWT_SECRET
        );

        if (!valid) {

            return Response.json({

                success: false,
                message: "Invalid or expired session."

            }, {

                status: 401

            });

        }

        const payload = jwt.decode(token).payload;

        const studentId = payload.studentId;

        /*=========================================
                FETCH STUDENT
        =========================================*/

        const student = await env.DB.prepare(

            `
            SELECT

                s.id,
                s.student_number,
                s.full_name,
                s.email,

                s.subscription_status,

                s.trial_started_at,
                s.trial_expires_at,
                s.subscription_expires_at,

                sp.id AS plan_id,
                sp.name AS plan_name,
                sp.duration_days

            FROM students s

            LEFT JOIN subscription_plans sp

                ON sp.id = s.subscription_plan_id

            WHERE s.id = ?

            LIMIT 1
            `

        )
        .bind(studentId)
        .first();

        /*=========================================
                STUDENT NOT FOUND
        =========================================*/

        if (!student) {

            return Response.json({

                success: false,
                message: "Student not found."

            }, {

                status: 404

            });

        }

                /*=========================================
                FETCH STUDENT PROGRESS
        =========================================*/

        const progress = await env.DB.prepare(

            `
            SELECT

                subjects_started,
                questions_answered,
                success_rate

            FROM student_progress

            WHERE student_id = ?

            LIMIT 1
            `

        )
        .bind(studentId)
        .first();

        /*=========================================
                FETCH TRIAL USAGE
        =========================================*/

        const trialUsage = await env.DB.prepare(

            `
            SELECT

                tu.subject_id,

                s.name AS subject_name,

                tu.questions_used,

                tu.correct_answers,

                tu.wrong_answers,

                tu.first_accessed_at,

                tu.last_question_at

            FROM trial_usage tu

            INNER JOIN subjects s

                ON s.id = tu.subject_id

            WHERE tu.student_id = ?

            ORDER BY tu.last_question_at DESC
            `

        )
        .bind(studentId)
        .all();

        /*=========================================
                FETCH PLAN FEATURES
        =========================================*/

        const featureRows = student.plan_id

            ? await env.DB.prepare(

                `
                SELECT

                    f.feature_key,

                    pf.access_level

                FROM plan_features pf

                INNER JOIN features f

                    ON f.id = pf.feature_id

                WHERE pf.plan_id = ?
                `

            )
            .bind(student.plan_id)
            .all()

            : { results: [] };

        /*=========================================
                NORMALIZE PROGRESS
        =========================================*/

        const subjectsStarted =
            Number(progress?.subjects_started ?? 0);

        const questionsAnswered =
            Number(progress?.questions_answered ?? 0);

        const successRate =
            Number(progress?.success_rate ?? 0);

        /*=========================================
                TRIAL USAGE TOTALS
        =========================================*/

        const usageRows = trialUsage.results || [];

        const totalTrialQuestions = usageRows.reduce(

            (total, row) =>

                total + Number(row.questions_used),

            0

        );

        const questionsRemaining = Math.max(

            0,

            TRIAL_TOTAL_QUESTIONS - totalTrialQuestions

        );

                /*=========================================
                PLAN PERMISSIONS
        =========================================*/

        const permissions = {};

        for (const feature of (featureRows.results || [])) {

            permissions[feature.feature_key] =
                feature.access_level;

        }

        /*=========================================
                TRIAL STATUS
        =========================================*/

        const now = new Date();

        const trialExpiry = student.trial_expires_at
            ? new Date(student.trial_expires_at)
            : null;

        const subscriptionExpiry = student.subscription_expires_at
            ? new Date(student.subscription_expires_at)
            : null;

        const trialExpired =

            !trialExpiry ||

            trialExpiry <= now;

        let daysLeft = 0;

        if (!trialExpired) {

            const millisecondsRemaining =

                trialExpiry.getTime() - now.getTime();

            daysLeft = Math.ceil(

                millisecondsRemaining /

                (1000 * 60 * 60 * 24)

            );

            if (daysLeft < 0) {

                daysLeft = 0;

            }

        }

        /*=========================================
                TRIAL LIMITS
        =========================================*/

        const subjectLimits = usageRows.map(row => ({

            subject_id: row.subject_id,

            subject_name: row.subject_name,

            questions_used: Number(row.questions_used),

            questions_remaining: Math.max(

                0,

                TRIAL_MAX_PER_SUBJECT -

                Number(row.questions_used)

            ),

            limit_reached:

                Number(row.questions_used) >=

                TRIAL_MAX_PER_SUBJECT

        }));

        const totalQuestionLimitReached =

            totalTrialQuestions >=

            TRIAL_TOTAL_QUESTIONS;

        /*=========================================
                SUBSCRIPTION STATUS
        =========================================*/

        const subscriptionActive =

            student.subscription_status === "active" &&

            subscriptionExpiry &&

            subscriptionExpiry > now;

        const upgradeRequired =

            !subscriptionActive &&

            (

                trialExpired ||

                totalQuestionLimitReached

            );

                    /*=========================================
                RECENT ACTIVITY
        =========================================*/

        const recentActivity = usageRows

            .sort((a, b) =>

                new Date(b.last_question_at) -

                new Date(a.last_question_at)

            )

            .slice(0, 5)

            .map(row => ({

                subject: row.subject_name,

                questions_used: Number(row.questions_used),

                correct_answers: Number(row.correct_answers),

                wrong_answers: Number(row.wrong_answers),

                last_question_at: row.last_question_at

            }));

        /*=========================================
                SUCCESS RESPONSE
        =========================================*/

        return Response.json({

            success: true,

            student: {

                id: student.id,

                student_number: student.student_number,

                full_name: student.full_name,

                email: student.email

            },

            subscription: {

                status: student.subscription_status,

                plan: student.plan_name || "Free Trial",

                plan_key: null,

                started_at:

                    student.trial_started_at,

                expires_at:

                    student.subscription_expires_at,

                active: subscriptionActive

            },

            trial: {

                active:

                    !trialExpired && !subscriptionActive,

                days_left: daysLeft,

                questions_allowed:

                    TRIAL_TOTAL_QUESTIONS,

                questions_used:

                    totalTrialQuestions,

                questions_remaining:

                    questionsRemaining,

                upgrade_required:

                    upgradeRequired

            },

            permissions,

            progress: {

                subjects_started:

                    subjectsStarted,

                questions_answered:

                    questionsAnswered,

                questions_remaining:

                    questionsRemaining,

                success_rate:

                    successRate

            },

            subject_limits: subjectLimits,

            recent_activity: recentActivity

        });

    }

    /*=========================================
            SERVER ERROR
    =========================================*/

    catch (error) {

        console.error(

            "Dashboard Error:",

            error

        );

        return Response.json({

            success: false,

            message:

                "Failed to load dashboard."

        }, {

            status: 500

        });

    }

}