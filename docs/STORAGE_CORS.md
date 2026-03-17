# Fix CORS for Firebase Storage (Move media / load videos)

If you see **"blocked by CORS policy"** when loading images/videos from Firebase Storage, the bucket needs a CORS configuration. The project’s `storage-cors.json` uses **`"origin": ["*"]`** so any origin (including every Vercel preview URL) is allowed.

**You must apply the config to the bucket.** After changing the file, re-apply (see below). Then do a **hard refresh** (Ctrl+Shift+R) or test in an **incognito window** — a 304 cached response from before CORS was set won’t have CORS headers.

---

## 1. Apply CORS (Cloud Shell or your PC)

**Bucket name:** `stormij.firebasestorage.app`  
If you get “bucket not found”, try `stormij.appspot.com` (Firebase project ID).

### Option A: Google Cloud Shell

1. Open [Google Cloud Console](https://console.cloud.google.com/), select project **stormij**, open **Cloud Shell** (`>_`).
2. Create `cors.json`: copy the contents of this repo’s `storage-cors.json` and run:
   ```bash
   nano cors.json
   ```
   Paste, save (Ctrl+O, Enter, Ctrl+X).
3. Apply and verify:
   ```bash
   gsutil cors set cors.json gs://stormij.firebasestorage.app
   gsutil cors get gs://stormij.firebasestorage.app
   ```
   If `gsutil` isn’t available, use:
   ```bash
   gcloud storage buckets update gs://stormij.firebasestorage.app --cors-file=cors.json
   ```

### Option B: Your PC (gsutil or gcloud)

From the repo root (e.g. `C:\Projects\Stormij_xo`):

```bash
# If you have gsutil (Google Cloud SDK):
gsutil cors set storage-cors.json gs://stormij.firebasestorage.app

# Or with gcloud:
gcloud storage buckets update gs://stormij.firebasestorage.app --cors-file=storage-cors.json
```

Verify:

```bash
gsutil cors get gs://stormij.firebasestorage.app
```

You should see the same JSON (one rule with `"origin": ["*"]`).

---

## 2. Clear cache / hard refresh

After applying CORS:

- **Hard refresh:** Ctrl+Shift+R (Windows/Linux) or Cmd+Shift+R (Mac), or  
- Open the app in an **incognito/private window**.

Otherwise the browser may use a cached 304 response that was stored before CORS was set, and that response won’t include CORS headers.

---

## 3. If it still fails

- Confirm the bucket name in Firebase Console → Storage (bucket in the URL).
- Re-run the apply command; wait a minute and try again.
- Try the other bucket name: `gs://stormij.appspot.com` instead of `gs://stormij.firebasestorage.app`.
