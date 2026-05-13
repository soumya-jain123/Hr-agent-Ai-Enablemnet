const multer = require("multer");
const path = require("path");
const { v4: uuidv4 } = require("uuid");
const { sanitizeFilename } = require("../utils/sanitize");

const MAX_SIZE_MB = parseInt(process.env.MAX_FILE_SIZE_MB || "5");
const UPLOAD_DIR = path.join(__dirname, "..", process.env.UPLOAD_DIR || "uploads");

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    // Store as uuid + sanitized original name to prevent path traversal
    const safeName = sanitizeFilename(file.originalname);
    cb(null, `${uuidv4()}_${safeName}`);
  },
});

const fileFilter = (req, file, cb) => {
  const allowedMimes = [
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ];
  const allowedExts = [".pdf", ".docx"];
  const ext = path.extname(file.originalname).toLowerCase();

  if (allowedMimes.includes(file.mimetype) && allowedExts.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error(`Invalid file type: ${file.originalname}. Only PDF and DOCX are accepted.`));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_SIZE_MB * 1024 * 1024,
    files: 20, // max 20 resumes per upload batch
  },
});

module.exports = upload;
