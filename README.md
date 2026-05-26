# Arcgenda Calendar

Arcgenda Calendar is a colorful iPhone-style calendar PWA built with Next.js, React, TypeScript, Supabase Auth, Supabase Postgres, and Prisma.

The current app uses:

- Next.js 16 app router for the frontend and API route handlers
- Supabase Auth for signup, login, sessions, and password hashing
- Supabase Postgres for the database
- Prisma 7 for database CRUD
- Tailwind CSS 4 for styling

## Before You Run

Install:

- Node.js LTS
- npm
- A Supabase project

You need these Supabase values:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `DATABASE_URL`

For `DATABASE_URL`, copy the Supabase **Shared Pooler / Session pooler** URI on port `5432`.

Example shape:

```env
DATABASE_URL="postgresql://postgres.PROJECT_REF:YOUR_PASSWORD@aws-0-eu-west-1.pooler.supabase.com:5432/postgres"
```

Keep `DATABASE_URL` private. Never prefix it with `NEXT_PUBLIC_`.

## Environment Setup

Create `.env.local` in the project root:

```env
NEXT_PUBLIC_SUPABASE_URL="https://your-project-ref.supabase.co"
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="your-publishable-key"
DATABASE_URL="your-private-supabase-postgres-url"
```

The committed `.env.example` shows the required keys without real secrets.

## Install And Prepare

From the project root:

```bash
npm install
npx prisma generate
npx prisma db push
```

The Prisma client is generated into:

```text
src/generated/prisma
```

That folder is ignored because it is generated.

## Supabase Security Setup

The public Prisma tables need Row Level Security enabled in Supabase.

This project includes:

```text
prisma/enable-rls.sql
```

Run it after your tables exist:

```bash
npx prisma db execute --file prisma/enable-rls.sql
```

It enables RLS and adds owner-only authenticated policies for:

- `User`
- `Event`
- `Category`
- `Task`
- `Reminder`

## Run The App

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

Signup page:

```text
http://localhost:3000/signup
```

Login page:

```text
http://localhost:3000/login
```

## Creating An Account

1. Start the app with `npm run dev`.
2. Go to `/signup`.
3. Enter name, email, and password.
4. If Supabase email confirmation is enabled, check your inbox and confirm the email.
5. Log in at `/login`.

For local development, you can temporarily disable email confirmation in Supabase:

```text
Authentication -> Providers -> Email -> Confirm email
```

For production, keep email confirmation on and configure SMTP:

```text
Authentication -> SMTP Settings
```

## API Routes

All CRUD goes through Next.js route handlers and Prisma.

Supabase table queries are not used for app CRUD. Supabase helpers are used for auth/session support.

Available API routes:

| Method | Route | Purpose |
| --- | --- | --- |
| GET | `/api/users/me` | Current synced Prisma user |
| POST | `/api/users/me` | Sync Supabase user into Prisma |
| GET | `/api/events` | List events |
| POST | `/api/events` | Create event |
| PATCH | `/api/events/[id]` | Update event |
| DELETE | `/api/events/[id]` | Archive event |
| PATCH | `/api/events/[id]/cancel` | Cancel event and optionally create reschedule task/reminder |
| GET | `/api/tasks` | List tasks |
| POST | `/api/tasks` | Create task |
| PATCH | `/api/tasks/[id]` | Update task |
| DELETE | `/api/tasks/[id]` | Delete task |
| PATCH | `/api/tasks/[id]/unlink-event` | Unlink task from event |
| GET | `/api/categories` | List categories |
| POST | `/api/categories` | Create category |
| GET | `/api/reminders` | List reminders |
| POST | `/api/reminders` | Create reminder |

## PWA Notes

Arcgenda Calendar includes:

- `public/manifest.webmanifest`
- `public/sw.js`
- `public/register-sw.js`
- iOS standalone metadata in `src/app/layout.tsx`
- safe-area viewport support

In local development, the service worker unregisters itself and clears caches to avoid stale Next.js chunks and hydration errors.

## Closed-App Push Reminders

Closed-app reminders require all of these pieces:

- `VAPID_PUBLIC_KEY` and `NEXT_PUBLIC_VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`
- `VAPID_SUBJECT`
- a saved browser push subscription from the notification settings screen
- a scheduler calling `POST /api/cron/reminders/send-due`

Generate VAPID keys with:

```bash
npx web-push generate-vapid-keys
```

For Vercel, `vercel.json` runs the cron route every minute. If `CRON_SECRET` is set, scheduled requests must include:

```text
Authorization: Bearer <CRON_SECRET>
```

The app will still run if VAPID or cron is missing, but notification settings will show that background reminder delivery is not fully configured.

## Useful Commands

```bash
npm run dev
npm run lint
npm run build
npx prisma generate
npx prisma db push
npx prisma db execute --file prisma/enable-rls.sql
```

## Troubleshooting

If signup says **email rate limit exceeded**, wait a few minutes, try a different test email, or temporarily disable email confirmation in Supabase while developing.

If the app shows stale UI or hydration warnings, clear site data in the browser:

```text
DevTools -> Application -> Storage -> Clear site data
```

If Prisma tries to connect to `localhost`, make sure `DATABASE_URL` is set in `.env.local` and points to Supabase, not a generated local Prisma Postgres URL.
