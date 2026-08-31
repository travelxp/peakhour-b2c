import { describe, it, expect } from "vitest";
import {
  ROUTING_CHANNELS,
  assignableMembers,
  assignmentInputFor,
  buildChannelRows,
  buildDomainRows,
  codeCountdown,
  contactHolders,
  canonicalTimeZone,
  contactsFor,
  localeOptions,
  describeQuietHours,
  formatWaId,
  isClock,
  hasLiveNumber,
  isPlausibleWaId,
  isTimeZone,
  memberLabel,
  normaliseWaIdInput,
  orphanedDomainRows,
  pickerOptions,
  quietHoursPatch,
  registrationInputFor,
} from "./control-plane";
import type {
  MerchantContact,
  NotificationDomain,
  RoutingAssignment,
} from "@/lib/api/control-plane";
import type { TeamMember } from "@/lib/auth";

/**
 * The pure half of the WhatsApp settings page (PR-1.6b).
 *
 * ── ★★WHAT THIS PAGE CAN GET WRONG ───────────────────────────────────────
 *
 * Not layout — this repo has no component render tests and `vitest.config.ts`
 * runs in `environment: "node"`, which is why the logic worth checking was put
 * in a module a node test can import at all.
 *
 * What it can get wrong is **which cells exist**, **what a write looks like**,
 * and **what it tells somebody about a row that is not doing what it says**:
 *
 *   - ⚠️A domain list that is a CONSTANT rather than the registry. §02 drew
 *     five domains, was right for four months, and was stale within a day of
 *     migration 279 seeding `insights`. A page built to it would have shipped
 *     five rows and left the sixth unassignable.
 *   - ⚠️A `PUT` body built from a `GET` row. Both bodies are `.strict()`, so
 *     the row's `id` and `assignee` object are a 400, not a silent strip.
 *   - ★★A cell rendered as assigned when the assignee has no verified number.
 *     `resolveRecipients` requires `status: "verified"`, so that cell falls
 *     through to the Owner — **and the merchant reads a name.**
 */

/**
 * ⚠️★★SIX ROWS, AND THE SIXTH IS THE WHOLE POINT — the seeded set as it
 * actually stands after mongodb migration 279.
 *
 * 🚫**A FIRST VERSION USED FOUR AND ARGUED IN A COMMENT THAT FOUR PROVED IT
 * AS WELL AS SIX WOULD. The mutation harness falsified that in one run**: a
 * `.slice(0, 5)` — the literal shape of a page built to §02's five-row
 * drawing — changes nothing at all against a fixture of four, so the mutant
 * survived and the spec reported it covered. ★A cap can only be seen by a
 * fixture LARGER than the cap.
 *
 * ★`linkedin` IS DELIBERATELY BOTH A DOMAIN KEY AND A CHANNEL KEY here. A
 * domain key is `^[a-z0-9]+$` and ops-seeded, so nothing stops one colliding
 * with the channel enum — and the two axes are independent namespaces that a
 * lookup keyed on the wrong one would silently merge.
 */
const DOMAINS: NotificationDomain[] = [
  { key: "support", displayName: "Support", description: "d", sortOrder: 10 },
  { key: "content", displayName: "Content", description: null, sortOrder: 20 },
  { key: "ads", displayName: "Ads & spend", description: null, sortOrder: 30 },
  { key: "billing", displayName: "Billing & Peaks", description: null, sortOrder: 40 },
  { key: "linkedin", displayName: "LinkedIn outreach", description: null, sortOrder: 50 },
  { key: "insights", displayName: "Insights", description: null, sortOrder: 60 },
];

const ASHA = "000000000000000000000004";
const ROHIT = "000000000000000000000003";

function assignment(
  over: Partial<RoutingAssignment> & { id: string },
): RoutingAssignment {
  return {
    domain: null,
    channel: null,
    assignee: { userId: ASHA, name: "Asha Sundaram", email: "asha@shop.test" },
    ...over,
  };
}

function contact(over: Partial<MerchantContact> = {}): MerchantContact {
  return {
    id: "c1",
    waId: "919820411207",
    userId: ASHA,
    status: "verified",
    verifiedAt: "2026-08-30T00:00:00.000Z",
    revokedAt: null,
    locale: null,
    register: null,
    quietHours: null,
    codeExpiresAt: null,
    codeSentAt: null,
    ...over,
  };
}

