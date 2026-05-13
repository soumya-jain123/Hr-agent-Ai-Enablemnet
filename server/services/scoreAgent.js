/**
 * scoreAgent.js — OpenRouter version
 */
const OpenAI = require("openai");

const client = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: "https://openrouter.ai/api/v1",
});

const MODEL = process.env.OPENROUTER_MODEL || "anthropic/claude-sonnet-4-5";

const SYSTEM_PROMPT = `You are a senior HR evaluator. Score a job candidate against a job description using a 5-dimension rubric.

Return ONLY a raw JSON object — no markdown, no backticks, no explanation — with exactly this structure:
{
  "skills_match": { "score": number, "justification": "string" },
  "experience_relevance": { "score": number, "justification": "string" },
  "education": { "score": number, "justification": "string" },
  "projects": { "score": number, "justification": "string" },
  "communication": { "score": number, "justification": "string" }
}

Scoring guide:
- skills_match: 0 = <30% of required skills present, 5 = 50-70% match, 10 = >85% match
- experience_relevance: 0 = completely unrelated domain, 5 = adjacent domain, 10 = exact domain and seniority level
- education: 0 = does not meet minimum requirement, 5 = meets minimum exactly, 10 = exceeds requirement with extra certifications
- projects: 0 = no relevant projects, 5 = 1-2 generic projects, 10 = strong portfolio directly relevant to the JD
- communication: 0 = poor grammar/structure in resume, 5 = adequate clarity, 10 = crisp, professional, well-structured

Rules: Scores must be integers 0-10. Output ONLY raw JSON. No markdown fences. No backticks.`;

const extractJSON = (text) => {
  if (!text) return null;
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) return fenced[1].trim();
  const braceStart = text.indexOf("{");
  const braceEnd = text.lastIndexOf("}");
  if (braceStart !== -1 && braceEnd !== -1) {
    return text.slice(braceStart, braceEnd + 1).trim();
  }
  return text.trim();
};

const score = async (parsedJD, candidateProfile) => {
  const userContent = `JOB DESCRIPTION REQUIREMENTS:\n${JSON.stringify(parsedJD, null, 2)}\n\nCANDIDATE PROFILE:\n${JSON.stringify(candidateProfile, null, 2)}\n\nScore this candidate and return only JSON.`;

  const callModel = async (messages) => {
    const res = await client.chat.completions.create({
      model: MODEL,
      max_tokens: 1200,
      messages,
    });
    return res.choices[0]?.message?.content?.trim();
  };

  let raw = await callModel([
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: userContent },
  ]);
  if (!raw) throw new Error("Score Agent: Model returned empty response");

  let parsed;
  try {
    parsed = JSON.parse(extractJSON(raw));
  } catch {
    const fixed = await callModel([
      {
        role: "system",
        content:
          "You must return only a raw JSON object. No markdown, no backticks, no explanation.",
      },
      {
        role: "user",
        content: `The following is not valid JSON. Return ONLY the corrected raw JSON object:\n\n${raw}`,
      },
    ]);
    try {
      parsed = JSON.parse(extractJSON(fixed));
    } catch {
      throw new Error(
        `Score Agent: Failed to get valid JSON after retry. Last response: ${fixed}`,
      );
    }
  }

  const dimensions = [
    "skills_match",
    "experience_relevance",
    "education",
    "projects",
    "communication",
  ];
  const validated = {};
  for (const dim of dimensions) {
    validated[dim] = {
      score: Math.min(
        10,
        Math.max(0, Math.round(Number(parsed[dim]?.score) || 0)),
      ),
      justification: parsed[dim]?.justification || "No justification provided.",
    };
  }
  return validated;
};

module.exports = { score };
