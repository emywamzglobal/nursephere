/*
=========================================================
    Nursephere Admin
    Questions & Resources Management
=========================================================
*/

"use strict";

/*=========================================================
    Authentication
=========================================================*/

Auth.requireAdmin();

/*=========================================================
    Application State
=========================================================*/

const App = {

    counts: {

        exams: 0,

        subjects: 0,

        questions: 0,

        resources: 0

    },

    loading: false

};

/*=========================================================
    DOM Elements
=========================================================*/

const elements = {

    examCount:

        document.getElementById("examCount"),

    subjectCount:

        document.getElementById("subjectCount"),

    questionCount:

        document.getElementById("questionCount"),

    resourceCount:

        document.getElementById("resourceCount"),

    refreshButton:

        document.getElementById("refreshButton"),

    pageLoader:

        document.getElementById("pageLoader"),
    
    summaryList:

    document.getElementById("summaryList"),

    lastUpdated:

    document.getElementById("lastUpdated")   

};

/*=========================================================
    Initialize
=========================================================*/

document.addEventListener(

    "DOMContentLoaded",

    initialize

);

async function initialize() {

    try {

        Utils.showLoader("pageLoader");

        App.loading = true;

        Auth.loadUser();

        bindEvents();

        await loadDashboard();

    }

    catch (error) {

        console.error(error);

    }

    finally {

        App.loading = false;

        Utils.hideLoader("pageLoader");

    }

}

/*=========================================================
    Load Dashboard
=========================================================*/

async function loadDashboard() {

    await loadCounts();

}

/*=========================================================
    Event Binding
=========================================================*/

function bindEvents() {

    if (elements.refreshButton) {

        elements.refreshButton.addEventListener(

            "click",

            handleRefresh

        );

    }

    window.addEventListener(

        "focus",

        handleWindowFocus

    );

}

/*=========================================================
    Event Handlers
=========================================================*/

async function handleRefresh() {

    if (App.loading) return;

    try {

        App.loading = true;

        Utils.showLoader("pageLoader");

        await loadDashboard();

    }

    catch (error) {

        console.error(error);

    }

    finally {

        App.loading = false;

        Utils.hideLoader("pageLoader");

    }

}

async function handleWindowFocus() {

    if (App.loading) return;

    try {

        await loadDashboard();

    }

    catch (error) {

        console.error(error);

    }

}

/*=========================================================
    Load Statistics
=========================================================*/

async function loadCounts() {

    try {

        const [

            exams,

            subjects,

            questions,

            resources

        ] = await Promise.all([

            API.get("/api/admin/exams"),

            API.get("/api/admin/subjects"),

            API.get("/api/admin/questions"),

            API.get("/api/admin/resources")

        ]);

        App.counts.exams = getCollectionCount(exams);

        App.counts.subjects = getCollectionCount(subjects);

        App.counts.questions = getCollectionCount(questions);

        App.counts.resources = getCollectionCount(resources);

        renderCounts();

        renderSummary();

    }

    catch (error) {

        console.error(error);

        throw error;

    }

}

/*=========================================================
    Helpers
=========================================================*/

function getCollectionCount(response) {

    if (!response) {

        return 0;

    }

    if (Array.isArray(response)) {

        return response.length;

    }

    if (

        Array.isArray(response.data)

    ) {

        return response.data.length;

    }

    if (

        Array.isArray(response.items)

    ) {

        return response.items.length;

    }

    if (

        typeof response.total === "number"

    ) {

        return response.total;

    }

    return 0;

}

/*=========================================================
    Render Statistics
=========================================================*/

function renderCounts() {

    const mappings = [

        {
            value: App.counts.exams,
            ids: ["examCount", "overviewExams"]
        },

        {
            value: App.counts.subjects,
            ids: ["subjectCount", "overviewSubjects"]
        },

        {
            value: App.counts.questions,
            ids: ["questionCount", "overviewQuestions"]
        },

        {
            value: App.counts.resources,
            ids: ["resourceCount", "overviewResources"]
        }

    ];

    mappings.forEach(item => {

        item.ids.forEach(id => {

            const element = document.getElementById(id);

            if (element) {

                element.textContent = Utils.number(item.value);

            }

        });

    });

}

/*=========================================================
    Render Summary
=========================================================*/

function renderSummary(){

    if(!elements.summaryList){

        return;

    }

    const summary=[

        {

            icon:"fa-file-alt",

            title:"Examinations",

            description:"Available nursing examinations.",

            value:App.counts.exams

        },

        {

            icon:"fa-book-medical",

            title:"Subjects",

            description:"Subjects organised under examinations.",

            value:App.counts.subjects

        },

        {

            icon:"fa-question-circle",

            title:"Practice Questions",

            description:"Questions currently available.",

            value:App.counts.questions

        },

        {

            icon:"fa-folder-open",

            title:"Study Resources",

            description:"Learning resources ready for students.",

            value:App.counts.resources

        }

    ];

    elements.summaryList.innerHTML=summary.map(item=>`

        <div class="summary-card">

            <div class="summary-left">

                <div class="summary-icon">

                    <i class="fas ${item.icon}"></i>

                </div>

                <div class="summary-info">

                    <h4>${item.title}</h4>

                    <p>${item.description}</p>

                </div>

            </div>

            <div class="summary-value">

                ${Utils.number(item.value)}

            </div>

        </div>

    `).join("");

    if(elements.lastUpdated){

        elements.lastUpdated.textContent=

    "Last updated: " +

    Utils.formatDateTime(

        new Date()

    );

    }

}
