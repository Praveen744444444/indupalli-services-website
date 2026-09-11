/* ============================================================
   INDUPALLI SERVICES ATS — Public Jobs Module (Supabase)
   ============================================================ */

import { supabase } from "./supabase.js";

const jobsContainer = document.getElementById("jobsContainer");
const searchInput = document.getElementById("jobSearch");
const filterButtons = document.querySelectorAll(".filter-btn");

let allJobs = [];
let activeFilter = "All Jobs";

/* ---------------------------
ESCAPE HTML (prevents XSS from
recruiter-entered job data)
----------------------------*/

function escapeHTML(str) {
    if (str === null || str === undefined) return "";
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

/* ---------------------------
LOAD JOBS & REALTIME SUBSCRIPTION
(excludes archived jobs from the
public listing)
----------------------------*/

async function fetchAndRenderJobs() {
    try {
        const { data, error } = await supabase
            .from("jobs")
            .select("*")
            .or("isarchived.is.null,isarchived.eq.false")
            .order("createdAt", { ascending: false });

        if (error) throw error;

        allJobs = data || [];
        applyFilters();
    } catch (e) {
        console.error("Error loading jobs from Supabase:", e);
    }
}

// Initial load
fetchAndRenderJobs();

// Supabase Realtime Listener — refreshes list on any insert,
// update (including archive/unarchive), or delete
supabase
    .channel("public:jobs_list")
    .on("postgres_changes", { event: "*", schema: "public", table: "jobs" }, () => {
        fetchAndRenderJobs();
    })
    .subscribe();

/* ---------------------------
SEARCH
----------------------------*/

if (searchInput) {
    searchInput.addEventListener("input", applyFilters);
}

/* ---------------------------
FILTER BUTTONS
----------------------------*/

filterButtons.forEach(btn => {
    btn.addEventListener("click", () => {
        filterButtons.forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        activeFilter = btn.textContent.trim();
        applyFilters();
    });
});

/* ---------------------------
APPLY SEARCH + FILTER TOGETHER
----------------------------*/

function applyFilters() {
    const keyword = searchInput ? searchInput.value.toLowerCase() : "";

    let filtered = allJobs.filter(job =>
        (job.jobTitle || job.title || "").toLowerCase().includes(keyword) ||
        (job.location || "").toLowerCase().includes(keyword) ||
        (job.companyName || "").toLowerCase().includes(keyword)
    );

    if (activeFilter !== "All Jobs") {
        filtered = filtered.filter(job =>
            (job.jobType || "").toLowerCase() === activeFilter.toLowerCase()
        );
    }

    renderJobs(filtered);
}

/* ---------------------------
RENDER
----------------------------*/

function renderJobs(jobs) {
    if (!jobsContainer) return;

    if (jobs.length === 0) {
        jobsContainer.innerHTML = `
        <div class="loading-box">
            <i class="fa-solid fa-magnifying-glass"></i>
            <h3>No Jobs Available</h3>
            <p>Try adjusting your search or filters.</p>
        </div>
        `;
        return;
    }

    jobsContainer.innerHTML = "";

    jobs.forEach(job => {
        const fullDescription = escapeHTML(job.description || "No description provided.");
        const jobId = escapeHTML(job.id);
        const jobTitle = escapeHTML(job.jobTitle || job.title || "Untitled Job");
        const companyName = escapeHTML(job.companyName || "Indupalli Services");
        const location = escapeHTML(job.location || "India");
        const jobType = escapeHTML(job.jobType || "Full Time");
        const salary = escapeHTML(job.salary || "Negotiable");

        const card = document.createElement("div");
        card.className = "job-card";
        card.innerHTML = `
            <h3>${jobTitle}</h3>
            <div class="company">${companyName}</div>
            <div class="meta">
                <span>📍 ${location}</span>
                <span>💼 ${jobType}</span>
                <span>💰 ${salary}</span>
            </div>
            <div class="description collapsed">
                ${fullDescription}
            </div>
            <div class="actions">
                <a class="read-more" href="#">Read More →</a>
                <button class="apply-btn" data-job-id="${jobId}">Apply Now</button>
            </div>
        `;

        const applyBtn = card.querySelector(".apply-btn");
        applyBtn.addEventListener("click", () => {
            window.location.href = `login.html?jobId=${encodeURIComponent(job.id)}`;
        });

        const readMoreLink = card.querySelector(".read-more");
        const descriptionEl = card.querySelector(".description");

        readMoreLink.addEventListener("click", (e) => {
            e.preventDefault();
            const isCollapsed = descriptionEl.classList.toggle("collapsed");
            readMoreLink.textContent = isCollapsed ? "Read More →" : "Show Less ↑";
        });

        jobsContainer.appendChild(card);
    });
}