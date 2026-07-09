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

function loadStudentInformation(){

    /*
        Backend will replace these values
        after successful login.
    */

    const student={

        name:"Student",

        plan:"Free Trial",

        trialDays:3,

        questionsRemaining:30,

        questionsAnswered:0,

        subjectsStarted:0,

        successRate:"0%",

        streak:0

    };

    updateDashboard(student);

}


/*=========================================
        UPDATE DASHBOARD
=========================================*/

function updateDashboard(student){

    setText("welcomeName",student.name);

    setText("studentName",student.name);

    setText("studentPlan",student.plan);

    setText("trialDays",student.trialDays);

    setText("questionsRemaining",student.questionsRemaining);

    setText("subjectsStarted",student.subjectsStarted);

    setText("questionsAnswered",student.questionsAnswered);

    setText("successRate",student.successRate);

    setText("studyStreak",student.streak);

}


/*=========================================
        TRIAL CARD
=========================================*/

function updateTrialCard(){

    /*
        Backend will calculate:

        Trial Expiry

        Questions Remaining

        Subscription Status

        Daily Limits
    */

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
