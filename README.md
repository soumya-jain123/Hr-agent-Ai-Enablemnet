# HR Resume & LinkedIn Shortlisting Agent

AI-powered agent that ingests a Job Description + resumes (PDF/DOCX), scores every candidate across 5 rubric dimensions using an LLM via OpenRouter, and presents a ranked shortlist with a human-in-the-loop override panel.

---

## Tech Stack

| Layer           | Technology                                          |
| --------------- | --------------------------------------------------- |
| Frontend        | React 18 + Vite + Tailwind CSS                      |
| Backend         | Node.js + Express.js                                |
| Database        | MongoDB + Mongoose                                  |
| File Parsing    | pdf-parse (PDF), mammoth (DOCX)                     |
| LLM             | Claude claude-sonnet-4-5 via OpenRouter             |
| Agent Framework | Custom pipeline (no external framework — see below) |
| Security        | dotenv, helmet, express-rate-limit                  |
| Report Export   | PDFKit                                              |

---

## LLM Choice — Claude claude-sonnet-4-5 via OpenRouter

**Model:** `anthropic/claude-sonnet-4-5`  
**Provider:** OpenRouter (unified API gateway)  
**Version accessed via:** OpenAI-compatible REST API at `https://openrouter.ai/api/v1`

### Why Claude Sonnet over alternatives?

| Criterion                   | Claude Sonnet                            | GPT-4o      | Gemini 1.5 Pro               |
| --------------------------- | ---------------------------------------- | ----------- | ---------------------------- |
| Structured JSON output      | Excellent — rarely adds markdown leakage | Good        | Moderate — frequent preamble |
| Instruction following       | Very strong                              | Strong      | Good                         |
| Context window              | 200K tokens                              | 128K tokens | 1M tokens                    |
| Resume extraction accuracy  | High — strong document reasoning         | High        | Moderate                     |
| Cost (Sonnet tier)          | Cost-effective                           | Higher      | Lower                        |
| Availability via OpenRouter | Yes                                      | Yes         | Yes                          |

Claude was chosen primarily for its superior instruction-following on structured JSON tasks — critical for this agent where every LLM call must return machine-parseable output with no extra text.

---

## Agent Framework

### Framework: Custom Sequential Pipeline (No external framework)

This project does **not** use LangChain, LlamaIndex, CrewAI, or AutoGen. Instead, it implements a hand-crafted sequential agent pipeline in Node.js. This was a deliberate design decision:

- **Simplicity** — for a linear, deterministic workflow (parse → profile → score → rank), a full agent framework adds overhead with no benefit
- **Full control** — each step's prompt, retry logic, and output validation is explicit and auditable
- **Easier debugging** — no abstraction layers hiding what the LLM is actually being sent

### Architecture — Agent Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                         HR USER                                  │
│            Uploads JD text + resume files (PDF/DOCX)            │
└──────────────────────┬──────────────────────────────────────────┘
                       │  POST /api/jobs
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│  STEP 1 — jdParser.js                                           │
│  LLM extracts: skills[], experience_years, education,           │
│  certifications[], domain  →  structured JSON                   │
│  Stored in: Job model (MongoDB)                                 │
└──────────────────────┬──────────────────────────────────────────┘
                       │  POST /api/jobs/:id/resumes
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│  STEP 2 — profileParser.js  (runs per resume file)             │
│  pdf-parse / mammoth → raw text                                 │
│  LLM extracts: name, skills[], experience_years, education,     │
│  certifications[], projects[], communication_quality            │
│  Stored in: Candidate model (MongoDB)                           │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│  STEP 3 — scoreAgent.js  (runs per candidate)                  │
│  Input: parsedJD + candidateProfile                             │
│  LLM scores 5 rubric dimensions (0–10) with justifications      │
│  Output validated + scores clamped to [0, 10]                  │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│  STEP 4 — rankEngine.js                                         │
│  Weighted total = skills×0.30 + experience×0.25 +               │
│                   education×0.15 + projects×0.20 +              │
│                   communication×0.10                            │
│  Candidates sorted descending. Hire if total ≥ 6.0             │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│  STEP 5 — React Dashboard                                        │
│  Ranked shortlist table with dimension scores + justifications  │
│  GET /api/jobs/:id/shortlist                                    │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│  STEP 6 — OverridePage  (Human-in-the-Loop)                    │
│  HR adjusts any score + enters reason                           │
│  PATCH /api/candidates/:id/override                             │
│  Change logged to AuditLog collection                           │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│  STEP 7 — reportGenerator.js                                    │
│  PDF report (PDFKit) or JSON export                             │
│  GET /api/reports/:jobId/pdf  or  /json                        │
└─────────────────────────────────────────────────────────────────┘
```

---

## Prompt Design

### Design Principles

All three LLM calls follow the same guardrail pattern:

1. **System prompt** instructs the model to return ONLY raw JSON — no markdown, no backticks, no explanation
2. **Structured output schema** is spelled out in the prompt with exact key names and types
3. **`extractJSON()` helper** strips any markdown fences before `JSON.parse()` (handles models that ignore formatting instructions)
4. **One retry** — if JSON parsing still fails, a second call asks the model to fix the invalid JSON
5. **Post-parse validation** — required keys are checked; missing keys get safe defaults; numeric scores are clamped

---

### JD Parser — System Prompt

```
You are an expert HR analyst. Extract structured requirements from a Job Description.

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
- Skills should be specific (e.g. "React.js", "Python") not vague (e.g. "programming").
```

**Guardrails applied:**

- Explicit JSON-only instruction in both system and user turns
- Specific skills instruction prevents vague catch-all extractions
- Default values rule prevents hallucinated requirements

---

### Profile Parser — System Prompt

```
You are a professional resume parser. Extract structured information from resume text.

