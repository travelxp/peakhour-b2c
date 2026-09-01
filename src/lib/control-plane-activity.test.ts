import { describe, it, expect } from "vitest";
import type { ActivityRow, NotificationDomain } from "@/lib/api/control-plane";
import {
  activityActor,
  activityCopy,
  activityScopeNote,
  activityWhen,
  displayTimeZone,
  formatMaskedNumber,
} from "./control-plane-activity";

/**
 * PR-2.5d — §07's tab, the half that can be wrong.
 *
 * ★EVERY RULE HERE IS ONE A MERCHANT WOULD BELIEVE. A ledger that mislabels a
 * refusal, misdates a row or mis-attributes an instruction is worse than no
 * ledger, because it is evidence.
 */

const DOMAINS: NotificationDomain[] = [
  { key: "ads", displayName: "Ads", description: null, sortOrder: 1 },
  { key: "billing", displayName: "Billing", description: null, sortOrder: 2 },
];

function row(patch: Partial<ActivityRow> = {}): ActivityRow {
  return {
    id: "aaaaaaaaaaaaaaaaaaaaaaaa",
    occurredAt: "2026-09-01T12:33:00.000Z",
    outcome: "command_handled",
    domain: null,
    command: null,
    action: null,
    actor: null,
    actorMasked: null,
    confirmed: null,
    businessId: "bbbbbbbbbbbbbbbbbbbbbbbb",
    ...patch,
  };
}

