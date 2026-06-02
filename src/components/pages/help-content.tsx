import { InfoCard, InfoPage } from "@/components/info-page";

export function HelpContent() {
  return (
    <InfoPage
      eyebrow="Help"
      title="How Arcgenda works"
      intro="A beginner-friendly guide to the main options, what is already active, and what is prepared as a safe placeholder."
    >
      <InfoCard title="Creating and editing events">
        Use the plus button to create an event. Pick a calendar, tag, date, time, notes, location, all-day mode, recurrence, pinned state, and optional reminder. Tap the edit icon on an event card to change it.
      </InfoCard>
      <InfoCard title="Cancelling events and rescheduling">
        Cancel is separate from delete. Cancelled events stay visible with a badge, cancellation reason, and faded styling. You can create a reschedule reminder/task so the follow-up is not lost.
      </InfoCard>
      <InfoCard title="Tasks and event binding">
        Tasks can be standalone or linked to one event. Event cards show linked tasks. You can toggle completion, add a task directly inside an event, link an existing task, unlink it without deleting it, or delete it fully.
      </InfoCard>
      <InfoCard title="Multiple calendars and tags">
        Calendars are big containers such as Personal, Family, School, or Project. Tags are smaller labels such as Health, Study, Errands, or Important. The free plan allows up to 3 calendars total, and shared calendars count too.
      </InfoCard>
      <InfoCard title="Shared calendars and roles">
        One shared calendar is included for free. Owners manage the calendar, editors can help add or change events, and viewers are read-only. Invite email delivery is prepared as a placeholder until a mail service is configured.
      </InfoCard>
      <InfoCard title="Specific event sharing">
        Event sharing is separate from sharing a whole calendar. You can prepare a share for one event with a selected email. Actual invite delivery is not faked yet.
      </InfoCard>
      <InfoCard title="Activity history">
        Shared calendar and event actions are prepared to write simple history such as created, updated, cancelled, archived, and share-prepared entries.
      </InfoCard>
      <InfoCard title="Notifications">
        Notification settings include event reminders, task reminders, daily agenda, reschedule reminders, birthdays, desktop/PWA notifications, quiet hours, sound, vibration, and default reminder timing. Full push delivery needs browser support and a push service.
      </InfoCard>
      <InfoCard title="AI Lite and privacy">
        AI Lite is off by default. Current suggestions are local rule-based text from visible calendar stats. Future OpenAI or Claude integrations would be opt-in. Your data is not sold.
      </InfoCard>
      <InfoCard title="Statistics">
        The Stats tab summarizes total, completed, cancelled, and upcoming events, task completion rate, most used tags, active days, and weekly/monthly summaries.
      </InfoCard>
      <InfoCard title="Get App / PWA install">
        Visit Get App for iPhone, iPad, Android, Windows, and Mac install instructions. iPhone notifications require the app to be installed to the home screen and need supported iOS/browser behavior.
      </InfoCard>
      <InfoCard title="Sync and account settings">
        Google Calendar, Outlook, device calendar sync, export data, Pro, donation, and delete account controls are safe placeholders until real providers are configured.
      </InfoCard>
      <InfoCard title="Profile names">
        Use a general account name for your default identity. Calendar display names let you appear differently in Family, Work, School, or Project calendars.
      </InfoCard>
    </InfoPage>
  );
}
