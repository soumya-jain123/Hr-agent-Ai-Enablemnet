const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const Candidate = require("../models/Candidate");
const AuditLog = require("../models/AuditLog");
const rankEngine = require("../services/rankEngine");

router.use(authMiddleware);

// ── GET /api/candidates/:id ────────────────────────────────────
router.get("/:id", async (req, res) => {
  try {
    const candidate = await Candidate.findById(req.params.id).select("-file_path");
    if (!candidate) return res.status(404).json({ error: "Candidate not found" });
    res.json(candidate);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── PATCH /api/candidates/:id/override ────────────────────────
// HR overrides one dimension score
router.patch("/:id/override", async (req, res) => {
  try {
    const { dimension, new_score, reason } = req.body;

    const validDimensions = ["skills_match", "experience_relevance", "education", "projects", "communication"];
    if (!validDimensions.includes(dimension)) {
      return res.status(400).json({ error: `Invalid dimension. Must be one of: ${validDimensions.join(", ")}` });
    }
    if (typeof new_score !== "number" || new_score < 0 || new_score > 10) {
      return res.status(400).json({ error: "new_score must be a number between 0 and 10" });
    }
    if (!reason || reason.trim().length < 5) {
      return res.status(400).json({ error: "reason is required (min 5 characters)" });
    }

    const candidate = await Candidate.findById(req.params.id);
    if (!candidate) return res.status(404).json({ error: "Candidate not found" });
    if (!candidate.scores || !candidate.scores[dimension]) {
      return res.status(400).json({ error: "Candidate has not been scored yet" });
    }

    const originalScore = candidate.scores[dimension].score;

    // Apply override
    candidate.scores[dimension].score = new_score;
    candidate.overrides.push({
      dimension,
      original_score: originalScore,
      new_score,
      reason: reason.trim(),
      overridden_by: "HR",
    });

    // Recompute weighted total
    const { total_score, recommendation } = rankEngine.computeScore(candidate.scores);
    candidate.total_score = total_score;
    candidate.recommendation = recommendation;
    await candidate.save();

    // Audit log
    await AuditLog.create({
      candidate_id: candidate._id,
      job_id: candidate.job_id,
      action: "score_override",
      changed_by: "HR",
      details: { dimension, original_score: originalScore, new_score, reason },
    });

    res.json({
      message: "Score overridden successfully",
      dimension,
      original_score: originalScore,
      new_score,
      new_total_score: candidate.total_score,
      recommendation: candidate.recommendation,
    });
  } catch (err) {
    console.error("[PATCH /candidates/:id/override]", err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
