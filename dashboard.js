/* ============================================================
   INDUPALLI SERVICES ATS — Recruiter Dashboard Module
   ============================================================ */

import { supabase } from "./supabase.js";

// ==========================================================
// Recruiter scoping — a recruiter only sees jobs/applications
// for jobs THEY posted. The admin account sees everything.
// ==========================================================
const ADMIN_EMAIL = "praveencenaindupalli@gmail.com";

function getMyEmail() {
    return String(localStorage.getItem("recruiterEmail") || "")
        .trim()
        .toLowerCase();
}

function isAdminUser() {
    return getMyEmail() === ADMIN_EMAIL.toLowerCase();
}

function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

async function getMyJobIds() {
    if (isAdminUser()) return null;

    const email = getMyEmail();
    if (!email) return new Set();

    const { data: myJobs, error } = await supabase
        .from("jobs")
        .select("id, recruiteremail")
        .eq("recruiteremail", email);

    if (error) {
        console.error("Error fetching recruiter job IDs:", error);
        return new Set();
    }

    return new Set(
        (myJobs || []).map(job => String(job.id))
    );
}

// ==========================================================
// Dashboard Initialization
// ==========================================================
document.addEventListener("DOMContentLoaded", () => {
    initializeDashboard();
});

function initializeDashboard() {
    checkRecruiterSession();
    startClock();
    initializeSearch();
    initializeLogout();
    initializeNotificationListener();
    loadDashboardCounts();
    loadJobs();
    
    // NOTE: loadApplications() has been removed here because
    // window.loadInboundApplications() is now handled cleanly by the HTML file.
    
    loadPayments();
}

// ==========================================================
// Recruiter Session
// ==========================================================
function checkRecruiterSession() {
    const email = localStorage.getItem("recruiterEmail");

    if (!email) {
        window.location.href = "recruiter-login.html";
        return;
    }

    const recruiterName = email
        .split("@")[0]
        .replace(/[._-]/g, " ")
        .replace(/\b\w/g, l => l.toUpperCase());

    const nameEl = document.getElementById("displayRecruiterName");
    const emailEl = document.getElementById("displayRecruiterEmail");
    const avatarEl = document.getElementById("displayAvatar");

    if (nameEl) nameEl.textContent = recruiterName;
    if (emailEl) emailEl.textContent = email;
    if (avatarEl) avatarEl.textContent = recruiterName.charAt(0);

    const badge = document.getElementById("displayRoleBadge");

    if (badge) {
        if (isAdminUser()) {
            badge.innerHTML = "Administrator";
            badge.style.background = "#dc2626";
        } else {
            badge.innerHTML = "Recruiter";
            badge.style.background = "#10b981";
        }
    }
}

// ==========================================================
// Live Clock
// ==========================================================
function startClock() {
    updateClock();
    setInterval(updateClock, 1000);
}

function updateClock() {
    const clock = document.getElementById("liveClock");
    if (!clock) return;

    clock.innerHTML =
        new Date().toLocaleTimeString("en-IN", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: true
        }) + " IST";
}

// ==========================================================
// Logout
// ==========================================================
function initializeLogout() {
    const btn = document.getElementById("sidebarLogoutBtn");
    if (!btn) return;

    btn.onclick = () => {
        if (typeof window.showCustomConfirm === "function") {
            window.showCustomConfirm(
                "Logout from Recruiter Dashboard?",
                "Logout",
                () => {
                    localStorage.clear();
                    location.href = "recruiter-login.html";
                }
            );
        } else {
            localStorage.clear();
            location.href = "recruiter-login.html";
        }
    };
}

// ==========================================================
// Search
// ==========================================================
function initializeSearch() {
    const search = document.querySelector(".search-box input");
    if (!search) return;

    search.addEventListener("keyup", function () {
        const keyword = this.value.toLowerCase();

        document
            .querySelectorAll(".dashboard-table tbody tr")
            .forEach(row => {
                row.style.display = row.innerText.toLowerCase().includes(keyword)
                    ? ""
                    : "none";
            });
    });
}

console.log("✅ Dashboard Part 1 Loaded");

// ==========================================================
// Dashboard Counters
// ==========================================================
async function loadDashboardCounts() {
    try {
        const myJobIds = await getMyJobIds();

        const { data: jobs } = await supabase
            .from("jobs")
            .select("id, recruiteremail");

        const { data: apps } = await supabase
            .from("jobApplications")
            .select("*");

        const jobList = jobs || [];
        const appList = apps || [];

        const jobCount = myJobIds === null
            ? jobList.length
            : jobList.filter(j =>
                String(j.recruiteremail || "").trim().toLowerCase() === getMyEmail()
            ).length;

        const appCount = myJobIds === null
            ? appList.length
            : appList.filter(a =>
                myJobIds.has(String(a.jobId ?? a.job_id ?? a.jobID ?? "").trim())
            ).length;

        const jobsCard = document.getElementById("kpiTotalJobs");
        const appsCard = document.getElementById("kpiTotalApps");

        if (jobsCard) jobsCard.innerHTML = jobCount;
        if (appsCard) appsCard.innerHTML = appCount;

    } catch (e) {
        console.error("Dashboard counter error:", e);
    }
}

