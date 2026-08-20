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

window.runGeminiAIDraft = function () {
    const promptInput = document.getElementById("aiPrompt");
    const aiResultEl = document.getElementById("aiResult");

    const titleInput = document.getElementById("jobTitle");
    const expInput = document.getElementById("experience");
    const compInput = document.getElementById("companyName");
    const locInput = document.getElementById("location");
    const salaryInput = document.getElementById("salary");
    const noticeInput = document.getElementById("maxNotice");

    const userPrompt = promptInput?.value?.trim() || "";
    const title = titleInput?.value?.trim() || "Professional";
    const exp = expInput?.value?.trim() || "2+ Years";
    const company = compInput?.value?.trim() || "Indupalli Services Pvt Ltd";
    const location = locInput?.value?.trim() || "Hyderabad, Telangana";
    const salary = salaryInput?.value?.trim() || "Competitive / Best in Industry";
    const notice = noticeInput?.value || "Immediate / Serving";

    if (aiResultEl) {
        aiResultEl.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Generating tailored Job Description...`;
    }

    setTimeout(() => {
        const titleLower = title.toLowerCase();
        let responsibilities = "";
        let skills = "";

        if (titleLower.includes("recruit") || titleLower.includes("hr") || titleLower.includes("talent") || titleLower.includes("staffing")) {
            responsibilities = `• End-to-End Recruitment: Manage the complete full-cycle recruitment process from sourcing and screening to offer negotiation and onboarding.
• Candidate Sourcing: Source active and passive candidates using job boards (Dice, LinkedIn Recruiter, Monster), networking, and internal databases.
• Screening & Assessment: Conduct initial HR screenings to evaluate candidate fit, technical baseline, communication skills, and salary expectations.
• Stakeholder Coordination: Partner closely with hiring managers to understand technical requirements, project needs, and team culture.
• Pipeline Management: Maintain accurate candidate records, compliance data, and pipeline tracking in the Applicant Tracking System (ATS).`;
            
            skills = `• Professional Experience: Minimum ${exp} of proven experience in IT/Non-IT recruitment, talent acquisition, or HR operations.
• Sourcing Expertise: Hands-on experience with modern sourcing tools, job portals, and complex Boolean search strings.
• Communication Skills: Exceptional verbal and written English communication and negotiation abilities.
• Market Knowledge: Strong understanding of hiring trends, compensation benchmarks, and employment/tax terms (e.g., W2, C2C, 1099).`;
        
        } else if (titleLower.includes("develop") || titleLower.includes("engineer") || titleLower.includes("program") || titleLower.includes("coder")) {
            responsibilities = `• Software Development: Design, develop, test, and deploy scalable, high-performance software solutions and architectures.
• Code Quality: Write clean, maintainable, and efficient code while adhering to best practices and coding standards.
• Agile Collaboration: Participate actively in daily stand-ups, sprint planning, and code review sessions with cross-functional teams.
• System Optimization: Identify performance bottlenecks, debug complex technical issues, and optimize application workflows.
• Technical Documentation: Maintain clear and comprehensive technical documentation for APIs, systems, and logic flows.`;
            
            skills = `• Professional Experience: Minimum ${exp} of hands-on software development, engineering, or architecture experience.
• Core Technologies: Proficiency in relevant programming languages, modern frameworks, and version control systems (e.g., Git).
• Problem Solving: Strong analytical mindset with a proven ability to troubleshoot and resolve complex logical issues.
• Team Collaboration: Excellent communication skills and the ability to thrive in cross-functional Agile environments.`;
        
        } else {
            responsibilities = `• Lifecycle & Execution: Lead and manage end-to-end deliverables aligned with organizational goals and client objectives.
• Cross-Functional Collaboration: Partner directly with internal teams and external stakeholders to ensure seamless project delivery.
• Strategy & Optimization: Identify operational bottlenecks and implement scalable, high-impact workflow solutions.
• Quality & Standards: Ensure all deliverables adhere to strict quality benchmarks, established standards, and compliance guidelines.
• Tracking & Reporting: Maintain transparent status updates, performance metrics, and structured reporting.`;
            
            skills = `• Professional Experience: Minimum ${exp} of proven, hands-on experience in ${title} or equivalent roles.
• Core Competencies: Strong functional and technical domain knowledge aligned with ${title} responsibilities.
• Communication Skills: Exceptional verbal and written English communication and stakeholder management abilities.
• Analytical Mindset: Strong problem-solving ability with a structured approach to working independently.`;
        }

        let customRequirements = "";
        if (userPrompt && !userPrompt.toLowerCase().startsWith("create a professional job description")) {
            customRequirements = `\n\nAdditional Role Guidelines:\n• ${userPrompt}`;
        }

        const generatedJD = `Role Overview:
${company} is looking for an experienced and results-driven ${title} to join our team in ${location}. The ideal candidate should have at least ${exp} of relevant domain experience and be able to deliver high-quality work in a collaborative, fast-paced environment.

Key Details:
• Position: ${title}
• Company: ${company}
• Location: ${location}
• Experience Required: ${exp}
• CTC / Salary: ${salary}
• Notice Period: ${notice}

Key Responsibilities:
${responsibilities}

Required Qualifications & Skills:
${skills}
• Educational Background: Bachelor's or Master's degree in a relevant discipline or equivalent practical experience.${customRequirements}`;

        if (aiResultEl) {
            aiResultEl.innerText = generatedJD;
        }

    }, 400);
};

window.insertAIResult = function () {
    const aiResultEl = document.getElementById("aiResult");

    // Mode-aware target: "blog" mode (set by window.generateBlogAI) targets the blog
    // content textarea; default/"job" mode keeps targeting the job description field.
    const mode = window.aiDraftMode || "job";
    const targetTextArea = document.getElementById(mode === "blog" ? "adminBlogContent" : "jobDescription");

    if (!aiResultEl || !targetTextArea) return;

    const content = aiResultEl.innerText.trim();

    if (!content || content.includes("Waiting for AI") || content.includes("Preparing AI") || content.includes("Generating") || content.includes("Enter a topic")) {
        if (typeof window.showCustomAlert === "function") {
            window.showCustomAlert("Please wait for the draft to generate before applying.", "Warning", "Info");
        }
        return;
    }

    targetTextArea.value = content;
    window.closeAI();

    if (typeof window.showCustomAlert === "function") {
        window.showCustomAlert(mode === "blog" ? "Applied draft to article!" : "Applied description to form!", "Success", "Success");
    }
};

window.closeAI = function () {
    const aiModal = document.getElementById("aiModal");
    if (aiModal) {
        aiModal.style.display = "none";
    }
    window.aiDraftMode = "job";
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
