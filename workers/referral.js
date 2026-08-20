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


export default async function referralHandler(
    request,
    env
) {

    try {

        const url =
            new URL(request.url);

        const pathname =
            url.pathname;


        /*=========================================================
            STUDENT REFERRAL

            GET /api/referral

            Authentication comes from the JWT.

            The browser does NOT determine the student identity.
        =========================================================*/

        if (

            request.method === "GET" &&

            pathname ===
                "/api/referral"

        ) {

            /*=====================================================
                AUTHENTICATION
            =====================================================*/

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

                return Response.json({

                    success: false,

                    message:
                        "Unauthorized."

                }, {

                    status: 401

                });

            }


            const token =
                authHeader.substring(7);


            const valid =
                await jwt.verify(
                    token,
                    env.JWT_SECRET
                );


            if (!valid) {

                return Response.json({

                    success: false,

                    message:
                        "Invalid or expired session."

                }, {

                    status: 401

                });

            }


            /*=====================================================
                READ VERIFIED JWT IDENTITY
            =====================================================*/

            const decoded =
                jwt.decode(token);


            const payload =
                decoded?.payload;


            const studentId =
                payload?.studentId;


            if (!studentId) {

                return Response.json({

                    success: false,

                    message:
                        "Student identity missing."

                }, {

                    status: 401

                });

            }


            /*=====================================================
                VERIFY STUDENT EXISTS
            =====================================================*/

            const student =
                await env.DB.prepare(

                    `
                    SELECT

                        id,

                        full_name,

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

                return Response.json({

                    success: false,

                    message:
                        "Student not found."

                }, {

                    status: 404

                });

            }


            /*=====================================================
                REFERRAL COUNTS
            =====================================================*/

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


            /*=====================================================
                REWARD WALLET
            =====================================================*/

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


            /*=====================================================
                AVAILABLE REWARD
            =====================================================*/

            const availableReward =
                rewards.find(

                    reward =>
                        String(
                            reward.reward_status || ""
                        ).toLowerCase() ===
                        "available"

                ) || null;


            /*=====================================================
                REWARD LADDER
            =====================================================*/

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


            /*=====================================================
                NEXT REWARD MILESTONE
            =====================================================*/

            const nextReward =
                rewardLadder.find(

                    reward =>

                        Number(
                            reward.milestone
                        ) >
                        successfulReferrals

                ) || null;


            /*=====================================================
                PROGRESS
            =====================================================*/

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


            /*=====================================================
                REFERRAL ACTIVITY
            =====================================================*/

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


            /*=====================================================
                REWARDS EARNED
            =====================================================*/

            const rewardsEarned =
                rewards.length;


            /*=====================================================
                RETURN REFERRAL DATA
            =====================================================*/

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


        /*=========================================================
            METHOD NOT ALLOWED
        =========================================================*/

        return Response.json({

            success: false,

            message:
                "Method Not Allowed."

        }, {

            status: 405

        });

    }


    catch (error) {

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