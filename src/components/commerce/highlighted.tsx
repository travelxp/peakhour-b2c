import { splitPlaceholders } from "@/lib/knowledge-base";

/** The text with each [bracketed] detail still to fill in highlighted. */
export function Highlighted({ text }: { text: string }) {
  return (
    <>
      {splitPlaceholders(text).map((p, i) =>
        p.placeholder ? (
          <mark key={i} data-kb-placeholder className="rounded bg-warning/20 px-0.5 text-warning-on-tint">
            {p.text}
          </mark>
        ) : (
          <span key={i}>{p.text}</span>
        ),
      )}
    </>
  );
}
