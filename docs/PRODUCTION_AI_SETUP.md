# Stormijxo — Production AI Setup (EchoFlux-style)

Generative AI (captions, usage) works in production when either:

1. **Root serverless** `api/studio/*.js` handle the request (same pattern as EchoFlux), or  
2. **Next.js** `app/api/studio/*` handle it (dev and some Vercel setups).

Both use the same env vars. Set these in **Vercel → Project → Settings → Environment Variables**:

## Required

| Variable | Description |
|----------|-------------|
| `GEMINI_API_KEY` or `GOOGLE_API_KEY` | Google AI API key (Generative Language API). |
| Firebase Admin (pick one) | |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Full JSON string of the service account (preferred). |
| **OR** `FIREBASE_PROJECT_ID` + `FIREBASE_CLIENT_EMAIL` + `FIREBASE_PRIVATE_KEY` | Separate fields; `FIREBASE_PRIVATE_KEY` can use `\n` for newlines. |

## Deploy

After setting variables, **redeploy** (Vercel → Deployments → … → Redeploy).

## Verify

- **Caption generation:** Use “AI suggest” or “Generate captions” on the posts page; you should get captions or a clear error.
- **Usage:** Premium Studio or posts page should show remaining caption/AI usage without errors.

If you see “Missing auth token” or “Invalid token”, Firebase Auth is working but the ID token may be expired — sign out and sign in again. If you see “AI captioning not available” or “GEMINI_API_KEY”, add or fix the key in Vercel and redeploy.
