/*
=========================================================
    Nursephere Student Dashboard Controller
    File: js/dashboard-student.js
=========================================================
*/

"use strict";

/*=========================================================
    Configuration
=========================================================*/

const DashboardAPI = {
    dashboard: "http://127.0.0.1:8787/api/dashboard"
};

/*=========================================
        DASHBOARD PAGE
=========================================*/

document.addEventListener("DOMContentLoaded", initialiseDashboard);


/*=========================================
        INITIALISE DASHBOARD
=========================================*/

function initialiseDashboard(){

    loadStudentInformation();

    updateTrialCard();

    loadMotivationalQuote();

}


/*=========================================
        STUDENT INFORMATION
=========================================*/

async function loadStudentInformation() {

    try {

        const studentId = localStorage.getItem("studentId");

        const response = await fetch(

            `${DashboardAPI.dashboard}?studentId=${studentId}`

        );

        const result = await response.json();
        console.log(result);

        if (!result.success) {

            throw new Error(result.message);

        }

        const student = {

            name: result.student.full_name,

            plan: result.student.subscription_status,

            trialDays: result.trial.daysLeft,

            questionsRemaining: result.progress.questions_remaining,

            questionsAnswered: result.progress.questions_answered,

            subjectsStarted: result.progress.subjects_started,

            successRate: result.progress.success_rate + "%",

            streak: result.progress.day_streak

        };

        updateDashboard(student);
        updateTrialCard(result.trial);

    }

    catch (error) {

        console.error(error);

    }

}

/*=========================================
        UPDATE DASHBOARD
=========================================*/

function updateDashboard(student){

    setText("welcomeStudentName", student.name);

    setText("headerStudentName", student.name);

    setText("studentPlan",student.plan);

    setText("daysLeft", student.trialDays);

    setText("questionsLeft",student.questionsRemaining);

    setText("subjectsStarted",student.subjectsStarted);

    setText("questionsAnswered",student.questionsAnswered);

    setText("successRate",student.successRate);

    setText("dayStreak", student.streak);

}

/*=========================================
        TRIAL CARD
=========================================*/

function updateTrialCard(trial) {

    const trialCard = document.querySelector(".trial-card");

    const expiredCard = document.getElementById("trialExpiredCard");

    const planBadge = document.getElementById("studentPlan");

    if (!trialCard || !expiredCard || !planBadge) return;

    if (trial.active) {

        trialCard.style.display = "flex";

        expiredCard.style.display = "none";

        planBadge.textContent = "Free Trial";

    }

    else if (

    localStorage.getItem("subscriptionStatus") === "premium"

) {

        trialCard.style.display = "none";

        expiredCard.style.display = "none";

        planBadge.textContent = "Premium";

    }

    else {

        trialCard.style.display = "none";

        expiredCard.style.display = "flex";

        planBadge.textContent = "Trial Expired";

    }

}


/*=========================================
        MOTIVATIONAL QUOTE
=========================================*/

function loadMotivationalQuote(){

    const quotes=[

        "Success comes from consistent practice, not perfection.",

        "Small improvements every day lead to remarkable results.",

        "Every question answered is one step closer to becoming a nurse.",

        "Believe in yourself. You are preparing to save lives.",

        "Discipline beats motivation. Keep practicing.",

        "Confidence grows with every practice session.",

        "Today's effort becomes tomorrow's success.",

        "One question at a time. One dream at a time."

    ];

    const quote=document.querySelector(".dashboard-panel blockquote");

    if(!quote) return;

    const random=Math.floor(Math.random()*quotes.length);

    quote.textContent=quotes[random];

}


/*=========================================
        HELPER
=========================================*/

function setText(id,value){

    const element=document.getElementById(id);

    if(element){

        element.textContent=value;

    }

}

/*=========================================
        SIDEBAR TOGGLE
=========================================*/

document.addEventListener("DOMContentLoaded", () => {

    const menuToggle = document.getElementById("menuToggle");

    const sidebar = document.getElementById("studentSidebar");

    const content = document.querySelector(".dashboard-content");

    if(menuToggle && sidebar && content){

        menuToggle.addEventListener("click", () => {

            sidebar.classList.toggle("collapsed");

            content.classList.toggle("expanded");

        });

    }

});
