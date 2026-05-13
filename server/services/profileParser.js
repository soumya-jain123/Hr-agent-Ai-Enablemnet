/**
 * profileParser.js — OpenRouter version
 */
const fs = require("fs");
const path = require("path");
const OpenAI = require("openai");
const pdfParse = require("pdf-parse");
const mammoth = require("mammoth");
const { sanitizeForPrompt } = require("../utils/sanitize");

const client = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: "https://openrouter.ai/api/v1",
});

const MODEL = process.env.OPENROUTER_MODEL || "anthropic/claude-sonnet-4-5";

const SYSTEM_PROMPT = `You are a professional resume parser. Extract structured information from resume text.

Return ONLY a raw JSON object — no markdown, no backticks, no explanation — with exactly these keys:
{
  "name": "string",
  "skills": ["string", ...],
  "experience_years": number,
  "education": "string",
  "certifications": ["string", ...],
  "projects": ["string", ...],
  "communication_quality": {
    "score": number,
    "reasoning": "string"
  }
}

Rules:
- Output ONLY raw JSON. No markdown fences. No backticks.
- Do not invent information. Only extract what is present.
- For experience_years, sum all work experience durations. Use 0 if none found.
- projects: max 5 brief descriptions.
- communication_quality.score: 1-10 based on resume clarity, grammar, structure.`;

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

const extractText = async (filePath) => {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".pdf") {
    const buffer = fs.readFileSync(filePath);
    const data = await pdfParse(buffer);
    return data.text;
  }
  if (ext === ".docx") {
    const result = await mammoth.extractRawText({ path: filePath });
    return result.value;
  }
  throw new Error(`Unsupported file type: ${ext}`);
};

const parse = async (filePath) => {
  const rawText = await extractText(filePath);
  if (!rawText || rawText.trim().length < 30) {
    throw new Error("Profile Parser: Resume file appears empty or unreadable");
  }

  const safeText = sanitizeForPrompt(rawText, 12000);

  const callModel = async (messages) => {
    const res = await client.chat.completions.create({
      model: MODEL,
      max_tokens: 1500,
      messages,
    });
    return res.choices[0]?.message?.content?.trim();
  };

  let raw = await callModel([
    { role: "system", content: SYSTEM_PROMPT },
    {
      role: "user",
      content: `Parse this resume and return only JSON:\n\n${safeText}`,
    },
  ]);
  if (!raw) throw new Error("Profile Parser: Model returned empty response");

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
        `Profile Parser: Failed to get valid JSON after retry. Last response: ${fixed}`,
      );
    }
  }

  return {
    name: parsed.name || "Unknown",
    skills: Array.isArray(parsed.skills) ? parsed.skills : [],
    experience_years:
      typeof parsed.experience_years === "number" ? parsed.experience_years : 0,
    education: parsed.education || "",
    certifications: Array.isArray(parsed.certifications)
      ? parsed.certifications
      : [],
    projects: Array.isArray(parsed.projects) ? parsed.projects.slice(0, 5) : [],
    communication_quality: {
      score: parsed.communication_quality?.score || 5,
      reasoning: parsed.communication_quality?.reasoning || "",
    },
  };
};

module.exports = { parse };
