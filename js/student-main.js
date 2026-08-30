/*=========================================
        Nursephere STUDENT PORTAL
        MAIN JAVASCRIPT
=========================================*/

"use strict";


/*=========================================
        API CONFIGURATION
=========================================*/

const STUDENT_API_BASE =
    "https://nursephere.wamalwaemily.workers.dev/api";


/*=========================================
        STUDENT SESSION
=========================================*/

const studentToken =
    localStorage.getItem("studentToken");


/*=========================================
        PAGE INITIALISATION
=========================================*/

document.addEventListener("DOMContentLoaded", () => {

    highlightStudentMenu();

    initialiseStudentHeader();

    initializeSidebarToggle();

    initializeStudentSearch();

});


/*=========================================
        ACTIVE SIDEBAR MENU
=========================================*/

function highlightStudentMenu() {

    const currentPage =
        window.location.pathname
            .split("/")
            .pop();

    document
        .querySelectorAll(".sidebar-menu a")
        .forEach(link => {

            link.classList.remove("active");

            const href =
                link.getAttribute("href");

            if (
                href === currentPage
            ) {

                link.classList.add("active");

            }

        });

}


/*=========================================
        INITIALISE HEADER
=========================================*/

function initialiseStudentHeader() {

    studentProfileDropdown();

    loadStudentHeaderAvatar();

    studentLogout();

}

/*=========================================
        PROFILE DROPDOWN
=========================================*/

function studentProfileDropdown() {

    const toggle =
        document.getElementById(
            "profileToggle"
        );

    const menu =
        document.getElementById(
            "profileMenu"
        );

    if (
        !toggle ||
        !menu
    ) {
        return;
    }

    toggle.addEventListener(
        "click",
        function (e) {

            e.stopPropagation();

            menu.classList.toggle(
                "show"
            );

        }
    );

    document.addEventListener(
        "click",
        function () {

            menu.classList.remove(
                "show"
            );

        }
    );

}

/*=========================================
        STUDENT HEADER AVATAR
=========================================*/

async function loadStudentHeaderAvatar() {

    const avatar =
        document.getElementById(
            "studentAvatar"
        );

    if (!avatar) {
        return;
    }

    const token =
        localStorage.getItem(
            "studentToken"
        );

    if (!token) {
        return;
    }

    try {

        /*=====================================
            GET STUDENT PROFILE
        =====================================*/

        const profileResponse =
            await fetch(
                `${STUDENT_API_BASE}/profile`,
                {
                    method: "GET",

                    headers: {
                        "Authorization":
                            `Bearer ${token}`,

                        "Accept":
                            "application/json"
                    }
                }
            );


        if (
            profileResponse.status === 401
        ) {

            localStorage.removeItem(
                "studentToken"
            );

            window.location.replace(
                "../login.html"
            );

            return;

        }


        if (!profileResponse.ok) {
            return;
        }


        const data =
            await profileResponse.json();


        const profile =
            data?.profile;


        if (!profile) {
            return;
        }


        /*=====================================
            STUDENT ID
        =====================================*/

        const studentId =
            profile.student_id;


        if (!studentId) {

            console.error(
                "Student ID unavailable for avatar."
            );

            return;

        }


        /*=====================================
            STREAM PRIVATE AVATAR FROM R2
        =====================================*/

        const avatarResponse =
            await fetch(
                `${STUDENT_API_BASE}/avatar/${encodeURIComponent(studentId)}`,
                {
                    method: "GET",

                    headers: {
                        "Authorization":
                            `Bearer ${token}`,

                        "Accept":
                            "image/*"
                    }
                }
            );


        if (
            avatarResponse.status === 401
        ) {

            localStorage.removeItem(
                "studentToken"
            );

            window.location.replace(
                "../login.html"
            );

            return;

        }


        if (
            !avatarResponse.ok
        ) {

            /*
                404 simply means the student
                has no avatar stored.

                Keep the HTML placeholder.
            */

            return;

        }


        /*=====================================
            VERIFY IMAGE RESPONSE
        =====================================*/

        const contentType =
            avatarResponse.headers.get(
                "Content-Type"
            ) || "";


        if (
            !contentType.startsWith(
                "image/"
            )
        ) {

            console.error(
                "Avatar endpoint did not return an image."
            );

            return;

        }


        /*=====================================
            CONVERT R2 STREAM TO BLOB
        =====================================*/

        const imageBlob =
            await avatarResponse.blob();


        if (
            !imageBlob ||
            !imageBlob.type.startsWith(
                "image/"
            )
        ) {

            return;

        }


        /*=====================================
            CREATE TEMPORARY BROWSER URL
        =====================================*/

        const imageUrl =
            URL.createObjectURL(
                imageBlob
            );


        /*=====================================
            DISPLAY AVATAR
        =====================================*/

        avatar.src =
            imageUrl;


        /*
            Revoke only after the browser
            has successfully loaded the image.
        */

        avatar.onload =
            () => {

                URL.revokeObjectURL(
                    imageUrl
                );

            };


        avatar.onerror =
            () => {

                URL.revokeObjectURL(
                    imageUrl
                );

            };

    }

    catch (error) {

        console.error(
            "Unable to load student avatar:",
            error
        );

    }

}

