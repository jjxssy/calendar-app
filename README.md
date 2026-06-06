# Arcgenda Calendar

Arcgenda Calendar is a colorful iPhone-style calendar and productivity PWA built with **Next.js**, **React**, **TypeScript**, **Supabase Auth**, **Supabase Postgres**, **Prisma**, and **Tailwind CSS**.

It is designed as a private, account-based calendar workspace where users can manage calendars, events, tasks, reminders, settings, themes, and notifications from one clean app.

## Features

- Account signup and login with Supabase Auth
- Protected calendar workspace
- Remember me session support
- Account settings page
- Light, dark, and system theme preferences saved per user
- Database-first workspace loading
- Calendar views for month, week, and day
- Multiple calendars per account
- Calendar visibility toggles
- Event creation, editing, cancellation, archiving, and restoring
- Event categories with colors and icons
- Standalone tasks and event-linked tasks
- Task views by day, week, and month
- Reminders and notification preferences
- Intro popup with an option to skip it later
- PWA setup with manifest and service worker
- Mobile-friendly iPhone-style interface

## Tech Stack

The app uses:

- **Next.js 16 App Router** for pages and API route handlers
- **React** and **TypeScript** for the frontend
- **Supabase Auth** for signup, login, sessions, and password hashing
- **Supabase Postgres** as the hosted database
- **Prisma 7** for database models and CRUD
- **Tailwind CSS 4** for styling
- **PWA manifest and service worker** for installable app behavior

## Project Structure

```text
src/
  app/
    api/                  # Next.js API routes
    calendar/             # Protected calendar route
    login/                # Login page
    signup/               # Signup page
    account/              # Account settings page
    layout.tsx            # App layout, metadata, theme hydration
    globals.css           # Global theme and UI styles
  components/
    auth/                 # ProtectedRoute and LogoutButton
    brand/                # BrandMark
    calendar-dashboard.tsx
    calendar-dashboard-loader.tsx
  lib/
    api.ts                # Session helpers, sync user, logout helper
    calendar.ts           # Calendar/date helpers
    events.ts             # Event/category types and helpers
    free-tier.ts          # App settings, stats, AI suggestion helpers
  utils/
    supabase/             # Supabase client helpers
prisma/
  schema.prisma           # Prisma schema
  enable-rls.sql          # Supabase RLS policies
public/
  manifest.webmanifest
  sw.js
  icons/
```

## Before You Run

Install:

- Node.js LTS
- npm
- A Supabase project

You need these Supabase values:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `DATABASE_URL`

For `DATABASE_URL`, use the Supabase **Shared Pooler / Session Pooler** URI on port `5432`.

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

