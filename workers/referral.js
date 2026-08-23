// ======================================================
// Nursephere Referral Worker
// File: workers/referral.js
//
// DATABASE-DRIVEN REFERRAL SYSTEM
//
// Student
//     ↓
// students.referral_code
//     ↓
// referrals.referrer_student_id
//     ↓
// referral_rewards.student_id
//     ↓
// referral_reward_ladder.milestone
//
// Business rules are read from the database.
// No reward percentages or milestone values are
// hardcoded here.
// ======================================================

import jwt from "@tsndr/cloudflare-worker-jwt";

import {
    sendEmail
} from "./email.js";


// ======================================================
// REFERRAL HANDLER
// ======================================================

export default async function referralHandler(
    request,
    env
) {

    try {

        const url =
            new URL(request.url);

        const pathname =
            url.pathname;


        // ======================================================
        // AUTHENTICATION HELPER
        // ======================================================

        const authenticateStudent =
            async () => {

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

                    return {

                        error:
                            Response.json({

                                success: false,

                                message:
                                    "Unauthorized."

                            }, {

                                status: 401

                            })

                    };

                }


                const token =
                    authHeader.substring(7);


                const valid =
                    await jwt.verify(
                        token,
                        env.JWT_SECRET
                    );


                if (!valid) {

                    return {

                        error:
                            Response.json({

                                success: false,

                                message:
                                    "Invalid or expired session."

                            }, {

                                status: 401

                            })

                    };

                }


                const decoded =
                    jwt.decode(token);


                const payload =
                    decoded?.payload;


                const studentId =
                    payload?.studentId;


                if (!studentId) {

                    return {

                        error:
                            Response.json({

                                success: false,

                                message:
                                    "Student identity missing."

                            }, {

                                status: 401

                            })

                    };

                }


                const student =
                    await env.DB.prepare(

                        `
                        SELECT

                            id,
                            full_name,
                            email,
                            referral_code

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

                        error:
                            Response.json({

                                success: false,

                                message:
                                    "Student not found."

                            }, {

                                status: 404

                            })

                    };

                }


                return {

                    studentId,

                    student

                };

            };


        // ======================================================
        // POST /api/referral
        //
        // CREATE REFERRAL INVITATION
        // ======================================================

        if (

            request.method === "POST" &&

            pathname ===
                "/api/referral"

        ) {

            const auth =
                await authenticateStudent();


            if (
                auth.error
            ) {

                return auth.error;

            }


            const {
                studentId,
                student
            } = auth;


            // ==================================================
            // READ REQUEST
            // ==================================================

            let data;

            try {

                data =
                    await request.json();

            }

            catch {

                return Response.json({

                    success: false,

                    message:
                        "Invalid request body."

                }, {

                    status: 400

                });

            }


            const referredEmail =
                String(
                    data?.referredEmail ||
                    data?.email ||
                    ""
                )
                    .trim()
                    .toLowerCase();


            const examId =
                data?.examId
                    ? String(
                        data.examId
                    ).trim()
                    : null;


            // ==================================================
            // VALIDATE EMAIL
            // ==================================================

            const emailPattern =
                /^[^\s@]+@[^\s@]+\.[^\s@]+$/;


            if (
                !referredEmail ||
                !emailPattern.test(
                    referredEmail
                )
            ) {

                return Response.json({

                    success: false,

                    message:
                        "A valid referral email is required."

                }, {

                    status: 400

                });

            }


            // ==================================================
            // PREVENT SELF-REFERRAL
            // ==================================================

            if (
                referredEmail ===
                String(
                    student.email || ""
                )
                    .trim()
                    .toLowerCase()
            ) {

                return Response.json({

                    success: false,

                    message:
                        "You cannot refer yourself."

                }, {

                    status: 400

                });

            }


            // ==================================================
            // VERIFY EXAM IF PROVIDED
            // ==================================================

            if (
                examId
            ) {

                const exam =
                    await env.DB.prepare(

                        `
                        SELECT id

                        FROM exams

                        WHERE id = ?

                        LIMIT 1
                        `

                    )

                    .bind(
                        examId
                    )

                    .first();


                if (!exam) {

                    return Response.json({

                        success: false,

                        message:
                            "Selected exam was not found."

                    }, {

                        status: 404

                    });

                }

            }


            // ==================================================
            // CHECK EXISTING REFERRAL
            //
            // referrals.referred_email is UNIQUE.
            // ==================================================

            const existingReferral =
                await env.DB.prepare(

                    `
                    SELECT

                        id,
                        status,
                        referrer_student_id

                    FROM referrals

                    WHERE referred_email = ?

                    LIMIT 1
                    `

                )

                .bind(
                    referredEmail
                )

                .first();


            if (
                existingReferral
            ) {

                if (
                    existingReferral.referrer_student_id ===
                    studentId
                ) {

                    return Response.json({

                        success: false,

                        message:
                            "You have already referred this email."

                    }, {

                        status: 409

                    });

                }


                return Response.json({

                    success: false,

                    message:
                        "This email has already been referred."

                }, {

                    status: 409

                });

            }


            // ==================================================
            // CHECK WHETHER EMAIL ALREADY HAS AN ACCOUNT
            // ==================================================

            const referredStudent =
                await env.DB.prepare(

                    `
                    SELECT id

                    FROM students

                    WHERE email = ?

                    LIMIT 1
                    `

                )

                .bind(
                    referredEmail
                )

                .first();


            // ==================================================
            // CREATE REFERRAL
            // ==================================================

            const referralId =
                crypto.randomUUID();


            const now =
                new Date()
                    .toISOString();


            await env.DB.prepare(

                `
                INSERT INTO referrals (

                    id,
                    referral_code,
                    referrer_student_id,
                    referred_student_id,
                    referred_email,
                    exam_id,
                    status,
                    first_subscription_id,
                    first_subscription_date,
                    reward_qualified,
                    notes,
                    created_at,
                    updated_at

                )

                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `

            )

            .bind(

                referralId,

                student.referral_code,

                studentId,

                referredStudent?.id || null,

                referredEmail,

                examId,

                "Pending",

                null,

                null,

                0,

                null,

                now,

                now

            )

            .run();


            // ==================================================
            // REFERRAL REGISTERED EMAIL
            //
            // The template is loaded from D1.
            // ==================================================

            try {

                const emailResult =
                    await sendEmail({

                        env,

                        studentId,

                        recipientEmail:
                            student.email,

                        templateKey:
                            "referral_registered",

                        eventKey:
                            `referral_registered:${referralId}`,

                        preferenceKey:
                            "referral_notifications",

                        variables: {

                            student_name:
                                student.full_name,

                            referral_email:
                                referredEmail,

                            registered_at:
                                now,

                            current_year:
                                new Date()
                                    .getFullYear()

                        }

                    });


                if (
                    !emailResult?.success
                ) {

                    console.error(

                        "Referral registered email was not sent:",

                        emailResult

                    );

                }

            }

            catch (
                emailError
            ) {

                console.error(

                    "Referral registered email error:",

                    emailError

                );

            }


            // ==================================================
            // RESPONSE
            // ==================================================

            return Response.json({

                success: true,

                message:
                    "Referral registered successfully.",

                referral: {

                    id:
                        referralId,

                    email:
                        referredEmail,

                    status:
                        "Pending",

                    created_at:
                        now

                }

            }, {

                status: 201

            });

        }


        // ======================================================
        // GET /api/referral
        //
        // EXISTING REFERRAL DASHBOARD LOGIC
        // ======================================================

        if (

            request.method === "GET" &&

            pathname ===
                "/api/referral"

        ) {

            const auth =
                await authenticateStudent();


            if (
                auth.error
            ) {

                return auth.error;

            }


            const {
                studentId,
                student
            } = auth;


            // ==================================================
            // REFERRAL COUNTS
            // ==================================================

            const referralCountResult =
                await env.DB.prepare(

                    `
                    SELECT

                        COUNT(*) AS total_referrals,

                        COALESCE(
                            SUM(
                                CASE
                                    WHEN status = 'Successful'
                                    THEN 1
                                    ELSE 0
                                END
                            ),
                            0
                        ) AS successful_referrals,

                        COALESCE(
                            SUM(
                                CASE
                                    WHEN status = 'Pending'
                                    THEN 1
                                    ELSE 0
                                END
                            ),
                            0
                        ) AS pending_referrals

                    FROM referrals

                    WHERE referrer_student_id = ?
                    `

                )

                .bind(
                    studentId
                )

                .first();


            const totalReferrals =
                Number(
                    referralCountResult?.total_referrals || 0
                );


            const successfulReferrals =
                Number(
                    referralCountResult?.successful_referrals || 0
                );


            const pendingReferrals =
                Number(
                    referralCountResult?.pending_referrals || 0
                );


            // ==================================================
            // REWARD WALLET
            // ==================================================

            const rewardResult =
                await env.DB.prepare(

                    `
                    SELECT

                        id,
                        milestone,
                        successful_referrals,
                        reward_type,
                        reward_value,
                        reward_status,
                        issued_date,
                        redeemed_date,
                        expires_at,
                        created_at,
                        updated_at

                    FROM referral_rewards

                    WHERE student_id = ?

                    ORDER BY
                        milestone DESC,
                        datetime(created_at) DESC
                    `

                )

                .bind(
                    studentId
                )

                .all();


            const rewards =
                rewardResult.results || [];


            // ==================================================
            // AVAILABLE REWARD
            // ==================================================

            const availableReward =
                rewards.find(

                    reward =>
                        String(
                            reward.reward_status || ""
                        ).toLowerCase() ===
                        "available"

                ) || null;


            // ==================================================
            // REWARD LADDER
            // ==================================================

            const ladderResult =
                await env.DB.prepare(

                    `
                    SELECT

                        id,
                        milestone,
                        reward_type,
                        reward_value,
                        title,
                        description,
                        display_order,
                        status

                    FROM referral_reward_ladder

                    WHERE status = 'active'

                    ORDER BY

                        display_order ASC,

                        milestone ASC
                    `

                )

                .all();


            const rewardLadder =
                ladderResult.results || [];


            // ==================================================
            // NEXT REWARD MILESTONE
            // ==================================================

            const nextReward =
                rewardLadder.find(

                    reward =>

                        Number(
                            reward.milestone
                        ) >
                        successfulReferrals

                ) || null;


            // ==================================================
            // PROGRESS
            // ==================================================

            let progress = null;


            if (
                nextReward
            ) {

                const target =
                    Number(
                        nextReward.milestone
                    );


                const current =
                    Math.min(
                        successfulReferrals,
                        target
                    );


                const percentage =
                    target > 0

                        ? Math.round(
                            (
                                current /
                                target
                            ) * 100
                        )

                        : 0;


                progress = {

                    current,

                    target,

                    percentage,

                    remaining:
                        Math.max(
                            target -
                            successfulReferrals,
                            0
                        ),

                    reward:
                        nextReward

                };

            }


            // ==================================================
            // REFERRAL ACTIVITY
            // ==================================================

            const activityResult =
                await env.DB.prepare(

                    `
                    SELECT

                        r.id,

                        r.referral_code,

                        r.referred_student_id,

                        r.referred_email,

                        r.exam_id,

                        r.status,

                        r.first_subscription_id,

                        r.first_subscription_date,

                        r.reward_qualified,

                        r.created_at,

                        r.updated_at,

                        s.full_name AS referred_student_name

                    FROM referrals r

                    LEFT JOIN students s

                        ON s.id =
                           r.referred_student_id

                    WHERE
                        r.referrer_student_id = ?

                    ORDER BY
                        datetime(r.created_at) DESC
                    `

                )

                .bind(
                    studentId
                )

                .all();


            const activity =
                activityResult.results || [];

                // ==================================================
// REFERRAL SUCCESSFUL EMAIL
//
// Sent when a referred student successfully
// activates their subscription.
//
// Uses the referral_reward template.
// event_key prevents duplicate emails.
// ==================================================

for (
    const referral
    of activity
) {

    if (
        String(
            referral.status || ""
        ).toLowerCase() !==
        "successful"
    ) {

        continue;

    }


    try {

        const emailResult =
            await sendEmail({

                env,

                studentId,

                recipientEmail:
                    student.email,

                templateKey:
                    "referral_reward",

                eventKey:
                    `referral_reward:${referral.id}`,

                preferenceKey:
                    "referral_notifications",

                variables: {

                    student_name:
                        student.full_name,

                    referral_email:
                        referral.referred_email,

                    activated_at:
                        referral.first_subscription_date ||
                        referral.updated_at,

                    current_year:
                        new Date()
                            .getFullYear()

                }

            });


        if (
            !emailResult?.success
        ) {

            console.error(

                "Referral successful email was not sent:",

                emailResult

            );

        }

    }

    catch (
        emailError
    ) {

        console.error(

            "Referral successful email error:",

            emailError

        );

    }

}


            // ==================================================
            // REWARD EARNED EMAILS
            //
            // Only rewards that actually exist in
            // referral_rewards are eligible.
            //
            // event_key makes this idempotent.
            // ==================================================

            for (
                const reward
                of rewards
            ) {

                if (
                    String(
                        reward.reward_status || ""
                    ).toLowerCase() !==
                    "available"
                ) {

                    continue;

                }


                const rewardLabel =

                    reward.reward_type ===
                    "discount"

                        ? `${reward.reward_value}% discount`

                        : `${reward.reward_value} free month${Number(
                            reward.reward_value
                        ) === 1 ? "" : "s"}`;


                try {

                    const emailResult =
                        await sendEmail({

                            env,

                            studentId,

                            recipientEmail:
                                student.email,

                            templateKey:
                                "referral_reward_earned",

                            eventKey:
                                `referral_reward_earned:${reward.id}`,

                            preferenceKey:
                                "referral_notifications",

                            variables: {

                                student_name:
                                    student.full_name,

                                reward:
                                    rewardLabel,

                                reward_balance:
                                    rewards.filter(

                                        item =>

                                            String(
                                                item.reward_status || ""
                                            ).toLowerCase() ===
                                            "available"

                                    ).length,

                                current_year:
                                    new Date()
                                        .getFullYear()

                            }

                        });


                    if (
                        !emailResult?.success
                    ) {

                        console.error(

                            "Referral reward email was not sent:",

                            emailResult

                        );

                    }

                }

                catch (
                    emailError
                ) {

                    console.error(

                        "Referral reward email error:",

                        emailError

                    );

                }

            }


            // ==================================================
            // REWARDS EARNED
            // ==================================================

            const rewardsEarned =
                rewards.length;


            // ==================================================
            // RETURN REFERRAL DATA
            // ==================================================

            return Response.json({

                success: true,

                referral: {

                    code:
                        student.referral_code || null,

                    total_referrals:
                        totalReferrals,

                    successful_referrals:
                        successfulReferrals,

                    pending_referrals:
                        pendingReferrals,

                    rewards_earned:
                        rewardsEarned,

                    available_reward:
                        availableReward,

                    progress,

                    rewards,

                    reward_ladder:
                        rewardLadder,

                    activity

                }

            });

        }


        // ======================================================
        // METHOD NOT ALLOWED
        // ======================================================

        return Response.json({

            success: false,

            message:
                "Method Not Allowed."

        }, {

            status: 405

        });

    }


    // ======================================================
    // ERROR HANDLER
    // ======================================================

    catch (
        error
    ) {

        console.error(
            "Referral Worker Error:",
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