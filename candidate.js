/* ============================================================
   INDUPALLI SERVICES ATS — Candidate Dashboard Module (Supabase)
   ============================================================ */

import { supabase } from "./supabase.js";

const APP_STATE = {
    allJobs: {},
    currentJobId: null,
    currentJobTitle: null,
    currentJobCompany: null,
    appliedJobIds: new Set()
};

// Supabase is the source of truth for candidate application state.
async function syncAppliedJobsFromServer() {
    const email = (localStorage.getItem("candidateLoggedInEmail") || "").trim().toLowerCase();
    APP_STATE.appliedJobIds = new Set();

    if (!email) {
        updateAppliedJobButtons();
        return;
    }

    try {
        const { data, error } = await supabase
            .from("jobApplications")
            .select("jobId, jobid, job_id")
            .ilike("email", email);

        if (error) throw error;

        (data || []).forEach(row => {
            const id = row.jobId ?? row.jobid ?? row.job_id;

            if (
                id !== null &&
                id !== undefined &&
                String(id).trim()
            ) {
                APP_STATE.appliedJobIds.add(String(id));
            }
        });

        localStorage.setItem(
            "appliedJobIds",
            JSON.stringify([...APP_STATE.appliedJobIds])
        );

        updateAppliedJobButtons();

        return [...APP_STATE.appliedJobIds];

    } catch (error) {
        console.warn(
            "Could not sync candidate application state:",
            error
        );

        // Never trust stale local state when the server cannot be checked.
        localStorage.setItem("appliedJobIds", "[]");
        updateAppliedJobButtons();

        return [];
    }
}

function getAppliedJobIds() {
    return APP_STATE.appliedJobIds instanceof Set
        ? APP_STATE.appliedJobIds
        : new Set(
            JSON.parse(
                localStorage.getItem("appliedJobIds") || "[]"
            ).map(String)
        );
}

function setApplicationButtonSubmitted(button) {
    if (!button) return;

    button.innerHTML =
        '<i class="fa-solid fa-check"></i> Submitted';

    button.disabled = true;
    button.style.background = "#94a3b8";
    button.style.color = "#fff";
    button.style.cursor = "not-allowed";
    button.style.boxShadow = "none";
}

function updateAppliedJobButtons() {
    const applied = getAppliedJobIds();

    document
        .querySelectorAll(".job-card[data-job-id]")
        .forEach(card => {
            const jobId =
                card.getAttribute("data-job-id");

            const btn =
                card.querySelector(
                    '.apply-btn[data-action="apply"], .apply-btn'
                );

            if (
                jobId &&
                applied.has(String(jobId))
            ) {
                setApplicationButtonSubmitted(btn);
            }
        });
}

window.syncAppliedJobsFromServer =
    syncAppliedJobsFromServer;

window.updateAppliedJobButtons =
    updateAppliedJobButtons;


// --- 1. UI HELPERS & POPUPS ---

function showCustomAlert(
    message,
    title = "Notice",
    isSuccess = false
) {
    const modal =
        document.getElementById("customAlertModal");

    if (!modal) return;

    document.getElementById(
        "alertTitle"
    ).innerText = title;

    document.getElementById(
        "alertMessage"
    ).innerText = message;

    const icon =
        document.querySelector(
            "#alertIconContainer i"
        );

    if (icon) {
        if (isSuccess) {
            icon.className =
                "fa-solid fa-circle-check";

            icon.style.color = "#16a34a";
        } else {
            icon.className =
                "fa-solid fa-circle-exclamation";

            icon.style.color = "#ef4444";
        }
    }

    modal.style.display = "flex";
}

window.showCustomAlert =
    showCustomAlert;


// Close only the custom alert popup immediately
function closeAlertOnly() {
    const alertModal =
        document.getElementById(
            "customAlertModal"
        );

    if (alertModal) {
        alertModal.style.display = "none";
    }
}


// Close large modals
function closeModals() {
    const applyModal =
        document.getElementById("applyModal");

    const subModal =
        document.getElementById(
            "premiumSubscriptionModal"
        );

    const detailsModal =
        document.getElementById(
            "jobDetailsModal"
        );

    if (applyModal) {
        applyModal.style.display = "none";
    }

    if (subModal) {
        subModal.style.display = "none";
    }

    if (detailsModal) {
        detailsModal.style.display = "none";
    }
}


// --- 2. BROWSE JOBS LOGIC ---