Return ONLY a raw JSON object — no markdown, no backticks, no explanation — with exactly these keys:
{
  "name": "string",
  "skills": ["string", ...],
  "experience_years": number,
  "education": "string",
  "certifications": ["string", ...],
  "projects": ["string", ...],
  "communication_quality": { "score": number, "reasoning": "string" }
}

Rules:
- Output ONLY raw JSON. No markdown fences. No backticks.
- Do not invent information. Only extract what is present.
- For experience_years, sum all work experience durations. Use 0 if none found.
- projects: max 5 brief descriptions.
```

**Key guardrail — "Do not invent information."** This explicit instruction is the primary mitigation against hallucination. Without it, models tend to infer skills or experience not present in the resume.

---

### Score Agent — System Prompt

```
You are a senior HR evaluator. Score a job candidate against a job description using a 5-dimension rubric.

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
- experience_relevance: 0 = completely unrelated domain, 5 = adjacent domain, 10 = exact domain & seniority
- education: 0 = does not meet minimum, 5 = meets minimum exactly, 10 = exceeds + extra certifications
- projects: 0 = no relevant projects, 5 = 1-2 generic projects, 10 = strong portfolio relevant to JD
- communication: 0 = poor grammar/structure, 5 = adequate clarity, 10 = crisp, professional, well-structured

Rules: Scores must be integers 0-10. Output ONLY raw JSON.
```

**Additional code-level guardrails:**

- `Math.min(10, Math.max(0, Math.round(score)))` clamps every score after parsing — even if the model returns 10.5 or -1, it becomes a valid value
- All 5 dimensions checked for existence; missing dimensions default to score 0

---

## Scoring Rubric

| Dimension             | Weight | 0 – Poor               | 5 – Average          | 10 – Excellent            |
| --------------------- | ------ | ---------------------- | -------------------- | ------------------------- |
| Skills Match          | 30%    | <30% skills match      | 50–70% match         | >85% match                |
| Experience Relevance  | 25%    | Unrelated domain       | Adjacent domain      | Exact domain & seniority  |
| Education & Certs     | 15%    | Below minimum          | Meets minimum        | Exceeds + extra certs     |
| Project / Portfolio   | 20%    | No evidence            | 1–2 generic projects | Strong relevant portfolio |
| Communication Quality | 10%    | Poor grammar/structure | Adequate clarity     | Crisp, professional       |

**Hire threshold: weighted total ≥ 6.0 / 10**

---

## Security Mitigations

| Risk                    | Implementation                                                                                                                                                                                                                                                                                                                                                                                   |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Prompt Injection**    | `sanitize.js` strips known injection patterns (ignore previous instructions, jailbreak phrases) before text enters any prompt. LLM instructed to return JSON only — any injected text attempting to alter behaviour becomes part of the string value rather than executed as an instruction. Output always parsed with `JSON.parse` inside try/catch; non-JSON responses are caught and retried. |
| **API Key Exposure**    | `OPENROUTER_API_KEY` stored in `.env` via `dotenv`. `.env` listed in `.gitignore`. Only `.env.example` (with placeholder values) is committed. Key is never hardcoded or logged.                                                                                                                                                                                                                 |
| **PII in Logs**         | Candidate names and emails are never written to `console.log`. Raw resume text is not printed to server logs. File paths are stripped from API responses. AuditLog stores only job ID, score delta, and reason — not personal data.                                                                                                                                                              |
| **Hallucination Risk**  | Profile parser explicitly instructed "Do not invent information." All LLM responses validated against expected JSON schema. Scores clamped to valid range post-parse. One retry attempted before failing gracefully with a 500 error.                                                                                                                                                            |
| **Unauthorised Access** | All `/api` routes protected by `authMiddleware` — checks `x-api-key` request header against `INTERNAL_API_KEY`. Global rate limit: 60 req/min. Agent routes (resume processing): 10 req/min. Returns `401` on invalid key.                                                                                                                                                                       |
| **Malicious Uploads**   | Multer middleware double-checks MIME type AND file extension. Only `application/pdf` and `application/vnd.openxmlformats-officedocument.wordprocessingml.document` accepted. Max file size: 5MB. Max files per batch: 20. Files stored in isolated `uploads/` directory.                                                                                                                         |
| **Security Headers**    | `helmet` middleware applies: Content-Security-Policy, X-Frame-Options (DENY), X-Content-Type-Options, Strict-Transport-Security, and Referrer-Policy on every response.                                                                                                                                                                                                                          |

---

## Setup Instructions

### Prerequisites

- Node.js 18+
- MongoDB (local Compass or Atlas)
- OpenRouter API key (get one at openrouter.ai)

### 1. Clone and install

```bash
git clone https://github.com/YOUR_USERNAME/hr-agent.git
cd hr-agent

