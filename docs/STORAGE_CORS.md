# Fix CORS for Firebase Storage (Move media / load videos)

If you see **"blocked by CORS policy"** when moving media or loading videos from Firebase Storage, your bucket needs a CORS configuration.

## Option A: Use Google Cloud Shell (no install)

You can set CORS from your browser without installing anything.

1. **Open Cloud Shell**
   - Go to [Google Cloud Console](https://console.cloud.google.com/) and make sure the project **stormij** is selected (top bar).
   - Click the **Activate Cloud Shell** icon (terminal icon `>_`) in the top-right. A terminal opens at the bottom.

2. **Create the CORS file in Cloud Shell**
   - In the Cloud Shell terminal, run:
   ```bash
   cat > cors.json << 'EOF'
   [{"origin":["http://localhost:3000","http://localhost:3001","http://127.0.0.1:3000","http://127.0.0.1:3001","https://stormijxo.com","https://www.stormijxo.com"],"method":["GET","HEAD","PUT","POST","OPTIONS"],"responseHeader":["Content-Type","Content-Length","Content-Range","Accept-Ranges"],"maxAgeSeconds":3600}]
   EOF
   ```

3. **Apply CORS to your Storage bucket**
   ```bash
   gsutil cors set cors.json gs://stormij.firebasestorage.app
   ```
   If that bucket name fails, check **Firebase Console → Storage** and use the bucket from the URL (e.g. `gs://stormij.appspot.com`).

4. **Confirm**
   ```bash
   gsutil cors get gs://stormij.firebasestorage.app
   ```
   You should see the same JSON. After this, your app at `https://stormijxo.com` and localhost should be able to load storage files without CORS errors.

---

## Option B: Use gcloud / gsutil on your PC

1. **Install Google Cloud SDK** (includes `gsutil`):  
   https://cloud.google.com/sdk/docs/install  
   On Windows, run the installer and ensure **"Add to PATH"** is checked.

2. **Open a new PowerShell or Command Prompt** (so PATH is updated), then:
   ```bash
   gcloud auth login
   gcloud config set project stormij
   cd C:\Projects\Stormij_xo
   gsutil cors set storage-cors.json gs://stormij.firebasestorage.app
   ```

3. **Confirm**
   ```bash
   gsutil cors get gs://stormij.firebasestorage.app
   ```

---

## Add more origins later

Edit `storage-cors.json` in the project: add origins to the `"origin"` array (e.g. `"https://another-domain.com"`). Then run the `gsutil cors set` command again (from Cloud Shell or from your PC with the path to the updated file).
