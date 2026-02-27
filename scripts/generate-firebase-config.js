const fs = require("fs");
const path = require("path");

const projectRoot = path.join(__dirname, "..");

// Load .env.local and .env so this script sees vars when run via npm (Next.js only loads these for next build)
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
  } catch (_) {
    // File missing or unreadable; ignore
  }
}
loadEnvFile(".env.local");
loadEnvFile(".env");

// Prefer NEXT_PUBLIC_FIREBASE_* if FIREBASE_* not set (so one .env.local works for both Next and this script)
const map = [
  ["NEXT_PUBLIC_FIREBASE_API_KEY", "FIREBASE_API_KEY"],
  ["NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN", "FIREBASE_AUTH_DOMAIN"],
  ["NEXT_PUBLIC_FIREBASE_PROJECT_ID", "FIREBASE_PROJECT_ID"],
  ["NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET", "FIREBASE_STORAGE_BUCKET"],
  ["NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID", "FIREBASE_MESSAGING_SENDER_ID"],
  ["NEXT_PUBLIC_FIREBASE_APP_ID", "FIREBASE_APP_ID"],
  ["NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID", "FIREBASE_MEASUREMENT_ID"],
];
map.forEach(([from, to]) => {
  if (!process.env[to] && process.env[from]) process.env[to] = process.env[from];
});

const required = [
  "FIREBASE_API_KEY",
  "FIREBASE_AUTH_DOMAIN",
  "FIREBASE_PROJECT_ID",
  "FIREBASE_STORAGE_BUCKET",
  "FIREBASE_MESSAGING_SENDER_ID",
  "FIREBASE_APP_ID",
];

const missing = required.filter((name) => !process.env[name]);
if (missing.length > 0) {
  console.error("Missing required env vars:", missing.join(", "));
  process.exit(1);
}

const measurementId = process.env.FIREBASE_MEASUREMENT_ID || "";
const outPath = path.join(__dirname, "..", "public", "firebase-config.js");

const content =
  "/**\n" +
  " * Generated at build time from environment variables.\n" +
  " * Do not commit secrets here.\n" +
  " */\n" +
  "var FIREBASE_CONFIG = {\n" +
  `  apiKey: ${JSON.stringify(process.env.FIREBASE_API_KEY)},\n` +
  `  authDomain: ${JSON.stringify(process.env.FIREBASE_AUTH_DOMAIN)},\n` +
  `  projectId: ${JSON.stringify(process.env.FIREBASE_PROJECT_ID)},\n` +
  `  storageBucket: ${JSON.stringify(process.env.FIREBASE_STORAGE_BUCKET)},\n` +
  `  messagingSenderId: ${JSON.stringify(process.env.FIREBASE_MESSAGING_SENDER_ID)},\n` +
  `  appId: ${JSON.stringify(process.env.FIREBASE_APP_ID)},\n` +
  `  measurementId: ${JSON.stringify(measurementId)}\n` +
  "};\n";

fs.writeFileSync(outPath, content, "utf8");
console.log("Generated firebase-config.js from environment variables.");
