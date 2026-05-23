import { InfoCard, InfoPage } from "@/components/info-page";

export function CookiesContent() {
  return (
    <InfoPage
      eyebrow="Needs legal review"
      title="Cookie Policy"
      intro="This placeholder describes expected cookie and local storage usage and needs legal review before launch."
    >
      <InfoCard title="Authentication">
        Supabase Auth may use cookies or browser storage to keep users signed in and refresh sessions.
      </InfoCard>
      <InfoCard title="Local preferences">
        The app may use local storage for local calendar UI state, settings, PWA cache, and migration keys.
      </InfoCard>
    </InfoPage>
  );
}
