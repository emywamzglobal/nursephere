/*==================================================
                NURSEPHERE HERO PREVIEW
====================================================

Features
--------
✔ 4 Exam Categories
✔ 3 Questions per Exam
✔ Original NCLEX-style Questions
✔ Detailed Rationales
✔ Green / Red Answer Feedback
✔ Progress Bar
✔ Score Tracking
✔ Dynamic Exam Switching
✔ Subscription CTA

==================================================*/


/*==================================================
                GLOBAL VARIABLES
==================================================*/

let currentExam = "NCLEX";
let currentQuestion = 0;
let selectedAnswer = null;
let score = 0;


/*==================================================
                DOM ELEMENTS
==================================================*/

const examSelect = document.getElementById("examSelect");

const questionNumber = document.getElementById("questionNumber");

const questionText = document.getElementById("questionText");

const answerButtons =
document.querySelectorAll(".answer-btn");

const submitBtn =
document.getElementById("submitAnswer");

const nextBtn =
document.getElementById("nextQuestion");

const rationaleBox =
document.getElementById("rationaleBox");

const heroMessage =
document.getElementById("heroMessage");

const progressFill =
document.getElementById("progressFill");


/*==================================================
                QUESTION DATABASE
==================================================*/

const freeQuestions = {

    /*==========================================
                    NCLEX
    ==========================================*/

    "NCLEX":[

        {

            question:
            "A nurse is caring for a client with heart failure. Which assessment finding requires immediate intervention?",

            options:[

                "Bilateral ankle edema",

                "Crackles heard in both lung bases",

                "Blood pressure of 136/82 mmHg",

                "Heart rate of 84 beats/min"

            ],

            answer:1,

            rationale:
            "Crackles indicate fluid accumulation in the lungs caused by worsening left-sided heart failure. Pulmonary edema can rapidly impair oxygenation and should be addressed immediately. Mild ankle edema and the vital signs shown are less urgent."

        },

        {

            question:
            "Which action should the nurse perform FIRST when a postoperative client suddenly becomes short of breath?",

            options:[

                "Call the healthcare provider",

                "Administer the prescribed pain medication",

                "Assess the airway, breathing, and oxygen saturation",

                "Encourage the client to cough"

            ],

            answer:2,

            rationale:
            "According to the ABC priority framework, airway and breathing are assessed first. Determining oxygenation status guides immediate interventions before notifying the provider."

        },

        {

            question:
            "A client has a serum potassium level of 6.2 mEq/L. Which ECG finding should the nurse expect?",

            options:[

                "Flattened T waves",

                "Peaked T waves",

                "Prolonged QT interval",

                "ST-segment depression"

            ],

            answer:1,

            rationale:
            "Hyperkalemia commonly produces tall, peaked T waves and may progress to dangerous cardiac dysrhythmias. Early recognition allows prompt treatment before life-threatening complications develop."

        }

    ],



    /*==========================================
                ATI TEAS 7
    ==========================================*/

    "ATI TEAS 7":[

        {

            question:
            "Which chamber of the heart pumps oxygenated blood into the systemic circulation?",

            options:[

                "Right atrium",

                "Right ventricle",

                "Left atrium",

                "Left ventricle"

            ],

            answer:3,

            rationale:
            "The left ventricle has the thickest muscular wall because it pumps oxygen-rich blood through the aorta to the entire body."

        },

        {

            question:
            "Which organ is primarily responsible for filtering blood and producing urine?",

            options:[

                "Liver",

                "Kidneys",

                "Pancreas",

                "Spleen"

            ],

            answer:1,

            rationale:
            "The kidneys continuously filter waste products and excess fluid from the bloodstream, helping regulate electrolyte balance, blood pressure, and urine production."

        },

        {

            question:
            "Which blood vessel carries oxygen-rich blood from the lungs back to the heart?",

            options:[

                "Pulmonary artery",

                "Superior vena cava",

                "Pulmonary vein",

                "Inferior vena cava"

            ],

            answer:2,

            rationale:
            "The pulmonary veins are unique because they carry oxygenated blood from the lungs to the left atrium. Most veins carry deoxygenated blood, making this a commonly tested concept."

        }

    ],



    /*==========================================
            HESI A2
            ---- continues in Bit 2 ----
    ==========================================*/

        /*==========================================
                    HESI A2
    ==========================================*/

    "HESI A2":[

        {

            question:
            "Which part of the cell is known as the control center because it contains the genetic material?",

            options:[

                "Mitochondrion",

                "Nucleus",

                "Ribosome",

                "Golgi apparatus"

            ],

            answer:1,

            rationale:
            "The nucleus contains DNA and directs the cell's growth, metabolism, protein synthesis, and reproduction. Because it stores the genetic blueprint, it is considered the control center of the cell."

        },

        {

            question:
            "Which organ is primarily responsible for exchanging oxygen and carbon dioxide during respiration?",

            options:[

                "Heart",

                "Kidneys",

                "Lungs",

                "Liver"

            ],

            answer:2,

            rationale:
            "Gas exchange occurs within the alveoli of the lungs. Oxygen diffuses into the bloodstream while carbon dioxide diffuses out to be exhaled."

        },

        {

            question:
            "A healthcare provider orders a medication to be given 'BID.' What does BID mean?",

            options:[

                "Once daily",

                "Twice daily",

                "Every four hours",

                "At bedtime"

            ],

            answer:1,

            rationale:
            "BID is derived from the Latin phrase 'bis in die,' meaning twice a day. Understanding common medical abbreviations is essential for safe medication administration."

        }

    ],



    /*==========================================
                    EXIT EXAMS
    ==========================================*/

    "EXIT EXAMS":[

        {

            question:
            "A nurse is caring for four clients. Which client should the nurse assess FIRST?",

            options:[

                "A client reporting pain rated 8 out of 10",

                "A client whose oxygen saturation has dropped from 97% to 88%",

                "A client requesting assistance to the restroom",

                "A client awaiting discharge instructions"

            ],

            answer:1,

            rationale:
            "A sudden decrease in oxygen saturation indicates impaired oxygenation and is the highest priority using the ABC (Airway, Breathing, Circulation) framework. The remaining situations are important but are not immediately life-threatening."

        },

        {

            question:
            "Which nursing action best helps prevent patient falls in the hospital?",

            options:[

                "Keep all four side rails raised at all times",

                "Place frequently used items within the patient's reach",

                "Encourage patients to walk without assistance",

                "Restrict fluid intake during the evening"

            ],

            answer:1,

            rationale:
            "Keeping personal belongings and the call light within reach reduces unnecessary attempts to get out of bed independently. Raising all four side rails may be considered a restraint and can actually increase injury risk."

        },

        {

            question:
            "Which statement by a client indicates effective understanding of discharge teaching after starting an antibiotic?",

            options:[

                "I'll stop taking it as soon as I feel better.",

                "I'll take the medication until the prescription is finished.",

                "I'll skip doses if they upset my stomach.",

                "I'll share any leftover medication with a family member."

            ],

            answer:1,

            rationale:
            "Completing the full course of antibiotics helps eliminate the infection and reduces the development of antibiotic resistance. Stopping early, skipping doses, or sharing medication can lead to treatment failure and unsafe outcomes."

        }

    ]

};


