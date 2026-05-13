const express = require("express");
const router = express.Router();
const upload = require("../middleware/uploadMiddleware");
const authMiddleware = require("../middleware/authMiddleware");
const Job = require("../models/Job");
const Candidate = require("../models/Candidate");
const jdParser = require("../services/jdParser");
const profileParser = require("../services/profileParser");
const scoreAgent = require("../services/scoreAgent");
const rankEngine = require("../services/rankEngine");

// All job routes require auth
router.use(authMiddleware);

// ── POST /api/jobs ─────────────────────────────────────────────
// Create a job with a Job Description (text body)
router.post("/", async (req, res) => {
  try {
    const { title, jd_text } = req.body;

    if (!title || !jd_text) {
      return res.status(400).json({ error: "title and jd_text are required" });
    }
    if (jd_text.length < 50) {
      return res.status(400).json({ error: "Job description is too short (min 50 chars)" });
    }

    // Create job in DB
    const job = await Job.create({ title, raw_jd: jd_text, status: "parsing" });

    // Parse JD with Claude (async, but we await here for simplicity)
    const parsedJD = await jdParser.parse(jd_text);
    job.parsed_jd = parsedJD;
    job.status = "ready";
    await job.save();

    res.status(201).json({ message: "Job created and JD parsed", job });
  } catch (err) {
    console.error("[POST /jobs]", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/jobs ──────────────────────────────────────────────
// List all jobs
router.get("/", async (req, res) => {
  try {
    const jobs = await Job.find().sort({ createdAt: -1 }).select("-raw_jd");
    res.json(jobs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/jobs/:id ──────────────────────────────────────────
router.get("/:id", async (req, res) => {
  try {
    const job = await Job.findById(req.params.id);
    if (!job) return res.status(404).json({ error: "Job not found" });
    res.json(job);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/jobs/:id/resumes ─────────────────────────────────
// Upload resumes and run the full agent pipeline
router.post("/:id/resumes", upload.array("resumes", 20), async (req, res) => {
  try {
    const job = await Job.findById(req.params.id);
    if (!job) return res.status(404).json({ error: "Job not found" });
    if (job.status !== "ready") {
      return res.status(400).json({ error: "JD not yet parsed. Wait for job status=ready." });
    }
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: "No resume files uploaded" });
    }

    // Create candidate records immediately so UI can show progress
    const candidateDocs = await Promise.all(
      req.files.map((file) =>
        Candidate.create({
          job_id: job._id,
          original_filename: file.originalname,
          file_path: file.path,
          status: "parsing",
        })
      )
    );

    // Run agent pipeline in background; respond immediately with candidate IDs
    res.status(202).json({
      message: `${req.files.length} resume(s) received. Processing started.`,
      candidate_ids: candidateDocs.map((c) => c._id),
    });

    // ── Background pipeline ──
    for (const candidate of candidateDocs) {
      try {
        // Step 1: Parse resume
        const profile = await profileParser.parse(candidate.file_path);
        candidate.parsed_profile = profile;
        candidate.status = "scoring";
        await candidate.save();

        // Step 2: Score against JD
        const scores = await scoreAgent.score(job.parsed_jd, profile);
        candidate.scores = scores;

        // Step 3: Compute weighted total
        const { total_score, recommendation } = rankEngine.computeScore(scores);
        candidate.total_score = total_score;
        candidate.recommendation = recommendation;
        candidate.status = "done";
        await candidate.save();
      } catch (pipelineErr) {
        console.error(`[Pipeline] Candidate ${candidate._id}:`, pipelineErr.message);
        candidate.status = "error";
        candidate.error_message = pipelineErr.message;
        await candidate.save();
      }
    }
  } catch (err) {
    console.error("[POST /jobs/:id/resumes]", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/jobs/:id/shortlist ────────────────────────────────
// Return ranked shortlist for a job
router.get("/:id/shortlist", async (req, res) => {
  try {
    const job = await Job.findById(req.params.id).select("title parsed_jd status");
    if (!job) return res.status(404).json({ error: "Job not found" });

    const candidates = await Candidate.find({ job_id: req.params.id, status: "done" })
      .sort({ total_score: -1 })
      .select("-file_path"); // never expose disk paths

    res.json({ job, candidates, total: candidates.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
