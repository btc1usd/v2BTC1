# Grant Firebase Admin Role - Complete Solution

## 🔴 Current Issue

Service account is missing these permissions:
- `firebase.projects.get`
- `firebasehosting.sites.update`
- And likely others for Cloud Functions

## ✅ Simple Solution: Grant "Firebase Admin" Role

Instead of adding individual roles, grant ONE role that includes everything.

---

## 📋 Step-by-Step Instructions

### Step 1: Open Google Cloud IAM

**Click this link:**
👉 **https://console.cloud.google.com/iam-admin/iam?project=btc1usd**

### Step 2: Find Your Service Account

Look for the email that ends with:
```
@btc1usd.iam.gserviceaccount.com
```

**It will look like:**
```
firebase-adminsdk-xxxxx@btc1usd.iam.gserviceaccount.com
```

### Step 3: Edit the Service Account

1. **Click the pencil icon ✏️** (Edit) next to that service account

2. **You'll see a panel** with current roles

### Step 4: Add Firebase Admin Role

1. **Click "+ ADD ANOTHER ROLE"**

2. **In the "Select a role" dropdown:**
   - Start typing: `Firebase Admin`
   - Click on: **"Firebase Admin"** when it appears

3. **Click "SAVE"** at the bottom

---

## 🎯 What Firebase Admin Role Includes

This ONE role gives all necessary permissions:
- ✅ Firebase project access
- ✅ Firebase Hosting deployment
- ✅ Cloud Functions deployment
- ✅ Cloud Storage access
- ✅ Everything needed for full deployment

---

## 📸 Visual Guide

```
1. IAM Page
   https://console.cloud.google.com/iam-admin/iam?project=btc1usd

2. Find row with:
   firebase-adminsdk-xxxxx@btc1usd.iam.gserviceaccount.com

3. Click ✏️ (pencil icon)

4. Click "+ ADD ANOTHER ROLE"

5. Type: "Firebase Admin"

6. Select: "Firebase Admin"

7. Click "SAVE"
```

---

## ⚠️ Important Notes

### Make Sure You're Editing the RIGHT Service Account

**Correct service account:**
- Email ends with: `@btc1usd.iam.gserviceaccount.com`
- Usually starts with: `firebase-adminsdk-`
- Type: "Service Account"

**Don't edit:**
- Your personal account (ending with @gmail.com)
- Other service accounts
- Default compute accounts

### Verify the Role Was Added

After clicking SAVE:
1. You'll return to the IAM page
2. Find the service account again
3. You should see "Firebase Admin" listed in the Role(s) column

---

## 🔄 After Adding the Role

### Wait 1-2 Minutes

Permissions can take 1-2 minutes to propagate in Google Cloud.

### Then Re-run the Workflow

1. Go to: https://github.com/btc1usd/btc1/actions
2. Click the failed workflow
3. Click "Re-run all jobs"
4. Wait 10 minutes for deployment

---

## 📱 Quick Reference

| Task | Link |
|------|------|
| **Grant Permission** | https://console.cloud.google.com/iam-admin/iam?project=btc1usd |
| **Re-run Workflow** | https://github.com/btc1usd/btc1/actions |
| **Check Firebase** | https://console.firebase.google.com/project/btc1usd |

---

## 🆘 Still Having Issues?

### Alternative Method: Use Firebase Console

1. **Go to Firebase Console:**
   https://console.firebase.google.com/project/btc1usd/settings/serviceaccounts/adminsdk

2. **On that page, you'll see:**
   - Your service account email
   - A link: "Manage service account permissions in Google Cloud Console"

3. **Click that link** - it takes you directly to the right place

4. **Grant "Firebase Admin" role** as described above

---

## ✅ Success Checklist

After adding the role, verify:

- [ ] Opened Google Cloud IAM page
- [ ] Found service account (firebase-adminsdk-xxxxx@btc1usd.iam.gserviceaccount.com)
- [ ] Clicked edit (pencil icon)
- [ ] Added role: "Firebase Admin"
- [ ] Clicked SAVE
- [ ] Saw role appear in the IAM list
- [ ] Waited 1-2 minutes for propagation
- [ ] Ready to re-run workflow

---

## 🎯 Expected Result After Fix

When the deployment runs successfully:
```
✅ Authentication successful
✅ Permissions verified
✅ Building Next.js app
✅ Deploying static files
✅ Deploying Cloud Functions
✅ Site live at https://btc1usd.web.app
```

---

## 📝 Note About Service Account Email

Your service account email should look like:
```
firebase-adminsdk-abc12@btc1usd.iam.gserviceaccount.com
```

The part after `firebase-adminsdk-` will be different for you (it's randomly generated).
