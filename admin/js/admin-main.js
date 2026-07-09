/*=========================================
        ADMIN APPLICATION
=========================================*/

document.addEventListener("DOMContentLoaded", async () => {

    await loadComponent("sidebar-container", "sidebar.html");

    await loadComponent("header-container", "header.html");

    initializeSidebar();

});

/*=========================================
        LOAD COMPONENT
=========================================*/

async function loadComponent(containerId, file){

    try{

        const response = await fetch(file);

        const html = await response.text();

        document.getElementById(containerId).innerHTML = html;

    }

    catch(error){

        console.error(error);

    }

}

/*=========================================
        SIDEBAR TOGGLE
=========================================*/

function initializeSidebar(){

    const menuToggle=document.getElementById("menuToggle");

    const sidebar=document.getElementById("adminSidebar");

    const content=document.querySelector(".admin-main");

    if(!menuToggle || !sidebar || !content){

        console.log("Toggle elements not found.");

        return;

    }

    menuToggle.addEventListener("click",()=>{

        sidebar.classList.toggle("collapsed");

        content.classList.toggle("expanded");

    });

}