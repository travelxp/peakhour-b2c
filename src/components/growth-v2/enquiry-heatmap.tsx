import type { LearningResponse } from "@/lib/api/growth-v2";
import { absentReason, figureValue, formatCount } from "@/lib/growth-v2-figure";

/**
 * When outcomes happen, by weekday and time of day (from chart-heatmap-traffic-1).
 *
 * Darker means more. A cell with no figure is hatched and labelled, not shaded as
 * the lowest value: "nobody enquired then" and "we did not measure then" are
 * different statements. The grid scrolls sideways on a narrow screen rather than
 * squeezing its cells.
 */
interface EnquiryHeatmapProps {
  heatmap: LearningResponse["heatmap"];
  /** What one outcome is called, plural. */
  unitPlural: string;
}

export function EnquiryHeatmap({ heatmap, unitPlural }: EnquiryHeatmapProps) {
  const { rows, columns, cells } = heatmap;
  const byKey = new Map(cells.map((c) => [`${c.row}\u0000${c.column}`, c.figure]));
  const values = cells.flatMap((c) => {
    const v = figureValue(c.figure);
    return v === undefined ? [] : [v];
  });
  const max = Math.max(...values, 0);

  if (rows.length === 0 || columns.length === 0 || values.length === 0) {
    return (
      <p data-absent="" className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
        Not enough history yet to show when {unitPlural} happen.
      </p>
    );
  }

  const peak = cells.reduce<{ row: string; column: string; v: number } | undefined>((best, c) => {
    const v = figureValue(c.figure);
    return v !== undefined && (best === undefined || v > best.v) ? { row: c.row, column: c.column, v } : best;
  }, undefined);

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[420px] border-separate border-spacing-1 text-xs" aria-label={`When ${unitPlural} happen`}>
        <thead>
          <tr>
            <th className="w-10" />
            {columns.map((c) => (
              <th key={c} scope="col" className="pb-1 font-normal text-muted-foreground">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r}>
              <th scope="row" className="pr-2 text-right font-normal text-muted-foreground">
                {r}
              </th>
              {columns.map((c) => {
                const f = byKey.get(`${r}\u0000${c}`);
                const v = figureValue(f);
                const isPeak = peak?.row === r && peak.column === c;
                return v === undefined ? (
                  <td
                    key={c}
                    data-absent=""
                    title={absentReason(f) ?? "Not measured"}
                    className="h-6 rounded border border-dashed bg-[repeating-linear-gradient(135deg,transparent_0_4px,var(--muted)_4px_8px)]"
                  />
                ) : (
                  <td
                    key={c}
                    title={`${r} ${c}: ${formatCount(v)}`}
                    className="h-6 rounded text-center font-semibold text-white"
                    style={{ background: `color-mix(in oklch, var(--chart-1) ${Math.round((0.08 + (max > 0 ? v / max : 0) * 0.92) * 100)}%, transparent)` }}
                  >
                    {isPeak ? "peak" : ""}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
