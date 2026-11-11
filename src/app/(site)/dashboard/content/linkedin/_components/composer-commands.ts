import { CalendarClock, Link2, ListChecks, Sparkles, Wand2 } from "lucide-react";
import type { AiActionContext, ComposerCommand } from "@/components/composer";

/** The command-palette entries for the LinkedIn composer. */
export function buildComposerCommands({
  text,
  empty,
  scheduleDisabled,
  showLink,
  pollActive,
  runAi,
  onSchedule,
  onAttachLink,
  onTogglePoll,
}: {
  text: string;
  empty: boolean;
  scheduleDisabled: boolean;
  showLink: boolean;
  pollActive: boolean;
  runAi: (ctx: AiActionContext) => Promise<string>;
  onSchedule: () => void;
  onAttachLink: () => void;
  onTogglePoll: () => void;
}): ComposerCommand[] {
  return [
    {
      id: "ai-compose",
      label: "Compose with AI",
      hint: "Generate a fresh draft from your brand voice",
      group: "AI",
      icon: Sparkles,
      run: () => {
        void runAi({ op: "compose", text, platform: "linkedin" });
      },
    },
    {
      id: "ai-redraft",
      label: "Rewrite this draft",
      group: "AI",
      icon: Wand2,
      disabled: empty,
      run: () => {
        void runAi({ op: "redraft", text, platform: "linkedin" });
      },
    },
    {
      id: "schedule",
      label: "Schedule for later",
      group: "Publish",
      icon: CalendarClock,
      disabled: scheduleDisabled,
      run: onSchedule,
    },
    {
      id: "add-link",
      label: showLink ? "Link attached" : "Attach a link",
      group: "Compose",
      icon: Link2,
      disabled: showLink || pollActive,
      run: onAttachLink,
    },
    {
      id: "toggle-poll",
      label: pollActive ? "Remove poll" : "Add a poll",
      group: "Compose",
      icon: ListChecks,
      run: onTogglePoll,
    },
  ];
}