async function loadJobs() {
    const container =
        document.getElementById(
            "jobsContainer"
        );

    if (!container) return;

    try {

        container.innerHTML = `
            <div
                style="
                    grid-column: 1 / -1;
                    text-align:center;
                    padding:30px;
                "
            >
                <i class="fa-solid fa-spinner fa-spin"></i>
                Loading jobs...
            </div>
        `;

        const {
            data: jobs,
            error
        } = await supabase
            .from("jobs")
            .select("*");

        if (error) throw error;

        if (!jobs || jobs.length === 0) {

            container.innerHTML = `
                <div
                    style="
                        grid-column: 1 / -1;
                        text-align:center;
                        color:#94a3b8;
                        padding:30px 0;
                    "
                >
                    No active job openings available.
                </div>
            `;

            return;
        }

        let jobsHtml = "";
        let count = 0;

        jobs.forEach((job) => {

            // Safe archive check
            if (job.isarchived) return;

            APP_STATE.allJobs[job.id] =
                job;

            count++;

            const title =
                job.jobtitle || "Position";

            const company =
                job.companyname ||
                "Indupalli Services";

            const location =
                job.location || "Remote";

            const experience =
                job.experience || "1 Year";

            const salary =
                job.salary || "Standard";

            const description =
                (job.description || "")
                    .substring(0, 90) + "...";

            jobsHtml += `
                <div
                    class="job-card"
                    data-job-id="${job.id}"
                >
                    <h3
                        class="job-title"
                        data-action="details"
                        data-id="${job.id}"
                    >
                        ${title}
                    </h3>

                    <div class="job-company">
                        ${company}
                    </div>

                    <div class="job-info">
                        <span>
                            <i class="fa-solid fa-location-dot"></i>
                            ${location}
                        </span>

                        <span>
                            <i class="fa-solid fa-briefcase"></i>
                            ${experience}
                        </span>

                        <span>
                            <i class="fa-solid fa-indian-rupee-sign"></i>
                            ₹${salary}
                        </span>
                    </div>

                    <p class="job-description">
                        ${description}
                    </p>

                    <button
                        class="apply-btn"
                        data-action="apply"
                        data-id="${job.id}"
                    >
                        Apply Now
                    </button>
                </div>
            `;
        });

        container.innerHTML =
            jobsHtml ||
            `
            <div
                style="
                    grid-column: 1 / -1;
                    text-align:center;
                    color:#94a3b8;
                    padding:30px 0;
                "
            >
                No active job openings available.
            </div>
            `;

        window.allJobsData =
            APP_STATE.allJobs;

        if (
            document.getElementById(
                "kpiTotalJobs"
            )
        ) {
            document.getElementById(
                "kpiTotalJobs"
            ).innerText = count;
        }

        // IMPORTANT:
        // Reload submitted state from Supabase.
        await syncAppliedJobsFromServer();

    } catch (error) {

        console.error(
            "Error loading jobs:",
            error
        );

        container.innerHTML = `
            <div
                style="
                    grid-column: 1 / -1;
                    text-align:center;
                    color:#ef4444;
                "
            >
                Database connection failed.
            </div>
        `;
    }
}

window.loadJobs = loadJobs;


// Search Filter Logic
function handleJobSearch(e) {
    const searchTerm =
        e.target.value.toLowerCase();

    const jobCards =
        document.querySelectorAll(
            ".job-card"
        );

    jobCards.forEach(card => {

        const titleEl =
            card.querySelector(
                ".job-title"
            );

        const title =
            titleEl
                ? titleEl.innerText.toLowerCase()
                : "";

        if (title.includes(searchTerm)) {
            card.style.display = "flex";
        } else {
            card.style.display = "none";
        }
    });
}


// --- 3. APPLICATION SUBMISSION ---

