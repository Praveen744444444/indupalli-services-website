// Supabase Edge Function: score-resume
// Set the Gemini API key as a Supabase secret:
//   supabase secrets set GEMINI_API_KEY=YOUR_KEY
// Deploy:
//   supabase functions deploy score-resume

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json"
};

type ScoreResponse = {
  overallScore: number;
  label: string;
  confidence: string;
  skillsMatch: number;
  experienceMatch: number;
  responsibilitiesMatch: number;
  educationCertificationsMatch: number;
  resumeQuality: number;
  matchedSkills: string[];
  missingOrWeakSkills: string[];
  strengths: string[];
  gaps: string[];
  summary: string;
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: corsHeaders
  });
}

function clampScore(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function normalizeResult(value: any): ScoreResponse {
  const skills = clampScore(value?.skillsMatch);
  const experience = clampScore(value?.experienceMatch);
  const responsibilities = clampScore(value?.responsibilitiesMatch);
  const education = clampScore(value?.educationCertificationsMatch);
  const quality = clampScore(value?.resumeQuality);

  // Fixed weighting keeps the score explainable and consistent.
  const weighted = Math.round(
    skills * 0.40 +
    experience * 0.25 +
    responsibilities * 0.15 +
    education * 0.10 +
    quality * 0.10
  );

  const overall = clampScore(value?.overallScore ?? weighted);

  let label = String(value?.label || "").trim();
  if (!label) {
    if (overall >= 90) label = "Excellent Match";
    else if (overall >= 80) label = "Strong Match";
    else if (overall >= 70) label = "Good Match";
    else if (overall >= 55) label = "Partial Match";
    else label = "Low Match";
  }

  return {
    overallScore: overall,
    label,
    confidence: String(value?.confidence || "Medium"),
    skillsMatch: skills,
    experienceMatch: experience,
    responsibilitiesMatch: responsibilities,
    educationCertificationsMatch: education,
    resumeQuality: quality,
    matchedSkills: Array.isArray(value?.matchedSkills) ? value.matchedSkills.slice(0, 12).map(String) : [],
    missingOrWeakSkills: Array.isArray(value?.missingOrWeakSkills) ? value.missingOrWeakSkills.slice(0, 12).map(String) : [],
    strengths: Array.isArray(value?.strengths) ? value.strengths.slice(0, 8).map(String) : [],
    gaps: Array.isArray(value?.gaps) ? value.gaps.slice(0, 8).map(String) : [],
    summary: String(value?.summary || "The resume was compared with the supplied job description.").slice(0, 1200)
  };
}

function parseJson(text: string): any {
  const clean = text.trim().replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/i, "");
  try {
    return JSON.parse(clean);
  } catch {
    const start = clean.indexOf("{");
    const end = clean.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(clean.slice(start, end + 1));
    throw new Error("Gemini returned invalid JSON.");
  }
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, Math.min(i + chunk, bytes.length)));
  }
  return btoa(binary);
}

