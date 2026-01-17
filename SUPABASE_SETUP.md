# Supabase Database Setup Guide

## Step 1: Create the Table

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor** (in the left sidebar)
3. Click **New Query**
4. Copy and paste the contents of `supabase-schema.sql`
5. Click **Run** (or press Ctrl+Enter)

## Step 2: Verify the Table

1. Go to **Table Editor** (in the left sidebar)
2. You should see the `inventory` table
3. Check that it has the following columns:
   - `id` (uuid, primary key)
   - `name` (text)
   - `description` (text, nullable)
   - `quantity` (integer)
   - `price` (numeric)
   - `category` (text, nullable)
   - `date_added` (timestamp)
   - `last_update` (timestamp)

## Step 3: Get Your Supabase Credentials

1. Go to **Project Settings** (gear icon in left sidebar)
2. Click on **API** section
3. Copy these values:
   - **Project URL** → This is your `NEXT_PUBLIC_SUPABASE_URL`
   - **anon/public key** → This is your `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## Step 4: Add Credentials to Your Project

1. In your project root, create a file named `.env.local`
2. Add your credentials:
   ```
   NEXT_PUBLIC_SUPABASE_URL=your_project_url_here
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
   ```

## Security Note

The current SQL policies allow public access (anyone with the anon key can read/write). This is fine for development, but for production you should:

1. Set up authentication (Supabase Auth)
2. Update the RLS policies to only allow authenticated users
3. Or restrict access based on your specific needs

## Testing

After setup, you can test by:
1. Running your Next.js app: `npm run dev`
2. Going to `http://localhost:3000/inventory`
3. You should see an empty inventory list (or errors if credentials are missing)