describe("buildDomainRows — the registry is the list, not this file", () => {
  it("★★returns one cell per ACTIVE domain, in the registry's own sortOrder", () => {
    const rows = buildDomainRows(
      // ⚠️DELIBERATELY OUT OF ORDER. The api sorts, but a page that relied on
      //  arrival order would agree with it right up until a domain is seeded
      //  with a sortOrder between two existing ones — which is exactly what
      //  `insights` at 60 was.
      [DOMAINS[5], DOMAINS[2], DOMAINS[0], DOMAINS[4], DOMAINS[3], DOMAINS[1]],
      [],
      [],
    );
    expect(rows.map((r) => r.key)).toEqual([
      "support",
      "content",
      "ads",
      "billing",
      "linkedin",
      "insights",
    ]);
  });

  it("⚠️★★draws a cell for a domain NOBODY is assigned to", () => {
    // ★★AN UNASSIGNED CELL IS THE INTERESTING ONE. It falls through to the
    //  Owner, which is a real routing decision the merchant may not know they
    //  have made — and a matrix that listed only stored rows would show them
    //  an empty table and nothing to click.
    const rows = buildDomainRows(DOMAINS, [], []);
    expect(rows).toHaveLength(6);
    expect(rows.every((r) => r.assignment === null)).toBe(true);
    expect(rows.every((r) => r.assigneeLabel === null)).toBe(true);
  });

  it("🚫★★does not invent a sixth domain, and does not drop the fourth", () => {
    // ★★THE ROWS ARE NOT A LIST TO COPY, and §02's own history is the argument:
    //  it drew FIVE, and `insights` (migration 279) made it six. **A page that
    //  hard-coded the drawn set would leave the newest domain unassignable**,
    //  which is the silent hole that domain was seeded to close.
    //
    //  🚫★I FIRST WROTE HERE THAT "a fixture of four proves it as well as a
    //  fixture of six would", AND THE MUTATION HARNESS FALSIFIED IT IN ONE
    //  RUN. A `.slice(0, 5)` — the literal shape of the defect — is invisible
    //  against four rows. **A cap can only be seen by a fixture larger than
    //  the cap**, so the fixture is six, and a seventh would be caught by the
    //  `DOMAINS.length` assertion below rather than by a hard-coded number.
    expect(buildDomainRows(DOMAINS, [], [])).toHaveLength(DOMAINS.length);
    expect(DOMAINS.length).toBeGreaterThan(5);
    expect(buildDomainRows([DOMAINS[0]], [], [])).toHaveLength(1);
    expect(buildDomainRows([], [], [])).toHaveLength(0);
  });

  it("names the assignee, and prefers their name over their email", () => {
    const rows = buildDomainRows(
      DOMAINS,
      [assignment({ id: "r1", domain: "ads" })],
      [contact()],
    );
    expect(rows.find((r) => r.key === "ads")?.assigneeLabel).toBe(
      "Asha Sundaram",
    );
  });

  it("★falls back to the email, and never to a made-up label", () => {
    // ★`null`, NOT "Unknown". A name we could not resolve and a person with no
    //  name on file are the same to a renderer and different to whoever has to
    //  fix it — §02 can say "this user no longer exists" only if the page does
    //  not invent one.
    const rows = buildDomainRows(
      DOMAINS,
      [
        assignment({
          id: "r1",
          domain: "ads",
          assignee: { userId: ASHA, name: null, email: "asha@shop.test" },
        }),
        assignment({
          id: "r2",
          domain: "support",
          assignee: { userId: ROHIT, name: null, email: null },
        }),
      ],
      [],
    );
    expect(rows.find((r) => r.key === "ads")?.assigneeLabel).toBe(
      "asha@shop.test",
    );
    expect(rows.find((r) => r.key === "support")?.assigneeLabel).toBeNull();
  });

  it("⚠️★★flags an assignee whose number is NOT verified", () => {
    // ★★THIS CELL ROUTES TO THE OWNER WHATEVER IT SAYS. `resolveRecipients`
    //  requires a `status: "verified"` contact, so an assignment to somebody
    //  who has not confirmed a number is a real row that delivers nowhere.
    //  **A page showing only the name tells the merchant something false.**
    //
    //  ⚠️★★AND SOMEBODY ELSE'S VERIFIED NUMBER IS IN THE FIXTURE ON PURPOSE.
    //  🚫A first version passed only the unverified row, so a check that
    //  ignored `userId` entirely — "is ANY number on this business verified" —
    //  answered false anyway and survived. **One confirmed teammate would
    //  then have made the whole matrix look healthy.**
    const rows = buildDomainRows(
      DOMAINS,
      [assignment({ id: "r1", domain: "ads" })],
      [
        contact({ status: "pending" }),
        contact({ id: "c2", userId: ROHIT, waId: "919872400031" }),
      ],
    );
    expect(rows.find((r) => r.key === "ads")?.assigneeUnverified).toBe(true);
  });

  it("★★a REVOKED number is the same answer as no number at all", () => {
    // ★Distinguishing them on the page would imply a difference in where the
    //  message goes, and there is none: the resolver asks for `verified` and
    //  gets nothing in either case.
    const revoked = buildDomainRows(
      DOMAINS,
      [assignment({ id: "r1", domain: "ads" })],
      [contact({ status: "revoked" })],
    );
    const absent = buildDomainRows(
      DOMAINS,
      [assignment({ id: "r1", domain: "ads" })],
      [],
    );
    expect(revoked.find((r) => r.key === "ads")?.assigneeUnverified).toBe(true);
    expect(absent.find((r) => r.key === "ads")?.assigneeUnverified).toBe(true);
  });

  it("🚫★an unassigned cell is not 'unverified' — it is unassigned", () => {
    // ★Two different states with two different remedies: one wants an
    //  assignee, the other wants that assignee to confirm a number. Collapsing
    //  them would send the merchant to the wrong control.
    const rows = buildDomainRows(DOMAINS, [], []);
    expect(rows.every((r) => r.assigneeUnverified === false)).toBe(true);
  });

  it("★★does not match a CHANNEL row into a domain cell — even on a SHARED key", () => {
    // ★The two axes are separate lists on the api's own answer, and a lookup
    //  keyed on the wrong one would render a channel override as a domain
    //  assignment — the cell would then show a person the domain never routes
    //  to.
    //
    //  ⚠️★★AND THE KEY HAS TO COLLIDE FOR THE CASE TO MEAN ANYTHING. 🚫A first
    //  version used `channel: "shopify"` against domains named `support`,
    //  `ads` and `insights` — **no overlap, so a lookup reading BOTH axes
    //  found nothing either way and the mutant survived.** A domain key is
    //  `^[a-z0-9]+$` and ops-seeded, so `linkedin` is a perfectly legal one,
    //  and the two namespaces really can collide.
    const rows = buildDomainRows(
      DOMAINS,
      [assignment({ id: "r1", channel: "linkedin" })],
      [contact()],
    );
    expect(rows.find((r) => r.key === "linkedin")?.assignment).toBeNull();
    expect(rows.every((r) => r.assignment === null)).toBe(true);
  });
});

