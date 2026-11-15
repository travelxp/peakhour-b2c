import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { eyebrowCls, h2Cls, sectionPad, subCls, wrap } from "./styles";

/** One section: the shared padding, container and heading block, so no template opens a gap of its own. */
export function Section({
  id,
  eyebrow,
  title,
  intro,
  tone = "plain",
  children,
}: {
  id: string;
  eyebrow?: string;
  title: string;
  intro?: ReactNode;
  tone?: "plain" | "muted";
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-h`}
      className={cn(sectionPad, "scroll-mt-20", tone === "muted" && "border-y bg-muted")}
    >
      <div className={wrap}>
        {eyebrow && <p className={eyebrowCls}>{eyebrow}</p>}
        <h2 id={`${id}-h`} className={cn(h2Cls, !eyebrow && "mt-0")}>
          {title}
        </h2>
        {intro && <div className={subCls}>{intro}</div>}
        <div className="mt-7 sm:mt-9">{children}</div>
      </div>
    </section>
  );
}
