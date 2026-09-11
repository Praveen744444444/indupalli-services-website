/* ============================================================
   INDUPALLI SERVICES ATS — Job Details Module (Supabase)
   ============================================================ */

import { supabase } from "./supabase.js";

// =========================
// GET JOB ID
// =========================

const params = new URLSearchParams(window.location.search);
const jobId = params.get("id");

if (!jobId) {
    alert("Job not found.");
    window.location.href = "jobs.html";
}

// =========================
// SAFE TEXT SETTER
// (textContent instead of innerHTML
//  prevents XSS from stored job data)
// =========================

function setText(id, value, fallback = "") {
    const el = document.getElementById(id);
    if (el) el.textContent = value || fallback;
}

// =========================
// LOAD JOB FROM SUPABASE
// =========================

async function loadJob() {
    try {
        // Query Supabase for the specific job by ID
        const { data: job, error } = await supabase
            .from("jobs")
            .select("*")
            .eq("id", jobId)
            .single();

        if (error || !job) {
            setText("jobTitle", "Job Not Found");
            return;
        }

        setText("jobTitle", job.jobtitle);
        setText("companyName", job.companyname);
        setText("location", job.location);
        setText("salary", job.salary);
        setText("experience", job.experience);
        setText("notice", job.notice);
        setText("description", job.description);
        setText("recruiterName", job.recruiteremail, "Indupalli Services");

    } catch (error) {
        console.error("Error loading job details:", error);
        alert(error.message);
    }
}

loadJob();

// =========================
// APPLY BUTTON
// =========================

const applyBtn = document.getElementById("applyNowBtn");

if (applyBtn) {
    applyBtn.addEventListener("click", function (e) {
        e.preventDefault();
        window.location.href = `login.html?jobId=${encodeURIComponent(jobId)}`;
    });
}