describe("orphanedDomainRows — a live assignment the registry no longer offers", () => {
  it("⚠️★★surfaces an assignment to a DEPRECATED domain rather than hiding it", () => {
    // ★★A DEPRECATED DOMAIN KEEPS ROUTING. `GET /domains` returns active rows
    //  only, but `resolveRecipients` deliberately does not join that registry —
    //  deleting the assignment instead would silently redirect those
    //  notifications to the Owner. **So this cell is still delivering mail and
    //  the domain list does not contain it**; rendering only the list would
    //  hide it from the one person who could clear it.
    const rows = orphanedDomainRows(
      DOMAINS,
      [assignment({ id: "r1", domain: "retired" })],
      [contact()],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].key).toBe("retired");
    expect(rows[0].assigneeLabel).toBe("Asha Sundaram");
  });

  it("★is empty when every assignment matches an offered domain", () => {
    expect(
      orphanedDomainRows(
        DOMAINS,
        [assignment({ id: "r1", domain: "ads" })],
        [],
      ),
    ).toHaveLength(0);
  });

  it("🚫★★never counts a CHANNEL row as an orphaned domain", () => {
    // ★A channel row has `domain: null`, and a filter testing only "is it in
    //  the known set" would call every channel row an orphan — five phantom
    //  rows telling the merchant their matrix is broken when it is not.
    expect(
      orphanedDomainRows(
        DOMAINS,
        [assignment({ id: "r1", channel: "shopify" })],
        [],
      ),
    ).toHaveLength(0);
  });
});

describe("buildChannelRows — a closed set, and it stays closed", () => {
  it("★★always draws all five, assigned or not", () => {
    const rows = buildChannelRows([], []);
    expect(rows.map((r) => r.key)).toEqual([
      "shopify",
      "woocommerce",
      "wordpress",
      "linkedin",
      "whatsapp",
    ]);
  });

  it("★★labels the whatsapp channel as the SHOPPERS' one", () => {
    // ★★THE PARENTHESIS IS LOAD-BEARING. This page is Flow A — Peakhour talking
    //  to the merchant. The `whatsapp` CHANNEL is Flow B, the merchant's own
    //  shoppers. **A cell reading plain "WhatsApp" would name the wrong plane**,
    //  on the one page whose subject is the difference between them.
    const wa = buildChannelRows([], []).find((r) => r.key === "whatsapp");
    expect(wa?.label).toBe("WhatsApp (your customers)");
  });

  it("★the five match `plt_routing`'s enum exactly", () => {
    // ★★A SIXTH CHANNEL IS NOT A CONFIG ROW SOMEBODY SEEDS — it is a surface
    //  Peakhour cannot currently see, so it implies new code. That is why this
    //  one is a constant while domains are fetched, and this case is the record
    //  of the difference.
    expect(ROUTING_CHANNELS.map((c) => c.key)).toEqual([
      "shopify",
      "woocommerce",
      "wordpress",
      "linkedin",
      "whatsapp",
    ]);
  });

  it("★★does not match a DOMAIN row into a channel cell — even on a SHARED key", () => {
    // ★The mirror of the domain case, and it needs the same colliding key for
    //  the same reason: `linkedin` is both a legal ops-seeded domain and a
    //  member of `plt_routing`'s channel enum.
    const rows = buildChannelRows(
      [assignment({ id: "r1", domain: "linkedin" })],
      [],
    );
    expect(rows.find((r) => r.key === "linkedin")?.assignment).toBeNull();
    expect(rows.every((r) => r.assignment === null)).toBe(true);
  });
});