async function handleApplicationSubmit() {

    const nameInput =
        document.getElementById(
            "applyName"
        );

    const emailInput =
        document.getElementById(
            "applyEmail"
        );

    const expInput =
        document.getElementById(
            "applyExperience"
        );

    const resumeInput =
        document.getElementById(
            "applyResume"
        );


    const nameVal =
        nameInput
            ? nameInput.value.trim()
            : "";

    const emailVal =
        emailInput
            ? emailInput.value.trim()
            : "";

    const expVal =
        expInput
            ? expInput.value.trim()
            : "";


    // VALIDATION
    if (!nameVal) {
        nameInput?.focus();

        return showCustomAlert(
            "Full Name is mandatory.",
            "Required Field",
            false
        );
    }

    if (
        !emailVal ||
        !emailVal.includes("@")
    ) {
        emailInput?.focus();

        return showCustomAlert(
            "Valid Email is mandatory.",
            "Required Field",
            false
        );
    }

    if (!expVal) {
        expInput?.focus();

        return showCustomAlert(
            "Experience is mandatory.",
            "Required Field",
            false
        );
    }

    if (
        (!resumeInput ||
            !resumeInput.files[0]) &&
        !window.candidateMasterResumeUrl
    ) {
        return showCustomAlert(
            "Please upload a resume to proceed.",
            "Resume Needed",
            false
        );
    }


    closeModals();

    document.body.style.cursor =
        "wait";


    try {

        let downloadUrl =
            window.candidateMasterResumeUrl ||
            "Upload Bypass";

        const file =
            resumeInput?.files[0];


        if (file) {

            try {

                const fileName =
                    `app_${Date.now()}_${file.name}`;

                const {
                    error: uploadErr
                } = await supabase.storage
                    .from("resumes")
                    .upload(
                        fileName,
                        file
                    );

                if (!uploadErr) {

                    const {
                        data: pubData
                    } = supabase.storage
                        .from("resumes")
                        .getPublicUrl(
                            fileName
                        );

                    downloadUrl =
                        pubData.publicUrl;
                }

            } catch (err) {

                console.warn(
                    "Storage warning:",
                    err
                );
            }
        }


        const normalizedEmail =
            emailVal.toLowerCase();

        const currentJobId =
            APP_STATE.currentJobId ?? null;


        // Final server-side duplicate check immediately before insert.
        if (currentJobId !== null) {

            const {
                data: existingApps,
                error:
                    duplicateCheckError
            } = await supabase
                .from("jobApplications")
                .select("id")
                .ilike(
                    "email",
                    normalizedEmail
                )
                .eq(
                    "jobId",
                    currentJobId
                )
                .limit(1);

            if (
                duplicateCheckError
            ) {
                throw duplicateCheckError;
            }

            if (
                existingApps &&
                existingApps.length > 0
            ) {

                APP_STATE.appliedJobIds.add(
                    String(currentJobId)
                );

                localStorage.setItem(
                    "appliedJobIds",
                    JSON.stringify(
                        [
                            ...APP_STATE.appliedJobIds
                        ]
                    )
                );

                updateAppliedJobButtons();

                await loadApplications();

                showCustomAlert(
                    "You have already submitted an application for this position.",
                    "Already Submitted",
                    true
                );

                return;
            }
        }


        // Supabase Insert
        const {
            error: insertErr
        } = await supabase
            .from("jobApplications")
            .insert([
                {
                    jobId:
                        currentJobId,

                    jobTitle:
                        APP_STATE.currentJobTitle ||
                        "Job Role",

                    companyName:
                        APP_STATE.currentJobCompany ||
                        "Indupalli Services",

                    fullname:
                        nameVal,

                    email:
                        normalizedEmail,

                    experience:
                        expVal,

                    resumeUrl:
                        downloadUrl,

                    status:
                        "New Application"
                }
            ]);


        if (insertErr) {
            throw insertErr;
        }


        // Recruiter Notification
        try {

            await supabase
                .from("notifications")
                .insert([
                    {
                        candidateName:
                            nameVal,

                        jobTitle:
                            APP_STATE.currentJobTitle ||
                            "Job Role",

                        message:
                            `${nameVal} has applied to ${
                                APP_STATE.currentJobTitle ||
                                "Job Role"
                            }`,

                        isRead:
                            false
                    }
                ]);

        } catch (
            notificationError
        ) {

            console.warn(
                "Notification insert failed:",
                notificationError
            );
        }


        // Update local Submitted state immediately.
        if (
            currentJobId !== null
        ) {

            APP_STATE.appliedJobIds.add(
                String(currentJobId)
            );

            localStorage.setItem(
                "appliedJobIds",
                JSON.stringify(
                    [
                        ...APP_STATE.appliedJobIds
                    ]
                )
            );

            updateAppliedJobButtons();
        }


        // Increment free applications count.
        const freeCount =
            parseInt(
                localStorage.getItem(
                    "freeApplicationsCount"
                ) || "0"
            );

        localStorage.setItem(
            "freeApplicationsCount",
            (
                freeCount + 1
            ).toString()
        );


        // Re-sync from server.
        await syncAppliedJobsFromServer();


        showCustomAlert(
            "Your application was submitted successfully!",
            "Submitted",
            true
        );


        // Refresh My Applications.
        await loadApplications();


    } catch (error) {

        console.error(
            "Submit Error:",
            error
        );

        showCustomAlert(
            "Database error occurred: " +
            error.message,
            "Failed",
            false
        );

    } finally {

        document.body.style.cursor =
            "default";
    }
}


