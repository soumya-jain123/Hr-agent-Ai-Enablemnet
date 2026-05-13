const mongoose = require("mongoose");

const JobSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    raw_jd: {
      type: String,
      required: true,
    },
    // Structured output from jdParser agent
    parsed_jd: {
      skills: [String],
      experience_years: Number,
      education: String,
      certifications: [String],
      domain: String,
    },
    status: {
      type: String,
      enum: ["pending", "parsing", "ready", "error"],
      default: "pending",
    },
    error_message: String,
  },
  { timestamps: true }
);

module.exports = mongoose.model("Job", JobSchema);