# Optional, for closed-app push notifications
NEXT_PUBLIC_VAPID_PUBLIC_KEY=""
VAPID_PUBLIC_KEY=""
VAPID_PRIVATE_KEY=""
VAPID_SUBJECT="mailto:you@example.com"
CRON_SECRET=""
```

The committed `.env.example` should show the required keys without real secrets.

## Install and Prepare

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

That folder is generated and should not be edited manually.

## Database Setup

After the Prisma tables exist, run the Supabase RLS setup:

```bash
npx prisma db execute --file prisma/enable-rls.sql
```

This enables Row Level Security and creates authenticated owner-based policies for the app tables.

If you add new fields to `prisma/schema.prisma`, remember that editing the schema only changes the blueprint. You still need to push the change to Supabase:

```bash
npx prisma db push
npx prisma generate
```

For production, prefer proper Prisma migrations instead of direct `db push`.

## Run the App

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

Important routes:

```text
/          Landing page
/signup    Create account
/login     Login
/calendar  Protected calendar workspace
/account   Protected account settings
```

## Creating an Account

1. Start the app with `npm run dev`.
2. Go to `/signup`.
3. Enter name, email, and password.
4. If Supabase email confirmation is enabled, check your inbox and confirm the email.
5. Log in at `/login`.
6. After login, the app opens `/calendar` on the current day.

For local development, you can temporarily disable email confirmation in Supabase:

```text
Authentication -> Providers -> Email -> Confirm email
```

For production, keep email confirmation on and configure SMTP:

```text
Authentication -> SMTP Settings
```

## Authentication and Protected Routes

The calendar and account pages are protected. If a user is not logged in, they should not see the calendar shell. Instead, the app shows a login-required screen with choices to:

- Log in
- Sign up
- Return home

Sessions are saved with app session helpers in `src/lib/api.ts`.

Remember me behavior:

- Checked: session is saved in `localStorage`
- Not checked: session is saved in `sessionStorage`
- Logout clears both storage locations and signs out from Supabase

## User Settings

User preferences are saved in the database, including:

- Theme: `light`, `dark`, or `system`
- Account display name
- Skip intro setting
- Notification settings
- AI/privacy settings

Theme is applied globally with CSS variables and stored per user in the database.

## API Routes

All app CRUD goes through Next.js route handlers and Prisma.

Supabase direct table queries are not used for main app CRUD. Supabase helpers are used mainly for auth/session support.

| Method | Route | Purpose |
| --- | --- | --- |
| GET | `/api/users/me` | Current synced Prisma user |
| POST | `/api/users/me` | Sync Supabase user into Prisma |
| PATCH | `/api/users/me` | Update account settings such as name/theme/intro |
| GET | `/api/events` | List events |
| POST | `/api/events` | Create event |
| PATCH | `/api/events/[id]` | Update event |
| DELETE | `/api/events/[id]` | Archive event |
| PATCH | `/api/events/[id]/cancel` | Cancel event |
| GET | `/api/tasks` | List tasks |
| POST | `/api/tasks` | Create task |
| PATCH | `/api/tasks/[id]` | Update task |
| DELETE | `/api/tasks/[id]` | Delete task |
| PATCH | `/api/tasks/[id]/unlink-event` | Unlink task from event |
| GET | `/api/categories` | List categories |
| POST | `/api/categories` | Create category |
| GET | `/api/calendars` | List calendars |
| POST | `/api/calendars` | Create calendar |
| PATCH | `/api/calendars/[id]` | Update calendar |
| DELETE | `/api/calendars/[id]` | Delete calendar |
| GET | `/api/reminders` | List reminders |
| POST | `/api/reminders` | Create reminder |
| GET | `/api/settings/notifications` | Load notification settings |
| PATCH | `/api/settings/notifications` | Save notification settings |
| GET | `/api/notifications/subscribe` | Check push subscription config |
| POST | `/api/notifications/subscribe` | Save browser push subscription |
| DELETE | `/api/notifications/unsubscribe` | Remove browser push subscription |
| POST | `/api/notifications/test` | Send test notification |
| POST | `/api/cron/reminders/send-due` | Send due background reminders |

## PWA Notes

Arcgenda includes:

- `public/manifest.webmanifest`
- `public/sw.js`
- iOS standalone metadata in `src/app/layout.tsx`
- safe-area viewport support
- installable app behavior on supported devices

In local development, service worker behavior may be different to avoid stale chunks and hydration issues.

## Closed-App Push Reminders

Closed-app reminders require all of these pieces:

- `VAPID_PUBLIC_KEY`
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`
- `VAPID_SUBJECT`
- a saved browser push subscription from notification settings
- a scheduler calling `POST /api/cron/reminders/send-due`

Generate VAPID keys with:

```bash
npx web-push generate-vapid-keys
```

If `CRON_SECRET` is set, scheduled requests must include:

```text
Authorization: Bearer <CRON_SECRET>
```

The app still runs without VAPID or cron, but notification settings will explain that background reminder delivery is not fully configured.

## Useful Commands

```bash
npm run dev
npm run build
npm start
npx prisma generate
npx prisma db push
npx prisma db execute --file prisma/enable-rls.sql
```

For a clean local restart:

```bash
# stop the dev server first with Ctrl + C
rm -rf .next
npx prisma generate
npm run dev
```

Do not delete `.next` while `npm run dev` is running, because that can cause missing Next manifest errors.

## Troubleshooting

### Signup says email rate limit exceeded

Wait a few minutes, try a different test email, or temporarily disable email confirmation in Supabase while developing.

### App shows stale UI or hydration warnings

Clear site data in the browser:

```text
DevTools -> Application -> Storage -> Clear site data
```

Then restart the dev server.

### Prisma says a column does not exist

This means `prisma/schema.prisma` and the real Supabase database are out of sync.

Run:

```bash
npx prisma db push
npx prisma generate
```

If needed, run the exact SQL migration in Supabase SQL Editor.

### Next shows `.next/dev/...manifest.json` missing

That is usually a local dev cache issue. Stop the dev server first, then run:

```bash
rm -rf .next
npm run dev
```

### Prisma tries to connect to localhost

Make sure `DATABASE_URL` is set in `.env.local` and points to Supabase, not a generated local Prisma Postgres URL.

## Build for Production

```bash
npm run build
npm start
```

Before deploying, test production locally with `npm run build` to catch TypeScript and route errors.

## Notes

Arcgenda is still in active development. Current focus areas include:

- improving auth flow stability
- polishing dark mode across every page
- making protected routes stricter
- improving PWA install and push reminders
- keeping DB settings as the source of truth
