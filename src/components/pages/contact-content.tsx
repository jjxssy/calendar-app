import { InfoCard, InfoPage } from "@/components/info-page";
import { ContactForm } from "@/components/pages/contact-form";

export function ContactContent() {
  return (
    <InfoPage
      eyebrow="Contact"
      title="Feedback and support"
      intro="Send feedback, report a bug, request a feature, or leave a suggestion."
    >
      <InfoCard title="Message">
        <ContactForm />
      </InfoCard>
    </InfoPage>
  );
}
