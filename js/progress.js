// ======================================================
// Nursephere Student Progress
// File: js/progress.js
// ======================================================

document.addEventListener(
    "DOMContentLoaded",
    function () {

        /*=========================================
                SESSION
        =========================================*/

        const studentToken =
            localStorage.getItem(
                "studentToken"
            );


        /*=========================================
                ELEMENTS
        =========================================*/

        const questionsAnsweredEl =
            document.getElementById(
                "questionsAnswered"
            );

        const examsCompletedEl =
            document.getElementById(
                "examsCompleted"
            );

        const subjectsStartedEl =
            document.getElementById(
                "subjectsStarted"
            );

        const successRateEl =
            document.getElementById(
                "successRate"
            );

        const headerStudentNameEl =
            document.getElementById(
                "headerStudentName"
            );

        const studentPlanEl =
            document.getElementById(
                "studentPlan"
            );


        /*=========================================
                AUTHENTICATION
        =========================================*/

        if (!studentToken) {

            window.location.href =
                "../login.html";

            return;

        }


        /*=========================================
                LOAD PROGRESS
        =========================================*/

        async function loadProgress() {

            try {

                const response =
                    await fetch(
                        "/api/progress",
                        {

                            method: "GET",

                            headers: {

                                "Authorization":
                                    `Bearer ${studentToken}`,

                                "Content-Type":
                                    "application/json"

                            }

                        }
                    );


                /*=================================
                        SESSION EXPIRED
                =================================*/

                if (
                    response.status === 401
                ) {

                    localStorage.removeItem(
                        "studentToken"
                    );

                    window.location.href =
                        "../login.html";

                    return;

                }


                const data =
                    await response.json();


                if (
                    !response.ok ||
                    !data.success
                ) {

                    console.error(
                        "Progress loading failed:",
                        data.message
                    );

                    return;

                }


                /*=================================
                        STUDENT INFORMATION
                =================================*/

                if (
                    data.student &&
                    headerStudentNameEl
                ) {

                    headerStudentNameEl.textContent =
                        data.student.full_name;

                }


                if (
                    data.student &&
                    studentPlanEl
                ) {

                    const status =
                        data.student
                            .subscription_status;

                    if (
                        status === "active"
                    ) {

                        studentPlanEl.textContent =
                            "Premium";

                    } else {

                        studentPlanEl.textContent =
                            "Free Trial";

                    }

                }


                /*=================================
                        PROGRESS DATA
                =================================*/

                const progress =
                    data.progress || {};


                if (
                    questionsAnsweredEl
                ) {

                    questionsAnsweredEl.textContent =
                        Number(
                            progress.questions_answered
                            ?? 0
                        );

                }


                if (
                    examsCompletedEl
                ) {

                    examsCompletedEl.textContent =
                        Number(
                            progress.exams_completed
                            ?? 0
                        );

                }


                if (
                    subjectsStartedEl
                ) {

                    subjectsStartedEl.textContent =
                        Number(
                            progress.subjects_started
                            ?? 0
                        );

                }


                if (
                    successRateEl
                ) {

                    const rate =
                        Number(
                            progress.success_rate
                            ?? 0
                        );

                    successRateEl.textContent =
                        `${rate}%`;

                }

            }

            catch (error) {

                console.error(
                    "PROGRESS LOAD ERROR:",
                    error
                );

            }

        }


        /*=========================================
                INITIAL LOAD
        =========================================*/

        loadProgress();

    }
);