function guessMimeType(url: string, responseType: string | null): string {
  if (responseType && responseType !== "application/octet-stream") return responseType.split(";")[0].trim();
  const path = url.split("?")[0].toLowerCase();
  if (path.endsWith(".pdf")) return "application/pdf";
  if (path.endsWith(".docx")) return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (path.endsWith(".doc")) return "application/msword";
  if (path.endsWith(".txt")) return "text/plain";
  return "application/pdf";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed." }, 405);

  const geminiApiKey = Deno.env.get("GEMINI_API_KEY");
  if (!geminiApiKey) return json({ error: "GEMINI_API_KEY is not configured on the server." }, 500);

  try {
    const body = await req.json();
    const resumeUrl = String(body?.resumeUrl || "").trim();
    const job = body?.job || {};
    const candidateProfile = body?.candidateProfile || {};

    if (!resumeUrl || !/^https?:\/\//i.test(resumeUrl)) {
      return json({ error: "A valid resume URL is required." }, 400);
    }
    if (!String(job?.description || "").trim()) {
      return json({ error: "The job description is required for scoring." }, 400);
    }

    const resumeResponse = await fetch(resumeUrl, { redirect: "follow" });
    if (!resumeResponse.ok) {
      return json({ error: `Could not read the resume file (HTTP ${resumeResponse.status}).` }, 400);
    }

    const mimeType = guessMimeType(resumeUrl, resumeResponse.headers.get("content-type"));
    if (!mimeType.includes("pdf") && !mimeType.startsWith("text/")) {
      return json({
        error: "AI scoring currently requires a PDF or text-based resume. Please upload the resume as PDF for scoring."
      }, 415);
    }

    const bytes = new Uint8Array(await resumeResponse.arrayBuffer());
    if (bytes.length > 12 * 1024 * 1024) {
      return json({ error: "Resume is too large for AI scoring. Keep it under 12 MB." }, 413);
    }

    const prompt = `
You are an ATS-style job match analyzer for a candidate-facing recruiting platform.
Compare the candidate resume against the job description and profile details below.

IMPORTANT RULES:
- Score only job-relevant qualifications: skills, relevant experience, responsibilities, education/certifications when explicitly required, and resume quality/completeness.
- Do NOT use or infer age, gender, race, ethnicity, religion, health/disability, marital status, nationality, or other protected/sensitive traits.
- Do not invent experience, skills, certifications, or missing requirements.
- A missing skill should only be marked missing/weak when it is relevant to the job requirements and is not supported by the supplied resume/profile.
- The score is advisory: it estimates alignment with THIS job, not hiring probability.
- Return ONLY valid JSON.

JOB
Title: ${String(job.title || "")}
Company: ${String(job.company || "")}
Location: ${String(job.location || "")}
Required Experience: ${String(job.experience || "")}
Job Description:
${String(job.description || "")}

CANDIDATE PROFILE
Experience: ${String(candidateProfile.experience || "")}
Skills: ${String(candidateProfile.skills || "")}
About: ${String(candidateProfile.about || "")}

Return this exact JSON structure:
{
  "overallScore": 0,
  "label": "Excellent Match | Strong Match | Good Match | Partial Match | Low Match",
  "confidence": "High | Medium | Low",
  "skillsMatch": 0,
  "experienceMatch": 0,
  "responsibilitiesMatch": 0,
  "educationCertificationsMatch": 0,
  "resumeQuality": 0,
  "matchedSkills": ["..."],
  "missingOrWeakSkills": ["..."],
  "strengths": ["..."],
  "gaps": ["..."],
  "summary": "2-4 sentence candidate-facing explanation"
}

Weighting for overallScore:
- skillsMatch: 40%
- experienceMatch: 25%
- responsibilitiesMatch: 15%
- educationCertificationsMatch: 10%
- resumeQuality: 10%
`;

    const inlineData = mimeType.startsWith("text/")
      ? { textResume: new TextDecoder().decode(bytes) }
      : { inlineData: { mimeType: "application/pdf", data: bytesToBase64(bytes) } };

    const contents = mimeType.startsWith("text/")
      ? [{ parts: [{ text: prompt + `\n\nRESUME TEXT\n${inlineData.textResume}` }] }]
      : [{ parts: [{ text: prompt }, inlineData] }];

    const geminiResponse = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-goog-api-key": geminiApiKey
        },
        body: JSON.stringify({
          contents,
          generationConfig: {
            temperature: 0.2,
            responseMimeType: "application/json"
          }
        })
      }
    );

    const geminiData = await geminiResponse.json();
    if (!geminiResponse.ok) {
      console.error("Gemini error:", geminiData);
      return json({ error: "The AI scoring service failed to analyze the resume." }, 502);
    }

    const text = geminiData?.candidates?.[0]?.content?.parts?.map((p: any) => p.text || "").join("").trim();
    if (!text) return json({ error: "The AI scoring service returned no analysis." }, 502);

    const parsed = parseJson(text);
    return json(normalizeResult(parsed), 200);
  } catch (error) {
    console.error("score-resume error:", error);
    return json({ error: error instanceof Error ? error.message : "Unexpected scoring error." }, 500);
  }
});