/*=========================================
        SIDEBAR COLLAPSE / EXPAND
=========================================*/

function initializeSidebarToggle() {

    const sidebar =
        document.getElementById(
            "studentSidebar"
        );

    const content =
        document.querySelector(
            ".dashboard-content"
        );

    const toggle =
        document.getElementById(
            "menuToggle"
        );


    if (
        !sidebar ||
        !toggle
    ) {

        return;

    }


    /*-----------------------------------------
            RESTORE PREVIOUS STATE
    -----------------------------------------*/

    if (
        localStorage.getItem(
            "sidebar"
        ) === "collapsed"
    ) {

        sidebar.classList.add(
            "collapsed"
        );


        if (content) {

            content.classList.add(
                "expanded"
            );

        }

    }


    /*-----------------------------------------
            TOGGLE
    -----------------------------------------*/

    toggle.addEventListener(
        "click",
        () => {

            sidebar.classList.toggle(
                "collapsed"
            );


            if (content) {

                content.classList.toggle(
                    "expanded"
                );

            }


            if (
                sidebar.classList.contains(
                    "collapsed"
                )
            ) {

                localStorage.setItem(
                    "sidebar",
                    "collapsed"
                );

            } else {

                localStorage.setItem(
                    "sidebar",
                    "expanded"
                );

            }

        }
    );

}

/*=========================================
        STUDENT GLOBAL SEARCH
=========================================*/

