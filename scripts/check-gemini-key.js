/**
 * Check Gemini key connectivity and common permission issues.
 * Loads .env.local/.env similar to other scripts.
 * Run: node scripts/check-gemini-key.js
 */
const fs = require("fs");
const path = require("path");

const projectRoot = path.join(__dirname, "..");

function loadEnvFile(filename) {
  const filePath = path.join(projectRoot, filename);
  try {
    const content = fs.readFileSync(filePath, "utf8");
    content.split("\n").forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) return;
      const eq = trimmed.indexOf("=");
      if (eq <= 0) return;
      const key = trimmed.slice(0, eq).trim();
      let val = trimmed.slice(eq + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      process.env[key] = val;
    });
  } catch (_) {
    // ignore missing env file
  }
}

async function run() {
  loadEnvFile(".env.local");
  loadEnvFile(".env");

  const key = (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "").trim();
  const keyType = process.env.GEMINI_API_KEY ? "GEMINI_API_KEY" : process.env.GOOGLE_API_KEY ? "GOOGLE_API_KEY" : "none";
  if (!key) {
    console.error("No GEMINI_API_KEY or GOOGLE_API_KEY found in .env.local/.env");
    process.exit(1);
  }

  console.log(`Using ${keyType} (length=${key.length})`);
  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(key)}`;
  const res = await fetch(url);
  const text = await res.text();
  console.log("Status:", res.status);
  console.log(text.slice(0, 1500));

  if (!res.ok) process.exit(1);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
