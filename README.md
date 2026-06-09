# Invoice Generator ERP

This ERP application now includes complete email-based Supabase authentication, secure profile storage, and per-user persistence.

## Setup

1. Install dependencies:
   `npm install`
2. Copy `.env.example` to `.env` and fill in your Supabase values:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
3. Optional: keep your `GEMINI_API_KEY` and `APP_URL` values if the project still needs them.

## Environment Variables

Use a `.env` file with the following values:

```env
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

## Supabase Setup

Create a `profiles` table and enable Row Level Security for user-scoped data. Refer to `supabase-setup.sql` for the recommended SQL.

## Run Locally

`npm run dev`

## Deployment

Cloudflare Pages and Vite are supported by reading `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from environment variables.
