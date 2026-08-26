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

async function loadComponent(containerId, file) {

    try {

        const container =
            document.getElementById(containerId);

        if (!container) {

            console.warn(
                `Container #${containerId} not found on this page.`
            );

            return;

        }

        const response =
            await fetch(file);

        if (!response.ok) {

            throw new Error(
                `Failed to load ${file}: ${response.status}`
            );

        }

        const html =
            await response.text();

        container.innerHTML =
            html;

    }

    catch (error) {

        console.error(
            `Failed to load component ${file}:`,
            error
        );

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