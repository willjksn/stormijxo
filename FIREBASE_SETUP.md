# Firebase setup — My Innercircle

Follow these steps so **Authentication**, **Firestore** (database), and **Storage** work with your app.

---

## Step 1: Open your Firebase project

1. Go to **[Firebase Console](https://console.firebase.google.com)** and sign in.
2. Open the project you created for My Innercircle.

---

## Step 2: Enable Authentication (Email/Password)

1. In the left sidebar, click **Build** → **Authentication**.
2. Click **Get started** (if you see it).
3. Open the **Sign-in method** tab.
4. Click **Email/Password**.
5. Turn **Enable** ON.
6. Leave **Email link** OFF unless you want passwordless sign-in.
7. Click **Save**.

**Create your admin account:**

8. Go to the **Users** tab.
9. Click **Add user**.
10. Enter the **email** and **password** you want to use to log in to the admin dashboard (e.g. `you@example.com`).
11. Click **Add user**.  
   → This user can open `admin/login.html` and see the members list.

---

## Step 3: Create the Firestore database

1. In the left sidebar, click **Build** → **Firestore Database**.
2. Click **Create database**.
3. Choose **Start in test mode** (we’ll deploy proper rules next) or **Start in production mode**.
4. Pick a **location** (e.g. `us-central1`) and click **Enable**.

**Collection used by the app:**  
The app uses a collection named **`members`**. You don’t need to create it manually — it will be created when:
- Someone submits their email on the success page, or  
- You add a member from the admin dashboard.

---

## Step 4: Enable Storage

1. In the left sidebar, click **Build** → **Storage**.
2. Click **Get started**.
3. For **Security rules**, choose **Start in test mode** (we’ll deploy proper rules next) or **Production mode**.
4. Use the same **location** as Firestore if possible, then click **Done**.

The app’s rules expect files under a **`content/`** path. You can upload files there from the Firebase Console or later from your admin UI.

---

## Step 5: Get your web app config

1. Click the **gear icon** next to “Project Overview” in the left sidebar → **Project settings**.
2. Scroll to **Your apps**.
3. If you don’t have a web app yet:
   - Click the **</>** (Web) icon.
   - Register the app with a nickname (e.g. “My Innercircle”) and optionally Firebase Hosting.
   - Click **Register app**.
4. You’ll see a config object like:

```javascript
const firebaseConfig = {
  apiKey: "AIza...",
  authDomain: "your-project-id.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project-id.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc..."
};
```

5. Copy those values into **`firebase-config.js`** in your project, so it looks like this (use your real values):

```javascript
const FIREBASE_CONFIG = {
  apiKey: "AIza...",
  authDomain: "your-project-id.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project-id.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc..."
};
```

6. Save the file.

---

## Step 6: Deploy Firestore and Storage rules

Your project already has **`firestore.rules`** and **`storage.rules`**. Deploy them so only logged-in admin can read/update/delete members and use Storage.

1. **Install Firebase CLI** (if needed):

   ```bash
   npm install -g firebase-tools
   ```

2. **Log in and select the project:**

   ```bash
   firebase login
   firebase use YOUR_PROJECT_ID
   ```

   Replace `YOUR_PROJECT_ID` with the **Project ID** from Project settings (e.g. `stormijxo-xxxxx`).  
   If you’re not sure, run `firebase projects:list` to see it.

3. **Link the project** (if this is the first time in this folder):

   ```bash
   cd c:\Projects\Stormij_xo
   firebase init
   ```

   - When asked “Which features do you want to set up?”, choose **Firestore** and **Storage** (spacebar to select, Enter to confirm).
   - “Use an existing project” → select your My Innercircle project.
   - When it asks for file names, keep the defaults: **firestore.rules**, **storage.rules** (and the existing **firebase.json** already points to them).

4. **Deploy the rules:**

   ```bash
   firebase deploy --only firestore
   firebase deploy --only storage
   ```

   Or both:

   ```bash
   firebase deploy --only firestore,storage
   ```

You should see “Deploy complete.” Firestore and Storage will now use the rules in your repo (admin-only read/update/delete for `members`, create allowed for success page; Storage only for authenticated users under `content/`).

---

## Step 7: Test that it works

1. **Authentication**  
   - Open your site (local or deployed) and go to **`/admin/login.html`**.  
   - Log in with the email and password you created in Step 2.  
   - You should be redirected to the dashboard.

2. **Firestore (database)**  
   - On the admin dashboard, click **Add member**, enter an email and optional note, then **Add**.  
   - The new row should appear in the list.  
   - Open **Firebase Console → Firestore** and confirm you see a **`members`** collection with a document.

3. **Success page → database**  
   - Open **`success.html`**, scroll to “Confirm your email”, enter an email, and submit.  
   - Check the admin dashboard and Firestore again — a new member document should appear.

4. **Storage**  
   - In **Firebase Console → Storage**, create a folder **`content`** (if needed) and upload a test file.  
   - Your app can later be extended so the admin dashboard lets you upload/delete files under **`content/`**; the rules already allow read/write for logged-in users there.

---

## Quick checklist

| Step | What | Done |
|------|------|------|
| 1 | Open Firebase project | ☐ |
| 2 | Authentication: Enable Email/Password + create admin user | ☐ |
| 3 | Firestore: Create database, pick location | ☐ |
| 4 | Storage: Get started, pick location | ☐ |
| 5 | Project settings → copy web config into `firebase-config.js` | ☐ |
| 6 | `firebase login` → `firebase use PROJECT_ID` → `firebase deploy --only firestore,storage` | ☐ |
| 7 | Test: admin login, add member, success page submit | ☐ |

After this, **Authentication**, **Firestore**, and **Storage** are configured and secured with your deployed rules.
