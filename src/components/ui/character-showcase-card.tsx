import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { MonoLabel } from "./mono-label";
import { StatBlock } from "./stat-block";

interface CharacterShowcaseCardProps {
  initials: string;
  name: string;
  role: string;
  quote: string;
  stats: ReadonlyArray<{ readonly label: string; readonly value: string }>;
  className?: string;
}

function CharacterShowcaseCard({
  initials,
  name,
  role,
  quote,
  stats,
  className,
}: CharacterShowcaseCardProps) {
  return (
    <div
      className={cn(
        "group w-full rounded-lg bg-[--ph-surface-200] p-1 transition-all duration-300 hover:bg-[--ph-accent-muted] md:w-112.5",
        className
      )}
    >
      <div className="h-full overflow-hidden rounded-lg bg-background">
        {/* Avatar area */}
        <div className="relative h-75 overflow-hidden bg-[--ph-surface-150]">
          <div className="absolute inset-0 bg-linear-to-t from-background to-transparent" />
          <div className="flex h-full items-center justify-center">
            <span className="font-display text-6xl font-bold text-[--ph-surface-300]">
              {initials}
            </span>
          </div>
        </div>

        {/* Content */}
        <div className="p-8">
          <h3 className="font-display text-2xl font-bold">{name}</h3>
          <MonoLabel size="xs" color="primary" className="mt-1 tracking-widest">
            {role}
          </MonoLabel>
          <p className="mt-4 text-sm italic text-foreground/50">
            &ldquo;{quote}&rdquo;
          </p>

          {/* Stats grid */}
          <div className="mt-6 grid grid-cols-3 gap-4 border-t border-border pt-6">
            {stats.map((stat) => (
              <StatBlock
                key={stat.label}
                label={stat.label}
                value={stat.value}
                valueSize="md"
              />
            ))}
          </div>

          <button className="mt-6 flex w-full items-center justify-center gap-2 rounded-md border border-border py-3 text-sm font-medium transition-colors hover:border-primary hover:text-primary">
            View Analytics Stack
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

export { CharacterShowcaseCard };
export type { CharacterShowcaseCardProps };