/*==================================================
            END OF QUESTION DATABASE
==================================================*/

/*==================================================
                LOAD QUESTION
==================================================*/

function loadQuestion() {

    const question = freeQuestions[currentExam][currentQuestion];

    questionNumber.textContent = currentQuestion + 1;

    progressFill.style.width =
        (((currentQuestion + 1) / 3) * 100) + "%";

    questionText.textContent = question.question;

    answerButtons.forEach((button, index) => {

        button.style.display = "block";

        button.disabled = false;

        button.textContent = question.options[index];

        button.style.background = "#ffffff";

        button.style.borderColor = "#DCE4F0";

        button.style.color = "#0F172A";

        button.style.cursor = "pointer";

    });

    rationaleBox.style.display = "none";

    rationaleBox.innerHTML = "";

    heroMessage.style.display = "none";

    selectedAnswer = null;

    submitBtn.style.display = "inline-flex";

    submitBtn.disabled = false;

    nextBtn.style.display = "none";

}


/*==================================================
                SELECT ANSWER
==================================================*/

answerButtons.forEach((button, index) => {

    button.addEventListener("click", () => {

        if (button.disabled) return;

        selectedAnswer = index;

        answerButtons.forEach(btn => {

            btn.style.background = "#ffffff";

            btn.style.borderColor = "#DCE4F0";

        });

        button.style.background = "#E8F1FF";

        button.style.borderColor = "#2563EB";

    });

});