// ==========================================================
// Notification Listener
// ==========================================================
function initializeNotificationListener() {
    const fetchUnread = async () => {
        const { data: notifs } = await supabase
            .from("notifications")
            .select("id, is_read");

        let unread = 0;
        (notifs || []).forEach(n => {
            if (!n.is_read) unread++;
        });

        const badge = document.getElementById("notificationCount");
        if (!badge) return;

        badge.innerHTML = unread;
        badge.style.display = unread > 0 ? "inline-block" : "none";
        document.title = unread > 0 ? `(${unread}) Recruiter Dashboard` : "Recruiter Dashboard";
    };

    fetchUnread();

    supabase
        .channel("public:notifications")
        .on("postgres_changes", {
            event: "*",
            schema: "public",
            table: "notifications"
        }, () => {
            fetchUnread();
        })
        .subscribe();
}

console.log("✅ Dashboard Parts 1 & 2 Loaded");

// ==========================================================
// PART 3: POST JOB TO SUPABASE
// ==========================================================
window.postJobFromForm = async function () {
    try {
        const jobtitle = document.getElementById("jobTitle")?.value?.trim();
        const companyname = document.getElementById("companyName")?.value?.trim();
        const location = document.getElementById("location")?.value?.trim();
        const salary = document.getElementById("salary")?.value?.trim();
        const experience = document.getElementById("experience")?.value?.trim();
        const notice = document.getElementById("maxNotice")?.value;
        const description = document.getElementById("jobDescription")?.value?.trim();
        const closingdate = document.getElementById("closingDate")?.value;

        if (!jobtitle || !companyname || !location || !salary || !experience || !description) {
            if (typeof window.showCustomAlert === "function") window.showCustomAlert("Please fill all required fields.", "Error", "Error");
            return;
        }

        const recruiteremail = getMyEmail();
        if (!recruiteremail) {
            if (typeof window.showCustomAlert === "function") window.showCustomAlert("Recruiter session not found.", "Error", "Error");
            return;
        }

        const recruiterName = localStorage.getItem("recruiterName") ||
            recruiteremail.split("@")[0].replace(/[._-]/g, " ").replace(/\b\w/g, l => l.toUpperCase());

        const { error } = await supabase
            .from("jobs")
            .insert([{
                jobtitle,
                companyname,
                location,
                salary,
                experience,
                notice,
                description,
                recruiteremail,
                recruiterName,
                status: "Open",
                applicants: 0,
                isarchived: false,
                closingdate
            }]);

        if (error) throw error;

        if (typeof window.showCustomAlert === "function") window.showCustomAlert("Job Posted Successfully", "Success", "Success");
        document.getElementById("jobForm")?.reset();
        loadJobs();
        loadDashboardCounts();

    } catch (error) {
        console.error("Post job error:", error);
        if (typeof window.showCustomAlert === "function") window.showCustomAlert(error.message || "Could not post job.", "Error", "Error");
    }
};

const jobFormElement = document.getElementById("jobForm");
if (jobFormElement) {
    jobFormElement.addEventListener("submit", function (e) {
        e.preventDefault();
        window.postJobFromForm();
    });
}

console.log("✅ Dashboard Part 3 Loaded");

// ==========================================================
// PART 4: LIVE JOBS TABLE
// ==========================================================
async function loadJobs() {
    const jobsContainer = document.getElementById("jobsContainer");
    if (!jobsContainer) return;

    const myEmail = getMyEmail();
    const admin = isAdminUser();

    const fetchAndRenderJobs = async () => {
        const { data: jobs, error } = await supabase
            .from("jobs")
            .select("*")
            .order("createdat", { ascending: false });

        if (error) {
            console.error("Error loading jobs:", error);
            return;
        }

        jobsContainer.innerHTML = "";

        const docs = admin
            ? (jobs || [])
            : (jobs || []).filter(j =>
                String(j.recruiteremail || "").trim().toLowerCase() === myEmail
            );

        if (!docs.length) {
            jobsContainer.innerHTML = `
                <tr>
                    <td colspan="5" style="text-align:center; padding:20px; color:#64748b;">
                        No jobs found.
                    </td>
                </tr>
            `;
            return;
        }

        docs.forEach(job => {
            jobsContainer.innerHTML += `
                <tr>
                    <td><strong>${escapeHtml(job.jobtitle || job.title || "")}</strong></td>
                    <td>${escapeHtml(job.location || "")}</td>
                    <td>${escapeHtml(job.experience || "")}</td>
                    <td>${escapeHtml(job.salary || "")}</td>
                    <td>
                        <button onclick="window.openEditJobModal('${escapeHtml(job.id)}')" style="
                            background:#2563eb; color:#fff; border:none; padding:6px 10px; border-radius:6px; cursor:pointer; margin-right:5px;
                        ">Edit</button>
                        <button onclick="deleteJob('${escapeHtml(job.id)}')" style="
                            background:#ef4444; color:#fff; border:none; padding:6px 10px; border-radius:6px; cursor:pointer;
                        ">Delete</button>
                    </td>
                </tr>
            `;
        });
    };

    await fetchAndRenderJobs();

    if (!window.__jobsChannelSubscribed) {
        window.__jobsChannelSubscribed = true;
        supabase
            .channel("public:jobs")
            .on("postgres_changes", {
                event: "*",
                schema: "public",
                table: "jobs"
            }, () => {
                fetchAndRenderJobs();
            })
            .subscribe();
    }
}