describe("assignmentInputFor — the GET row is not a legal PUT body", () => {
  it("⚠️★★sends assigneeUserId, and no id and no assignee object", () => {
    // ★★BOTH BODIES ARE `.strict()`, so `id` and `assignee` are a 400 rather
    //  than a silent strip — which is the api refusing to let a page store an
    //  escalation contact it never saved. A builder that spread the row would
    //  fail every write, loudly, and a builder that spread it into a lenient
    //  schema would fail none of them and store nothing.
    const body = assignmentInputFor({ axis: "domain", key: "ads" }, ASHA);
    expect(body).toEqual({ domain: "ads", channel: null, assigneeUserId: ASHA });
    expect("id" in body).toBe(false);
    expect("assignee" in body).toBe(false);
  });

  it("★★names the other axis as null rather than omitting it", () => {
    // ★Both are accepted — the api takes `null` as absent precisely so the axis
    //  pair `GET` hands back round-trips. Sending `null` keeps ONE spelling on
    //  this page instead of two, and the shape is the one already on screen.
    const body = assignmentInputFor({ axis: "channel", key: "shopify" }, ROHIT);
    expect(body).toEqual({
      domain: null,
      channel: "shopify",
      assigneeUserId: ROHIT,
    });
  });

  it("🚫★★never sends both axes set", () => {
    // ★★THE IMPOSSIBLE STATE THE WHOLE UNION EXISTS TO REFUSE. A malformed row
    //  is INERT — the resolver's lookups exclude the other axis — so it renders
    //  as an override that answers nothing, and this page is one of the two
    //  places that can stop one being written.
    for (const cell of [
      { axis: "domain" as const, key: "ads" },
      { axis: "channel" as const, key: "shopify" },
    ]) {
      const body = assignmentInputFor(cell, ASHA);
      const set = [body.domain, body.channel].filter(
        (v) => v !== null && v !== undefined,
      );
      expect(set).toHaveLength(1);
    }
  });
});

describe("formatWaId — a number its owner can recognise", () => {
  it("groups an Indian number the way §02 draws it", () => {
    expect(formatWaId("919820411207")).toBe("+91 98204 11207");
  });

  it("🚫★★does NOT guess grouping for a country it does not know", () => {
    // ★★A CONFIDENTLY MIS-SPACED NUMBER READS AS WRONG TO THE ONE PERSON WHO
    //  CAN TELL — the one it belongs to. A merchant who cannot recognise their
    //  own number cannot confirm the row is right, so ungrouped beats guessed.
    expect(formatWaId("4915112345678")).toBe("+4915112345678");
    expect(formatWaId("14155552671")).toBe("+14155552671");
  });

  it("★tolerates a stored value that already carries punctuation", () => {
    expect(formatWaId("+91 98204 11207")).toBe("+91 98204 11207");
  });

  it("★does not group a 12-digit number that merely STARTS with 91", () => {
    // ★`91` is India's code at the FRONT of a 12-digit number and nothing at
    //  all in the middle of a longer one. A length-blind prefix test would
    //  reformat a Ugandan or Japanese number into an Indian shape.
    expect(formatWaId("9112345678901")).toBe("+9112345678901");
  });
});

describe("normaliseWaIdInput + isPlausibleWaId — refuse locally what the api refuses", () => {
  it("strips everything a person might paste", () => {
    expect(normaliseWaIdInput("+91 98204-11207")).toBe("919820411207");
    expect(normaliseWaIdInput("(91) 98204 11207")).toBe("919820411207");
  });

  it("★★matches the api's own bound, 8–15 digits with no leading zero", () => {
    // ★The api's `waIdSchema` is /^[1-9][0-9]{7,14}$/. A local guard that was
    //  LOOSER would send a 400 the page has to translate; one that was TIGHTER
    //  would refuse a number the platform accepts. Either way the page and the
    //  api would disagree about a number somebody is holding in their hand.
    expect(isPlausibleWaId("919820411207")).toBe(true);
    expect(isPlausibleWaId("12345678")).toBe(true);
    expect(isPlausibleWaId("1234567")).toBe(false);
    expect(isPlausibleWaId("1234567890123456")).toBe(false);
    expect(isPlausibleWaId("0919820411207")).toBe(false);
    expect(isPlausibleWaId("")).toBe(false);
  });
});

describe("codeCountdown — a pending row shows time, not a status word", () => {
  const now = Date.parse("2026-08-31T10:00:00.000Z");

  it("★★renders m:ss, zero-padded", () => {
    expect(codeCountdown("2026-08-31T10:04:12.000Z", now)).toBe("4:12");
    expect(codeCountdown("2026-08-31T10:00:09.000Z", now)).toBe("0:09");
  });

  it("⚠️★★is null once the code has expired, rather than '0:00'", () => {
    // ★★AN EXPIRED CODE IS NOT A CODE WITH NO TIME LEFT ON IT — it is a row
    //  that needs Resend, and the two want different controls. Clamping to
    //  "0:00" would leave the page inviting somebody to type a code the api
    //  will refuse.
    expect(codeCountdown("2026-08-31T10:00:00.000Z", now)).toBeNull();
    expect(codeCountdown("2026-08-31T09:59:59.000Z", now)).toBeNull();
  });

  it("is null for a row that has no code at all", () => {
    expect(codeCountdown(null, now)).toBeNull();
  });

  it("★is null rather than NaN for a value it cannot parse", () => {
    // ★A page rendering "NaN:NaN" is worse than one rendering nothing, and the
    //  remedy — press Resend — is the same as for an expired code.
    expect(codeCountdown("not a date", now)).toBeNull();
  });
});