describe("activityCopy — §07's left column and 'what'", () => {
  it("names the domain from the REGISTRY, never from a list in this repo", () => {
    const c = activityCopy(
      row({ outcome: "command_handled", domain: "ads", command: "STOP" }),
      DOMAINS,
    );
    expect(c.group).toBe("Ads");
    expect(c.what).toBe("Ran STOP");
  });

  it("falls back to the KEY for a domain the registry no longer returns", () => {
    // ⚠️A domain can be `deprecated`, and `GET /domains` returns the ACTIVE
    //  ones. A ledger line written while it was active must not go blank when
    //  ops retire it — the event still happened, under that name.
    const c = activityCopy(
      row({ outcome: "command_handled", domain: "insights", command: "DIGEST" }),
      DOMAINS,
    );
    expect(c.group).toBe("insights");
  });

  it("files a refusal WITH a domain under that domain, and still marks it refused", () => {
    // ★★"Blocked" IS THE FALLBACK, NOT THE RULE. A merchant who goes looking
    //  under Ads for what happened to their campaign must find the refusal
    //  there — and must still see that it was refused.
    const c = activityCopy(
      row({ outcome: "command_denied", domain: "ads", command: "LAUNCH" }),
      DOMAINS,
    );
    expect(c.group).toBe("Ads");
    expect(c.refused).toBe(true);
    expect(c.what).toBe("Refused LAUNCH");
  });

  it("groups a domainless refusal under Blocked", () => {
    const c = activityCopy(row({ outcome: "unknown_sender" }), DOMAINS);
    expect(c.group).toBe("Blocked");
    expect(c.refused).toBe(true);
  });

  it("does NOT call ordinary chatter Blocked", () => {
    // 🚫A verified merchant saying "thanks" was refused nothing, and filing it
    //  under the wall would empty the word of the meaning §07 depends on.
    const c = activityCopy(row({ outcome: "not_a_command" }), DOMAINS);
    expect(c.group).toBe("Message");
    expect(c.refused).toBe(false);
  });

  it("marks every refusal and no other outcome", () => {
    const refused = ["unknown_sender", "no_longer_a_member", "ambiguous_business", "command_denied"];
    const notRefused = [
      "not_a_command",
      "command_handled",
      "command_silent",
      "confirmation_requested",
      "nothing_to_confirm",
      "consent_opted_out",
      "consent_opted_in",
    ];
    for (const outcome of refused) {
      expect(activityCopy(row({ outcome }), DOMAINS).refused, outcome).toBe(true);
    }
    for (const outcome of notRefused) {
      expect(activityCopy(row({ outcome }), DOMAINS).refused, outcome).toBe(false);
    }
  });

  it("covers exactly the ELEVEN outcomes plt_activity stores", () => {
    // ⚠️★★THE COLLECTION'S ENUM IS ELEVEN OF api's TWELVE. `duplicate_skipped`
    //  is a `PlatformInboundOutcome` the ledger deliberately never writes — *"a
    //  redelivery is not a second event"* — so copy for it would be copy for a
    //  row that cannot arrive. 🚫And `owner_only` / `not_your_domain` are
    //  `AuthorityOutcome`s collapsed into `command_denied` before they get here.
    const stored = [
      "unknown_sender",
      "no_longer_a_member",
      "ambiguous_business",
      "command_denied",
      "not_a_command",
      "command_handled",
      "command_silent",
      "confirmation_requested",
      "nothing_to_confirm",
      "consent_opted_out",
      "consent_opted_in",
    ];
    for (const outcome of stored) {
      // A recognised outcome never renders its own key back at the merchant.
      expect(activityCopy(row({ outcome }), DOMAINS).what, outcome).not.toBe(outcome);
    }
    for (const absent of ["duplicate_skipped", "owner_only", "not_your_domain"]) {
      expect(activityCopy(row({ outcome: absent }), DOMAINS).what, absent).toBe(absent);
    }
  });

  it("RENDERS an outcome it has never heard of rather than dropping the line", () => {
    // ★★THIS MAP IS A COPY OF AN ENUM IN TWO OTHER REPOS AND NO COMPILER CHECKS
    //  IT. A twelfth outcome ships as a migration, and this file learns late —
    //  so the line renders with its raw outcome rather than vanishing. **A
    //  ledger that hides the event somebody added an outcome to make visible is
    //  the one failure this surface cannot have.**
    const c = activityCopy(row({ outcome: "some_future_outcome" }), DOMAINS);
    expect(c.group).toBe("Activity");
    expect(c.what).toBe("some_future_outcome");
    expect(c.refused).toBe(false);
  });

  it("still reads when the row carries no trigger", () => {
    // ⚠️★★AND THIS IS THE COMMON CASE, NOT THE EDGE. `platform-inbound.ts` sets
    //  no `command` on `ambiguous_business` or `no_longer_a_member` — the two
    //  refusals that most need a sentence — so deleting the placeholder left
    //  "Ignored — the person…" and "which business was meant for" on the page.
    const c = activityCopy(
      row({ outcome: "no_longer_a_member", command: null }),
      DOMAINS,
    );
    expect(c.what).toBe(
      "Ignored an instruction — the person this number belongs to is no longer on the team",
    );
    expect(c.what).not.toContain("{command}");
    expect(c.what).not.toContain("  ");
  });

  it("reads as a sentence on EVERY template, with a trigger and without one", () => {
    // ★A template is only correct if both readings are. This is the whole map,
    //  checked mechanically rather than by whichever two somebody remembered.
    const outcomes = [
      "unknown_sender",
      "no_longer_a_member",
      "ambiguous_business",
      "command_denied",
      "not_a_command",
      "command_handled",
      "command_silent",
      "confirmation_requested",
      "nothing_to_confirm",
      "consent_opted_out",
      "consent_opted_in",
    ];
    for (const outcome of outcomes) {
      const withTrigger = activityCopy(row({ outcome, command: "LAUNCH" }), DOMAINS).what;
      const without = activityCopy(row({ outcome, command: null }), DOMAINS).what;
      for (const [label, what] of [
        ["LAUNCH", withTrigger],
        ["none", without],
      ] as const) {
        expect(what, `${outcome}/${label}`).not.toContain("{command}");
        expect(what, `${outcome}/${label}`).not.toContain("  ");
        expect(what.trim(), `${outcome}/${label}`).toBe(what);
        // 🚫NO SECOND PERSON. The ledger is org-wide — a reader sees their
        //  colleagues' rows — so "you" contradicts the name beside it.
        expect(what, `${outcome}/${label}`).not.toMatch(/\byou\b/i);
      }
      // ⚠️★★AND THE PLACEHOLDER IS SUBSTITUTED, NOT DELETED — the structural
      //  checks above cannot see the difference. "Ignored — the person…" is
      //  trimmed, single-spaced and second-person-free, and it is still a
      //  broken sentence. **The triggerless reading must be the trigger one
      //  with a noun in place of the trigger, and nothing else.**
      expect(without, outcome).toBe(withTrigger.replace("LAUNCH", "an instruction"));
    }
  });

  it("names no single reader on a confirmation, because the ledger is org-wide", () => {
    expect(
      activityCopy(row({ outcome: "confirmation_requested", command: "LAUNCH" }), DOMAINS)
        .what,
    ).toBe("Asked for confirmation before running LAUNCH");
  });

  it("never repeats an unverified sender's text, because the row does not carry it", () => {
    // ★`unknown_sender` stores no `command` on purpose — a stranger's free text
    //  is not ours to republish — and the sentence must not imply one.
    const c = activityCopy(row({ outcome: "unknown_sender", command: null }), DOMAINS);
    expect(c.what).toBe("Ignored an instruction from a number that was not verified");
  });
});