/*==================================================
                SUBMIT ANSWER
==================================================*/

submitBtn.addEventListener("click", () => {

    if (selectedAnswer === null) {

        heroMessage.style.display = "block";

        heroMessage.textContent =
            "⚠ Please select an answer before submitting.";

        setTimeout(() => {

            heroMessage.style.display = "none";

        }, 2500);

        return;

    }

    const question = freeQuestions[currentExam][currentQuestion];

    if (selectedAnswer === question.answer) {

        score++;

    }

    answerButtons.forEach((button, index) => {

        button.disabled = true;

        button.style.cursor = "default";

        if (index === question.answer) {

            button.style.background = "#DCFCE7";

            button.style.borderColor = "#22C55E";

            button.style.color = "#166534";

        }

        else if (index === selectedAnswer) {

            button.style.background = "#FEE2E2";

            button.style.borderColor = "#EF4444";

            button.style.color = "#991B1B";

        }

    });

    rationaleBox.style.display = "block";

    rationaleBox.innerHTML = `

        <strong>Explanation</strong>

        <br><br>

        ${question.rationale}

    `;

    submitBtn.disabled = true;

    nextBtn.style.display = "inline-flex";

});


/*==================================================
                NEXT QUESTION
==================================================*/

nextBtn.addEventListener("click", () => {

    currentQuestion++;

    if (currentQuestion >= 3) {

        showSubscription();

        return;

    }

    loadQuestion();

});


/*==================================================
                CHANGE EXAM
==================================================*/

examSelect.addEventListener("change", () => {

    currentExam = examSelect.value;

    currentQuestion = 0;

    score = 0;

    heroMessage.style.display = "none";

    rationaleBox.innerHTML = "";

    rationaleBox.style.display = "none";

    answerButtons.forEach(button => {

        button.style.display = "block";

        button.disabled = false;

    });

    submitBtn.style.display = "inline-flex";

    submitBtn.disabled = false;

    nextBtn.style.display = "none";

    loadQuestion();

});


/*==================================================
            SUBSCRIPTION SCREEN
==================================================*/

function showSubscription() {

    progressFill.style.width = "100%";

    questionText.innerHTML = `

        🎉 Congratulations!

        <br><br>

        You completed the

        <strong>${currentExam}</strong>

        preview.

    `;

    answerButtons.forEach(button => {

        button.style.display = "none";

    });

    submitBtn.style.display = "none";

    nextBtn.style.display = "none";

    heroMessage.style.display = "none";

    rationaleBox.style.display = "block";

    rationaleBox.innerHTML = `

        <h3 style="margin-bottom:15px;">

            Your Score: ${score} / 3

        </h3>

        <p>

            Great start!

            Continue practicing with thousands of realistic nursing questions.

        </p>

        <br>

        ✔ 10,000+ Practice Questions<br><br>

        ✔ Detailed Rationales<br><br>

        ✔ Smart Analytics<br><br>

        ✔ Unlimited Practice Tests<br><br>

        ✔ NCLEX, ATI TEAS, HESI & Exit Exams<br><br>

        ✔ 3-Day Free Trial

        <br><br>

        <a href="pricing.html"

           class="btn btn-primary"

           style="display:inline-flex;">

            View Study Plans

        </a>

    `;

}


/*==================================================
                INITIALIZE
==================================================*/

loadQuestion();