describe("quietHoursPatch — all three or none", () => {
  it("accepts a normal window", () => {
    const r = quietHoursPatch({
      start: "22:00",
      end: "07:00",
      tz: "Asia/Kolkata",
    });
    expect(r).toEqual({
      ok: true,
      value: { start: "22:00", end: "07:00", tz: "Asia/Kolkata" },
    });
  });

  it("★★ACCEPTS an overnight window — start later than end is the common case", () => {
    // ★22:00–07:00 is the commonest quiet period there is. A guard that
    //  required start < end would refuse almost every real one.
    expect(
      quietHoursPatch({ start: "23:30", end: "06:15", tz: "Europe/London" }).ok,
    ).toBe(true);
  });

  it("🚫★★refuses start === end", () => {
    // ★It reads as either "no quiet hours" or "quiet for twenty-four hours" —
    //  opposites, and neither is what somebody typing the same time twice
    //  meant.
    const r = quietHoursPatch({
      start: "22:00",
      end: "22:00",
      tz: "Asia/Kolkata",
    });
    expect(r.ok).toBe(false);
  });

  it("⚠️★★refuses a missing time zone", () => {
    // ★★THE OTHER TWO ARE MEANINGLESS WITHOUT IT. "Do not message me between
    //  22:00 and 07:00" is a different instruction in Mumbai and in London, and
    //  the collection requires all three together for exactly that reason.
    expect(
      quietHoursPatch({ start: "22:00", end: "07:00", tz: "   " }).ok,
    ).toBe(false);
  });

  it("★★refuses anything that is not 24-hour HH:MM", () => {
    // ★A page that posted "9am" would be refused by the DATABASE as a code 121,
    //  on an insert path whose failure is caught and logged — i.e. silently.
    //  **The page has to refuse it first**, because the api's own refusal would
    //  arrive somewhere nobody reads.
    for (const bad of ["9am", "9:00", "24:00", "22:60", "22", "22:0"]) {
      expect(quietHoursPatch({ start: bad, end: "07:00", tz: "UTC" }).ok).toBe(
        false,
      );
    }
    expect(isClock("00:00")).toBe(true);
    expect(isClock("23:59")).toBe(true);
  });

  it("trims before validating, so a pasted value with spaces works", () => {
    expect(
      quietHoursPatch({ start: " 22:00 ", end: " 07:00 ", tz: " UTC " }),
    ).toEqual({ ok: true, value: { start: "22:00", end: "07:00", tz: "UTC" } });
  });
});

describe("describeQuietHours", () => {
  it("names the zone, because the window means nothing without it", () => {
    expect(
      describeQuietHours({ start: "09:00", end: "17:00", tz: "Asia/Kolkata" }),
    ).toBe("09:00–17:00 · Asia/Kolkata");
  });

  it("★says so when the window crosses midnight", () => {
    expect(
      describeQuietHours({ start: "22:00", end: "07:00", tz: "Asia/Kolkata" }),
    ).toBe("22:00–07:00 · Asia/Kolkata (overnight)");
  });
});

describe("assignableMembers — who the picker offers", () => {
  const members: TeamMember[] = [
    {
      userId: ROHIT,
      email: "rohit@shop.test",
      name: "Rohit Mehta",
      role: "owner",
      lastLoginAt: null,
      isOwner: true,
    },
    {
      userId: ASHA,
      email: "asha@shop.test",
      name: "Asha Sundaram",
      role: "admin",
      lastLoginAt: null,
      isOwner: false,
    },
  ];

  it("⚠️★★offers EVERY member, including one with no verified number", () => {
    // ★★NARROWING THE PICKER WOULD MAKE THE PAGE DISAGREE WITH THE API IT
    //  WRITES TO: `PUT /routing` accepts any active org member. And hiding
    //  somebody would leave a merchant unable to assign the teammate they are
    //  about to onboard, with no explanation on screen. **The CELL says the
    //  number is unverified; the picker does not hide the person.**
    expect(assignableMembers(members)).toHaveLength(2);
  });

  it("sorts by display name so the list is findable", () => {
    expect(assignableMembers(members).map((m) => m.name)).toEqual([
      "Asha Sundaram",
      "Rohit Mehta",
    ]);
  });

  it("★★memberLabel falls back to the email — a picker option nobody can read is unusable", () => {
    // 🚫A first version only asserted the SORT ORDER of a nameless member, so
    //  `m.name ?? ""` — an empty option in the assignee dropdown — survived.
    //  **The sort and the label are two claims and each needs its own case.**
    expect(memberLabel(members[0])).toBe("Rohit Mehta");
    expect(
      memberLabel({
        userId: "000000000000000000000009",
        email: "nameless@shop.test",
        name: null,
        role: "editor",
        lastLoginAt: null,
        isOwner: false,
      }),
    ).toBe("nameless@shop.test");
  });

  it("★sorts a nameless member by their email rather than dropping them", () => {
    const nameless: TeamMember = {
      userId: "000000000000000000000009",
      email: "aaa@shop.test",
      name: null,
      role: "editor",
      lastLoginAt: null,
      isOwner: false,
    };
    expect(assignableMembers([...members, nameless])[0].email).toBe(
      "aaa@shop.test",
    );
  });
});

