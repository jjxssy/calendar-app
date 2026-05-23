import { InfoCard, InfoPage } from "@/components/info-page";

export function FeaturesContent() {
  return (
    <InfoPage
      eyebrow="Features"
      title="Everything included in Arcgenda"
      intro="A full tour of the free Arcgenda experience: colorful calendars, task binding, reminders, collaboration, stats, AI-lite suggestions, and PWA install support."
    >
      <InfoCard title="Multiple calendars">
        Create up to 3 free calendars for areas like Family, School, Project, or Personal planning. Shared calendars count toward the same free limit so the rules stay simple.
      </InfoCard>
      <InfoCard title="Categories and tags">
        Tags describe what an event is about, while calendars describe where it belongs. This keeps Health, Study, Errands, Social, Fitness, Important, and Creative labels useful without replacing calendars.
      </InfoCard>
      <InfoCard title="Tasks linked to events">
        Tasks can be independent or linked to one event. Linked tasks appear in event details, can be completed there, unlinked without deletion, or deleted fully when you choose.
      </InfoCard>
      <InfoCard title="Cancellation flow">
        Cancelling is separate from deleting. Cancelled events keep their reason, timestamp, faded styling, badge, and linked tasks, with reschedule reminder support.
      </InfoCard>
      <InfoCard title="Shared calendar basics">
        Free users can use one shared calendar with owner, editor, and viewer roles. The app prepares activity history such as created by and last edited by.
      </InfoCard>
      <InfoCard title="Specific event sharing">
        Share one event without sharing a whole calendar. The UI and data structure are prepared, while real invite delivery remains safely marked until an email backend is configured.
      </InfoCard>
      <InfoCard title="Notifications and reminders">
        Arcgenda organizes event reminders, task reminders, daily agenda reminders, reschedule reminders, birthday reminders, desktop notifications, and PWA notification settings.
      </InfoCard>
      <InfoCard title="Statistics dashboard">
        View total events, completed events, cancelled events, upcoming plans, task completion rate, most used tags, active days, and weekly or monthly summary text.
      </InfoCard>
      <InfoCard title="AI Lite">
        AI Lite is optional, off by default, and currently rule-based. It can suggest scheduling ideas from visible app state without requiring a paid AI API key.
      </InfoCard>
      <InfoCard title="Installable PWA">
        Arcgenda is prepared to install from the browser on iPhone, Android, Windows, and Mac, with clear notes about notification limits.
      </InfoCard>
    </InfoPage>
  );
}
