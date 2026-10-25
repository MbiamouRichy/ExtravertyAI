import { ContactChannels } from "./contact-channels";
import { ContactComposer } from "./contact-composer";
import { ContactNextSteps, ContactShortcuts } from "./contact-next-steps";

export function ContactPage() {
  return (
    <>
      <ContactComposer />
      <ContactChannels />
      <ContactNextSteps />
      <ContactShortcuts />
    </>
  );
}