describe("contactsFor", () => {
  it("★returns every row for one person — `waId` is unique per BUSINESS, not per person", () => {
    // ★So a teammate can hold more than one number, and a lookup that returned
    //  the first would hide a second the merchant is waiting on.
    const rows = [
      contact({ id: "c1", waId: "919820411207" }),
      contact({ id: "c2", waId: "919820411208", status: "pending" }),
      contact({ id: "c3", userId: ROHIT }),
    ];
    expect(contactsFor(ASHA, rows).map((c) => c.id)).toEqual(["c1", "c2"]);
    expect(contactsFor(ROHIT, rows).map((c) => c.id)).toEqual(["c3"]);
  });

  it("is empty for somebody who has registered nothing", () => {
    expect(contactsFor("000000000000000000000009", [contact()])).toEqual([]);
  });
});

describe("contactHolders — a number outlives the membership that registered it", () => {
  const members: TeamMember[] = [
    {
      userId: ASHA,
      email: "asha@shop.test",
      name: "Asha Sundaram",
      role: "admin",
      lastLoginAt: null,
      isOwner: false,
    },
  ];

  it("⚠️★★DRAWS A CONTACT WHOSE HOLDER HAS LEFT THE ORG", async () => {
    // ★★`plt_merchant_contacts` IS NOT TOUCHED WHEN SOMEBODY IS REMOVED FROM
    //  `members[]`, and `resolveRecipients` does not join the member list
    //  either — it asks for `status: "verified"`. **So a teammate who left
    //  still holds a number Peakhour will take an instruction from.**
    //
    //  🚫A first version of the page iterated the MEMBER list, so that row was
    //  invisible: not shown, not revocable, and still able to command. **The
    //  one control that could close it was the one thing the page did not
    //  draw.**
    const holders = contactHolders(members, [
      contact(),
      contact({ id: "c9", userId: ROHIT, waId: "919872400031" }),
    ]);
    expect(holders.map((h) => h.userId)).toEqual([ASHA, ROHIT]);
    expect(holders.find((h) => h.userId === ROHIT)?.isMember).toBe(false);
  });

  it("★★labels the departed holder by their NUMBER — it is the only label left", () => {
    // ★`GET /contacts` carries no name: it never needed one while every holder
    //  was a member. So the row is identified by the thing that still matters,
    //  which is the number that can command Peakhour.
    const holders = contactHolders(members, [
      contact({ id: "c9", userId: ROHIT, waId: "919872400031" }),
    ]);
    const gone = holders.find((h) => h.userId === ROHIT);
    expect(gone?.label).toBe("+91 98724 00031");
    expect(gone?.role).toBeNull();
  });

  it("★★still lists a member who has registered NOTHING", () => {
    // ★They are the ones who need the Register control, so dropping people
    //  without contacts would hide the only path to giving them one.
    const holders = contactHolders(members, []);
    expect(holders).toHaveLength(1);
    expect(holders[0].isMember).toBe(true);
    expect(holders[0].role).toBe("admin");
  });

  it("🚫★does not list a member TWICE when they hold two numbers", () => {
    // ★`waId` is unique per BUSINESS, not per person, so two rows for one
    //  member is ordinary — and a holder list that appended per CONTACT rather
    //  than per PERSON would draw them twice, each showing both numbers.
    const holders = contactHolders(members, [
      contact({ id: "c1", waId: "919820411207" }),
      contact({ id: "c2", waId: "919820411208" }),
    ]);
    expect(holders).toHaveLength(1);
  });

  it("🚫★and does not list a DEPARTED holder twice either", () => {
    const holders = contactHolders(members, [
      contact({ id: "c8", userId: ROHIT, waId: "919872400031" }),
      contact({ id: "c9", userId: ROHIT, waId: "919872400032" }),
    ]);
    expect(holders.filter((h) => h.userId === ROHIT)).toHaveLength(1);
  });
});

