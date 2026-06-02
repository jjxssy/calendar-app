import { InfoCard, InfoPage } from "@/components/info-page";

export function CookiesContent() {
  return (
    <InfoPage
      eyebrow="Needs legal review"
      title="Cookie Policy"
      intro="This placeholder describes expected cookie usage and needs legal review before launch."
    >
      <InfoCard title="Authentication">
        Supabase Auth may use cookies or browser storage to keep users signed in and refresh sessions.
      </InfoCard>
      <InfoCard title="Product data">
        Calendar events, tasks, reminders, and user settings are loaded from the database through the app APIs.
      </InfoCard>
    </InfoPage>
  );
}
