# Luma Calendar

A colorful, iPhone-style calendar Progressive Web App with a Next.js frontend and a NestJS/PostgreSQL backend scaffold.

## Recommended Stack

- Frontend: Next.js 16, React 19, TypeScript, Tailwind CSS 4
- Styling choice: Tailwind CSS is the best fit here because the UI is highly interactive and design-token heavy. CSS Modules are fine, but Tailwind keeps the iOS-style polish fast and consistent.
- Backend: NestJS, TypeScript, PostgreSQL, Prisma ORM, JWT auth
- API style: REST, because the app maps cleanly to resources like events, categories, notes, habits, and reminders.

## Project Structure

```text
calendar-app/
  src/app/                 Next.js app shell and PWA metadata
  src/lib/                 Frontend calendar and event domain helpers
  public/                  Manifest, icons, and service worker
  backend/
    prisma/schema.prisma   Full database schema
    src/auth/              Register/login/JWT
    src/users/             Profile endpoints
    src/categories/        Event category endpoints
    src/events/            Event CRUD/search/archive endpoints
    src/tasks/             Event checklist endpoints
    src/reminders/         Reminder endpoints
    src/day-notes/         Per-day note endpoints
    src/habits/            Habit tracking endpoints
    src/birthdays/         Birthday reminder endpoints
```

## Frontend Features

- Month, week, and day views
- Day selection with agenda
- Add, edit, and delete events
- Cancel events without deleting them
- Day timeline displays events inside the hourly schedule
- Search and category filtering
- Custom tags with color picker grid
- Color-coded event categories
- Tasks, alerts, and account tabs
- Separate `/login` and `/signup` pages for multi-user authentication
- Login/signup connect to the backend auth API and calendar data is stored per authenticated user
- Floating action button
- Bottom tab navigation
- Desktop layout optimized with an overview panel while keeping the mobile iPhone look
- Glassmorphism, pastel gradients, rounded native-feeling controls
- PWA manifest, service worker, iOS standalone metadata, safe-area support

## Backend Features Included

- Register and login
- Argon2 password hashing
- JWT bearer auth
- User profile endpoint
- Category CRUD foundation
- Event CRUD, search, filtering, archive
- Prisma schema for users, events, categories, tasks, notes, habits, reminders, birthdays, recurrence, soft delete/archive

## API Endpoints

All protected routes use:

```http
Authorization: Bearer <accessToken>
```

| Method | Endpoint | Purpose |
| --- | --- | --- |
| POST | `/api/auth/register` | Create account |
| POST | `/api/auth/login` | Log in |
| POST | `/api/auth/logout` | Log out |
| GET | `/api/users/me` | Current profile |
| GET | `/api/categories` | List categories |
| POST | `/api/categories` | Create category |
| PATCH | `/api/categories/:id` | Update category |
| GET | `/api/events?from=&to=&q=&categoryId=&priority=&status=` | List/search/filter events |
| POST | `/api/events` | Create event |
| GET | `/api/events/:id` | Event detail |
| PATCH | `/api/events/:id` | Update event |
| PATCH | `/api/events/:id/cancel` | Mark event cancelled and optionally create a reschedule reminder |
| PATCH | `/api/events/:id/undo-cancel` | Restore a cancelled event to scheduled |
| DELETE | `/api/events/:id` | Archive event |
| POST | `/api/tasks` | Add checklist task |
| PATCH | `/api/tasks/:id` | Update checklist task |
| GET | `/api/reminders` | List reminders |
| POST | `/api/reminders` | Create reminder |
| GET | `/api/day-notes?date=` | Read day note |
| POST | `/api/day-notes` | Upsert day note |
| GET | `/api/habits` | List habits |
| POST | `/api/habits` | Create habit |
| POST | `/api/habits/entries` | Log habit entry |
| GET | `/api/birthdays` | List birthdays |
| POST | `/api/birthdays` | Create birthday |

Example register:

```json
{
  "email": "yasmin@example.com",
  "name": "Yasmin",
  "password": "strong-password"
}
```

Example event:

```json
{
  "title": "Design review",
  "startsAt": "2026-05-20T09:30:00.000Z",
  "endsAt": "2026-05-20T10:15:00.000Z",
  "location": "Product room",
  "priority": "HIGH",
  "recurrence": "WEEKLY",
  "allDay": false,
  "pinned": true,
  "links": ["https://example.com/brief"]
}
```

Example cancel event:

```json
{
  "cancellationReason": "The client needs to move the meeting.",
  "createRescheduleReminder": true,
  "reminderAt": "2026-05-21T09:00:00.000Z"
}
```

Cancellation stores:

- `status: CANCELLED`
- `cancellationReason`
- `cancelledAt`
- linked reminder titled `Reschedule: [event title]`
- linked task on the cancelled event

## Setup

Install:

- Node.js LTS
- PostgreSQL
- VS Code
- npm is already working on this machine; pnpm is optional

Frontend:

```bash
cd c:\Users\yasmi\Documents\Calendar\calendar-app
copy .env.example .env.local
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Backend:

```bash
cd c:\Users\yasmi\Documents\Calendar\calendar-app\backend
copy .env.example .env
npm install
npm run prisma:generate
npm run prisma:migrate
npm run dev
```

The API runs on [http://localhost:4000/api](http://localhost:4000/api).

## Connecting Frontend To Backend

Use `NEXT_PUBLIC_API_URL` from `.env.local`.

```ts
const API_URL = process.env.NEXT_PUBLIC_API_URL;

export async function apiFetch(path: string, token?: string) {
  const response = await fetch(`${API_URL}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  if (!response.ok) {
    throw new Error("API request failed");
  }

  return response.json();
}
```

## PWA On iPhone

Deploy over HTTPS, open the site in Safari, tap Share, then Add to Home Screen.

This project includes:

- `public/manifest.webmanifest`
- `public/sw.js`
- `public/register-sw.js`
- iOS web app metadata in `src/app/layout.tsx`
- app icons in `public/icons`
- safe-area viewport support

## Development Environment

Use VS Code with:

- ESLint
- Prettier
- Tailwind CSS IntelliSense
- Prisma
- GitLens
- Error Lens
- Postman or Thunder Client

AI workflow:

- Ask AI to work in small slices: "build auth", "add event recurrence", "write tests".
- Keep schema and API docs open when asking for backend changes.
- Ask for verification commands after each feature.
- Commit after each clean milestone.

## Production Next Steps

- Add frontend API client and auth screens.
- Add proper recurrence expansion service.
- Add reminder scheduling worker.
- Add IndexedDB offline queue and sync conflict handling.
- Add Playwright mobile viewport tests.
- Add rate limiting and refresh-token rotation.
