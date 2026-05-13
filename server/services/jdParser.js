/**
 * jdParser.js — OpenRouter version
 */
const OpenAI = require("openai");
const { sanitizeForPrompt } = require("../utils/sanitize");

const client = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: "https://openrouter.ai/api/v1",
});

const MODEL = process.env.OPENROUTER_MODEL || "anthropic/claude-sonnet-4-5";

const SYSTEM_PROMPT = `You are an expert HR analyst. Extract structured requirements from a Job Description.

Return ONLY a valid JSON object — no explanation, no markdown, no backticks — with exactly these keys:
{
  "skills": ["string", ...],
  "experience_years": number,
  "education": "string",
  "certifications": ["string", ...],
  "domain": "string"
}

Rules:
- Output ONLY raw JSON. No markdown fences. No backticks. No explanation.
- If a field is not mentioned, use a sensible default (empty array or empty string).
- Skills should be specific (e.g. "React.js", "Python") not vague.`;

/**
 * Strip markdown code fences and extract raw JSON string.
 */
const extractJSON = (text) => {
  if (!text) return null;
  // Remove ```json ... ``` or ``` ... ``` fences
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) return fenced[1].trim();
  // Try to find first { ... } block
  const braceStart = text.indexOf("{");
  const braceEnd = text.lastIndexOf("}");
  if (braceStart !== -1 && braceEnd !== -1) {
    return text.slice(braceStart, braceEnd + 1).trim();
  }
  return text.trim();
};

const parse = async (rawJD) => {
  const safeJD = sanitizeForPrompt(rawJD, 15000);

  const callModel = async (messages) => {
    const res = await client.chat.completions.create({
      model: MODEL,
      max_tokens: 1000,
      messages,
    });
    return res.choices[0]?.message?.content?.trim();
  };

  let raw = await callModel([
    { role: "system", content: SYSTEM_PROMPT },
    {
      role: "user",
      content: `Parse this Job Description and return only JSON:\n\n${safeJD}`,
    },
  ]);
  if (!raw) throw new Error("JD Parser: Model returned an empty response");

  let parsed;
  // First attempt — strip fences then parse
  try {
    parsed = JSON.parse(extractJSON(raw));
  } catch {
    // Second attempt — ask model to fix it
    const fixed = await callModel([
      {
        role: "system",
        content:
          "You must return only a raw JSON object. No markdown, no backticks, no explanation whatsoever.",
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
        `JD Parser: Failed to get valid JSON after retry. Last response: ${fixed}`,
      );
    }
  }

  // Ensure all required keys exist
  const required = [
    "skills",
    "experience_years",
    "education",
    "certifications",
    "domain",
  ];
  for (const key of required) {
    if (parsed[key] === undefined) {
      parsed[key] = key === "skills" || key === "certifications" ? [] : "";
    }
  }
  return parsed;
};

module.exports = { parse };
