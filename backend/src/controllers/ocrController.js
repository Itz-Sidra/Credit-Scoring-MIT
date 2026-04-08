/**
 * OCR Controller — additive only.
 * Handles POST /api/loan/upload-document
 * Does NOT modify any existing controller.
 */

import multer from "multer";
import path from "path";
import fs from "fs";
import { analyzeIdentityDocument } from "../services/ocrService.js";

// ── Storage: save to backend/uploads/ ─────────────────────────────────────────
const uploadDir = path.resolve("uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ts = Date.now();
    const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
    cb(null, `${ts}_${safe}`);
  },
});

// Accept common browser/mobile types; Textract may still fail on some (e.g. WebP) — we soft-accept anyway.
const allowedMime = ["image/jpeg", "image/png", "image/webp"];

function softAcceptBody(overrides = {}) {
  return {
    message:
      "Document received (automated verification unavailable or unclear image)",
    documentType: null,
    name: null,
    dob: null,
    idNumber: null,
    gender: null,
    address: null,
    identityVerified: false,
    softAccept: true,
    ...overrides,
  };
}

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB max
  fileFilter: (_req, file, cb) => {
    if (allowedMime.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only JPG or PNG files are accepted"));
    }
  },
}).single("document");

// ── Handler ────────────────────────────────────────────────────────────────────
export const uploadAndAnalyzeDocument = (req, res) => {
  upload(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ message: err.message });
    }

    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    const filePath = req.file.path;

    try {
      const result = await analyzeIdentityDocument(filePath);

      // Clean up uploaded file after processing (don't persist on server)
      try {
        fs.unlinkSync(filePath);
      } catch (_) {}

      if (!result.success) {
        if (result.error) {
          console.warn("OCR soft-accept (no extract):", result.error);
        }
        return res.status(200).json(softAcceptBody());
      }

      return res.status(200).json({
        message: "Document analysed successfully",
        documentType: result.documentType,
        name: result.name,
        dob: result.dob,
        idNumber: result.idNumber,   // last-4 masked
        gender: result.gender,
        address: result.address,
        identityVerified: result.identityVerified,
      });
    } catch (analysisErr) {
      try { fs.unlinkSync(filePath); } catch (_) {}
      console.error("❌ OCR controller error (soft-accept):", analysisErr.message);
      return res.status(200).json(softAcceptBody());
    }
  });
};