console.log("✅ Dashboard Part 4 Loaded");

// ==========================================================
// PART 5: EDIT & DELETE JOB
// ==========================================================
window.openEditJobModal = async function (jobid) {
    const modal = document.getElementById("editJobModal");
    if (!modal) {
        console.error("Modal #editJobModal not found in DOM");
        return;
    }

    try {
        const { data: job, error } = await supabase
            .from("jobs")
            .select("*")
            .eq("id", jobid)
            .single();

        if (error || !job) {
            if (typeof window.showCustomAlert === "function") window.showCustomAlert("Job details not found.", "Error", "Error");
            return;
        }

        const idField = document.getElementById("editJobId");
        const titleField = document.getElementById("editJobTitle");
        const locField = document.getElementById("editLocation");
        const salaryField = document.getElementById("editSalary");
        const dateField = document.getElementById("editClosingDate");
        const descField = document.getElementById("editJobDescription");

        if (idField) idField.value = job.id;
        if (titleField) titleField.value = job.jobtitle || job.title || "";
        if (locField) locField.value = job.location || "";
        if (salaryField) salaryField.value = job.salary || "";
        if (dateField) dateField.value = job.closingdate || job.closing_date || job.closingDate || "";
        if (descField) descField.value = job.description || "";

        modal.style.display = "flex";

    } catch (error) {
        console.error("Error opening edit modal:", error);
        if (typeof window.showCustomAlert === "function") window.showCustomAlert("Could not load job data.", "Error", "Error");
    }
};

window.editJob = window.openEditJobModal;

window.closeEditJobModal = function () {
    const modal = document.getElementById("editJobModal");
    if (modal) modal.style.display = "none";
};

window.saveEditedJob = async function (e) {
    if (e && e.preventDefault) e.preventDefault();

    const jobId = document.getElementById("editJobId")?.value;
    const jobtitle = document.getElementById("editJobTitle")?.value?.trim();
    const location = document.getElementById("editLocation")?.value?.trim();
    const salary = document.getElementById("editSalary")?.value?.trim();
    const closingdate = document.getElementById("editClosingDate")?.value;
    const description = document.getElementById("editJobDescription")?.value?.trim();

    if (!jobId || !jobtitle || !location || !salary || !description) {
        if (typeof window.showCustomAlert === "function") window.showCustomAlert("Please fill all required fields.", "Error", "Error");
        return;
    }

    try {
        const { error } = await supabase
            .from("jobs")
            .update({
                jobtitle,
                location,
                salary,
                closingdate,
                description
            })
            .eq("id", jobId);

        if (error) throw error;

        if (typeof window.showCustomAlert === "function") window.showCustomAlert("Job Updated Successfully", "Success", "Success");
        window.closeEditJobModal();

        if (typeof window.loadPostedJobsInventory === "function") window.loadPostedJobsInventory();
        loadJobs();
        loadDashboardCounts();

    } catch (err) {
        console.error("Save edit error:", err);
        if (typeof window.showCustomAlert === "function") window.showCustomAlert(err.message || "Failed to update job.", "Error", "Error");
    }
};

window.deleteJob = async function (jobid) {
    if (typeof window.showCustomConfirm === "function") {
        window.showCustomConfirm(
            "Are you sure you want to delete this job?",
            "Delete Job",
            async () => {
                try {
                    const { error } = await supabase
                        .from("jobs")
                        .delete()
                        .eq("id", jobid);

                    if (error) throw error;

                    if (typeof window.showCustomAlert === "function") window.showCustomAlert("Job deleted successfully", "Success", "Success");
                    
                    if (typeof window.loadPostedJobsInventory === "function") window.loadPostedJobsInventory();
                    loadJobs();
                    loadDashboardCounts();

                } catch (error) {
                    console.error(error);
                    if (typeof window.showCustomAlert === "function") window.showCustomAlert(error.message, "Error", "Error");
                }
            }
        );
    }
};

console.log("✅ Dashboard Part 5 Loaded");

// ==========================================================
// REFRESH DASHBOARD KPIs
// ==========================================================
async function refreshDashboardKPIs() {
    await loadDashboardCounts();
}

setInterval(() => {
    refreshDashboardKPIs();
}, 60000);

