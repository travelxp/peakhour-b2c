import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * Full "peakhour.ai" wordmark lockup.
 *
 * Renders both the black and white artwork and toggles them with the `.dark`
 * class (next-themes, `attribute="class"`). This CSS-only swap avoids the
 * hydration flash you'd get from reading the resolved theme in JS, and keeps
 * the mark legible on both light and dark backgrounds.
 *
 * Size via `className` height utilities (e.g. `h-7`); width stays auto.
 */
export function Logo({
  className,
  priority,
}: {
  className?: string;
  priority?: boolean;
}) {
  const common = { width: 680, height: 160, priority };
  return (
    <>
      <Image
        {...common}
        alt="peakhour.ai"
        src="/brand/peakhour-logo-black.png"
        className={cn("h-7 w-auto dark:hidden", className)}
      />
      <Image
        {...common}
        alt="peakhour.ai"
        src="/brand/peakhour-logo-white.png"
        className={cn("hidden h-7 w-auto dark:block", className)}
      />
    </>
  );
}

/**
 * Square Peakhour app-icon mark — the self-contained badge (dark tile + light
 * symbol) used in sidebar lockups where a compact square reads better than the
 * full wordmark. Being self-contained, it needs no theme swap.
 *
 * Size via `className` (e.g. `size-8`).
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <Image
      src="/brand/peakhour-symbol.png"
      alt="Peakhour"
      width={128}
      height={128}
      className={cn("size-8 rounded-lg", className)}
    />
  );
}
