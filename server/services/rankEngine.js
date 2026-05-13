/**
 * rankEngine.js
 * Pure logic — no LLM calls.
 * Computes weighted total score from the 5 rubric dimensions
 * and applies hire / no-hire threshold.
 */

const WEIGHTS = {
  skills_match: 0.3,
  experience_relevance: 0.25,
  education: 0.15,
  projects: 0.2,
  communication: 0.1,
};

const HIRE_THRESHOLD = 6.0; // out of 10

/**
 * Compute weighted total score and hire recommendation.
 * @param {Object} scores - Object with 5 dimension objects each having a `score` field
 * @returns {{ total_score: number, recommendation: string }}
 */
const computeScore = (scores) => {
  let total = 0;

  for (const [dimension, weight] of Object.entries(WEIGHTS)) {
    const dimensionScore = scores?.[dimension]?.score ?? 0;
    total += dimensionScore * weight;
  }

  const total_score = Math.round(total * 100) / 100; // 2 decimal places
  const recommendation = total_score >= HIRE_THRESHOLD ? "hire" : "no-hire";

  return { total_score, recommendation };
};

/**
 * Sort a list of candidate objects by total_score descending.
 * @param {Array} candidates
 * @returns {Array}
 */
const rankCandidates = (candidates) => {
  return [...candidates].sort((a, b) => b.total_score - a.total_score);
};

module.exports = { computeScore, rankCandidates, WEIGHTS, HIRE_THRESHOLD };
