/**
 * Smoke tests for POST /api/studio/generate-captions.
 * Run with dev server up: npm run dev (in another terminal), then node scripts/test-caption-api.mjs
 * Or: npm run test:captions (starts dev, runs tests, exits).
 */

const BASE = process.env.CAPTION_API_BASE || "http://localhost:3000";

async function request(body, opts = {}) {
  const res = await fetch(`${BASE}/api/studio/generate-captions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...opts.headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

async function run() {
  let passed = 0;
  let failed = 0;

  // 1) No auth → 401
  try {
    const { status, data } = await request({ mediaUrl: "https://example.com/img.jpg" });
    if (status === 401) {
      console.log("✓ No auth → 401");
      passed++;
    } else {
      console.log("✗ No auth: expected 401, got", status, data);
      failed++;
    }
  } catch (e) {
    console.log("✗ No auth request failed:", e.message);
    failed++;
  }

  // 2) Invalid JSON → 400 (or 401 if auth is checked first with fake token)
  try {
    const res = await fetch(`${BASE}/api/studio/generate-captions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer fake-token" },
      body: "not json",
    });
    const data = await res.json().catch(() => ({}));
    if (res.status === 400 && (data.error === "Invalid request" || data.details)) {
      console.log("✓ Invalid JSON → 400");
      passed++;
    } else if (res.status === 401) {
      console.log("✓ Invalid JSON (auth first): 401");
      passed++;
    } else {
      console.log("✗ Invalid JSON: expected 400 or 401, got", res.status, data);
      failed++;
    }
  } catch (e) {
    console.log("✗ Invalid JSON request failed:", e.message);
    failed++;
  }

  // 3) Valid JSON but no media → 400
  try {
    const { status, data } = await request(
      { goal: "engagement", tone: "flirty" },
      { headers: { Authorization: "Bearer fake-token" } }
    );
    if (status === 401) {
      console.log("✓ No media (with fake token): got 401 (auth checked first)");
      passed++;
    } else if (status === 400 && (data.error === "Invalid request" || data.details?.length > 0)) {
      console.log("✓ No media → 400");
      passed++;
    } else {
      console.log("✗ No media: expected 400 or 401, got", status, data);
      failed++;
    }
  } catch (e) {
    console.log("✗ No media request failed:", e.message);
    failed++;
  }

  // 4) Valid shape with mediaUrl but invalid token → 401
  try {
    const { status } = await request(
      { mediaUrl: "https://example.com/photo.jpg", goal: "engagement" },
      { headers: { Authorization: "Bearer invalid" } }
    );
    if (status === 401) {
      console.log("✓ Invalid token → 401");
      passed++;
    } else {
      console.log("✗ Invalid token: expected 401, got", status);
      failed++;
    }
  } catch (e) {
    console.log("✗ Invalid token request failed:", e.message);
    failed++;
  }

  console.log("\n" + passed + " passed, " + failed + " failed");
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