// --- 4. REFRESH GRIDS ---

async function loadApplications() {

    if (
        typeof window.triggerRefreshApplications ===
        "function"
    ) {
        return window.triggerRefreshApplications();
    }


    const email =
        localStorage.getItem(
            "candidateLoggedInEmail"
        );

    const table =
        document.getElementById(
            "applicationsTable"
        );


    if (!email || !table) return;


    try {

        const {
            data: apps,
            error
        } = await supabase
            .from("jobApplications")
            .select("*")
            .eq("email", email)
            .order(
                "id",
                {
                    ascending: false
                }
            );


        if (error) throw error;


        // Keep Submitted job IDs synchronized.
        APP_STATE.appliedJobIds =
            new Set();


        (apps || []).forEach(data => {

            const id =
                data.jobId ??
                data.jobid ??
                data.job_id;

            if (
                id !== null &&
                id !== undefined &&
                String(id).trim()
            ) {
                APP_STATE.appliedJobIds.add(
                    String(id)
                );
            }
        });


        localStorage.setItem(
            "appliedJobIds",
            JSON.stringify(
                [
                    ...APP_STATE.appliedJobIds
                ]
            )
        );


        updateAppliedJobButtons();


        if (
            !apps ||
            apps.length === 0
        ) {

            table.innerHTML = `
                <tr>
                    <td
                        colspan="5"
                        style="
                            text-align:center;
                            padding:40px;
                            color:#888;
                        "
                    >
                        No job applications submitted yet.
                    </td>
                </tr>
            `;

            const total =
                document.getElementById(
                    "totalApplications"
                );

            if (total) {
                total.innerText = "0";
            }

            return;
        }


        let html = "";


        apps.forEach(data => {

            const created =
                data.created_at ||
                data.createdAt ||
                data.createdat;

            const dateStr =
                created
                    ? new Date(
                          created
                      ).toLocaleDateString()
                    : "Just now";


            const title =
                data.jobTitle ||
                data.jobtitle ||
                "Role";


            const company =
                data.companyName ||
                data.companyname ||
                "Indupalli Services";


            // Candidate-facing status.
            // Recruiter/backend status remains New Application.
            const candidateStatus =
                (
                    data.status ||
                    "New Application"
                ) === "New Application"
                    ? "Submitted"
                    : (
                        data.status ||
                        "Submitted"
                    );


            html += `
                <tr>
                    <td>
                        <strong>
                            ${title}
                        </strong>
                    </td>

                    <td>
                        ${company}
                    </td>

                    <td>
                        <span class="status new">
                            ${candidateStatus}
                        </span>
                    </td>

                    <td>
                        ${dateStr}
                    </td>

                    <td>
                        <button
                            class="chat-btn"
                            onclick="
                                window.initializeChatRoom &&
                                window.initializeChatRoom(
                                    '${data.id}',
                                    'Recruiter',
                                    'candidate'
                                )
                            "
                        >
                            Chat
                        </button>
                    </td>
                </tr>
            `;
        });


        table.innerHTML =
            html;


        if (
            document.getElementById(
                "totalApplications"
            )
        ) {
            document.getElementById(
                "totalApplications"
            ).innerText =
                apps.length;
        }


    } catch (e) {

        console.error(
            "Error loading applications:",
            e
        );
    }
}


window.loadApplications =
    loadApplications;