describe("formatMaskedNumber", () => {
  it("spaces an Indian mask the way §07 draws it", () => {
    expect(formatMaskedNumber("+9198XXXXXX07")).toBe("+91 98XXX XXX07");
  });

  it("leaves every other country's mask alone", () => {
    // ★THE SAME RULE `formatWaId` USES: a confidently mis-grouped number is
    //  worse than an ungrouped one, and here the reader is being asked to
    //  recognise a value that is mostly X.
    expect(formatMaskedNumber("+4915XXXXXX78")).toBe("+4915XXXXXX78");
    expect(formatMaskedNumber("+298XX41")).toBe("+298XX41");
  });

  it("leaves a +91 value of the WRONG LENGTH alone", () => {
    // ⚠️THE PREFIX IS NOT ENOUGH. 2+5+5 is India's grouping for a 12-digit
    //  number; slicing anything else into that shape invents a format.
    expect(formatMaskedNumber("+9198XXXX07")).toBe("+9198XXXX07");
  });
});

describe("activityActor — a person, or a number, never both", () => {
  it("names a teammate", () => {
    expect(
      activityActor(
        row({ actor: { userId: "u1", name: "Rohit Mehta", email: "r@x.com" } }),
      ),
    ).toEqual({ label: "Rohit Mehta", masked: false });
  });

  it("falls back to the email when the account has no name", () => {
    expect(
      activityActor(row({ actor: { userId: "u1", name: null, email: "r@x.com" } })),
    ).toEqual({ label: "r@x.com", masked: false });
  });

  it("keeps the line when the account is gone entirely", () => {
    // ⚠️The endpoint returns null for both when the `users` document has been
    // deleted — and `no_longer_a_member` is one of the outcomes this page
    // exists to show, so the row must not be dropped for want of a name.
    expect(
      activityActor(row({ actor: { userId: "u1", name: null, email: null } })),
    ).toEqual({ label: "A deleted account", masked: false });
  });

  it("formats a masked sender and says it is masked", () => {
    expect(activityActor(row({ actorMasked: "+9198XXXXXX07" }))).toEqual({
      label: "+91 98XXX XXX07",
      masked: true,
    });
  });

  it("prefers the named actor if a row somehow carries both", () => {
    // The collection forbids the pair; if one ever arrives, naming the person
    // is the reading that does not publish a number.
    expect(
      activityActor(
        row({
          actor: { userId: "u1", name: "Asha", email: null },
          actorMasked: "+9198XXXXXX07",
        }),
      ),
    ).toEqual({ label: "Asha", masked: false });
  });

  it("renders a row with neither rather than deleting it from the view", () => {
    expect(activityActor(row())).toEqual({ label: "Unattributed", masked: false });
  });
});

