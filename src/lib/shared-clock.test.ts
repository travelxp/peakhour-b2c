import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createSharedClock, deadlineDelay } from "./shared-clock";

const T0 = Date.parse("2026-10-20T12:00:00.000Z");

describe("createSharedClock", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(T0);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("a tick tells every reader once", () => {
    const clock = createSharedClock(30_000);
    let a = 0;
    let b = 0;
    clock.subscribe(() => a++);
    clock.subscribe(() => b++);
    a = 0;
    b = 0;
    vi.advanceTimersByTime(30_000);
    expect([a, b]).toEqual([1, 1]);
    expect(clock.now()).toBe(T0 + 30_000);
  });
  it("the snapshot holds still between ticks", () => {
    const clock = createSharedClock(30_000);
    clock.subscribe(() => {});
    vi.setSystemTime(T0 + 10_000);
    expect(clock.now()).toBe(T0);
  });
  it("a refresh moves the time at once", () => {
    const clock = createSharedClock(30_000);
    clock.subscribe(() => {});
    vi.setSystemTime(T0 + 5_000);
    clock.refresh();
    expect(clock.now()).toBe(T0 + 5_000);
  });
  it("a first reader catches an idle clock up", () => {
    const clock = createSharedClock(30_000);
    vi.setSystemTime(T0 + 60 * 60_000);
    clock.subscribe(() => {});
    expect(clock.now()).toBe(T0 + 60 * 60_000);
  });
  it("the interval keeps running while one reader remains", () => {
    const clock = createSharedClock(30_000);
    const off = clock.subscribe(() => {});
    let b = 0;
    clock.subscribe(() => b++);
    off();
    b = 0;
    vi.advanceTimersByTime(30_000);
    expect(b).toBe(1);
  });
  it("the interval stops when the last reader leaves", () => {
    const clock = createSharedClock(30_000);
    const off1 = clock.subscribe(() => {});
    const off2 = clock.subscribe(() => {});
    off1();
    off2();
    expect(vi.getTimerCount()).toBe(0);
  });
  it("one interval serves every reader", () => {
    const clock = createSharedClock(30_000);
    clock.subscribe(() => {});
    clock.subscribe(() => {});
    expect(vi.getTimerCount()).toBe(1);
  });
});

describe("deadlineDelay", () => {
  const ends = new Date(T0).toISOString();
  it("waits until a future deadline", () => expect(deadlineDelay(ends, T0 - 1500)).toBe(1500));
  it("does not wait for a deadline already reached", () => expect(deadlineDelay(ends, T0)).toBeNull());
  it("does not wait without a deadline", () => expect(deadlineDelay(null, T0)).toBeNull());
  it("does not wait for an unparseable deadline", () => expect(deadlineDelay("soon", T0)).toBeNull());
  it("leaves a deadline beyond a timer's reach to the interval", () => {
    expect(deadlineDelay(ends, T0 - 2 ** 31)).toBeNull();
  });
});
