# Fix CORS for Firebase Storage (Move media / fetch)

If you see **"blocked by CORS policy"** when moving media or loading files from Firebase Storage in the app, your bucket needs a CORS configuration.

## One-time setup

1. **Install Google Cloud SDK** (includes `gsutil`) if you don’t have it:  
   https://cloud.google.com/sdk/docs/install  

2. **Log in and set project** (use your Firebase project id, e.g. `stormij`):
   ```bash
   gcloud auth login
   gcloud config set project stormij
   ```

3. **Apply CORS** from the **project root** (where `storage-cors.json` lives):
   ```bash
   gsutil cors set storage-cors.json gs://stormij.firebasestorage.app
   ```
   If your bucket name is different, check **Firebase Console → Storage** and use the bucket from the URL (e.g. `gs://your-bucket-name`).

4. **Confirm**:
   ```bash
   gsutil cors get gs://stormij.firebasestorage.app
   ```

After this, the Move feature and any `fetch`/`getBlob` of storage files from your app origin (e.g. `http://localhost:3001`) should work.

## Add your production URL

Edit `storage-cors.json` and add your production origin to the `"origin"` array, for example:

- `"https://yourdomain.com"`
- `"https://www.yourdomain.com"`

Then run the `gsutil cors set` command again.
