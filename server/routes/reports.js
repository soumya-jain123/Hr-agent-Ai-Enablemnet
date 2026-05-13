const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const Job = require("../models/Job");
const Candidate = require("../models/Candidate");
const AuditLog = require("../models/AuditLog");
const reportGenerator = require("../utils/reportGenerator");

router.use(authMiddleware);

// ── GET /api/reports/:jobId/pdf ────────────────────────────────
router.get("/:jobId/pdf", async (req, res) => {
  try {
    const job = await Job.findById(req.params.jobId);
    if (!job) return res.status(404).json({ error: "Job not found" });

    const candidates = await Candidate.find({ job_id: job._id, status: "done" })
      .sort({ total_score: -1 })
      .select("-file_path");

    const pdfBuffer = await reportGenerator.generatePDF(job, candidates);

    await AuditLog.create({
      candidate_id: candidates[0]?._id || null,
      job_id: job._id,
      action: "report_generated",
      changed_by: "HR",
      details: { format: "pdf", candidate_count: candidates.length },
    });

    const filename = `shortlist_${job.title.replace(/\s+/g, "_")}_${Date.now()}.pdf`;
    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    });
    res.send(pdfBuffer);
  } catch (err) {
    console.error("[GET /reports/:jobId/pdf]", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/reports/:jobId/json ───────────────────────────────
router.get("/:jobId/json", async (req, res) => {
  try {
    const job = await Job.findById(req.params.jobId).select("-raw_jd");
    if (!job) return res.status(404).json({ error: "Job not found" });

    const candidates = await Candidate.find({ job_id: job._id, status: "done" })
      .sort({ total_score: -1 })
      .select("-file_path");

    res.json({
      generated_at: new Date().toISOString(),
      job,
      total_candidates: candidates.length,
      shortlist: candidates,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