describe("pickerOptions — a Select whose value is missing renders blank", () => {
  const members: TeamMember[] = [
    {
      userId: ASHA,
      email: "asha@shop.test",
      name: "Asha Sundaram",
      role: "admin",
      lastLoginAt: null,
      isOwner: false,
    },
  ];

  it("⚠️★★KEEPS THE CURRENT ASSIGNEE AS AN OPTION EVEN AFTER THEY LEAVE", () => {
    // ★★A `Select` whose value is not among its options renders BLANK. So an
    //  Admin would see an empty control on a cell that IS assigned, while the
    //  read-only branch beside it shows the name. **Blank reads as "not
    //  assigned" — the opposite of what is stored** — and the remedy
    //  (reassign it) is the one thing a blank control makes hard.
    const options = pickerOptions(
      members,
      assignment({
        id: "r1",
        domain: "ads",
        assignee: { userId: ROHIT, name: "Rohit Mehta", email: null },
      }),
    );
    expect(options.map((o) => o.userId)).toContain(ROHIT);
    expect(options.find((o) => o.userId === ROHIT)?.isMember).toBe(false);
  });

  it("★does not duplicate an assignee who IS still a member", () => {
    const options = pickerOptions(
      members,
      assignment({ id: "r1", domain: "ads" }),
    );
    expect(options.filter((o) => o.userId === ASHA)).toHaveLength(1);
    expect(options[0].isMember).toBe(true);
  });

  it("★offers the members alone when the cell is unassigned", () => {
    const options = pickerOptions(members, null);
    expect(options.map((o) => o.userId)).toEqual([ASHA]);
  });

  it("★★labels a departed assignee with no name and no email rather than blank", () => {
    // ★An option with an empty label is one nobody can choose deliberately,
    //  and this is exactly the row somebody needs to click to fix.
    const options = pickerOptions(
      members,
      assignment({
        id: "r1",
        domain: "ads",
        assignee: { userId: ROHIT, name: null, email: null },
      }),
    );
    expect(options.find((o) => o.userId === ROHIT)?.label).toBe(
      "Someone who has left",
    );
  });
});

describe("localeOptions — locale is a free string, not an enum", () => {
  const SUGGESTIONS = [
    { value: "en-IN", label: "English (India)" },
    { value: "ta", label: "Tamil" },
  ];

  it("⚠️★★ADDS A STORED VALUE THAT IS NOT AMONG THE SUGGESTIONS", () => {
    // ★★`plt_merchant_contacts.locale` IS A BCP-47-ish STRING CAPPED AT 32 —
    //  the same type the shopper plane uses — and the suggestions are a
    //  starting point. 🚫A `Select` limited to them renders BLANK for anything
    //  else, which is **indistinguishable from "infer it from how they
    //  write"**: the opposite setting.
    expect(localeOptions(SUGGESTIONS, "fr-CA").map((o) => o.value)).toEqual([
      "fr-CA",
      "en-IN",
      "ta",
    ]);
  });

  it("★does not duplicate one that IS among them", () => {
    expect(localeOptions(SUGGESTIONS, "ta").map((o) => o.value)).toEqual([
      "en-IN",
      "ta",
    ]);
  });

  it("★returns the suggestions unchanged when nothing is stored", () => {
    expect(localeOptions(SUGGESTIONS, null)).toHaveLength(2);
  });

  it("🚫★does not copy the caller's array in place", () => {
    // ★The suggestions are a module-level constant in the dialog. Unshifting
    //  into it would make every subsequent contact inherit the previous one's
    //  locale as an option.
    //
    //  ⚠️★★A FRESH ARRAY AND AN UNSEEN VALUE, because the shared fixture makes
    //  this case order-dependent: the first case in this block already asks
    //  for `fr-CA`, so under a MUTATING implementation the constant would
    //  already contain it by the time this ran — the early return fires, no
    //  mutation happens, **and the spec passes on the exact defect it exists
    //  to catch.** The harness found that; nothing else would have.
    const own = [{ value: "en-IN", label: "English (India)" }];
    const result = localeOptions(own, "de-AT");
    expect(own).toHaveLength(1);
    expect(result).toHaveLength(2);
  });
});

describe("registrationInputFor — the api defaults userId to the CALLER", () => {
  it("⚠️★★REFUSES to send a number with no subject", () => {
    // ★★`POST /contacts` DEFAULTS `userId` TO THE CALLER WHEN IT IS OMITTED —
    //  right for a script, wrong for a form whose first question is "whose
    //  number is it?". 🚫A first version omitted it whenever nothing was
    //  selected, so "Add a teammate" registered **a teammate's handset against
    //  the Owner's `userId`**.
    //
    //  ★And that is not merely a wrong row: only the person a row NAMES can
    //  verify it, so either the number is unconfirmable — or the Owner
    //  confirms it and **a teammate's phone is authorised as the Owner**,
    //  which is the precise failure `plt_merchant_contacts` exists to prevent.
    expect(registrationInputFor("+91 98204 11207", null)).toBeNull();
    expect(registrationInputFor("+91 98204 11207", "")).toBeNull();
  });

  it("★★always NAMES the subject — never omits the key", () => {
    // ★An input that merely left `userId` off when it had one would be the
    //  same defect wearing a builder.
    const input = registrationInputFor("+91 98204 11207", ASHA);
    expect(input).toEqual({ waId: "919820411207", userId: ASHA });
    expect(input && "userId" in input).toBe(true);
  });

  it("★refuses a number the api would refuse anyway", () => {
    expect(registrationInputFor("12345", ASHA)).toBeNull();
    expect(registrationInputFor("", ASHA)).toBeNull();
    expect(registrationInputFor("0919820411207", ASHA)).toBeNull();
  });

  it("★normalises what somebody pasted", () => {
    expect(registrationInputFor("(+91) 98204-11207", ASHA)?.waId).toBe(
      "919820411207",
    );
  });
});

