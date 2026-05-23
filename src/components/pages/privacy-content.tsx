import { InfoCard, InfoPage } from "@/components/info-page";

export function PrivacyContent() {
  return (
    <InfoPage
      eyebrow="Needs legal review"
      title="Privacy Policy"
      intro="This placeholder explains intended data handling and must be reviewed by a qualified legal professional before public launch."
    >
      <InfoCard title="Data that may be stored">
        Account info, events, tasks, reminders, calendars, categories, notification preferences, sharing metadata, activity history, AI privacy preferences, and feedback messages.
      </InfoCard>
      <InfoCard title="Services">
        The app currently uses Supabase and may be deployed on Vercel. Google, Outlook, device calendar sync, payment providers, and AI providers may be added later only when clearly configured.
      </InfoCard>
      <InfoCard title="AI and privacy">
        AI Lite is disabled by default and rule-based locally in this build. User data is not sold. Future AI providers would require explicit opt-in and clearer disclosures.
      </InfoCard>
    </InfoPage>
  );
}
