# Where to Get GitHub Secrets Values

## Understanding the Two Secrets

Your workflow file has two secrets:

```yaml
repoToken: ${{ secrets.GITHUB_TOKEN }}
firebaseServiceAccount: ${{ secrets.FIREBASE_SERVICE_ACCOUNT_BTC1USD }}
```

Let me explain where each comes from:

---

## 1. `secrets.GITHUB_TOKEN` ✅ (Automatic - You Don't Need to Do Anything)

### What is it?
This is **automatically provided by GitHub Actions**. You don't need to create or add this secret.

### Where does it come from?
GitHub automatically creates this token for every workflow run. It's used to allow the workflow to interact with your repository.

### Do you need to do anything?
**NO!** This is already available automatically.

---

## 2. `secrets.FIREBASE_SERVICE_ACCOUNT_BTC1USD` ⚠️ (Manual - You MUST Add This)

### What is it?
This is the **Firebase authentication key** that allows GitHub Actions to deploy to Firebase. **You must add this manually.**

### Where to get it?

#### Method 1: Get Service Account JSON (Recommended)

**Step 1: Go to Firebase Console**

Click this link:
👉 https://console.firebase.google.com/project/btc1usd/settings/serviceaccounts/adminsdk

**Step 2: Generate Key**

1. Click the blue button: **"Generate new private key"**
2. Click **"Generate key"** in the confirmation dialog
3. A JSON file will download: `btc1usd-firebase-adminsdk-xxxxx.json`

**Step 3: Open the JSON File**

Open the downloaded file with Notepad or any text editor. It will look like this:

```json
{
  "type": "service_account",
  "project_id": "btc1usd",
  "private_key_id": "abc123...",
  "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvQI...\n-----END PRIVATE KEY-----\n",
  "client_email": "firebase-adminsdk-xxxxx@btc1usd.iam.gserviceaccount.com",
  "client_id": "123456789...",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/...",
  "universe_domain": "googleapis.com"
}
```

**Step 4: Copy ALL the JSON Content**

- Press Ctrl+A (select all)
- Press Ctrl+C (copy)
- **Copy EVERYTHING from `{` to `}`**

#### Method 2: Use Firebase CLI (Alternative)

```bash
# Run in your terminal
firebase init hosting:github
```

This will automatically set up everything including adding the secret to GitHub.

---

## How to Add the Secret to GitHub

### Step 1: Go to GitHub Secrets Page

Click this link:
👉 **https://github.com/btc1usd/btc1/settings/secrets/actions**

### Step 2: Create New Secret

1. Click **"New repository secret"** (green button)

2. Fill in the form:

   **Name:**
   ```
   FIREBASE_SERVICE_ACCOUNT_BTC1USD
   ```
   ⚠️ **MUST be exactly this - copy/paste it!**

   **Secret:**
   - Paste the ENTIRE JSON content you copied from the downloaded file
   - Make sure it starts with `{` and ends with `}`

3. Click **"Add secret"**

---

## Verification Checklist

After adding the secret, verify:

### ✅ Check 1: Secret Name is Correct

Go to: https://github.com/btc1usd/btc1/settings/secrets/actions

You should see a secret named **exactly**:
```
FIREBASE_SERVICE_ACCOUNT_BTC1USD
```

### ✅ Check 2: Both Secrets Required by Workflow

Your workflow needs these two secrets:

| Secret Name | Where It Comes From | Action Required |
|-------------|---------------------|-----------------|
| `GITHUB_TOKEN` | ✅ Automatic (provided by GitHub) | None - already available |
| `FIREBASE_SERVICE_ACCOUNT_BTC1USD` | ⚠️ Manual (you must add) | **ADD THIS ONE** |

---

## Complete Step-by-Step Guide

### Quick Summary:

1. **Get Firebase Service Account JSON:**
   - Go to: https://console.firebase.google.com/project/btc1usd/settings/serviceaccounts/adminsdk
   - Click "Generate new private key"
   - Download JSON file
   - Open it and copy ALL content

2. **Add to GitHub Secrets:**
   - Go to: https://github.com/btc1usd/btc1/settings/secrets/actions
   - Click "New repository secret"
   - Name: `FIREBASE_SERVICE_ACCOUNT_BTC1USD`
   - Value: Paste the JSON content
   - Click "Add secret"

3. **Re-run Failed Workflow:**
   - Go to: https://github.com/btc1usd/btc1/actions
   - Click latest failed run
   - Click "Re-run all jobs"
   - Wait 5-10 minutes

---

## Visual Guide

```
Firebase Console
    ↓
Settings → Service Accounts
    ↓
Generate New Private Key
    ↓
Download JSON file (btc1usd-firebase-adminsdk-xxxxx.json)
    ↓
Open with Notepad
    ↓
Copy ALL content (Ctrl+A, Ctrl+C)
    ↓
Go to GitHub Repository
    ↓
Settings → Secrets and variables → Actions
    ↓
New repository secret
    ↓
Name: FIREBASE_SERVICE_ACCOUNT_BTC1USD
Value: [Paste JSON]
    ↓
Add secret
    ↓
Re-run workflow
    ↓
✅ Success!
```

---

## Common Mistakes

### ❌ Mistake 1: Using Wrong Type of Key
- Don't use the token from `firebase login:ci`
- Use the JSON file from Firebase Console

### ❌ Mistake 2: Wrong Secret Name
- Must be: `FIREBASE_SERVICE_ACCOUNT_BTC1USD`
- Not: `firebase_service_account` or any other variation

### ❌ Mistake 3: Only Copying Part of JSON
- Must copy EVERYTHING including `{` and `}`
- Don't copy just the private key part

### ❌ Mistake 4: Extra Spaces
- Copy directly from the JSON file
- No extra spaces before or after

---

## Links You Need

| What | Link |
|------|------|
| Get Service Account JSON | https://console.firebase.google.com/project/btc1usd/settings/serviceaccounts/adminsdk |
| Add GitHub Secret | https://github.com/btc1usd/btc1/settings/secrets/actions |
| Monitor Workflow | https://github.com/btc1usd/btc1/actions |

---

## Still Not Working?

If you're still having issues after following these steps:

### Try the Automated Method:

```bash
firebase init hosting:github
```

This command will:
- Automatically generate the service account key
- Automatically add it to GitHub secrets
- Set up everything correctly

Just follow the prompts and it will do everything for you!

---

## Summary

**You need to add only ONE secret manually:**

| Secret | Status | Action |
|--------|--------|--------|
| `GITHUB_TOKEN` | ✅ Automatic | Nothing - already works |
| `FIREBASE_SERVICE_ACCOUNT_BTC1USD` | ⚠️ Manual | **Get from Firebase Console and add to GitHub** |

Follow the steps above to add `FIREBASE_SERVICE_ACCOUNT_BTC1USD` and your deployment will work!
