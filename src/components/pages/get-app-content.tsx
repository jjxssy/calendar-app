import { InfoCard, InfoPage } from "@/components/info-page";

export function GetAppContent() {
  return (
    <InfoPage
      eyebrow="Install"
      title="Get Arcgenda"
      intro="Arcgenda is a PWA, so you can install it from your browser without an app store."
    >
      <InfoCard title="iPhone and iPad">
        Open Arcgenda in Safari, tap Share, choose Add to Home Screen, then open it from your home screen. Notifications require iOS support, install-to-home-screen, permission, and a push backend.
      </InfoCard>
      <InfoCard title="Android">
        Open the app in Chrome, tap the menu, then Install app or Add to Home screen. Allow notifications when prompted.
      </InfoCard>
      <InfoCard title="Windows and Mac">
        Open the app in Chrome or Edge and use the install icon in the address bar. Safari on Mac can also add web apps from the Share menu.
      </InfoCard>
      <InfoCard title="Troubleshooting notifications">
        Check browser permissions, quiet hours, system focus modes, and whether the app is installed. Full push notification delivery is planned and not faked in this free build.
      </InfoCard>
    </InfoPage>
  );
}
