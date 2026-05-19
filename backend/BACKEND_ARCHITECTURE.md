# Backend Architecture

## Stack Choice

Use NestJS rather than plain Express for this app. Express is simpler for tiny APIs, but this calendar needs auth, validation, modules, Prisma access, reminders, habits, notes, categories, and future notification workers. NestJS gives you controllers, services, dependency injection, guards, pipes, and a clean folder structure from day one.

Recommended stack:

- Node.js + TypeScript
- NestJS
- PostgreSQL
- Prisma ORM
- JWT bearer auth now; add refresh-token rotation before production launch
- REST API
- Argon2 password hashing
- Helmet, CORS allowlist, global validation pipe
- Global rate limiting with `@nestjs/throttler`

## Folder Structure

```text
backend/
  prisma/schema.prisma
  src/
    main.ts
    app.module.ts
    auth/
    users/
    categories/
    events/
    tasks/
    reminders/
    day-notes/
    habits/
    birthdays/
    prisma/
```

Each feature follows the same pattern:

- `*.controller.ts`: HTTP routes
- `*.service.ts`: business logic and Prisma calls
- `dto.ts`: request validation shape where the feature needs strict input validation

## Authentication Flow

1. Client calls `POST /api/auth/register` or `POST /api/auth/login`.
2. Passwords are hashed with Argon2.
3. API returns `{ user, accessToken }`.
4. Frontend stores the token securely for development. For production, prefer an httpOnly secure cookie or refresh-token rotation.
5. Protected routes use `Authorization: Bearer <token>`.
6. `JwtAuthGuard` validates the token and exposes `CurrentUser`.
7. Logout currently returns `{ ok: true }`; production logout should revoke refresh tokens or blacklist active access tokens.

## Core Endpoints

| Method | Endpoint | Purpose |
| --- | --- | --- |
| POST | `/api/auth/register` | Register |
| POST | `/api/auth/login` | Login |
| POST | `/api/auth/logout` | Logout |
| GET | `/api/users/me` | Profile |
| GET | `/api/categories` | List tags/categories |
| POST | `/api/categories` | Create category with color/icon |
| PATCH | `/api/categories/:id` | Update category |
| GET | `/api/events?from=&to=&q=&categoryId=&priority=&status=` | Search/filter events |
| POST | `/api/events` | Create event |
| GET | `/api/events/:id` | Read event |
| PATCH | `/api/events/:id` | Update event |
| PATCH | `/api/events/:id/cancel` | Cancel event and optionally create reschedule reminder |
| PATCH | `/api/events/:id/undo-cancel` | Restore cancelled event |
| DELETE | `/api/events/:id` | Archive event |
| POST | `/api/tasks` | Add event checklist task |
| PATCH | `/api/tasks/:id` | Update task |
| GET | `/api/reminders` | List reminders |
| POST | `/api/reminders` | Create reminder |
| GET | `/api/day-notes?date=` | Read day note |
| POST | `/api/day-notes` | Upsert day note |
| GET | `/api/habits` | List habits |
| POST | `/api/habits` | Create habit |
| POST | `/api/habits/entries` | Log habit entry |
| GET | `/api/birthdays` | List birthdays |
| POST | `/api/birthdays` | Create birthday reminder |

## Example Requests

Register:

```json
{
  "email": "yasmin@example.com",
  "name": "Yasmin",
  "password": "strong-password"
}
```

Create event:

```json
{
  "title": "Design review",
  "startsAt": "2026-05-20T09:30:00.000Z",
  "endsAt": "2026-05-20T10:15:00.000Z",
  "categoryId": "category-id",
  "location": "Product room",
  "links": ["https://example.com"],
  "priority": "HIGH",
  "recurrence": "WEEKLY",
  "allDay": false,
  "pinned": true
}
```

Cancel and create reschedule reminder:

```json
{
  "cancellationReason": "Need to move this meeting.",
  "createRescheduleReminder": true,
  "reminderAt": "2026-05-21T09:00:00.000Z"
}
```

Create category:

```json
{
  "name": "Family",
  "color": "#ff2d55",
  "icon": "heart"
}
```

## Frontend Connection

Set this in `calendar-app/.env.local`:

```bash
NEXT_PUBLIC_API_URL=http://localhost:4000/api
```

Example client helper:

```ts
export async function apiFetch(path: string, token?: string, init?: RequestInit) {
  const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
  });

  if (!response.ok) {
    throw new Error("API request failed");
  }

  return response.json();
}
```

## Local Setup

```bash
cd backend
copy .env.example .env
npm install
npm run prisma:generate
npm run prisma:migrate
npm run dev
```

## Security Checklist

- Use a long random `JWT_SECRET`.
- Keep CORS restricted to your frontend URL.
- Hash passwords with Argon2.
- Add rate limiting before production.
- Rate limiting is enabled globally; tune route-specific limits for auth before launch.
- Prefer httpOnly cookies or refresh-token rotation for production sessions.
- Never expose `DATABASE_URL` to the frontend.
- Validate every request DTO before writing to the database.
