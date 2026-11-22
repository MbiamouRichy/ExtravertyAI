import { SeverityNumber } from "@opentelemetry/api-logs";
import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-http";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { BatchLogRecordProcessor, LoggerProvider } from "@opentelemetry/sdk-logs";

let loggerProvider: LoggerProvider | null = null;
let logger: ReturnType<LoggerProvider["getLogger"]> | null = null;
let configured = false;

function warnMissingConfiguration(variable: string) {
  if (process.env.NODE_ENV !== "production")
    console.warn(
      `${variable} variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once ${variable} is configured`,
    );
}

/** Configures a logger solely for PostHog lines introduced by this integration. */
export function initPostHogLogs() {
  if (configured) return logger;
  configured = true;

  const token = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST;
  if (!token) {
    warnMissingConfiguration("NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN");
    return null;
  }
  if (!host) {
    warnMissingConfiguration("NEXT_PUBLIC_POSTHOG_HOST");
    return null;
  }

  try {
    loggerProvider = new LoggerProvider({
      resource: resourceFromAttributes({ "service.name": "extravertyai" }),
      processors: [
        new BatchLogRecordProcessor({
          exporter: new OTLPLogExporter({
            url: new URL("/i/v1/logs", host).toString(),
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
          }),
        }),
      ],
    });
    logger = loggerProvider.getLogger("extravertyai.posthog");
    return logger;
  } catch {
    if (process.env.NODE_ENV !== "production")
      console.warn("PostHog log exporter could not be configured.");
    return null;
  }
}

export function emitPostHogLog(
  body: string,
  attributes: Record<string, string> = {},
  severityNumber = SeverityNumber.INFO,
) {
  const posthogLogger = initPostHogLogs();
  posthogLogger?.emit({ body, severityNumber, attributes });
}

/** Long-running workers call this during shutdown; request-serving paths never wait on delivery. */
export async function shutdownPostHogLogs() {
  if (!loggerProvider) return;
  await Promise.race([
    loggerProvider.shutdown(),
    new Promise<void>((resolve) => setTimeout(resolve, 3000)),
  ]).catch(() => undefined);
}
