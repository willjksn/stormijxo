const fs = require("fs");
const path = require("path");

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
