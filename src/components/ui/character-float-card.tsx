import { cn } from "@/lib/utils";
import { MonoLabel } from "./mono-label";

interface CharacterFloatCardProps {
  initials: string;
  name: string;
  role: string;
  progressLabel?: string;
  progressValue: number;
  className?: string;
}

function CharacterFloatCard({
  initials,
  name,
  role,
  progressLabel = "AUTONOMY",
  progressValue,
  className,
}: CharacterFloatCardProps) {
  return (
    <div
      className={cn(
        "glass-panel rounded-xl border border-white/5 p-5 shadow-2xl",
        className
      )}
    >
      <div className="mb-3 flex items-center gap-3">
        <div className="h-10 w-10 overflow-hidden rounded-full bg-[--ph-surface-250]">
          <div className="flex h-full w-full items-center justify-center font-display text-xs font-bold text-primary">
            {initials}
          </div>
        </div>
        <div>
          <div className="font-display text-xs font-bold">{name}</div>
          <MonoLabel size="xs" color="muted" className="text-[9px] tracking-tighter">
            {role}
          </MonoLabel>
        </div>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-[--ph-surface-300]">
        <div
          className="h-full bg-primary"
          style={{ width: `${progressValue}%` }}
        />
      </div>
      <div className="mt-2 flex justify-between font-mono text-[9px] text-foreground/40">
        <span>{progressLabel}</span>
        <span>{progressValue}%</span>
      </div>
    </div>
  );
}

export { CharacterFloatCard };
export type { CharacterFloatCardProps };
