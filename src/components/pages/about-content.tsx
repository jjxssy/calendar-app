import { InfoCard, InfoPage } from "@/components/info-page";

export function AboutContent() {
  return (
    <InfoPage
      eyebrow="About"
      title="About Arcgenda"
      intro="Arcgenda is a cozy productivity calendar for events, tasks, reminders, shared planning, and privacy-first AI-lite insights."
    >
      <InfoCard title="Free plan focus">
        The free experience includes up to 3 calendars, one shared calendar, task/event linking, local statistics, notification settings, and rule-based AI Lite.
      </InfoCard>
      <InfoCard title="Roadmap">
        Google Calendar sync, Outlook sync, device calendar sync, full push notifications, donations, and Pro are prepared as placeholders until real integrations are configured.
      </InfoCard>
    </InfoPage>
  );
}
