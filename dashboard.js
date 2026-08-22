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

// ----------------------------------------------------------
// Extract candidate skills
// ----------------------------------------------------------

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

    // Common technical skills
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

// ----------------------------------------------------------
// Extract job skills
// ----------------------------------------------------------

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

// ----------------------------------------------------------
// Job title
// ----------------------------------------------------------

function atsJobTitle(job) {

    return atsNormalize(
        job.jobtitle ||
        job.job_title ||
        job.title ||
        ""
    );

}

// ----------------------------------------------------------
// Candidate title
// ----------------------------------------------------------

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

// ----------------------------------------------------------
// Extract years of experience
// ----------------------------------------------------------

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

// ----------------------------------------------------------
// Tokenization
// ----------------------------------------------------------

function atsTokenSet(text) {

    return new Set(
        atsNormalize(text)
            .split(/\s+/)
            .map(token => token.trim())
            .filter(token => token.length >= 3)
    );

}

// ----------------------------------------------------------
// Calculate ATS score
// ----------------------------------------------------------

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
    // 1. SKILLS = 50 POINTS
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
    // 2. JOB TITLE = 20 POINTS
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
    // 3. EXPERIENCE = 20 POINTS
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
    // 4. JOB DESCRIPTION RELEVANCE = 10 POINTS
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

// ----------------------------------------------------------
// Check whether score already exists
// ----------------------------------------------------------

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

// ----------------------------------------------------------
// Analyze applications
// ----------------------------------------------------------

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

        // --------------------------------------------------
        // Job map
        // --------------------------------------------------

        const jobMap =
            new Map();

        jobs.forEach(job => {

            jobMap.set(
                String(job.id),
                job
            );

        });

        // --------------------------------------------------
        // Candidate profile map
        // --------------------------------------------------

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

        // --------------------------------------------------
        // Process applications
        // --------------------------------------------------

        for (const application of apps) {

            // Do not overwrite existing scores.
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

            // Older applications may only have job title.
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

            // Merge latest candidate profile
            // with application data.
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

            // Save score to Supabase.
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

        }

        if (analyzed > 0) {

            console.log(
                `✅ ATS analyzed ${analyzed} application(s).`
            );

        }

        // Refresh dashboard after scoring.
        if (
            analyzed > 0 &&
            typeof window.loadInboundApplications === "function"
        ) {

            await window.loadInboundApplications();

        }

    } catch (error) {

        console.error(
            "ATS match-score analysis error:",
            error
        );

    }

}

// Make functions available globally.
window.analyzeApplicationMatchScores =
    analyzeMissingApplicationScores;

window.calculateATSMatchScore =
    atsCalculateMatchScore;


// ==========================================================
// AUTOMATIC ANALYSIS
// ==========================================================

document.addEventListener(
    "DOMContentLoaded",
    () => {

        // First analysis shortly after dashboard loads.
        setTimeout(
            () => {
                analyzeMissingApplicationScores();
            },
            1200
        );

        // Check for new applications every 5 minutes.
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
