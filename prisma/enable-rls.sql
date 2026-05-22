alter table public."User" enable row level security;
alter table public."Event" enable row level security;
alter table public."Category" enable row level security;
alter table public."Task" enable row level security;
alter table public."Reminder" enable row level security;

drop policy if exists "Users can manage own user row" on public."User";
create policy "Users can manage own user row"
on public."User"
for all
to authenticated
using (id = (select auth.uid())::text)
with check (id = (select auth.uid())::text);

drop policy if exists "Users can manage own events" on public."Event";
create policy "Users can manage own events"
on public."Event"
for all
to authenticated
using ("userId" = (select auth.uid())::text)
with check ("userId" = (select auth.uid())::text);

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
