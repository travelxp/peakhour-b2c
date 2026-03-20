import { cn } from "@/lib/utils";
import { MonoLabel } from "./mono-label";

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
        {/* Image / avatar area with name overlay */}
        <div className="relative h-75 overflow-hidden bg-[--ph-surface-150]">
          <div className="absolute inset-0 bg-linear-to-t from-background to-transparent" />
          <div className="flex h-full items-center justify-center">
            <span className="font-display text-6xl font-bold text-[--ph-surface-300]">
              {initials}
            </span>
          </div>
          <div className="absolute bottom-6 left-6">
            <h3 className="font-display text-3xl font-bold">{name}</h3>
            <MonoLabel size="xs" color="primary" className="tracking-widest">
              {role}
            </MonoLabel>
          </div>
        </div>

        {/* Content */}
        <div className="space-y-6 p-8">
          {/* Stats grid with background boxes */}
          <div className="grid grid-cols-3 gap-4">
            {stats.map((stat) => (
              <div
                key={stat.label}
                className="rounded bg-[--ph-bg-shell] p-3 text-center"
              >
                <div className="font-display text-xl font-bold">
                  {stat.value}
                </div>
                <MonoLabel size="xs" color="faint">
                  {stat.label}
                </MonoLabel>
              </div>
            ))}
          </div>

          <p className="text-sm italic leading-relaxed text-foreground/60">
            &ldquo;{quote}&rdquo;
          </p>

          <button className="w-full border border-border/30 py-4 text-xs font-bold uppercase tracking-[0.2em] transition-all group-hover:border-primary group-hover:text-primary">
            View Analytics Stack
          </button>
        </div>
      </div>
    </div>
  );
}

export { CharacterShowcaseCard };
export type { CharacterShowcaseCardProps };
