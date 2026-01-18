# TV Inventory System

A modern inventory management system built with Express.js, HTML, and Supabase.

## Tech Stack

- **Frontend**: Vanilla HTML/CSS/JavaScript
- **Backend**: Express.js
- **Database**: Supabase (PostgreSQL)
- **Business Logic**: Supabase Edge Functions
- **Deployment**: Vercel

## Project Structure

```
TV/
├── api/
│   └── index.js          # Express.js API
├── public/
│   └── login.html        # Login page
├── supabase/
│   ├── functions/
│   │   └── login/        # Login edge function
│   └── migrations/
│       └── 001_initial_schema.sql
├── package.json
├── vercel.json
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

### 5. Deploy to Vercel

1. Push your code to GitHub
2. Import the project in Vercel
3. Add environment variables in Vercel dashboard
4. Deploy!

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
