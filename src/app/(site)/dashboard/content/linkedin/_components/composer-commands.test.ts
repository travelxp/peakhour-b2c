import { describe, expect, it, vi } from "vitest";
import { buildComposerCommands } from "./composer-commands";

const build = (over: Partial<Parameters<typeof buildComposerCommands>[0]> = {}) =>
  buildComposerCommands({ text: "hi", empty: false, scheduleDisabled: false, showLink: false, pollActive: false, hasPictures: false, runAi: vi.fn(), onSchedule: vi.fn(), onAttachLink: vi.fn(), onTogglePoll: vi.fn(), ...over });
const link = (over = {}) => build(over).find((c) => c.id === "add-link")!;

describe("the Attach a link command", () => {
  it("is on for an empty post", () => {
    expect(link().disabled).toBeFalsy();
  });
  it("is off with pictures on the post (a post takes pictures or a link)", () => {
    expect(link({ hasPictures: true }).disabled).toBe(true);
  });
  it("is off with a link attached or a poll on", () => {
    expect(link({ showLink: true }).disabled).toBe(true);
    expect(link({ pollActive: true }).disabled).toBe(true);
  });
});
