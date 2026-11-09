import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { FigureValue, MoneyValue } from "./figure-value";
import { KpiCard } from "./kpi-card";

const html = (node: React.ReactElement) => renderToStaticMarkup(node);

describe("FigureValue: absent is never 0", () => {
  it("renders a labelled absence for an absent figure, with the reason, and no digit", () => {
    const out = html(<FigureValue figure={{ absent: "No holdout reading yet" }} />);
    expect(out).toContain("Not available");
    expect(out).toContain("No holdout reading yet");
    expect(out).toContain("data-absent");
    expect(out).not.toMatch(/\d/);
  });

  it("prints the reason inline only when asked", () => {
    const quiet = html(<FigureValue figure={{ absent: "why" }} />);
    const loud = html(<FigureValue figure={{ absent: "why" }} showReason />);
    expect(quiet).toContain("sr-only");
    expect(loud).toContain("(why)");
  });

  it("renders a real zero as 0, so zero and absent are different on screen", () => {
    const zero = html(<FigureValue figure={{ value: 0 }} />);
    expect(zero).toContain(">0<");
    expect(zero).not.toContain("Not available");
  });

  it("renders an undefined figure as an absence, not 0", () => {
    const out = html(<FigureValue figure={undefined} />);
    expect(out).toContain("Not available");
    expect(out).not.toMatch(/\d/);
  });

  it("uses the formatter for a present value", () => {
    expect(html(<FigureValue figure={{ value: 0.65 }} format={(n) => `${Math.round(n * 100)}%`} />)).toContain("65%");
  });
});

describe("MoneyValue", () => {
  it("formats a present amount in its own currency", () => {
    expect(html(<MoneyValue money={{ value: 13940, currency: "INR" }} />)).toContain("13,940");
  });

  it("renders a labelled absence, never a zero amount", () => {
    const out = html(<MoneyValue money={{ absent: "Not connected" }} />);
    expect(out).toContain("Not available");
    expect(out).not.toMatch(/\d/);
  });
});

describe("KpiCard", () => {
  it("shows an absent figure and an absent change as absences, not 0 and 0%", () => {
    const out = html(<KpiCard label="Extra bookings" figure={{ absent: "too early" }} change={{ absent: "no prior" }} />);
    expect(out).toContain("Not available");
    expect(out).toContain("No comparison available");
    expect(out).not.toContain("0%");
    expect(out).not.toMatch(/>0</);
  });

  it("colours a falling cost green and a falling count red", () => {
    const cost = html(<KpiCard label="Cost" figure={{ value: 410 }} change={{ value: -0.09 }} lowerIsBetter />);
    const count = html(<KpiCard label="Bookings" figure={{ value: 30 }} change={{ value: -0.09 }} />);
    expect(cost).toContain("text-success-on-tint");
    expect(count).toContain("text-destructive-on-tint");
  });
});
