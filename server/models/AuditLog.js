const mongoose = require("mongoose");

const AuditLogSchema = new mongoose.Schema(
  {
    candidate_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Candidate",
      required: true,
    },
    job_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Job",
      required: true,
    },
    action: {
      type: String,
      enum: ["score_override", "recommendation_override", "pipeline_run", "report_generated"],
      required: true,
    },
    changed_by: { type: String, default: "HR" },
    details: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: true }
);

module.exports = mongoose.model("AuditLog", AuditLogSchema);
