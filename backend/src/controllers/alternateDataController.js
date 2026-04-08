import multer from "multer";
import {
  parseCsv,
  buildUpiSummary,
  buildUtilitySummary,
} from "../utils/alternateCsvSummaries.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

export const uploadAlternateData = (req, res) => {
  upload.single("file")(req, res, async (err) => {
    if (err) return res.status(400).json({ message: err.message });
    if (!req.file) return res.status(400).json({ message: "No file uploaded" });

    const sourceType = String(req.body?.sourceType || "upi").toLowerCase();
    const rawText = req.file.buffer.toString("utf-8");
    const rows = parseCsv(rawText);
    if (!rows.length) {
      return res.status(400).json({
        message: "Could not parse file. Please upload CSV with headers.",
      });
    }

    if (sourceType === "utility") {
      const summary = buildUtilitySummary(rows);
      return res.status(200).json({ message: "Parsed utility summary", sourceType, summary });
    }

    const summary = buildUpiSummary(rows);
    return res.status(200).json({ message: "Parsed transaction summary", sourceType: "upi", summary });
  });
};
