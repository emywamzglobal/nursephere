/*==================================================
            NURSEPHERE HERO
==================================================*/

let currentExam = "NCLEX";
let currentQuestion = 0;
let selectedAnswer = null;

const examSelect = document.getElementById("examSelect");
const questionNumber = document.getElementById("questionNumber");
const questionText = document.getElementById("questionText");

const answerButtons = document.querySelectorAll(".answer-btn");

const submitBtn = document.getElementById("submitAnswer");
const nextBtn = document.getElementById("nextQuestion");

const rationaleBox = document.getElementById("rationaleBox");

const heroMessage = document.getElementById("heroMessage");

const progressFill = document.getElementById("progressFill");
/*==============================
        LOAD QUESTION
==============================*/

function loadQuestion(){

    const question =
        freeQuestions[currentExam][currentQuestion];

    questionNumber.textContent = currentQuestion + 1;

    const progress = ((currentQuestion + 1) / 3) * 100;

progressFill.style.width = progress + "%";

    questionText.textContent = question.question;

    answerButtons.forEach((button,index)=>{

        button.textContent = question.options[index];

        button.style.background="#ffffff";
        button.style.borderColor="#DCE4F0";
        button.style.color="#0F172A";

    });

    rationaleBox.style.display="none";

    selectedAnswer=null;

    nextBtn.style.display="none";

}


/*==============================
        SELECT ANSWER
==============================*/

answerButtons.forEach((button,index)=>{

    button.addEventListener("click",()=>{

        selectedAnswer=index;

        answerButtons.forEach(btn=>{

            btn.style.background="#ffffff";
            btn.style.borderColor="#DCE4F0";

        });

        button.style.background="#E8F1FF";
        button.style.borderColor="#2563EB";

    });

});


/*==============================
        SUBMIT
==============================*/

submitBtn.addEventListener("click",()=>{

    if(selectedAnswer===null){

    heroMessage.style.display = "block";

    heroMessage.textContent = "⚠ Please select an answer before submitting.";

    setTimeout(() => {

        heroMessage.style.display = "none";

    }, 2500);

    return;

}

    const question =
        freeQuestions[currentExam][currentQuestion];

    answerButtons.forEach((button,index)=>{

        if(index===question.answer){

            button.style.background="#DCFCE7";
            button.style.borderColor="#22C55E";

        }

        else if(index===selectedAnswer){

            button.style.background="#FEE2E2";
            button.style.borderColor="#EF4444";

        }

    });

    rationaleBox.style.display="block";

    rationaleBox.innerHTML=

    "<strong>Rationale:</strong><br><br>"+

    question.rationale;

    nextBtn.style.display="inline-flex";

});


/*==============================
        NEXT QUESTION
==============================*/

nextBtn.addEventListener("click",()=>{

    currentQuestion++;

    if(currentQuestion>=3){

        showSubscription();

        return;

    }

    loadQuestion();

});


/*==============================
        CHANGE EXAM
==============================*/

examSelect.addEventListener("change",()=>{

    currentExam=examSelect.value;

    currentQuestion=0;

    loadQuestion();

});


/*==============================
    SUBSCRIPTION POPUP
==============================*/

function showSubscription(){

    questionText.innerHTML=

    "🎉 You've completed the FREE preview!";

    answerButtons.forEach(button=>{

        button.style.display="none";

    });

    submitBtn.style.display="none";

    nextBtn.style.display="none";

    heroMessage.style.display = "none";

    rationaleBox.style.display="block";

    rationaleBox.innerHTML=`

        <h3>Unlock the Full Question Bank</h3>

        <br>

        ✔ 10,000+ Questions<br><br>

        ✔ Detailed Rationales<br><br>

        ✔ Smart Analytics<br><br>

        ✔ Exam Simulations<br><br>

        <a href="pricing.html"
        class="btn btn-primary">

        Subscribe Now

        </a>

    `;

}


/*==============================
        INITIALIZE
==============================*/

loadQuestion();