export type ResponseSample = { receivedAt: string; sentAt: string };
export function responseTimeSeries(
  samples: ResponseSample[],
  now: string,
  timeZone: string,
) {
  const keyFormat = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const today = keyFormat.format(new Date(now));
  const days = Array.from({ length: 7 }, (_, index) => {
    const day = new Date(today + "T12:00:00Z");
    day.setUTCDate(day.getUTCDate() - 6 + index);
    const key = day.toISOString().slice(0, 10);
    return {
      date: key,
      day: new Intl.DateTimeFormat("fr-FR", {
        weekday: "short",
        timeZone: "UTC",
      }).format(day),
      values: [] as number[],
    };
  });
  for (const sample of samples) {
    const sent = new Date(sample.sentAt);
    const received = new Date(sample.receivedAt);
    const seconds = (sent.getTime() - received.getTime()) / 1000;
    if (
      !Number.isFinite(seconds) ||
      seconds < 0 ||
      sent.getTime() > new Date(now).getTime()
    )
      continue;
    days
      .find((day) => day.date === keyFormat.format(sent))
      ?.values.push(seconds);
  }
  return days.map(({ date, day, values }) => {
    values.sort((a, b) => a - b);
    const half = Math.floor(values.length / 2);
    return {
      date,
      day,
      count: values.length,
      seconds: values.length
        ? values.length % 2
          ? values[half]
          : (values[half - 1] + values[half]) / 2
        : null,
    };
  });
}
export function formatResponseTime(seconds: number) {
  if (seconds < 1) return "< 1 s";
  if (seconds < 60)
    return (
      new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(
        seconds,
      ) + " s"
    );
  return (
    new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(
      seconds / 60,
    ) + " min"
  );
}