async function loadPayments() {

    if (
        typeof window.triggerRefreshSubscriptions ===
        "function"
    ) {
        return window.triggerRefreshSubscriptions();
    }


    const email =
        localStorage.getItem(
            "candidateLoggedInEmail"
        );

    const table =
        document.getElementById(
            "subscriptionsTable"
        );


    if (!email || !table) return;


    try {

        const {
            data: subs,
            error
        } = await supabase
            .from("subscriptions")
            .select("*")
            .eq(
                "email",
                email
            );


        if (error) throw error;


        if (
            !subs ||
            subs.length === 0
        ) {

            table.innerHTML = `
                <tr>
                    <td
                        colspan="5"
                        style="
                            text-align:center;
                            padding:40px;
                            color:#888;
                        "
                    >
                        No payment history.
                    </td>
                </tr>
            `;

            return;
        }


        let html = "";


        subs.forEach(data => {

            const created =
                data.createdAt ||
                data.created_at ||
                data.createdat;

            const dateStr =
                created
                    ? new Date(
                          created
                      ).toLocaleDateString()
                    : "Just now";


            const paymentId =
                data.paymentId ||
                data.paymentid ||
                "N/A";


            const planName =
                data.planName ||
                data.planname ||
                "Plan";


            html += `
                <tr>
                    <td>
                        <code>
                            ${paymentId}
                        </code>
                    </td>

                    <td>
                        <strong>
                            ${planName}
                        </strong>
                    </td>

                    <td>
                        ₹${data.amount || 0}
                    </td>

                    <td>
                        ${dateStr}
                    </td>

                    <td>
                        <span class="status paid">
                            SUCCESS
                        </span>
                    </td>
                </tr>
            `;
        });


        table.innerHTML =
            html;


    } catch (e) {

        console.error(
            "Error loading payments:",
            e
        );
    }
}


// --- 5. RAZORPAY PAYMENT TRIGGER ---

window.initiateRazorpayPayment =
    function(amount, planName) {

        if (!window.Razorpay) {
            return showCustomAlert(
                "Payment system offline.",
                "Error",
                false
            );
        }

        const options = {

            key:
                "rzp_live_TJLwJjiDyneRpb",

            amount:
                amount * 100,

            currency:
                "INR",

            name:
                "Indupalli Services",

            description:
                planName,

            handler:
                async function(res) {

                    localStorage.setItem(
                        "isPremiumCandidate",
                        "true"
                    );

                    // FIX: Dynamically read the logged-in user's email from localStorage
                    const emailVal =
                        localStorage.getItem(
                            "candidateLoggedInEmail"
                        ) ||
                        localStorage.getItem(
                            "userEmail"
                        ) ||
                        "";

                    try {

                        await supabase
                            .from("subscriptions")
                            .insert([
                                {
                                    paymentId:
                                        res.razorpay_payment_id,

                                    planName:
                                        planName,

                                    amount:
                                        amount,

                                    email:
                                        emailVal,

                                    status:
                                        "SUCCESS"
                                }
                            ]);

                        loadPayments();

                    } catch (e) {

                        console.error(
                            e
                        );
                    }

                    closeModals();

                    showCustomAlert(
                        "Subscription Activated Successfully!",
                        "Success",
                        true
                    );
                }
        };

        new Razorpay(
            options
        ).open();
    };


// --- 6. EVENT DELEGATION & PAGE LOAD ---

