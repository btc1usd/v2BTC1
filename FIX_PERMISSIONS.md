# Fix Service Account Permissions

## 🔴 Current Issue

The service account is missing Cloud Functions permissions:
```
Permission 'cloudfunctions.functions.list' denied
```

**What this means:** The service account can authenticate but can't deploy Cloud Functions (needed for Next.js API routes).

---

## ✅ Solution: Grant Cloud Functions Permissions

### Step 1: Go to Google Cloud IAM Page

**Click this link:**
👉 **https://console.cloud.google.com/iam-admin/iam?project=btc1usd**

### Step 2: Find the Service Account

On the IAM page, look for:
- **Email:** `firebase-adminsdk-xxxxx@btc1usd.iam.gserviceaccount.com`
- **Name:** "Firebase Admin SDK Service Agent"

### Step 3: Edit Permissions

1. **Click the pencil icon** (✏️) next to that service account

2. **Click "ADD ANOTHER ROLE"**

3. **Search for and add these roles:**
   - `Cloud Functions Developer`
   - `Firebase Hosting Admin`
   - `Service Account User`

4. **Click "SAVE"**

---

## 🎯 Quick Visual Guide

```
Google Cloud Console
    ↓
IAM & Admin → IAM
    ↓
Find: firebase-adminsdk-xxxxx@btc1usd.iam.gserviceaccount.com
    ↓
Click Edit (pencil icon)
    ↓
Add Role: Cloud Functions Developer
    ↓
Add Role: Firebase Hosting Admin
    ↓
Add Role: Service Account User
    ↓
Save
    ↓
Re-run GitHub Actions workflow
    ↓
✅ Success!
```

---

## 📝 Detailed Steps with Screenshots Guide

### Step-by-Step Instructions:

1. **Open IAM Page:**
   https://console.cloud.google.com/iam-admin/iam?project=btc1usd

2. **You'll see a table with members/principals**
   - Look for email ending with `@btc1usd.iam.gserviceaccount.com`

3. **Click the pencil/edit icon** on that row

4. **In the "Edit permissions" panel that opens:**
   - You'll see existing roles
   - Click "ADD ANOTHER ROLE"

5. **Select role:**
   - Type: "Cloud Functions Developer"
   - Click on it when it appears

6. **Click "ADD ANOTHER ROLE" again**
   - Type: "Firebase Hosting Admin"
   - Click on it

7. **Click "ADD ANOTHER ROLE" again**
   - Type: "Service Account User"
   - Click on it

8. **Click "SAVE"** at the bottom

---

## 🔍 What Each Role Does

| Role | Why Needed |
|------|------------|
| **Cloud Functions Developer** | Deploy and manage Cloud Functions (Next.js API routes) |
| **Firebase Hosting Admin** | Deploy to Firebase Hosting |
| **Service Account User** | Allow the service account to act on behalf of the project |

---

## ⚡ Alternative: Use Firebase Admin Role

If you want a simpler approach, just grant ONE role:

**Role:** `Firebase Admin`

This includes all the permissions needed for Firebase deployment.

---

## 🚀 After Granting Permissions

### Re-run the Workflow:

1. Go to: https://github.com/btc1usd/btc1/actions
2. Click the failed workflow
3. Click "Re-run all jobs"
4. Wait 5-10 minutes

---

## 📱 Quick Links

| What | Link |
|------|------|
| **Grant Permissions Here** | https://console.cloud.google.com/iam-admin/iam?project=btc1usd |
| **Monitor Workflow** | https://github.com/btc1usd/btc1/actions |
| **Firebase Console** | https://console.firebase.google.com/project/btc1usd |

---

## 🆘 Can't Find the Service Account?

If you can't find the service account:

1. Look for email: `firebase-adminsdk-xxxxx@btc1usd.iam.gserviceaccount.com`
2. Use the search/filter box at the top of the IAM page
3. Make sure you're on the right project (btc1usd)

---

## ✅ Expected Result

After granting permissions and re-running:
- ✅ Build completes
- ✅ Cloud Functions deploy
- ✅ Hosting deploys
- ✅ Live at https://btc1usd.web.app
