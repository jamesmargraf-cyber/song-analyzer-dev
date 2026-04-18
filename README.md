# Stereo Map App — Deployment Guide

## Files in this project

```
index.html      Login / landing page
student.html    Student activity (song list + stereo map)
teacher.html    Teacher dashboard (manage songs + progress)
style.css       Shared styles
app.js          Supabase auth + shared utilities
map.js          Stereo map drag engine
schema.sql      Database setup (run once in Supabase)
netlify.toml    Netlify config
```

---

## Step 1 — Run the database schema

1. Go to your Supabase dashboard
2. Click **SQL Editor** in the left sidebar
3. Paste the entire contents of `schema.sql` and click **Run**
4. You should see "Success" for each statement

---

## Step 2 — Deploy to Netlify

1. Zip all the files (everything except this README and schema.sql)
   OR push them to a GitHub repo
2. In Netlify: **Add new site → Deploy manually** (drag the zip)
   OR connect your GitHub repo
3. No build settings needed — this is a static site

---

## Step 3 — Add your domain

1. In Netlify: **Domain settings → Add custom domain**
2. Follow Netlify's instructions to point your domain's DNS

---

## Step 4 — Configure Google OAuth redirect

1. Go to Google Cloud Console → your OAuth client
2. Under **Authorized redirect URIs**, make sure this is listed:
   `https://hmaplzcwhunonyrntnvr.supabase.co/auth/v1/callback`
3. Also add your live site URL if needed (usually not required for Supabase OAuth)

---

## Step 5 — Make yourself a teacher

1. Open your deployed site and sign in with your school Google account
2. Go to your Supabase dashboard → **SQL Editor**
3. Run this (replace with your actual email):
   ```sql
   update profiles set role = 'teacher' where email = 'your.email@school.edu';
   ```
4. Sign out and back in — you'll now see the Teacher Dashboard

---

## Adding more teachers later

Run the same SQL update for any other teacher emails:
```sql
update profiles set role = 'teacher' where email = 'colleague@school.edu';
```

---

## Moving to a school domain

1. Add the new domain in Netlify (Domain settings)
2. Update the authorized redirect URIs in Google Cloud Console if needed
3. Supabase config doesn't need to change — the backend URL stays the same