document.addEventListener(
    "DOMContentLoaded",
    async () => {

        // Auth Session Sync
        const {
            data: { session }
        } =
            await supabase.auth.getSession();


        if (session?.user) {

            const email =
                session.user.email;


            localStorage.setItem(
                "candidateLoggedInEmail",
                email
            );


            if (
                document.getElementById(
                    "candidateEmail"
                )
            ) {
                document.getElementById(
                    "candidateEmail"
                ).textContent =
                    email;
            }


            if (
                document.getElementById(
                    "candidateEmailAddress"
                )
            ) {
                document.getElementById(
                    "candidateEmailAddress"
                ).value =
                    email;
            }
        }


        // Bind Alert Close
        document
            .getElementById(
                "closeAlertBtn"
            )
            ?.addEventListener(
                "click",
                closeAlertOnly
            );


        // Bind Modals
        document
            .getElementById(
                "closeApplyCrossBtn"
            )
            ?.addEventListener(
                "click",
                closeModals
            );


        document
            .getElementById(
                "closeApplyModalBtn"
            )
            ?.addEventListener(
                "click",
                closeModals
            );


        document
            .getElementById(
                "closeSubModalBtn"
            )
            ?.addEventListener(
                "click",
                closeModals
            );


        document
            .getElementById(
                "closeJobDetailsBtn"
            )
            ?.addEventListener(
                "click",
                closeModals
            );


        document
            .getElementById(
                "closeJobDetailsCrossBtn"
            )
            ?.addEventListener(
                "click",
                closeModals
            );


        // Main action buttons
        document
            .getElementById(
                "submitAppBtn"
            )
            ?.addEventListener(
                "click",
                handleApplicationSubmit
            );


        document
            .getElementById(
                "refreshJobsBtn"
            )
            ?.addEventListener(
                "click",
                loadJobs
            );


        document
            .getElementById(
                "refreshAppsBtn"
            )
            ?.addEventListener(
                "click",
                loadApplications
            );


        document
            .getElementById(
                "refreshSubsBtn"
            )
            ?.addEventListener(
                "click",
                loadPayments
            );


        // Search Bar
        document
            .getElementById(
                "jobSearchInput"
            )
            ?.addEventListener(
                "input",
                handleJobSearch
            );


        // Dynamic Job Grid
        document
            .getElementById(
                "jobsContainer"
            )
            ?.addEventListener(
                "click",
                (e) => {

                    const target =
                        e.target.closest(
                            "[data-action]"
                        );

                    if (!target) return;


                    // APPLY
                    if (
                        target.dataset.action ===
                        "apply"
                    ) {

                        const isPremium =
                            localStorage.getItem(
                                "isPremiumCandidate"
                            ) === "true";


                        const freeCount =
                            parseInt(
                                localStorage.getItem(
                                    "freeApplicationsCount"
                                ) || "0"
                            );


                        if (
                            !isPremium &&
                            freeCount >= 3
                        ) {

                            closeModals();

                            const premiumModal =
                                document.getElementById(
                                    "premiumSubscriptionModal"
                                );

                            if (premiumModal) {
                                premiumModal.style.display =
                                    "flex";
                            }

                            return showCustomAlert(
                                "You have reached your 3 free application limit. Please select a plan.",
                                "Trial Ended",
                                false
                            );
                        }


                        const id =
                            target.dataset.id;


                        // Already submitted
                        if (
                            getAppliedJobIds().has(
                                String(id)
                            )
                        ) {

                            setApplicationButtonSubmitted(
                                target
                            );

                            return showCustomAlert(
                                "You have already submitted an application for this position.",
                                "Already Submitted",
                                true
                            );
                        }


                        const job =
                            APP_STATE.allJobs[id];


                        if (job) {

                            APP_STATE.currentJobId =
                                job.id;

                            APP_STATE.currentJobTitle =
                                job.jobtitle ||
                                "Position";

                            APP_STATE.currentJobCompany =
                                job.companyname ||
                                "Indupalli Services";


                            document.getElementById(
                                "applyModal"
                            ).style.display =
                                "flex";
                        }
                    }


                    // DETAILS
                    if (
                        target.dataset.action ===
                        "details"
                    ) {

                        const id =
                            target.dataset.id;


                        const job =
                            APP_STATE.allJobs[id];


                        if (job) {

                            const title =
                                job.jobtitle ||
                                "Position";

                            const company =
                                job.companyname ||
                                "Indupalli Services";


                            document.getElementById(
                                "modalJobTitle"
                            ).innerText =
                                title;


                            document.getElementById(
                                "modalJobCompany"
                            ).innerText =
                                company;


                            document.getElementById(
                                "modalJobDescription"
                            ).innerText =
                                job.description ||
                                "No description provided.";


                            document.getElementById(
                                "modalApplyBtn"
                            ).onclick = () => {

                                if (
                                    getAppliedJobIds().has(
                                        String(job.id)
                                    )
                                ) {

                                    return showCustomAlert(
                                        "You have already submitted an application for this position.",
                                        "Already Submitted",
                                        true
                                    );
                                }


                                const isPremium =
                                    localStorage.getItem(
                                        "isPremiumCandidate"
                                    ) === "true";


                                const freeCount =
                                    parseInt(
                                        localStorage.getItem(
                                            "freeApplicationsCount"
                                        ) || "0"
                                    );


                                if (
                                    !isPremium &&
                                    freeCount >= 3
                                ) {

                                    closeModals();

                                    document.getElementById(
                                        "premiumSubscriptionModal"
                                    ).style.display =
                                        "flex";

                                    return showCustomAlert(
                                        "You have reached your 3 free application limit. Please select a plan.",
                                        "Trial Ended",
                                        false
                                    );
                                }


                                closeModals();


                                APP_STATE.currentJobId =
                                    job.id;

                                APP_STATE.currentJobTitle =
                                    title;

                                APP_STATE.currentJobCompany =
                                    company;


                                document.getElementById(
                                    "applyModal"
                                ).style.display =
                                    "flex";
                            };


                            document.getElementById(
                                "jobDetailsModal"
                            ).style.display =
                                "flex";
                        }
                    }
                }
            );


        // Load initial data.
        await loadJobs();

        await syncAppliedJobsFromServer();

        await loadApplications();

        await loadPayments();
    }
);