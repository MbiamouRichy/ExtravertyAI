import { WebHaptics } from "web-haptics";

type HapticPattern = "success" | "error" | "notification";

export function useHaptics() {
  const haptics = new WebHaptics({ debug: true });

  const playHaptic = (type: HapticPattern) => {
    if (type === "success") {
      haptics.trigger([
        { duration: 30 },
        { delay: 60, duration: 50, intensity: 1 },
      ]);
    } else if (type === "error") {
      haptics.trigger([
        { duration: 40, intensity: 0.7 },
        { delay: 40, duration: 50, intensity: 0.7 },
        { delay: 30, duration: 40, intensity: 1 },
        { delay: 40, duration: 50, intensity: 0.6 },
      ]);
    } else {
      haptics.trigger([{ duration: 35 }], { intensity: 1 });
}
  };

  return { playHaptic };
}