# Install server dependencies
cd server && npm install

# Install client dependencies
cd ../client && npm install
```

### 2. Configure environment

```bash
# In server/
cp .env.example .env
# Fill in: OPENROUTER_API_KEY, OPENROUTER_MODEL, MONGO_URI, INTERNAL_API_KEY

# In client/
cp .env.example .env
# Fill in: VITE_INTERNAL_API_KEY (must match INTERNAL_API_KEY above)
```

**server/.env values:**

```env
OPENROUTER_API_KEY=sk-or-v1-xxxxxxxxxxxxxxxx
OPENROUTER_MODEL=anthropic/claude-sonnet-4-5
MONGO_URI=mongodb://localhost:27017/hr_agent
PORT=5000
NODE_ENV=development
INTERNAL_API_KEY=your_random_secret_here
MAX_FILE_SIZE_MB=5
UPLOAD_DIR=uploads
```

**Generate INTERNAL_API_KEY:**

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 3. Run

```bash
# Terminal 1 – backend
cd server && npm run dev

# Terminal 2 – frontend
cd client && npm run dev
```

Open **http://localhost:5173**

---

## API Endpoints

| Method | Endpoint                     | Description                    |
| ------ | ---------------------------- | ------------------------------ |
| GET    | /api/health                  | Health check                   |
| POST   | /api/jobs                    | Create job + parse JD          |
| GET    | /api/jobs                    | List all jobs                  |
| GET    | /api/jobs/:id                | Get single job                 |
| POST   | /api/jobs/:id/resumes        | Upload resumes, start pipeline |
| GET    | /api/jobs/:id/shortlist      | Get ranked shortlist           |
| GET    | /api/candidates/:id          | Get single candidate           |
| PATCH  | /api/candidates/:id/override | HR score override              |
| GET    | /api/reports/:jobId/pdf      | Download PDF shortlist report  |
| GET    | /api/reports/:jobId/json     | Download JSON report           |

---

## Sample Test Resumes

The `sample-resumes/` folder contains 5 test resumes designed to validate all scoring ranges:

| File                            | Candidate                                        | Expected Score | Match Level |
| ------------------------------- | ------------------------------------------------ | -------------- | ----------- |
| `01_Arjun_Mehta_Excellent.docx` | 6 yrs React, TypeScript, AWS cert, OSS portfolio | ~8.5 / 10      | Excellent   |
| `02_Priya_Sharma_Good.docx`     | 4 yrs React + Redux, most skills match           | ~7.0 / 10      | Good        |
| `03_Rohit_Verma_Partial.docx`   | Vue/Angular dev, basic React only                | ~4.5 / 10      | Partial     |
| `04_Sneha_Pillai_Weak.docx`     | Fresh grad, HTML/CSS intern, no React            | ~2.5 / 10      | Weak        |
| `05_Vikram_Nair_NoMatch.docx`   | Senior PHP/Laravel backend, no frontend          | ~1.0 / 10      | No match    |

---

## Deliverables

- [x] GitHub repository with source code
- [x] `.env.example` with all required keys
- [x] `package.json` with all dependencies
- [x] README with architecture, setup, LLM rationale, agent framework, prompt design, security docs
- [x] 5 sample resumes in `sample-resumes/`
- [ ] Sample output PDF (run the app with the 5 resumes and save the generated report)
- [ ] 3–5 min screen recording
- [ ] 8–10 slide presentation deck
