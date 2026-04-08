import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promises as fs } from "node:fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendRoot = path.resolve(__dirname, "..", "..");

const DEFAULT_ARTIFACT = path.resolve(
  backendRoot,
  "models/alternate/alternate_risk_pipeline.pkl"
);

const RUNNER = path.resolve(backendRoot, "src/services/alternate_ml_runner.py");

function runPython(payload) {
  const pythonBin = process.env.ML_PYTHON_BIN || "python3";
  return new Promise((resolve, reject) => {
    const py = spawn(pythonBin, [RUNNER, DEFAULT_ARTIFACT], {
      cwd: backendRoot,
      stdio: ["pipe", "pipe", "pipe"],
    });
    let out = "";
    let err = "";
    py.stdout.on("data", (c) => {
      out += c.toString();
    });
    py.stderr.on("data", (c) => {
      err += c.toString();
    });
    py.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(err || `alternate_ml_runner exit ${code}`));
        return;
      }
      try {
        const parsed = JSON.parse(out.trim() || "{}");
        if (parsed.error) {
          reject(new Error(parsed.error));
          return;
        }
        resolve(parsed);
      } catch (e) {
        reject(new Error(`invalid alternate_ml output: ${out?.slice(0, 200)}`));
      }
    });
    py.stdin.write(JSON.stringify(payload));
    py.stdin.end();
  });
}

export async function predictAlternateRisk(features) {
  await fs.access(DEFAULT_ARTIFACT).catch(() => {
    throw new Error("alternate_risk_pipeline.pkl missing — run scripts/train_alternate_model.py");
  });
  return runPython({ mode: "explain", features });
}

export function getAlternateArtifactPath() {
  return DEFAULT_ARTIFACT;
}
