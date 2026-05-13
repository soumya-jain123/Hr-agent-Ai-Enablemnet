/**
 * authMiddleware.js
 * Checks that the request includes a valid x-api-key header.
 * This protects all agent endpoints from unauthorized access.
 */

const authMiddleware = (req, res, next) => {
  const apiKey = req.headers["x-api-key"];

  if (!apiKey) {
    return res.status(401).json({ error: "Missing x-api-key header" });
  }

  if (apiKey !== process.env.INTERNAL_API_KEY) {
    return res.status(403).json({ error: "Invalid API key" });
  }

  next();
};

module.exports = authMiddleware;