// ==========================================================
// PART 7: PAYMENT REQUESTS
// ==========================================================
async function loadPayments() {
    const table = document.getElementById("paymentRequestsContainer");
    const panel = document.getElementById("paymentRequestsPanel");
    if (!table) return;

    const isAdmin = isAdminUser();

    if (!isAdmin) {
        if (panel) panel.style.display = "none";
        return;
    }

    if (panel) panel.style.display = "block";

    const fetchAndRenderPayments = async () => {
        const { data: pays, error } = await supabase
            .from("paymentrequests")
            .select("*")
            .order("requestedat", { ascending: false });

        if (error) {
            console.error("Error loading payment requests:", error);
            return;
        }

        table.innerHTML = "";
        const paysList = pays || [];
        const countEl = document.getElementById("pendingRequestCount");
        if (countEl) countEl.innerHTML = paysList.length + " Pending";

        if (!paysList.length) {
            table.innerHTML = `
                <tr>
                    <td colspan="5" style="padding:20px; text-align:center;">
                        No Payment Requests
                    </td>
                </tr>
            `;
            return;
        }

        paysList.forEach(pay => {
            table.innerHTML += `
                <tr>
                    <td>${escapeHtml(pay.email || "-")}</td>
                    <td>${escapeHtml(pay.role || "-")}</td>
                    <td>₹${escapeHtml(pay.amount || 0)}</td>
                    <td>${escapeHtml(pay.requestedat || "-")}</td>
                    <td>
                        <button onclick="approvePayment('${escapeHtml(pay.id)}')" style="
                            background:#10b981; color:white; border:none; padding:6px 12px; border-radius:6px; cursor:pointer; margin-right:6px;
                        ">Approve</button>
                        <button onclick="rejectPayment('${escapeHtml(pay.id)}')" style="
                            background:#ef4444; color:white; border:none; padding:6px 12px; border-radius:6px; cursor:pointer;
                        ">Reject</button>
                    </td>
                </tr>
            `;
        });
    };

    await fetchAndRenderPayments();

    if (!window.__paymentsChannelSubscribed) {
        window.__paymentsChannelSubscribed = true;
        supabase
            .channel("public:paymentrequests")
            .on("postgres_changes", {
                event: "*",
                schema: "public",
                table: "paymentrequests"
            }, () => {
                fetchAndRenderPayments();
            })
            .subscribe();
    }
}

// ==========================================================
// APPROVE & REJECT PAYMENT
// ==========================================================
window.approvePayment = async function (id) {
    if (!isAdminUser()) {
        if (typeof window.showCustomAlert === "function") window.showCustomAlert("Administrator access required.", "Error", "Error");
        return;
    }

    if (typeof window.showCustomConfirm === "function") {
        window.showCustomConfirm(
            "Are you sure you want to approve this payment request?",
            "Approve Payment",
            async () => {
                try {
                    const { error } = await supabase
                        .from("paymentrequests")
                        .update({ status: "Approved" })
                        .eq("id", id);

                    if (error) throw error;

                    if (typeof window.showCustomAlert === "function") window.showCustomAlert("Payment Approved", "Success", "Success");
                    loadPayments();

                } catch (e) {
                    console.error(e);
                    if (typeof window.showCustomAlert === "function") window.showCustomAlert(e.message, "Error", "Error");
                }
            }
        );
    }
};

window.rejectPayment = async function (id) {
    if (!isAdminUser()) {
        if (typeof window.showCustomAlert === "function") window.showCustomAlert("Administrator access required.", "Error", "Error");
        return;
    }

    if (typeof window.showCustomConfirm === "function") {
        window.showCustomConfirm(
            "Are you sure you want to reject this payment request?",
            "Reject Payment",
            async () => {
                try {
                    const { error } = await supabase
                        .from("paymentrequests")
                        .update({ status: "Rejected" })
                        .eq("id", id);

                    if (error) throw error;

                    if (typeof window.showCustomAlert === "function") window.showCustomAlert("Payment Rejected", "Success", "Success");
                    loadPayments();

                } catch (e) {
                    console.error(e);
                    if (typeof window.showCustomAlert === "function") window.showCustomAlert(e.message, "Error", "Error");
                }
            }
        );
    }
};

console.log("✅ Dashboard Part 7 Loaded");

// ==========================================================
// PART 8: AI GENERATOR & MODAL CONTROLS (PLAIN TEXT)
// ==========================================================