function initializeStudentSearch() {

    const searchInput =
        document.getElementById(
            "searchInput"
        );

    if (!searchInput) {
        return;
    }


    const searchBox =
        searchInput.closest(
            ".search-box"
        );

    if (!searchBox) {
        return;
    }


    /*=====================================
        SEARCH RESULTS CONTAINER
    =====================================*/

    let resultsContainer =
        document.getElementById(
            "studentSearchResults"
        );

    if (!resultsContainer) {

        resultsContainer =
            document.createElement(
                "div"
            );

        resultsContainer.id =
            "studentSearchResults";

        resultsContainer.className =
            "student-search-results";

        searchBox.appendChild(
            resultsContainer
        );

    }


    /*=====================================
        SEARCH DATA
    =====================================*/

    const searchData = {

        exams: [],

        subjects: [],

        books: []

    };


    /*=====================================
        AUTHENTICATION
    =====================================*/

    function getToken() {

        return localStorage.getItem(
            "studentToken"
        );

    }


    /*=====================================
        API REQUEST
    =====================================*/

    async function searchRequest(
        endpoint
    ) {

        const token =
            getToken();

        if (!token) {
            return null;
        }


        const response =
            await fetch(
                `${STUDENT_API_BASE}${endpoint}`,
                {
                    method: "GET",

                    headers: {
                        "Authorization":
                            `Bearer ${token}`,

                        "Accept":
                            "application/json"
                    }
                }
            );


        if (
            response.status === 401
        ) {

            localStorage.removeItem(
                "studentToken"
            );

            window.location.replace(
                "../login.html"
            );

            return null;

        }


        if (!response.ok) {
            return null;
        }


        return await response.json();

    }


    /*=====================================
        LOAD EXAMS
    =====================================*/

    async function loadSearchExams() {

        const result =
            await searchRequest(
                "/exams"
            );

        if (!result) {
            return;
        }


        const exams =
            Array.isArray(
                result.exams
            )
                ? result.exams
                : [];


        searchData.exams =
            exams.map(
                exam => ({

                    id:
                        exam.id,

                    name:
                        exam.name ||

                        exam.title ||

                        exam.exam_name ||

                        ""

                })
            )
            .filter(
                exam =>
                    exam.id &&
                    exam.name
            );

    }


    /*=====================================
        LOAD SUBJECTS
    =====================================*/

    async function loadSearchSubjects() {

        for (
            const exam
            of searchData.exams
        ) {

            const result =
                await searchRequest(
                    `/subjects?exam_id=${encodeURIComponent(exam.id)}`
                );


            if (!result) {
                continue;
            }


            const subjects =
                Array.isArray(
                    result.subjects
                )
                    ? result.subjects
                    : Array.isArray(
                        result.data
                    )
                        ? result.data
                        : [];


            subjects.forEach(
                subject => {

                    if (
                        !subject.id ||
                        !subject.name
                    ) {

                        return;

                    }


                    searchData.subjects.push({

                        id:
                            subject.id,

                        name:
                            subject.name,

                        examId:
                            exam.id,

                        examName:
                            exam.name

                    });

                }
            );

        }

    }


    /*=====================================
        LOAD STUDY BOOKS
    =====================================*/

    async function loadSearchBooks() {

        for (
            const subject
            of searchData.subjects
        ) {

            const result =
                await searchRequest(
                    `/subjects/${encodeURIComponent(subject.id)}/resources`
                );


            if (!result) {
                continue;
            }


            const resources =
                Array.isArray(
                    result.resources
                )
                    ? result.resources
                    : [];


            resources.forEach(
                resource => {

                    if (
                        !resource.id ||
                        !resource.title
                    ) {

                        return;

                    }


                    searchData.books.push({

                        id:
                            resource.id,

                        title:
                            resource.title,

                        type:
                            resource.type ||

                            "Study Book",

                        subjectId:
                            subject.id,

                        subjectName:
                            subject.name

                    });

                }
            );

        }

    }


    /*=====================================
        LOAD ALL SEARCH DATA
    =====================================*/

    async function loadSearchData() {

        try {

            await loadSearchExams();

            await loadSearchSubjects();

            await loadSearchBooks();

        }

        catch (error) {

            console.error(
                "Nursephere Search Data Error:",
                error
            );

        }

    }


    /*=====================================
        SEARCH
    =====================================*/

    function performSearch(
        query
    ) {

        const value =
            query
                .trim()
                .toLowerCase();


        if (
            value.length < 2
        ) {

            closeSearchResults();

            return;

        }


        const exams =
            searchData.exams
                .filter(
                    exam =>
                        exam.name
                            .toLowerCase()
                            .includes(
                                value
                            )
                )
                .slice(
                    0,
                    5
                );


        const subjects =
            searchData.subjects
                .filter(
                    subject =>
                        subject.name
                            .toLowerCase()
                            .includes(
                                value
                            )
                )
                .slice(
                    0,
                    5
                );


        const books =
            searchData.books
                .filter(
                    book =>
                        book.title
                            .toLowerCase()
                            .includes(
                                value
                            )
                )
                .slice(
                    0,
                    5
                );


        renderSearchResults(
            exams,
            subjects,
            books
        );

    }


    /*=====================================
        RENDER RESULTS
    =====================================*/

    function renderSearchResults(
        exams,
        subjects,
        books
    ) {

        resultsContainer.innerHTML =
            "";


        const total =
            exams.length +
            subjects.length +
            books.length;


        if (
            total === 0
        ) {

            resultsContainer.innerHTML = `

                <div class="search-empty">

                    <i class="fas fa-search"></i>

                    <span>
                        No results found
                    </span>

                </div>

            `;

            resultsContainer.classList.add(
                "active"
            );

            return;

        }


        if (
            exams.length
        ) {

            renderSearchSection(
                "Examinations",
                exams,
                "exam"
            );

        }


        if (
            subjects.length
        ) {

            renderSearchSection(
                "Subjects",
                subjects,
                "subject"
            );

        }


        if (
            books.length
        ) {

            renderSearchSection(
                "Study Books",
                books,
                "book"
            );

        }


        resultsContainer.classList.add(
            "active"
        );

    }


    /*=====================================
        RENDER SECTION
    =====================================*/

    function renderSearchSection(
        title,
        items,
        type
    ) {

        const section =
            document.createElement(
                "div"
            );

        section.className =
            "search-result-section";


        const heading =
            document.createElement(
                "div"
            );

        heading.className =
            "search-result-heading";

        heading.textContent =
            title;


        section.appendChild(
            heading
        );


        items.forEach(
            item => {

                const button =
                    document.createElement(
                        "button"
                    );

                button.type =
                    "button";

                button.className =
                    "search-result-item";


                const icon =

                    type === "exam"

                        ? "fa-file-lines"

                        : type === "subject"

                            ? "fa-book-open"

                            : "fa-book";


                const name =

                    type === "book"

                        ? item.title

                        : item.name;


                const meta =

                    type === "subject"

                        ? item.examName

                        : type === "book"

                            ? item.subjectName

                            : "";


                button.innerHTML = `

                    <i class="fas ${icon}"></i>

                    <span class="search-result-content">

                        <strong>
                            ${escapeSearchHtml(name)}
                        </strong>

                        ${
                            meta
                                ? `
                                    <small>
                                        ${escapeSearchHtml(meta)}
                                    </small>
                                  `
                                : ""
                        }

                    </span>

                `;


                button.addEventListener(
                    "click",
                    () => {

                        handleSearchResult(
                            item,
                            type
                        );

                    }
                );


                section.appendChild(
                    button
                );

            }
        );


        resultsContainer.appendChild(
            section
        );

    }


    /*=====================================
        RESULT NAVIGATION
    =====================================*/

    function handleSearchResult(
        item,
        type
    ) {

        /*
            We use the existing Student
            resources/practice architecture.

            No fake API routes are created.
        */


        if (
            type === "exam"
        ) {

            window.location.href =
                `resources.html?exam_id=${encodeURIComponent(item.id)}`;

            return;

        }


        if (
            type === "subject"
        ) {

            window.location.href =
                `resources.html?subject_id=${encodeURIComponent(item.id)}`;

            return;

        }


        if (
            type === "book"
        ) {

            window.location.href =
                `resources.html?subject_id=${encodeURIComponent(item.subjectId)}`;

            return;

        }

    }


    /*=====================================
        ESCAPE SEARCH TEXT
    =====================================*/

    function escapeSearchHtml(
        value
    ) {

        return String(
            value ?? ""
        )
            .replace(
                /&/g,
                "&amp;"
            )
            .replace(
                /</g,
                "&lt;"
            )
            .replace(
                />/g,
                "&gt;"
            )
            .replace(
                /"/g,
                "&quot;"
            )
            .replace(
                /'/g,
                "&#039;"
            );

    }


    /*=====================================
        INPUT
    =====================================*/

    searchInput.addEventListener(
        "input",
        function () {

            performSearch(
                searchInput.value
            );

        }
    );


    /*=====================================
        CLOSE RESULTS
    =====================================*/

    document.addEventListener(
        "click",
        function (event) {

            if (
                !searchBox.contains(
                    event.target
                )
            ) {

                closeSearchResults();

            }

        }
    );


    function closeSearchResults() {

        resultsContainer.classList.remove(
            "active"
        );

    }


    /*=====================================
        INITIAL DATA LOAD
    =====================================*/

    loadSearchData();

}