// supabase/functions/generate-job-description/index.ts
//
// Deploy with:  supabase functions deploy generate-job-description
// Set secret :  supabase secrets set GEMINI_API_KEY=your_key_here
//
// Call from the client like:
//   const { data, error } = await supabase.functions.invoke('generate-job-description', {
//     body: { jobTitle, companyName, location, experience, salary, notice, industry }
//   });

// Minimal ambient declaration so this file type-checks in any editor,
// even without the Deno VS Code extension configured for this folder.
// (Supabase Edge Functions run on Deno at deploy time regardless of
// what your local editor's TS server understands.)
declare const Deno: {
  env: { get(key: string): string | undefined };
  serve: (handler: (req: Request) => Response | Promise<Response>) => void;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

// Rough seniority buckets drive very different prompts.
// This is the actual fix for the "Cashier gets a VP job description" bug:
// the model is told explicitly what level of role this is, and is
// forbidden from injecting corporate-strategy language into frontline roles.
function classifyLevel(experienceRaw: string | number) {
  const years = parseFloat(String(experienceRaw ?? "0").replace(/[^\d.]/g, "")) || 0;
  if (years === 0) return "entry-level / walk-in";
  if (years <= 2) return "junior";
  if (years <= 5) return "mid-level";
  if (years <= 10) return "senior";
  return "leadership / executive";
}

function buildPrompt(input: {
  jobTitle: string;
  companyName: string;
  location: string;
  experience: string | number;
  salary?: string;
  notice?: string;
  industry?: string;
  extraGuidance?: string;
}) {
  const level = classifyLevel(input.experience);

  return `You are writing a real job posting description for a job board. Write ONLY for the exact role given — do not default to generic corporate/strategy language.

Role: ${input.jobTitle}
Company: ${input.companyName}
Location: ${input.location}
Experience required: ${input.experience} (this is a ${level} role)
${input.salary ? `Salary: ${input.salary}` : ""}
${input.notice ? `Notice period: ${input.notice}` : ""}
${input.industry ? `Industry: ${input.industry}` : ""}
${input.extraGuidance ? `Additional guidance from the recruiter (incorporate this): ${input.extraGuidance}` : ""}

Hard rules:
- Match the seniority. A ${level} role must NOT include phrases like "lead cross-functional initiatives", "stakeholder management", "strategic optimization", or degree requirements that don't fit an entry-level/frontline job.
- If experience required is 0, do not require a specific degree — say "no prior experience required" or mention on-the-job training instead.
- Responsibilities must be concrete, day-to-day tasks a real person in THIS job actually does (e.g. for a cashier: operating the POS/billing system, handling cash and card payments, reconciling the till, assisting customers, restocking counters — not "lead end-to-end deliverables").
- Qualifications must match the seniority and the role's actual skill needs, not generic "analytical mindset / strong communicator" filler unless it's genuinely relevant.
- Keep it concise: 1 short intro paragraph, then "Key Responsibilities" (4-6 bullets) and "Required Qualifications" (3-5 bullets).
- Plain text output only. No markdown headers with #, use the section labels "Key Responsibilities:" and "Required Qualifications:" followed by "•" bullets, matching this job board's existing format.

Write the job description now.`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY is not configured");
    }

    const body = await req.json();
    const { jobTitle, companyName, location, experience, salary, notice, industry, extraGuidance } = body;

    if (!jobTitle || !companyName) {
      return new Response(
        JSON.stringify({ error: "jobTitle and companyName are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const prompt = buildPrompt({
      jobTitle,
      companyName,
      location: location || "Not specified",
      experience: experience ?? 0,
      salary,
      notice,
      industry,
      extraGuidance,
    });

    const geminiRes = await fetch(`${GEMINI_URL}?key=${GEMINI_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.6,
          maxOutputTokens: 600,
        },
      }),
    });

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      throw new Error(`Gemini API error: ${geminiRes.status} ${errText}`);
    }

    const geminiData = await geminiRes.json();
    const description =
      geminiData?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";

    if (!description) {
      throw new Error("Gemini returned an empty description");
    }

    return new Response(JSON.stringify({ description }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("generate-job-description error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
