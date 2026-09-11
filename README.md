# TV Inventory System

A modern inventory management system built with Express.js, HTML, and Supabase.

## Tech Stack

- **Frontend**: Vanilla HTML/CSS/JavaScript
- **Backend**: Express.js
- **Database**: Supabase (PostgreSQL)
- **Business Logic**: Supabase Edge Functions
- **Deployment**: Netlify

## Project Structure

```
TitaVapeShop/
├── backend/              # Routes, Middleware & Supabase Client
├── frontend/             # HTML, CSS, client-side JS & static assets
├── supabase/             # Migrations & Database RPC functions
│       └── 001_initial_schema.sql
├── package.json
├── netlify.toml
└── README.md
```

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Set up Supabase

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to SQL Editor and run the migration file: `supabase/migrations/001_initial_schema.sql`
3. Deploy the Edge Function:
   ```bash
   supabase functions deploy login
   ```

### 3. Configure Environment Variables

Create a `.env` file:

```
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 4. Run Locally

```bash
npm run dev
```

Visit `http://localhost:3000`

### 5. Deploy to Netlify

1. Push this project to GitHub and import the repository into Netlify.
2. Use the repository root as the base directory. Leave the build command empty; `netlify.toml` sets the publish directory to `frontend` and functions directory to `netlify/functions`.
3. Add these environment variables in Netlify with the Functions scope (or all scopes):
   - `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
   - `JWT_SECRET` (keep the existing secret)
   - `SMTP_USER`, `SMTP_PASS` for email
   - `APP_URL=https://your-site.netlify.app` (or your custom domain)
   - `NODE_ENV=production`
   - `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` if using Google Drive
   - `GOOGLE_REDIRECT_URI=https://your-site.netlify.app/auth/google/callback`
   - `KEEP_ALIVE_TOKEN` if using the keep-alive endpoint
4. Add the exact new Google redirect URI to the OAuth web client in Google Cloud Console. Update any external keep-alive monitor to the new domain.
5. Deploy, then verify login, protected pages, email, uploads, and Google authentication before switching your custom domain from Vercel. Redeploy after changing function environment variables.

The existing Express app runs inside a Netlify Function using `serverless-http`. All URLs are forwarded to Express so existing page routes, static assets, cookies, and API routes retain their behavior. Local development still uses `npm run dev`.

Netlify Functions impose request size and execution limits independently of Express's 50 MB body parser setting. Test representative image uploads and email requests on the deployed site; larger uploads may need direct storage uploads.

Reference: [Express on Netlify](https://docs.netlify.com/build/frameworks/framework-setup-guides/express/).

## Default Login

- **Username**: admin
- **Password**: admin123

⚠️ **Change the default password after first login!**

## Features

- [x] Login page with modern UI
- [ ] Dashboard
- [ ] Inventory management
- [ ] User management
- [ ] Reports

## License

MIT
