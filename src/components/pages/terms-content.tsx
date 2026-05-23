import { InfoCard, InfoPage } from "@/components/info-page";

export function TermsContent() {
  return (
    <InfoPage
      eyebrow="Needs legal review"
      title="Terms of Service"
      intro="These placeholder terms are not final legal terms and need review before public launch."
    >
      <InfoCard title="Use of the app">
        Arcgenda is provided as a planning tool. Do not rely on it as the only record for critical medical, legal, financial, or emergency scheduling.
      </InfoCard>
      <InfoCard title="Accounts and content">
        Users are responsible for the events, tasks, reminders, calendar shares, and feedback they create.
      </InfoCard>
      <InfoCard title="Integrations">
        Sync, AI, payment, and notification integrations shown as Coming soon are not active until configured.
      </InfoCard>
    </InfoPage>
  );
}
