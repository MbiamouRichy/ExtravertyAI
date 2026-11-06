"use client";
import { useEffect, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { useAutosave } from "@/hooks/use-autosave";
import { saveAgentConfiguration } from "@/app/actions/project-settings";
import {
  AGENT_DEFAULTS,
  AgentConfigSchema,
  systemMessageTemplate,
  type AgentConfig,
} from "@/lib/agent-config";
import { AutosaveStatus } from "./autosave-status";
import { AutosaveFieldIcon } from "./autosave-field-indicator";
import { SystemMessageDialog } from "./system-message-dialog";
import {
  AgentBehaviorFields,
  AgentLanguageField,
  AgentLengthField,
  AgentNameField,
  AgentToneField,
  type AgentFieldUpdate,
} from "./agent-fields";

function SectionHeader({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="mb-4">
      <h2 className="text-base! font-semibold! tracking-tight!">{title}</h2>
      <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

/** Page Assistant IA : chaque modification est enregistrée automatiquement. */
export function AgentEditor({
  projectId,
  projectName,
  initial,
  version,
}: {
  projectId: string;
  projectName: string;
  initial: AgentConfig;
  version: number;
}) {
  const form = useForm<AgentConfig>({
    resolver: zodResolver(AgentConfigSchema),
    defaultValues: {
      ...AGENT_DEFAULTS,
      ...initial,
      agentSystemMessage:
        initial.agentSystemMessage || systemMessageTemplate(projectName),
    },
  });
  const config = useWatch({ control: form.control }) as AgentConfig;
  const autosave = useAutosave<AgentConfig>(version, (config, expectedVersion) =>
    saveAgentConfiguration({ projectId, expectedVersion, config }),
  );
  const { reset } = form;
  useEffect(() => {
    if (!autosave.queue.unsaved)
      reset({
        ...initial,
        agentSystemMessage:
          initial.agentSystemMessage || systemMessageTemplate(projectName),
      });
  }, [initial, version, projectName, reset, autosave.queue]);
  // Dernier champ modifié : seul le champ concerné affiche l’enregistrement.
  const [lastEdited, setLastEdited] = useState<keyof AgentConfig | null>(null);
  const nameStatus = lastEdited === "agentName" ? autosave.status : "idle";
  const update: AgentFieldUpdate = (key, value) => {
    setLastEdited(key);
    form.setValue(key, value, { shouldDirty: true, shouldValidate: true });
    const parsed = AgentConfigSchema.safeParse(form.getValues());
    if (!parsed.success) {
      autosave.queue.invalidate();
      void form.trigger();
      return;
    }
    autosave.queue.schedule(
      parsed.data,
      key === "agentName" || key === "agentSystemMessage" ? 600 : 0,
    );
  };
  const fields = { control: form.control, onChange: update };

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void autosave.queue.flush();
      }}
      className="min-w-0 space-y-6"
      noValidate
    >
      <section className="rounded-xl border p-4 sm:p-5">
        <SectionHeader title="Identité" description="Le nom vu par vos clients." />
        <AgentNameField
          {...fields}
          length={config.agentName.length}
          status={nameStatus}
          showStatus
        />
      </section>

      <section className="rounded-xl border p-4 sm:p-5">
        <SectionHeader
          title="Mission"
          description="Ce que l’agent doit faire et ne jamais promettre."
        />
        <Controller
          name="agentSystemMessage"
          control={form.control}
          render={({ fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="agent-system" className="sr-only">
                Message système
              </FieldLabel>
              <SystemMessageDialog
                projectId={projectId}
                config={config}
                onChange={(value) => update("agentSystemMessage", value)}
                onClose={() => void autosave.queue.flush()}
                status={autosave.status}
                saveError={autosave.error}
                error={fieldState.error}
              />
              <p id="agent-system-description" className="sr-only">
                {config.agentSystemMessage.length} caractères sur 12 000
              </p>
              <FieldError id="agent-system-error" errors={[fieldState.error]} />
            </Field>
          )}
        />
      </section>

      <section className="rounded-xl border p-4 sm:p-5">
        <SectionHeader title="Style" description="Sa façon de répondre sur WhatsApp." />
        <div className="space-y-7">
          <AgentToneField {...fields} />
          <AgentLengthField {...fields} />
          <AgentLanguageField {...fields} />
          <AgentBehaviorFields {...fields} />
        </div>
      </section>

      {autosave.status === "error" || autosave.status === "invalid" ? (
        // Plus de texte de progression : seuls les échecs restent écrits.
        <div className="border-t pt-5">
          <AutosaveStatus status={autosave.status} error={autosave.error} />
        </div>
      ) : lastEdited && lastEdited !== "agentName" ? (
        // Autres réglages (interrupteurs, choix) : indicateur sans texte.
        <div className="border-t pt-5">
          <AutosaveFieldIcon status={autosave.status} />
        </div>
      ) : null}
    </form>
  );
}
