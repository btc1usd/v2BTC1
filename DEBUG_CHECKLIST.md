# Debug Checklist - GitHub Actions Not Working

## 🔍 What We Need to Check

Please go through this checklist step by step:

---

## Step 1: Verify What Type of Key You Added

**Question: What did you add to GitHub secrets?**

❌ **Wrong (won't work):**
- A token that starts with `1//0` (from firebase login:ci)
- Just the private key part
- Any single-line token

✅ **Correct (will work):**
- A complete JSON file content
- Starts with `{`
- Ends with `}`
- Contains "type": "service_account"
- Contains "private_key": "-----BEGIN PRIVATE KEY-----..."

---

## Step 2: Verify Secret Name is EXACTLY Correct

**Go to:** https://github.com/btc1usd/btc1/settings/secrets/actions

**Check:**
- [ ] Secret exists with name: `FIREBASE_SERVICE_ACCOUNT_BTC1USD`
- [ ] NOT lowercase
- [ ] NOT different spelling
- [ ] Exactly matches what the workflow expects

**Screenshot this page and check if the name matches!**

---

## Step 3: Get the Exact Error Message

**Go to:** https://github.com/btc1usd/btc1/actions

**Click the latest failed run**

**Scroll to the error section**

**Look for these specific errors:**

### Error Type A: "Secret not found"
```
Error: Input required and not supplied: firebaseServiceAccount
```
**Fix:** Secret name doesn't match. Must be exactly `FIREBASE_SERVICE_ACCOUNT_BTC1USD`

### Error Type B: "Authentication failed"
```
Error: Failed to authenticate, have you run firebase login?
```
**Fix:** Wrong type of token/key. Need the JSON file content.

### Error Type C: "JSON parse error"
```
SyntaxError: Unexpected token
```
**Fix:** JSON is malformed. Re-copy the complete JSON.

### Error Type D: "Invalid credentials"
```
Error: Invalid credentials
```
**Fix:** Service account might not have correct permissions.

**Which error are you seeing?**

---

## Step 4: Verify the JSON Format

If you used the JSON key, **open the secret in GitHub and check:**

**Should start with:**
```json
{
  "type": "service_account",
  "project_id": "btc1usd",
```

**Should end with:**
```json
  ...
  "client_x509_cert_url": "https://..."
}
```

**Should contain:**
- `"private_key": "-----BEGIN PRIVATE KEY-----\n...`
- `"client_email": "firebase-adminsdk-...@btc1usd.iam.gserviceaccount.com"`

---

## Step 5: Alternative - Try Firebase Init Hosting:GitHub

If the manual method isn't working, try this automated approach:

```bash
# This will set up GitHub integration automatically
firebase init hosting:github
```

**This command will:**
1. Ask for your GitHub repository (btc1usd/btc1)
2. Automatically create the workflow files
3. Automatically add the secret to GitHub
4. Set up everything correctly

**Follow the prompts:**
- Repository: `btc1usd/btc1`
- Set up automatic deployment? `Yes`
- Overwrite existing workflow files? `Yes`

---

## Step 6: Manual Verification

**Let's verify your setup manually:**

### Check 1: Secret Name in Workflow File
```bash
# Run this to see what secret name the workflow expects
cat .github/workflows/firebase-hosting-merge.yml | grep "firebaseServiceAccount"
```

**Expected output:**
```
firebaseServiceAccount: ${{ secrets.FIREBASE_SERVICE_ACCOUNT_BTC1USD }}
```

### Check 2: GitHub Secret Name
**Go to:** https://github.com/btc1usd/btc1/settings/secrets/actions

**Verify:** There's a secret named `FIREBASE_SERVICE_ACCOUNT_BTC1USD`

**These two names MUST match exactly!**

---

## 🎯 Action Plan

**Please do this and tell me the results:**

1. **Go to GitHub secrets:** https://github.com/btc1usd/btc1/settings/secrets/actions
   - What secrets do you see listed?
   - Is `FIREBASE_SERVICE_ACCOUNT_BTC1USD` listed?

2. **Go to failed workflow:** https://github.com/btc1usd/btc1/actions
   - Click the latest failed run
   - What is the EXACT error message?
   - Copy/paste the error here

3. **What did you add as the secret?**
   - The token from `firebase login:ci` (starts with 1//0)?
   - OR the JSON file content from Firebase Console?

---

## 🔄 Fresh Start Method

If nothing works, let's do a **complete fresh start:**

### Method 1: Delete and Recreate Secret

1. **Delete existing secret:**
   - Go to: https://github.com/btc1usd/btc1/settings/secrets/actions
   - Click on `FIREBASE_SERVICE_ACCOUNT_BTC1USD`
   - Click "Remove secret"

2. **Get NEW service account key:**
   - Go to: https://console.firebase.google.com/project/btc1usd/settings/serviceaccounts/adminsdk
   - Click "Generate new private key"
   - Download the JSON file

3. **Add as new secret:**
   - Name: `FIREBASE_SERVICE_ACCOUNT_BTC1USD`
   - Value: Open JSON file, copy ALL content
   - Add secret

4. **Re-run workflow**

### Method 2: Use Firebase CLI to Set Up

```bash
# Run this in your project directory
firebase init hosting:github

# Follow prompts:
# - Repository: btc1usd/btc1
# - Set up automatic deployment: Yes
# - Overwrite workflow files: Yes
```

This will automatically create and add the correct secret.

---

## 📱 Quick Links

| What | Where |
|------|-------|
| View GitHub Secrets | https://github.com/btc1usd/btc1/settings/secrets/actions |
| View Actions Runs | https://github.com/btc1usd/btc1/actions |
| Get Service Account Key | https://console.firebase.google.com/project/btc1usd/settings/serviceaccounts/adminsdk |
| Firebase Project Settings | https://console.firebase.google.com/project/btc1usd/settings/general |

---

## 🆘 Share With Me

To help you better, please share:

1. **Screenshot of your GitHub secrets page** (blur the values, just show the names)
2. **Exact error message** from the failed GitHub Actions run
3. **What type of key/token you added** (firebase login:ci token or JSON file?)

Then I can give you specific instructions to fix it!
