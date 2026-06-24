import WhatsappSendMessageForm from "@/components/project/whatsappSendMessageForm";

export default async function ProjectPage({ params }: { params: Promise<{ project: string }> }) {
    const { project } = await params;
  return (
    <WhatsappSendMessageForm  />
  );
}