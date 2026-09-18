"use client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type React from "react";

export type FREQUENCY = "Mensuel" | "Annuel";

type FrequencyToggleProps = React.ComponentProps<"div"> & {
  frequency: FREQUENCY;
  setFrequency: React.Dispatch<React.SetStateAction<FREQUENCY>>;
  frequencies?: FREQUENCY[];
};

export function FrequencyToggle({
  frequency,
  setFrequency,
  frequencies = ["Mensuel", "Annuel"],
  className,
  ...props
}: FrequencyToggleProps) {
  return (
    <div
      className={cn(
        "mx-auto flex w-fit rounded-xl border bg-card p-1 shadow-xs",
        className,
      )}
      {...props}
    >
      {frequencies.map((freq) => (
        <Button
          variant={frequency === freq ? "default" : "ghost"}
          aria-pressed={frequency === freq}
          className="px-4 capitalize"
          key={freq}
          onClick={() => setFrequency(freq)}
          type="button"
        >
          <span className="relative z-10">{freq}</span>
        </Button>
      ))}
    </div>
  );
}
