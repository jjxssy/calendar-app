alter table public."User" enable row level security;
alter table public."Calendar" enable row level security;
alter table public."CalendarMember" enable row level security;
alter table public."Event" enable row level security;
alter table public."Category" enable row level security;
alter table public."Task" enable row level security;
alter table public."Reminder" enable row level security;
alter table public."NotificationDelivery" enable row level security;
alter table public."EventShare" enable row level security;
alter table public."ActivityHistory" enable row level security;
alter table public."NotificationPreference" enable row level security;
alter table public."PushSubscription" enable row level security;
alter table public."Feedback" enable row level security;
alter table "User" add COLUMN if not exists "skipIntro" boolean not null default false;

drop policy if exists "Users can manage own user row" on public."User";
create policy "Users can manage own user row"
on public."User"
for all
to authenticated
using (id = (select auth.uid())::text)
with check (id = (select auth.uid())::text);

drop policy if exists "Users can manage own calendars" on public."Calendar";
create policy "Users can manage own calendars"
on public."Calendar"
for all
to authenticated
using ("ownerId" = (select auth.uid())::text)
with check ("ownerId" = (select auth.uid())::text);

drop policy if exists "Users can read shared calendar memberships" on public."CalendarMember";
create policy "Users can read shared calendar memberships"
on public."CalendarMember"
for select
to authenticated
using (
  "userId" = (select auth.uid())::text
  or exists (
    select 1 from public."Calendar"
    where public."Calendar".id = "calendarId"
      and public."Calendar"."ownerId" = (select auth.uid())::text
  )
);

drop policy if exists "Calendar owners can manage members" on public."CalendarMember";
create policy "Calendar owners can manage members"
on public."CalendarMember"
for all
to authenticated
using (
  exists (
    select 1 from public."Calendar"
    where public."Calendar".id = "calendarId"
      and public."Calendar"."ownerId" = (select auth.uid())::text
  )
)
with check (
  exists (
    select 1 from public."Calendar"
    where public."Calendar".id = "calendarId"
      and public."Calendar"."ownerId" = (select auth.uid())::text
  )
);

drop policy if exists "Users can manage own events" on public."Event";
create policy "Users can manage own events"
on public."Event"
for all
to authenticated
using ("userId" = (select auth.uid())::text)
with check ("userId" = (select auth.uid())::text);

drop policy if exists "Users can manage own event shares" on public."EventShare";
create policy "Users can manage own event shares"
on public."EventShare"
for all
to authenticated
using (
  "userId" = (select auth.uid())::text
  or exists (
    select 1 from public."Event"
    where public."Event".id = "eventId"
      and public."Event"."userId" = (select auth.uid())::text
  )
)
with check (
  exists (
    select 1 from public."Event"
    where public."Event".id = "eventId"
      and public."Event"."userId" = (select auth.uid())::text
  )
);

drop policy if exists "Users can read own activity" on public."ActivityHistory";
create policy "Users can read own activity"
on public."ActivityHistory"
for select
to authenticated
using (
  "userId" = (select auth.uid())::text
  or exists (
    select 1 from public."Event"
    where public."Event".id = "eventId"
      and public."Event"."userId" = (select auth.uid())::text
  )
  or exists (
    select 1 from public."Calendar"
    where public."Calendar".id = "calendarId"
      and public."Calendar"."ownerId" = (select auth.uid())::text
  )
);

drop policy if exists "Users can create own activity" on public."ActivityHistory";
create policy "Users can create own activity"
on public."ActivityHistory"
for insert
to authenticated
with check ("userId" = (select auth.uid())::text);

drop policy if exists "Users can manage own notification preferences" on public."NotificationPreference";
create policy "Users can manage own notification preferences"
on public."NotificationPreference"
for all
to authenticated
using ("userId" = (select auth.uid())::text)
with check ("userId" = (select auth.uid())::text);

drop policy if exists "Users can read own notification deliveries" on public."NotificationDelivery";
create policy "Users can read own notification deliveries"
on public."NotificationDelivery"
for select
to authenticated
using ("userId" = (select auth.uid())::text);

drop policy if exists "Users can manage own push subscriptions" on public."PushSubscription";
create policy "Users can manage own push subscriptions"
on public."PushSubscription"
for all
to authenticated
using ("userId" = (select auth.uid())::text)
with check ("userId" = (select auth.uid())::text);

drop policy if exists "Users can create own feedback" on public."Feedback";
create policy "Users can create own feedback"
on public."Feedback"
for insert
to authenticated
with check ("userId" = (select auth.uid())::text or "userId" is null);

drop policy if exists "Users can read own feedback" on public."Feedback";
create policy "Users can read own feedback"
on public."Feedback"
for select
to authenticated
using ("userId" = (select auth.uid())::text);

drop policy if exists "Users can manage own categories" on public."Category";
create policy "Users can manage own categories"
on public."Category"
for all
to authenticated
using ("userId" = (select auth.uid())::text)
with check ("userId" = (select auth.uid())::text);

drop policy if exists "Users can manage own tasks" on public."Task";
create policy "Users can manage own tasks"
on public."Task"
for all
to authenticated
using ("userId" = (select auth.uid())::text)
with check ("userId" = (select auth.uid())::text);

drop policy if exists "Users can manage own reminders" on public."Reminder";
create policy "Users can manage own reminders"
on public."Reminder"
for all
to authenticated
using ("userId" = (select auth.uid())::text)
with check ("userId" = (select auth.uid())::text);
