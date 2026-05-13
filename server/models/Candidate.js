const mongoose = require("mongoose");

const ScoreDimensionSchema = new mongoose.Schema(
  {
    score: { type: Number, min: 0, max: 10, required: true },
    justification: { type: String, required: true },
  },
  { _id: false }
);

const OverrideSchema = new mongoose.Schema(
  {
    dimension: { type: String, required: true },
    original_score: { type: Number, required: true },
    new_score: { type: Number, required: true },
    reason: { type: String, required: true },
    overridden_by: { type: String, default: "HR" },
    timestamp: { type: Date, default: Date.now },
  },
  { _id: false }
);

const CandidateSchema = new mongoose.Schema(
  {
    job_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Job",
      required: true,
    },
    original_filename: { type: String, required: true },
    file_path: { type: String, required: true },

    // Structured output from profileParser agent
    parsed_profile: {
      name: String,
      skills: [String],
      experience_years: Number,
      education: String,
      certifications: [String],
      projects: [String],
      communication_quality: {
        score: Number,
        reasoning: String,
      },
    },

    // Scores from scoreAgent
    scores: {
      skills_match: ScoreDimensionSchema,
      experience_relevance: ScoreDimensionSchema,
      education: ScoreDimensionSchema,
      projects: ScoreDimensionSchema,
      communication: ScoreDimensionSchema,
    },

    // Computed by rankEngine
    total_score: { type: Number, default: 0 },
    recommendation: {
      type: String,
      enum: ["hire", "no-hire", "pending"],
      default: "pending",
    },

    overrides: [OverrideSchema],

    status: {
      type: String,
      enum: ["uploaded", "parsing", "scoring", "done", "error"],
      default: "uploaded",
    },
    error_message: String,
  },
  { timestamps: true }
);

module.exports = mongoose.model("Candidate", CandidateSchema);
