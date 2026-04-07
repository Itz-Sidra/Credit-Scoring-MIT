/**
 * OCR Service — AWS Textract AnalyzeID
 * Additive only: does not touch any existing service or controller.
 *
 * Extracts structured fields from Aadhaar / PAN / driving licence images.
 * Returns a normalised object consumed by ocrController.
 */

import { TextractClient, AnalyzeIDCommand } from "@aws-sdk/client-textract";
import fs from "fs";

const client = new TextractClient({
  region: process.env.AWS_REGION || "ap-south-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

/**
 * @param {string} filePath  Absolute path to the uploaded image/PDF
 * @returns {Promise<{
 *   success: boolean,
 *   documentType: string|null,
 *   name: string|null,
 *   dob: string|null,
 *   idNumber: string|null,   // last 4 digits only for Aadhaar
 *   gender: string|null,
 *   address: string|null,
 *   identityVerified: boolean,
 *   rawFields: object
 * }>}
 */
export async function analyzeIdentityDocument(filePath) {
  try {
    const fileBytes = fs.readFileSync(filePath);

    const command = new AnalyzeIDCommand({
      DocumentPages: [
        {
          Bytes: fileBytes,
        },
      ],
    });

    const response = await client.send(command);

    const rawFields = {};
    const docResult = response.IdentityDocuments?.[0];

    if (!docResult) {
      return { success: false, identityVerified: false, rawFields: {} };
    }

    // Flatten all fields into a plain key→value map
    for (const field of docResult.IdentityDocumentFields || []) {
      const key = field.Type?.Text;
      const val = field.ValueDetection?.Text;
      if (key && val) rawFields[key] = val;
    }

    // Normalise common field names across document types
    const name =
      rawFields["FIRST_NAME"] || rawFields["NAME"] || rawFields["FULL_NAME"] || null;

    const lastName = rawFields["LAST_NAME"] || null;
    const fullName = name
      ? lastName
        ? `${name} ${lastName}`.trim()
        : name
      : null;

    const dob =
      rawFields["DATE_OF_BIRTH"] ||
      rawFields["DOB"] ||
      rawFields["DATE OF BIRTH"] ||
      null;

    // Aadhaar: mask to last 4 digits for privacy
    const rawId =
      rawFields["DOCUMENT_NUMBER"] ||
      rawFields["ID_NUMBER"] ||
      rawFields["AADHAAR"] ||
      null;
    const idNumber = rawId ? `XXXX-XXXX-${rawId.replace(/\s/g, "").slice(-4)}` : null;

    const gender = rawFields["GENDER"] || rawFields["SEX"] || null;
    const address = rawFields["ADDRESS"] || null;

    const documentType =
      rawFields["ID_TYPE"] ||
      (rawId?.replace(/\s/g, "").length === 12 ? "AADHAAR" : "UNKNOWN");

    const identityVerified = Boolean(fullName && (dob || rawId));

    return {
      success: true,
      documentType,
      name: fullName,
      dob,
      idNumber,
      gender,
      address,
      identityVerified,
      rawFields,
    };
  } catch (err) {
    console.error("❌ Textract OCR error:", err.message);
    return {
      success: false,
      identityVerified: false,
      error: err.message,
      rawFields: {},
    };
  }
}