window.runGeminiAIDraft = async function () {
    const promptInput = document.getElementById("aiPrompt");
    const aiResultEl = document.getElementById("aiResult");
    const genBtn = document.getElementById("btnGenerateAIModal");

    const titleInput = document.getElementById("jobTitle");
    const expInput = document.getElementById("experience");
    const compInput = document.getElementById("companyName");
    const locInput = document.getElementById("location");
    const salaryInput = document.getElementById("salary");
    const noticeInput = document.getElementById("maxNotice");

    const userPrompt = promptInput?.value?.trim() || "";
    const title = titleInput?.value?.trim() || "";
    const exp = expInput?.value?.trim() || "0";
    const company = compInput?.value?.trim() || "Indupalli Services Pvt Ltd";
    const location = locInput?.value?.trim() || "Hyderabad, Telangana";
    const salary = salaryInput?.value?.trim() || "";
    const notice = noticeInput?.value || "";

    if (!title) {
        if (typeof window.showCustomAlert === "function") {
            window.showCustomAlert("Please enter a Job Title before generating a description.", "Warning", "Info");
        }
        titleInput?.focus();
        return;
    }

    if (aiResultEl) {
        aiResultEl.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Generating tailored Job Description with Gemini...`;
    }
    if (genBtn) genBtn.disabled = true;

    // Pull any free-text guidance the recruiter typed beyond the auto-filled
    // "Create a professional job description for..." starter sentence.
    let extraGuidance = "";
    if (userPrompt && !userPrompt.toLowerCase().startsWith("create a professional job description")) {
        extraGuidance = userPrompt;
    }

    try {
        const { data, error } = await supabase.functions.invoke("generate-job-description", {
            body: {
                jobTitle: title,
                companyName: company,
                location,
                experience: exp,
                salary,
                notice,
                extraGuidance,
            },
        });

        if (error) throw error;
        if (!data?.description) throw new Error("Gemini did not return a description.");

        if (aiResultEl) {
            aiResultEl.innerText = data.description;
        }
    } catch (e) {
        console.error("runGeminiAIDraft error:", e);
        if (aiResultEl) {
            aiResultEl.innerText = "Could not generate a description right now. Please try again, or write it manually.";
        }
        if (typeof window.showCustomAlert === "function") {
            window.showCustomAlert(e?.message || "AI generation failed. Please try again.", "Error", "Error");
        }
    } finally {
        if (genBtn) genBtn.disabled = false;
    }
};

window.insertAIResult = function () {
    const aiResultEl = document.getElementById("aiResult");
    const targetTextArea = document.getElementById("jobDescription");

    if (!aiResultEl || !targetTextArea) return;

    const content = aiResultEl.innerText.trim();

    if (!content || content.includes("Waiting for AI") || content.includes("Preparing AI") || content.includes("Generating")) {
        if (typeof window.showCustomAlert === "function") {
            window.showCustomAlert("Please wait for the draft to generate before applying.", "Warning", "Info");
        }
        return;
    }

    targetTextArea.value = content;
    window.closeAI();

    if (typeof window.showCustomAlert === "function") {
        window.showCustomAlert("Applied description to form!", "Success", "Success");
    }
};

window.closeAI = function () {
    const aiModal = document.getElementById("aiModal");
    if (aiModal) {
        aiModal.style.display = "none";
    }
};

// ==========================================================
// PART 9: DEMO CANDIDATE / GLOBAL ALIASES
// ==========================================================
window.simulateCandidateApply = async function () {
    try {
        const { data: jobs, error: jobErr } = await supabase.from("jobs").select("*");

        if (jobErr || !jobs || jobs.length === 0) {
            if (typeof window.showCustomAlert === "function") window.showCustomAlert("Please create a job first.", "Warning", "Info");
            return;
        }

        const firstJob = jobs[0];

        const { error: appErr } = await supabase
            .from("jobApplications")
            .insert([{
                fullname: "Demo Candidate",
                email: "candidate@test.com",
                jobTitle: firstJob.jobtitle || firstJob.title,
                jobId: firstJob.id,
                companyName: firstJob.companyname || firstJob.company || "Indupalli Services",
                recruiteremail: firstJob.recruiteremail || "",
                status: "New Application"
            }]);

        if (appErr) throw appErr;

        if (typeof window.showCustomAlert === "function") window.showCustomAlert("Demo candidate added successfully.", "Success", "Success");

    } catch (e) {
        console.error(e);
        if (typeof window.showCustomAlert === "function") window.showCustomAlert(e.message, "Error", "Error");
    }
};

window.refreshDashboard = function () {
    refreshDashboardKPIs();
    loadJobs();
    if (typeof window.loadInboundApplications === "function") {
        window.loadInboundApplications();
    }
    loadPayments();
};

console.log("✅ Indupalli ATS Dashboard Ready (Supabase)");
// ==========================================================
// PART 10: AUTOMATIC ATS MATCH SCORE
// ==========================================================

const ATS_SCORE_COLUMNS = [
    "matchScore",
    "match_score",
    "jobMatchScore",
    "job_match_score"
];

function atsNormalize(value) {
    return String(value ?? "")
        .toLowerCase()
        .replace(/[^\w+#.\-/ ]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function atsToText(value) {
    if (Array.isArray(value)) {
        return value.map(v => String(v ?? "")).join(" ");
    }

    if (value && typeof value === "object") {
        return Object.values(value).join(" ");
    }

    return String(value ?? "");
}

function atsUnique(items) {
    return [...new Set(
        items
            .map(atsNormalize)
            .filter(Boolean)
    )];
}

function atsExtractSkills(candidate) {

    const fields = [
        candidate.skills,
        candidate.skillSet,
        candidate.skill_set,
        candidate.extractedSkills,
        candidate.extracted_skills,
        candidate.resumeSkills,
        candidate.resume_skills,
        candidate.technicalSkills,
        candidate.technical_skills,
        candidate.keySkills,
        candidate.key_skills
    ];

    const skills = [];

    fields.forEach(value => {

        const text = atsToText(value);

        text.split(/[,;|\n]+/).forEach(part => {

            const cleaned = atsNormalize(part);

            if (
                cleaned &&
                cleaned.length >= 2 &&
                cleaned.length <= 80
            ) {
                skills.push(cleaned);
            }

        });

    });

    const commonSkills = [
        "javascript",
        "typescript",
        "react",
        "react.js",
        "angular",
        "vue",
        "node.js",
        "nodejs",
        "python",
        "java",
        "c",
        "c++",
        "c#",
        ".net",
        "dotnet",
        "php",
        "ruby",
        "go",
        "rust",
        "sql",
        "mysql",
        "postgresql",
        "postgres",
        "oracle",
        "mongodb",
        "redis",
        "html",
        "css",
        "tailwind",
        "bootstrap",
        "spring",
        "spring boot",
        "django",
        "flask",
        "aws",
        "azure",
        "gcp",
        "docker",
        "kubernetes",
        "terraform",
        "jenkins",
        "devops",
        "git",
        "github",
        "gitlab",
        "bitbucket",
        "linux",
        "windows",
        "power bi",
        "tableau",
        "excel",
        "pandas",
        "numpy",
        "machine learning",
        "deep learning",
        "tensorflow",
        "pytorch",
        "selenium",
        "testng",
        "jmeter",
        "servicenow",
        "salesforce",
        "sap",
        "recruitment",
        "talent acquisition",
        "hr",
        "human resources",
        "communication",
        "project management",
        "business analysis",
        "data analysis",
        "cybersecurity",
        "networking",
        "active directory"
    ];

    const freeText = atsNormalize([
        candidate.resumeText,
        candidate.resume_text,
        candidate.resumeContent,
        candidate.resume_content,
        candidate.about,
        candidate.bio,
        candidate.summary,
        candidate.coverLetter,
        candidate.cover_letter,
        candidate.pitch
    ]
        .map(v => atsToText(v))
        .join(" "));

    commonSkills.forEach(skill => {

        const normalizedSkill = atsNormalize(skill);

        if (freeText.includes(normalizedSkill)) {
            skills.push(normalizedSkill);
        }

    });

    return atsUnique(skills);
}

function atsJobSkills(job) {

    const explicitSkills = [
        job.skills,
        job.skillSet,
        job.skill_set,
        job.requiredSkills,
        job.required_skills,
        job.technicalSkills,
        job.technical_skills
    ]
        .map(atsToText)
        .join(" ");

    const jobText = atsNormalize([
        job.jobtitle,
        job.job_title,
        job.title,
        job.description,
        job.requirements,
        explicitSkills
    ]
        .map(v => atsToText(v))
        .join(" "));

    const commonSkills = [
        "javascript",
        "typescript",
        "react",
        "react.js",
        "angular",
        "vue",
        "node.js",
        "nodejs",
        "python",
        "java",
        "c",
        "c++",
        "c#",
        ".net",
        "dotnet",
        "php",
        "ruby",
        "go",
        "rust",
        "sql",
        "mysql",
        "postgresql",
        "postgres",
        "oracle",
        "mongodb",
        "redis",
        "html",
        "css",
        "tailwind",
        "bootstrap",
        "spring",
        "spring boot",
        "django",
        "flask",
        "aws",
        "azure",
        "gcp",
        "docker",
        "kubernetes",
        "terraform",
        "jenkins",
        "devops",
        "git",
        "github",
        "gitlab",
        "bitbucket",
        "linux",
        "windows",
        "power bi",
        "tableau",
        "excel",
        "pandas",
        "numpy",
        "machine learning",
        "deep learning",
        "tensorflow",
        "pytorch",
        "selenium",
        "testng",
        "jmeter",
        "servicenow",
        "salesforce",
        "sap",
        "recruitment",
        "talent acquisition",
        "hr",
        "human resources",
        "communication",
        "project management",
        "business analysis",
        "data analysis",
        "cybersecurity",
        "networking",
        "active directory"
    ];

    const foundSkills = commonSkills.filter(skill =>
        jobText.includes(atsNormalize(skill))
    );

    explicitSkills
        .split(/[,;|\n]+/)
        .forEach(part => {

            const normalized = atsNormalize(part);

            if (
                normalized &&
                normalized.length >= 2 &&
                normalized.length <= 80
            ) {
                foundSkills.push(normalized);
            }

        });

    return atsUnique(foundSkills);
}

function atsJobTitle(job) {

    return atsNormalize(
        job.jobtitle ||
        job.job_title ||
        job.title ||
        ""
    );

}

function atsCandidateTitle(candidate) {

    return atsNormalize(
        candidate.currentRole ||
        candidate.current_role ||
        candidate.jobTitle ||
        candidate.job_title ||
        candidate.designation ||
        candidate.role ||
        candidate.headline ||
        ""
    );

}

function atsExtractYears(value) {

    const text = atsToText(value).toLowerCase();

    const matches = [];

    const regex =
        /(\d+(?:\.\d+)?)\s*(?:\+|plus)?\s*(?:years?|yrs?)/g;

    let match;

    while ((match = regex.exec(text))) {

        matches.push(
            Number(match[1])
        );

    }

    return matches.length
        ? Math.max(...matches)
        : null;

}

function atsCandidateYears(candidate) {

    const directFields = [
        candidate.experienceYears,
        candidate.experience_years,
        candidate.yearsExperience,
        candidate.years_experience
    ];

    for (const value of directFields) {

        const number = Number(value);

        if (
            Number.isFinite(number) &&
            number >= 0
        ) {
            return number;
        }

    }

    return atsExtractYears(
        candidate.experience ||
        candidate.totalExperience ||
        candidate.total_experience ||
        candidate.resumeText ||
        candidate.resume_text ||
        candidate.summary ||
        ""
    );

}

function atsRequiredYears(job) {

    const directFields = [
        job.experienceYears,
        job.experience_years,
        job.minExperience,
        job.min_experience
    ];

    for (const value of directFields) {

        const number = Number(value);

        if (
            Number.isFinite(number) &&
            number >= 0
        ) {
            return number;
        }

    }

    return atsExtractYears(
        job.experience ||
        job.description ||
        job.requirements ||
        ""
    );

}

function atsTokenSet(text) {

    return new Set(
        atsNormalize(text)
            .split(/\s+/)
            .map(token => token.trim())
            .filter(token => token.length >= 3)
    );

}

function atsCalculateMatchScore(candidate, job) {

    if (!candidate || !job) {
        return null;
    }

    const candidateSkills =
        atsExtractSkills(candidate);

    const jobSkills =
        atsJobSkills(job);

    const candidateText =
        atsNormalize([
            candidate.fullname,
            candidate.name,
            candidate.headline,
            candidate.currentRole,
            candidate.current_role,
            candidate.jobTitle,
            candidate.job_title,
            candidate.designation,
            candidate.role,
            candidate.about,
            candidate.bio,
            candidate.summary,
            candidate.experience,
            candidate.skills,
            candidate.resumeText,
            candidate.resume_text,
            candidate.coverLetter,
            candidate.cover_letter
        ]
            .map(atsToText)
            .join(" "));

    const jobText =
        atsNormalize([
            job.jobtitle,
            job.job_title,
            job.title,
            job.description,
            job.requirements,
            job.requiredSkills,
            job.required_skills,
            job.skills,
            job.skillSet,
            job.skill_set,
            job.experience
        ]
            .map(atsToText)
            .join(" "));

    // ======================================================
    // SKILLS = 50 POINTS
    // ======================================================

    let skillScore = 0;

    if (jobSkills.length) {

        const matchedSkills =
            jobSkills.filter(skill => {

                return (
                    candidateSkills.includes(skill) ||
                    candidateText.includes(skill)
                );

            });

        skillScore =
            (matchedSkills.length /
                jobSkills.length) * 50;

    } else {

        const jobTokens =
            atsTokenSet(jobText);

        const candidateTokens =
            atsTokenSet(candidateText);

        const stopWords = new Set([
            "the",
            "and",
            "with",
            "for",
            "from",
            "that",
            "this",
            "your",
            "will",
            "have",
            "years",
            "year",
            "experience",
            "work",
            "working",
            "team",
            "role",
            "job",
            "required",
            "requirements",
            "candidate",
            "skills",
            "strong",
            "good"
        ]);

        const meaningfulJobTokens =
            [...jobTokens]
                .filter(token =>
                    !stopWords.has(token)
                );

        const matchedTokens =
            meaningfulJobTokens.filter(token =>
                candidateTokens.has(token)
            );

        skillScore =
            meaningfulJobTokens.length
                ? Math.min(
                    50,
                    (matchedTokens.length /
                        meaningfulJobTokens.length) * 50
                )
                : 0;

    }

    // ======================================================
    // JOB TITLE = 20 POINTS
    // ======================================================

    const jobTitle =
        atsJobTitle(job);

    const candidateTitle =
        atsCandidateTitle(candidate);

    let titleScore = 0;

    if (jobTitle) {

        const jobTitleTokens =
            [...atsTokenSet(jobTitle)];

        const candidateTitleTokens =
            atsTokenSet(
                candidateTitle ||
                candidateText
            );

        const matchedTitleTokens =
            jobTitleTokens.filter(token =>
                candidateTitleTokens.has(token)
            );

        if (matchedTitleTokens.length) {

            titleScore =
                Math.min(
                    20,
                    (matchedTitleTokens.length /
                        Math.max(
                            1,
                            jobTitleTokens.length
                        )) * 20
                );

        }

        if (candidateText.includes(jobTitle)) {
            titleScore = 20;
        }

    }

    // ======================================================
    // EXPERIENCE = 20 POINTS
    // ======================================================

    const requiredYears =
        atsRequiredYears(job);

    const candidateYears =
        atsCandidateYears(candidate);

    let experienceScore = 10;

    if (
        requiredYears !== null &&
        candidateYears !== null
    ) {

        if (requiredYears <= 0) {

            experienceScore = 20;

        } else if (candidateYears >= requiredYears) {

            experienceScore = 20;

        } else {

            experienceScore =
                Math.max(
                    0,
                    (candidateYears /
                        requiredYears) * 20
                );

        }

    } else if (candidateYears !== null) {

        experienceScore = 15;

    }

    // ======================================================
    // DESCRIPTION = 10 POINTS
    // ======================================================

    const jobTokens =
        [...atsTokenSet(jobText)];

    const candidateTokens =
        atsTokenSet(candidateText);

    const stopWords = new Set([
        "the",
        "and",
        "with",
        "for",
        "from",
        "that",
        "this",
        "your",
        "will",
        "have",
        "years",
        "year",
        "experience",
        "work",
        "working",
        "team",
        "role",
        "job",
        "required",
        "requirements",
        "candidate",
        "skills",
        "strong",
        "good",
        "responsibilities",
        "position",
        "company",
        "location",
        "salary"
    ]);

    const meaningfulJobTokens =
        jobTokens.filter(token =>
            !stopWords.has(token)
        );

    const relevantMatches =
        meaningfulJobTokens.filter(token =>
            candidateTokens.has(token)
        );

    const descriptionScore =
        meaningfulJobTokens.length
            ? Math.min(
                10,
                (relevantMatches.length /
                    Math.min(
                        meaningfulJobTokens.length,
                        30
                    )) * 10
            )
            : 0;

    // ======================================================
    // FINAL SCORE
    // ======================================================

    const score = Math.max(
        0,
        Math.min(
            100,
            Math.round(
                skillScore +
                titleScore +
                experienceScore +
                descriptionScore
            )
        )
    );

    const hasCandidateData =
        candidateSkills.length ||
        candidateText.length > 20 ||
        candidateYears !== null;

    const hasJobData =
        jobTitle ||
        jobText.length > 20 ||
        jobSkills.length;

    if (!hasCandidateData || !hasJobData) {
        return null;
    }

    return score;

}

function atsExistingScore(application) {

    for (const column of ATS_SCORE_COLUMNS) {

        const raw =
            application?.[column];

        const number =
            Number(raw);

        if (
            raw !== null &&
            raw !== undefined &&
            raw !== "" &&
            Number.isFinite(number) &&
            number >= 0
        ) {

            return Math.min(
                100,
                Math.round(number)
            );

        }

    }

    return null;

}

async function analyzeMissingApplicationScores() {

    try {

        const [
            appsResult,
            jobsResult,
            candidatesResult
        ] = await Promise.all([

            supabase
                .from("jobApplications")
                .select("*"),

            supabase
                .from("jobs")
                .select("*"),

            supabase
                .from("candidates")
                .select("*")

        ]);

        if (appsResult.error) {
            throw appsResult.error;
        }

        if (jobsResult.error) {
            throw jobsResult.error;
        }

        const apps =
            appsResult.data || [];

        const jobs =
            jobsResult.data || [];

        const profiles =
            candidatesResult?.data || [];

        const jobMap =
            new Map();

        jobs.forEach(job => {

            jobMap.set(
                String(job.id),
                job
            );

        });

        const profileMap =
            new Map();

        profiles.forEach(profile => {

            const email =
                String(
                    profile.email || ""
                )
                    .trim()
                    .toLowerCase();

            if (email) {

                profileMap.set(
                    email,
                    profile
                );

            }

        });

        let analyzed = 0;

        for (const application of apps) {

            if (
                atsExistingScore(application) !== null
            ) {
                continue;
            }

            const jobId =
                String(
                    application.jobId ??
                    application.job_id ??
                    application.jobID ??
                    ""
                ).trim();

            let job =
                jobMap.get(jobId);

            if (!job) {

                const applicationTitle =
                    atsNormalize(
                        application.jobTitle ||
                        application.job_title ||
                        application.title ||
                        ""
                    );

                if (applicationTitle) {

                    job = jobs.find(j =>
                        atsNormalize(
                            j.jobtitle ||
                            j.job_title ||
                            j.title ||
                            ""
                        ) === applicationTitle
                    );

                }

            }

            if (!job) {
                continue;
            }

            const email =
                String(
                    application.email || ""
                )
                    .trim()
                    .toLowerCase();

            const profile =
                profileMap.get(email) || {};

            const candidate = {

                ...profile,
                ...application,

                skills:
                    profile.skills ||
                    application.skills ||
                    application.skillSet ||
                    "",

                experience:
                    profile.experience ||
                    application.experience ||
                    "",

                resumeText:
                    profile.resumeText ||
                    profile.resume_text ||
                    application.resumeText ||
                    application.resume_text ||
                    "",

                currentRole:
                    profile.currentRole ||
                    profile.current_role ||
                    application.currentRole ||
                    application.current_role ||
                    application.jobTitle ||
                    ""

            };

            const score =
                atsCalculateMatchScore(
                    candidate,
                    job
                );

            if (score === null) {
                continue;
            }

            const { error } =
                await supabase
                    .from("jobApplications")
                    .update({
                        match_score: score
                    })
                    .eq("id", application.id);

            if (error) {

                console.warn(
                    "Could not save ATS score:",
                    application.id,
                    error
                );

                continue;

            }

            analyzed++;

            console.log(
                `✅ ATS score saved: ${score}%`,
                application.fullname ||
                application.name ||
                application.email
            );

        }

        if (analyzed > 0) {

            console.log(
                `✅ ATS analyzed ${analyzed} application(s).`
            );

            if (
                typeof window.loadInboundApplications ===
                "function"
            ) {

                await window.loadInboundApplications();

            }

        }

    } catch (error) {

        console.error(
            "ATS match-score analysis error:",
            error
        );

    }

}

window.analyzeApplicationMatchScores =
    analyzeMissingApplicationScores;

window.calculateATSMatchScore =
    atsCalculateMatchScore;

document.addEventListener(
    "DOMContentLoaded",
    () => {

        setTimeout(
            () => {
                analyzeMissingApplicationScores();
            },
            1200
        );

        setInterval(
            () => {
                analyzeMissingApplicationScores();
            },
            5 * 60 * 1000
        );

    }
);

console.log(
    "✅ ATS Match Score Engine Loaded"
);