describe("isTimeZone — \"non-empty\" is not a time zone", () => {
  it("⚠️★★REFUSES A TYPO'D ZONE, which is the likeliest mistake on this form", () => {
    // ★★AND THE ONE THAT FAILS SILENTLY. 🚫A first version checked only that
    //  the field had characters in it, so `Asia/Kolkta` saved as a REAL quiet
    //  window that no scheduler can resolve: the merchant sets quiet hours,
    //  the page reports success, and the hours are never honoured.
    expect(isTimeZone("Asia/Kolkta")).toBe(false);
    expect(isTimeZone("GMT+5:30")).toBe(false);
    expect(isTimeZone("Kolkata")).toBe(false);
    // ⚠️★★AND `IST` IS **ACCEPTED**, WHICH I GUESSED WRONG FIRST. Measured:
    //  `Intl` resolves the legacy abbreviations — `IST` → `Asia/Calcutta`,
    //  `EST` → `America/Panama` — and is case-insensitive besides. Rejecting
    //  them would refuse zones the platform can resolve perfectly well.
    //  ★**They are CANONICALISED rather than refused**, so the row stores what
    //  the scheduler will actually use.
    expect(isTimeZone("IST")).toBe(true);
    expect(canonicalTimeZone("IST")).toBe("Asia/Calcutta");
    expect(canonicalTimeZone("asia/kolkata")).toBe("Asia/Calcutta");
  });

  it("🚫★★STORES WHAT THE PERSON TYPED, not the canonical form", () => {
    // ⚠★★ICU CANONICALISES THE MODERN NAME TO THE DEPRECATED ONE:
    //  `Asia/Kolkata` → `Asia/Calcutta`. 🚫A first version stored the resolved
    //  value, so **the merchant would type the current name and read back the
    //  old one** — which looks like the page misunderstood them, a worse
    //  failure than the case-spelling it was meant to tidy. The canonical form
    //  decides YES or NO and nothing else.
    const r = quietHoursPatch({
      start: "22:00",
      end: "07:00",
      tz: "Asia/Kolkata",
    });
    expect(r.ok === true && r.value.tz).toBe("Asia/Kolkata");
  });

  it("accepts the real ones, including the odd-looking ones", () => {
    // ★`Intl` IS THE AUTHORITY, not a list of our own — a hand-maintained one
    //  would be an IANA release behind for ever, and these are exactly the
    //  entries such a list gets wrong.
    for (const tz of [
      "Asia/Kolkata",
      "Europe/London",
      "UTC",
      "America/Argentina/Buenos_Aires",
      "Australia/Eucla",
    ]) {
      expect(isTimeZone(tz)).toBe(true);
    }
  });

  it("refuses an empty or blank field", () => {
    expect(isTimeZone("")).toBe(false);
    expect(isTimeZone("   ")).toBe(false);
  });

  it("★★and quietHoursPatch refuses the whole window over it", () => {
    // ★All three or none: a window with an unresolvable zone is not a partial
    //  setting, it is one that will never fire.
    const r = quietHoursPatch({
      start: "22:00",
      end: "07:00",
      tz: "Asia/Kolkta",
    });
    expect(r.ok).toBe(false);
    // ★AND THE MESSAGE NAMES THE ZONE IT REFUSED, because a typo is invisible
    //  to the person who made it until somebody spells it back to them.
    expect(r.ok === false && r.error).toContain("Asia/Kolkta");
  });
});

describe("hasLiveNumber — a revoked row is history, not a number", () => {
  it("⚠️★★IS FALSE WHEN EVERY ROW IS REVOKED", () => {
    // ★★"HAS NO ROWS" IS THE WRONG QUESTION, and asking it left somebody whose
    //  only number was revoked with **no control at all** on their row: no
    //  Register button, and no dropdown either, because that is hidden for a
    //  revoked row too. **The one person most likely to need a new number had
    //  nowhere to ask for one.**
    expect(hasLiveNumber([contact({ status: "revoked" })])).toBe(false);
  });

  it("★is TRUE for a pending row — it is on its way to being live", () => {
    // ★Offering Register beside a code somebody is waiting on would invite a
    //  second number nobody asked for.
    expect(hasLiveNumber([contact({ status: "pending" })])).toBe(true);
  });

  it("★is true when ONE of several rows is live", () => {
    expect(
      hasLiveNumber([
        contact({ id: "c1", status: "revoked" }),
        contact({ id: "c2", status: "verified" }),
      ]),
    ).toBe(true);
  });

  it("is false for somebody with no rows at all", () => {
    expect(hasLiveNumber([])).toBe(false);
  });
});
