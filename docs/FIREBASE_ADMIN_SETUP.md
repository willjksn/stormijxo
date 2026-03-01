# Firebase Admin setup (Premium Studio / API auth)

The **generate-captions** API (and other Studio APIs) verify the Firebase ID token on the server. For that, the server needs **Firebase Admin** credentials.

If you see:

> Server auth not configured. Set FIREBASE_SERVICE_ACCOUNT_KEY_BASE64 or FIREBASE_SERVICE_ACCOUNT_JSON.

do the following.

---

## What is FIREBASE_SERVICE_ACCOUNT_KEY_BASE64?

It is the **entire** service account JSON file (the one you download from Firebase Console) **encoded as base64**.

- You do **not** put the JSON text directly in this variable.
- You take the **whole .json file** and turn it into one base64 string (no spaces, no line breaks in that string).
- The app then decodes that string back to JSON and uses it as the credential.

**Order of precedence:** The app tries credentials in this order. The first one that works is used.

1. **FIREBASE_SERVICE_ACCOUNT_JSON_PATH** — path to a .json file (e.g. `secrets/firebase-key.json`)
2. **FIREBASE_SERVICE_ACCOUNT_KEY_BASE64** — base64-encoded full JSON (one long string)
3. **FIREBASE_SERVICE_ACCOUNT_JSON** — full JSON as one line in the env value
4. **FIREBASE_PROJECT_ID** + **FIREBASE_CLIENT_EMAIL** + **FIREBASE_PRIVATE_KEY** — three separate vars (no base64)

So if you have **KEY_BASE64** set but the value is invalid (wrong encoding, truncated, or has spaces/newlines in the middle), the app will skip it and try the next option. If you also have the three vars (project_id, client_email, private_key), those will be used and captions will work even when KEY_BASE64 isn’t valid.

**Check what the app sees:** Run:

```bash
npm run check:firebase-admin
```

It loads `.env.local` and reports which vars are set and which credential option is valid. Use that to confirm KEY_BASE64 is present and valid, or that the three-vars option is used instead.

---

## 1. Get the service account key

1. Open [Firebase Console](https://console.firebase.google.com/) and select the **same project** as your web app (the one used by `NEXT_PUBLIC_FIREBASE_PROJECT_ID`).
2. Go to **Project settings** (gear) → **Service accounts**.
3. Click **Generate new private key** and confirm. A JSON file will download.

## 2. Set the env variable

Use **one** of these options.

### Option A — JSON string (e.g. `.env.local`)

- Open the downloaded JSON file.
- Minify it to a single line (no newlines inside the value). Keep `\n` inside the `private_key` string as literal backslash-n.
- In `.env.local` add:

```bash
FIREBASE_SERVICE_ACCOUNT_JSON={"type":"service_account","project_id":"your-project-id",...}
```

- Paste the full one-line JSON as the value (no quotes around it in `.env`, or escape inner quotes if your shell requires it).

### Option B — Base64: FIREBASE_SERVICE_ACCOUNT_KEY_BASE64

Use this when you want one single string in env (e.g. for Vercel). The value must be the **whole JSON file** base64-encoded, with **no spaces or newlines** in the base64 string.

**macOS / Linux:**

```bash
base64 -i path/to/your-service-account-key.json | tr -d '\n'
```

**PowerShell:**

```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("path\to\your-service-account-key.json"))
```

In `.env.local` use the **exact** variable name (no typos, no space before the `=`):

```bash
FIREBASE_SERVICE_ACCOUNT_KEY_BASE64=eyJ0eXBlIjoic2VydmljZV9hY2NvdW50Ii...
```

Paste the **entire** base64 output as the value (one line). If the script added line breaks, remove them so the value is one continuous string.

## 3. Restart the dev server

After changing `.env.local`, restart Next.js so it picks up the new variable:

```bash
# Stop the server (Ctrl+C), then:
npm run dev
```

## 4. Confirm

Try **Generate captions** again from Admin → Posts (with at least one image). If credentials are correct, the 401 should be gone. If you still get 401, check the server terminal for the exact error (e.g. wrong project or invalid key).

## Security

- **Never commit** the JSON file or put it in git.
- `.env.local` is git-ignored; keep it that way.
- In Vercel, use **Environment variables** and mark the variable as sensitive.
