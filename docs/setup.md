# Setup: Google sign-in and the database

Aurea Studio needs two things before anyone can sign in:

| Piece | Cost | Backend setting |
|---|---|---|
| Google sign-in (an OAuth client ID) | Free. No billing account needed. | `GOOGLE_CLIENT_ID` |
| A PostgreSQL database | Free with Neon or your own computer. Cloud SQL is paid. | `DATABASE_URL` |

The backend works with any PostgreSQL database, so pick whichever database option below suits you. Everything goes into `backend/.env`:

```bash
cp backend/.env.example backend/.env
```

---

## 1. Google sign-in (free)

An OAuth client ID lives in a Google Cloud project, but it does **not** need billing. You can use any project you already have, or create a new one: projects themselves are free, and you can skip the billing step when creating one.

### 1a. Consent screen

1. Open [console.cloud.google.com](https://console.cloud.google.com) and select (or create) a project.
2. Go to **Google Auth Platform** (search for it, or open **APIs and Services > OAuth consent screen**).
3. **Branding**: App name `Aurea Studio`, a support email, and a developer contact email. Save.
4. **Audience**: choose **External**. While the app is in **Testing**, only the Google accounts listed under **Test users** can sign in (up to 100). Add your own account now.
5. **Data Access**: add the scopes `openid`, `.../auth/userinfo.email`, and `.../auth/userinfo.profile`. They are non-sensitive, so Google does not need to review them.

When you want anyone to be able to sign in, return to **Audience** and click **Publish app**.

### 1b. Client ID

1. Go to **Google Auth Platform > Clients > Create client**.
2. Application type: **Web application**. Name: `Aurea Studio web`.
3. **Authorized JavaScript origins**, add every origin the app is served from:
   - `http://localhost:5173`
   - `http://localhost` (Google requires this one too for local development)
   - your production origin later, for example `https://studio.example.com`
4. **Authorized redirect URIs**: leave empty. The app uses the Google popup, which needs no redirect.
5. Click **Create** and copy the **Client ID** (it ends in `.apps.googleusercontent.com`). Aurea does not use the client secret.

```bash
# backend/.env
GOOGLE_CLIENT_ID=1234567890-abc123.apps.googleusercontent.com
```

New origins can take a few minutes to start working.

---

## 2. The database (choose one)

In every option you only create an empty database. The backend creates its tables on startup from `backend/schema.sql`, and every statement is safe to run again.

### Option A: Neon (free, hosted, recommended)

[Neon](https://neon.tech) runs PostgreSQL for you and has a free plan that is plenty for development and a small launch. No credit card is needed.

1. Sign up at [neon.tech](https://neon.tech) (you can use your Google account).
2. Create a project named `aurea`. Choose PostgreSQL 16 or newer and the region closest to where your backend runs.
3. On the project dashboard, click **Connect** and copy the connection string. It looks like:

   ```
   postgresql://neondb_owner:PASSWORD@ep-example-123456.us-east-2.aws.neon.tech/neondb?sslmode=require
   ```

4. Put it in `backend/.env`, keeping `?sslmode=require` on the end:

   ```bash
   DATABASE_URL=postgresql://neondb_owner:PASSWORD@ep-example-123456.us-east-2.aws.neon.tech/neondb?sslmode=require
   ```

Good to know: on the free plan the database sleeps when idle, so the first request after a quiet period takes a moment longer. You can browse your data in Neon's **Tables** view.

[Supabase](https://supabase.com) works the same way if you prefer it: create a project, open **Connect**, copy the **Session pooler** connection string, and use it as `DATABASE_URL`.

### Option B: PostgreSQL on your Mac (free, development only)

PostgreSQL is already installed with Homebrew. This keeps everything on your machine, which is great for development, but nobody else can reach it.

```bash
brew services start postgresql@17        # starts now and on every login
/opt/homebrew/opt/postgresql@17/bin/createdb aurea
```

```bash
# backend/.env  (Homebrew uses your macOS user name, with no password)
DATABASE_URL=postgresql://localhost:5432/aurea
```

To stop it later: `brew services stop postgresql@17`.

### Option C: Cloud SQL for PostgreSQL (paid)

Use this once you have a Google Cloud project with billing enabled. The smallest instance costs a few dollars a month or more; new Google Cloud accounts may qualify for free trial credit.

```bash
gcloud config set project PROJECT_ID
gcloud services enable sqladmin.googleapis.com

gcloud sql instances create aurea-db \
  --database-version=POSTGRES_16 --edition=ENTERPRISE --tier=db-f1-micro \
  --region=us-central1 --storage-size=10GB --storage-auto-increase --backup-start-time=03:00
gcloud sql databases create aurea --instance=aurea-db
gcloud sql users create aurea_app --instance=aurea-db --password='DB_PASSWORD'
```

Connect from your computer through the Cloud SQL Auth Proxy (an encrypted tunnel; no need to open the database to the internet):

```bash
brew install cloud-sql-proxy
gcloud auth application-default login
cloud-sql-proxy --port 5432 PROJECT_ID:us-central1:aurea-db   # leave running
```

```bash
# backend/.env
DATABASE_URL=postgresql://aurea_app:DB_PASSWORD@127.0.0.1:5432/aurea
```

If the password contains special characters (`@ : / ? #`), URL-encode them.

---

## 3. Run it

```bash
# terminal 1
cd backend && uv sync && uv run uvicorn main:app --port 8000 --reload

# terminal 2
cd frontend && npm install && npm run dev
```

Check that it works:

- `http://localhost:8000/health` shows `"database": "ok"`.
- `http://localhost:5173/signin` shows the **Continue with Google** button.
- Sign in with one of your test users. First-time users answer the questionnaire, then land in the studio.

Just want to try the app before creating the Google client? With a database connected, set `DEV_LOGIN=true` in `backend/.env`. The sign-in page then shows **Continue as local developer**, which only works from your own machine. Never enable it in production.

---

## 4. Going to production

- **Hosting:** the backend is a standard FastAPI app, so any host that runs Python works: Render, Railway, Fly.io, or Google Cloud Run. (Cloud Run has a free monthly allowance but still requires a billing account.) The repo does not include a `Dockerfile` yet; the backend needs its `uv` dependencies plus Chromium for Playwright.
- **Settings:** set `DATABASE_URL`, `GOOGLE_CLIENT_ID`, `ALLOWED_ORIGINS=https://your-app-domain`, and `COOKIE_SECURE=true` on the host. Keep secrets in the host's secret manager, not in the repo.
- **Same site:** serve the app and the API from the same site (for example `studio.example.com` and `api.studio.example.com`). The session cookie is `SameSite=Lax`, which works whenever both share a site. If they must be on unrelated domains, set `COOKIE_SAMESITE=none`.
- **Frontend:** build it with the API address baked in and host `frontend/dist` on any static host (Netlify, Vercel, Cloudflare Pages, Firebase Hosting):

  ```bash
  cd frontend && VITE_API_BASE=https://api.studio.example.com npm run build
  ```

- **Google:** add the production origin to the client's **Authorized JavaScript origins** and publish the consent screen.
- **The AI model:** the pipeline calls Ollama on `localhost`. A hosted backend needs Ollama running somewhere it can reach, or a hosted model.

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| Sign-in page says "database is not connected" | `DATABASE_URL` is missing or wrong, or the database is not running. Check `/health`, then the backend terminal for the error. |
| Sign-in page says "Google sign-in is not configured" | Set `GOOGLE_CLIENT_ID` in `backend/.env` and restart the backend. |
| Google popup shows "origin is not allowed" or "invalid client" | Add the exact origin (scheme, host, and port) to **Authorized JavaScript origins**, wait a few minutes, and retry. |
| "Access blocked: app has not completed verification" | The account is not a **test user** while the app is in Testing. Add it, or publish the app. |
| Signed in, but every request returns 401 | The browser is not sending the cookie. Use the same host name everywhere (`localhost`, not a mix of `localhost` and `127.0.0.1`), and check `ALLOWED_ORIGINS`. |
| Neon or Supabase: `SSL connection is required` | Keep `?sslmode=require` at the end of `DATABASE_URL`. |
| Local Postgres: `connection refused` | Run `brew services start postgresql@17`. |
