/**
 * Check if Firebase Admin env vars are present and valid.
 * Loads .env.local from project root. Run: node scripts/check-firebase-admin-env.js
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
      if (trimmed && !trimmed.startsWith("#")) {
        const eq = trimmed.indexOf("=");
        if (eq > 0) {
          const key = trimmed.slice(0, eq).trim();
          let val = trimmed.slice(eq + 1).trim();
          if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'")))
            val = val.slice(1, -1);
          process.env[key] = val;
        }
      }
    });
  } catch (_) {}
}
loadEnvFile(".env.local");
loadEnvFile(".env");

const base64 = (process.env.FIREBASE_SERVICE_ACCOUNT_KEY_BASE64 || "").trim();
const jsonRaw = (process.env.FIREBASE_SERVICE_ACCOUNT_JSON || process.env.FIREBASE_SERVICE_ACCOUNT || "").trim();
const jsonPath = (process.env.FIREBASE_SERVICE_ACCOUNT_JSON_PATH || "").trim();
const projectId = (process.env.FIREBASE_PROJECT_ID || "").trim();
const clientEmail = (process.env.FIREBASE_CLIENT_EMAIL || "").trim();
const privateKey = (process.env.FIREBASE_PRIVATE_KEY || "").trim();

console.log("Firebase Admin env check (from .env.local / .env):\n");
console.log("  FIREBASE_SERVICE_ACCOUNT_KEY_BASE64:", base64 ? "set (" + base64.length + " chars)" : "UNSET");
console.log("  FIREBASE_SERVICE_ACCOUNT_JSON:     ", jsonRaw ? "set (" + jsonRaw.length + " chars)" : "UNSET");
console.log("  FIREBASE_SERVICE_ACCOUNT_JSON_PATH:", jsonPath || "UNSET");
console.log("  FIREBASE_PROJECT_ID:               ", projectId ? "set" : "UNSET");
console.log("  FIREBASE_CLIENT_EMAIL:             ", clientEmail ? "set" : "UNSET");
console.log("  FIREBASE_PRIVATE_KEY:              ", privateKey ? "set (" + privateKey.length + " chars)" : "UNSET");

let ok = false;
if (base64) {
  try {
    const decoded = Buffer.from(base64.replace(/\s/g, ""), "base64").toString("utf8");
    const parsed = JSON.parse(decoded);
    if (parsed && parsed.private_key) {
      console.log("\n  Base64 credential: valid (has private_key)");
      ok = true;
    } else {
      console.log("\n  Base64 credential: decoded but missing private_key");
    }
  } catch (e) {
    console.log("\n  Base64 credential: invalid -", e.message);
  }
}
if (!ok && jsonRaw) {
  try {
    let toParse = jsonRaw;
    if (toParse.startsWith('"') && toParse.endsWith('"')) {
      toParse = toParse.slice(1, -1).replace(/\\"/g, '"');
    }
    const parsed = JSON.parse(toParse);
    if (parsed && parsed.private_key) {
      console.log("\n  JSON credential: valid (has private_key)");
      ok = true;
    } else {
      console.log("\n  JSON credential: parsed but missing private_key");
    }
  } catch (e) {
    console.log("\n  JSON credential: parse error -", e.message);
  }
}
if (!ok && jsonPath) {
  const fullPath = path.isAbsolute(jsonPath) ? jsonPath : path.join(projectRoot, jsonPath);
  try {
    const raw = fs.readFileSync(fullPath, "utf8");
    const parsed = JSON.parse(raw);
    if (parsed && parsed.private_key) {
      console.log("\n  JSON file " + fullPath + ": valid (has private_key)");
      ok = true;
    } else {
      console.log("\n  JSON file: missing private_key");
    }
  } catch (e) {
    console.log("\n  JSON file:", e.message);
  }
}
if (!ok && projectId && clientEmail && privateKey) {
  const key = privateKey.replace(/\\n/g, "\n");
  if (key.includes("BEGIN PRIVATE KEY")) {
    console.log("\n  PROJECT_ID + CLIENT_EMAIL + PRIVATE_KEY: valid");
    ok = true;
  } else {
    console.log("\n  PRIVATE_KEY missing BEGIN PRIVATE KEY (check quoting/newlines)");
  }
}

if (!ok) {
  console.log("\n  Result: NO valid credential. Set one in .env.local and restart: npm run dev");
  process.exit(1);
}
console.log("\n  Result: Credential OK. If server still fails, restart dev server (Ctrl+C then npm run dev).\n");