describe("activityWhen — §07's right column", () => {
  const IST = "Asia/Kolkata";
  // 2026-09-01T12:33Z is 18:03 in IST — §07's own first row.
  const now = new Date("2026-09-01T14:00:00.000Z");

  it("shows a 24-hour clock for today, in the merchant's zone", () => {
    expect(activityWhen("2026-09-01T12:33:00.000Z", now, IST)).toBe("18:03");
  });

  it("says Yesterday for the previous calendar day", () => {
    expect(activityWhen("2026-08-31T12:33:00.000Z", now, IST)).toBe("Yesterday");
  });

  it("shows the day and month for anything older", () => {
    expect(activityWhen("2026-08-11T12:33:00.000Z", now, IST)).toBe("11 Aug");
  });

  it("adds the YEAR once the row is from another one", () => {
    // ⚠️★★`plt_activity` HAS NO TTL, DELIBERATELY — migration 282's whole
    //  argument is that an expiry erases the slow probe preferentially. So rows
    //  outlive their year, and a bare "11 Aug" would show a merchant two
    //  identical dates twelve months apart.
    expect(activityWhen("2025-08-11T12:33:00.000Z", now, IST)).toBe("11 Aug 2025");
  });

  it("decides the DAY in the merchant's zone, not the browser's", () => {
    // ⚠️★★THE BUCKET AND THE CLOCK MUST USE THE SAME ZONE, and only a case
    //  where the two zones disagree about the DAY can show it. 2026-08-31T19:00Z
    //  is 1 September in Kolkata (+05:30) and 31 August in UTC — so read in the
    //  merchant's zone it is TODAY and shows a clock, and read in UTC it is
    //  yesterday. 🚫A row whose two readings land on the same day proves
    //  nothing, however far apart the clocks are.
    const now = new Date("2026-09-01T10:00:00.000Z"); // 15:30 IST, 1 Sep both ways
    expect(activityWhen("2026-08-31T19:00:00.000Z", now, IST)).toBe("00:30");
    expect(activityWhen("2026-08-31T19:00:00.000Z", now, "UTC")).toBe("Yesterday");
  });

  it("gets Yesterday right across a DST jump", () => {
    // ⚠️🚫★★THE 24-HOUR SUBTRACTION IS WRONG HERE AND THIS IS THE CASE THAT
    //  SHOWS IT. `America/New_York` springs forward at 07:00Z on 2026-03-08, so
    //  that day is 23 hours long. ★THE WINDOW IS THE FIRST HOUR OF THE NEXT
    //  DAY: from 00:30 EDT on the 9th (04:30Z), `now - 86_400_000` is 04:30Z on
    //  the 8th, which is **23:30 EST on 7 March** — so the whole of the 8th
    //  renders as a date instead of "Yesterday". 🚫A first version of this spec
    //  used 05:30Z (01:30 EDT), one hour outside the window, where the wrong
    //  arithmetic gives the right answer and the mutant survived.
    const ny = "America/New_York";
    const morningAfter = new Date("2026-03-09T04:30:00.000Z"); // 00:30 EDT, 9 Mar
    // 20:00Z on the 8th is 16:00 EDT — squarely inside the short day.
    expect(activityWhen("2026-03-08T20:00:00.000Z", morningAfter, ny)).toBe("Yesterday");
  });

  it("gets Yesterday right across a month and a year boundary", () => {
    expect(
      activityWhen("2025-12-31T18:00:00.000Z", new Date("2026-01-01T18:00:00.000Z"), "UTC"),
    ).toBe("Yesterday");
  });

  it("returns an empty string for an unparseable instant rather than 'Invalid Date'", () => {
    expect(activityWhen("not-a-date", now, IST)).toBe("");
  });
});

describe("activityScopeNote", () => {
  it("says so when a row belongs to no single business", () => {
    // ⚠️The query is ORG-scoped though the tab is per-business, so these rows
    // appear on every business's tab — attributing one to whichever tab is open
    // would be the wrong label §07 exists to avoid.
    expect(activityScopeNote(row({ businessId: null }))).toBe(
      "Concerns more than one of your businesses",
    );
  });

  it("says nothing on the ordinary row", () => {
    expect(activityScopeNote(row())).toBeNull();
  });
});

describe("displayTimeZone", () => {
  it("prefers what the merchant set", () => {
    expect(displayTimeZone("Asia/Kolkata")).toBe("Asia/Kolkata");
  });

  it("ignores a stored zone Intl cannot resolve, rather than throwing in render", () => {
    // ⚠️`preferences.timezone` is free text. `Asia/Kolkta` is the likeliest
    // mistake on the form that writes it, and `Intl` answers a RangeError —
    // which, thrown from a render, takes the whole page to an error boundary.
    const tz = displayTimeZone("Asia/Kolkta");
    expect(tz).not.toBe("Asia/Kolkta");
    expect(() => new Intl.DateTimeFormat("en-GB", { timeZone: tz })).not.toThrow();
  });

  it("TRIMS the zone it hands back, having trimmed the one it validated", () => {
    // ⚠️🚫`canonicalTimeZone` trims before asking `Intl`, so a padded value
    //  PASSES the check — and `Intl.DateTimeFormat` then throws `RangeError`
    //  for the untrimmed string. **A guard that validates one value and returns
    //  another is not a guard.**
    const tz = displayTimeZone(" Asia/Kolkata ");
    expect(tz).toBe("Asia/Kolkata");
    expect(() => new Intl.DateTimeFormat("en-GB", { timeZone: tz })).not.toThrow();
  });

  it("keeps the zone the merchant TYPED, not its canonical spelling", () => {
    // ★Validating with `Intl` and storing its answer would rewrite the modern
    //  `Asia/Kolkata` into the deprecated `Asia/Calcutta` — the rule
    //  `quietHoursPatch` already records.
    expect(displayTimeZone("Asia/Kolkata")).toBe("Asia/Kolkata");
  });

  it("falls back to a resolvable zone when they have set none", () => {
    // ★It must be a zone `Intl` accepts, whatever the host is — the callers
    //  pass it straight into `DateTimeFormat`.
    for (const absent of [null, undefined, ""]) {
      const tz = displayTimeZone(absent);
      expect(() => new Intl.DateTimeFormat("en-GB", { timeZone: tz })).not.toThrow();
    }
  });
});
