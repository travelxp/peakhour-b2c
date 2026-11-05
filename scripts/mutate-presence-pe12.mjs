/**
 * Mutation harness for the PE-12 panels (b2c): posts, services, details and links. What a mutation on each rule is killed by:
 *
 *   - panel gating (a network that does not declare a panel draws NOTHING; an api that sends no `panels` draws none) ... the lib spec for the
 *     predicate, the card spec for each of the four cards, and the wiring spec for the shell and the page.
 *   - the post value (kinds and buttons from the declaration, the longest post never shortened, https addresses, a title and real dates for an
 *     event or an offer, the end not before the start, the number-dialling button taking no address) ... the lib spec's "a post value".
 *   - services keep what was not touched (price and description included), and only services not held are offered ... the lib spec.
 *   - details: a deprecated one is never offered, CLEARING one REMOVES it from the list, one value of a several-choice detail changes alone,
 *     setting one keeps the others ... the lib spec, and the card spec for what is drawn.
 *   - links: https, a kind the network offers, one preferred per kind ... the lib spec.
 *   - what waits is read from the change list (a post with a change waiting has no Edit or Delete; a create waits on no post), and the controls
 *     wait for the change list to answer ... the lib and card specs.
 *   - ROUND ONE: only what the person added or changed is judged (a held http link, a held link of a kind no longer offered, a held detail link
 *     pass); a removed service comes back from what the network holds; a service of one's own is filed under the category; a post keeps its
 *     language and event times and a held undeclared button; a new post carries a fresh draft id; the words follow the role; the panel sends the
 *     base and reloads on the api's refusal; the panel is gated on the chosen network's declaration before the listing is read ... the "round
 *     one" blocks of the lib, card and wiring specs.
 *   - the lines of a change card (a post shows its words, never raw JSON; each field has a title) ... the lib spec.
 *   - the edit card never lists a change a panel lists, and lists another network's ... the photos wiring spec and this one.
 *
 * Discipline (the api harness's, scripts/mutate-pe-11.mjs there, and mutate-presence-pe11.mjs here): PASS cases are in each spec beside the
 * refusals; anchors appear EXACTLY once and every mutant differs from its source; every designated title exists exactly once and is green at
 * baseline; a kill counts only when a DESIGNATED test failed; a dead runner is an error; the source is restored from an in-memory copy in a
 * finally, on signals, and verified byte for byte. Never kill a run mid-case: a killed run leaves a mutant (check `git status`).
 *
 * Run: node scripts/mutate-presence-pe12.mjs [--only <id>]
 */
import { readFileSync, writeFileSync, existsSync, rmSync, mkdtempSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { execPath } from "node:process";
import { tmpdir } from "node:os";
import { join } from "node:path";

const LIB = "src/lib/presence-extras.ts";
const EDIT_LIB = "src/lib/presence-edit.ts";
const SHELL = "src/components/presence/edit/extra-panel.tsx";
const POSTS = "src/components/presence/edit/posts-card.tsx";
const SERVICES = "src/components/presence/edit/services-card.tsx";
const EDIT_CARD = "src/components/presence/edit/edit-listing-card.tsx";
const HOME = "src/components/presence/presence-home.tsx";

const T = "src/lib/presence-extras.test.ts";
const T_CARD = "src/components/presence/edit/extra-cards.test.tsx";
const T_WIRE = "src/lib/presence-extras-wiring.test.ts";
const T_PHOTOS = "src/lib/presence-photos.test.ts";
const t = (file, ...names) => names.map((n) => ({ file, name: n }));

const GATE = "which panels a network draws > a panel is drawn only when the network's declaration offers it; an older api that sends none draws none";
const NOPANELS = (n) => `a panel is drawn only for a network that declares it > ${n}: an api that sends no panels draws nothing`;
const UNDECLARED = (n) => `a panel is drawn only for a network that declares it > ${n}: not declared draws nothing at all (no disabled control)`;
const VALUE = (n) => `a post value > ${n}`;
const V_PLAIN = VALUE("a plain update is built from the words, trimmed");
const V_FULL = VALUE("an edit carries the ref, a button with an https address, an event with its dates and an offer with its terms");
const V_CALL = VALUE("the button that calls the listing's number takes no address");
const V_LEN = VALUE("the length edge: the limit passes, one over is refused and is not shortened for you");
const V_DECL = VALUE("refuses empty words, a kind or a button the network did not declare");
const V_BTN = VALUE("a button needs an https address, and an address needs a button");
const V_EVENT = VALUE("an event and an offer need a title and a real start date; the end must not be before the start; an update sends no dates");
const V_REDEEM = VALUE("the redeem link of an offer must be https");
const SVC_ADD = "services: a whole list that keeps what you did not touch > adding a service keeps every other entry exactly as read, price and description included";
const SVC_DEL = "services: a whole list that keeps what you did not touch > removing one keeps the others exactly as read";
const SVC_OFFER = "services: a whole list that keeps what you did not touch > the network's list offers only what is not held, and adding one already held adds nothing";
const SVC_SAME = "services: a whole list that keeps what you did not touch > an unchanged list is no change; a changed one is sent whole";
const DET_DEP = "details: only what is offered, and clearing removes > a deprecated detail is never offered";
const DET_SET = "details: only what is offered, and clearing removes > setting a detail replaces its entry and keeps the others exactly as read";
const DET_CLEAR = "details: only what is offered, and clearing removes > CLEARING A DETAIL REMOVES IT from the list";
const DET_CHOICE = "details: only what is offered, and clearing removes > one value of a several-choice detail changes alone; none said removes the detail";
const LINK_PREF = "links: https, and one preferred per kind > marking one preferred clears the mark on the others of its kind only";
const LINK_REFUSE = "links: https, and one preferred per kind > refuses an address that is not https, a kind not offered, and two preferred of one kind";
const LINK_ADD = "links: https, and one preferred per kind > adding does not add the same address twice for a kind; removing keeps the others";
const CTL_EDIT = "what a person may press > an editor may edit and delete a post with nothing waiting on it";
const CTL_NOEDIT = "what a person may press > a network that does not let posts be edited offers delete only";
const CTL_WAIT = "what a person may press > a post with a change already waiting has neither, and a role that cannot propose has neither and is told why";
const ACCESS = "what a person may press > an answer that says no is the role's; no answer yet is checking; a failed answer is not blamed on the role";
const KNOWN = "what a person may press > adding and removing wait until the change list has answered, keeping the role's own reason";
const VIEWS = "what a person may press > a read is loading, paused, failed, empty or ready; a failed refresh over data is stale, never an empty list";
const LISTED = "the change list of a panel > is one field's, for one network; sent ones are in flight; settled history is capped but every unsettled change is kept";
const PENDING = "the change list of a panel > what waits on a post is read from the change list, and a create waits on no existing post";
const SETTLED = "the change list of a panel > the panel is read again when a change leaves the in-flight statuses, and not for one still open or new";
const NOTE = "what a post says about itself > a delete says before approval whether it can be brought back";
const STATES = "what a post says about itself > states: showing, processing (may not show yet), not published, and not said; the label is the api's";
const LINES_POST = "the lines of a change card (never raw JSON) > a post shows its kind and words, its button, dates and offer; a delete says it will be removed";
const LINES_LIST = "the lines of a change card (never raw JSON) > services, details and links list their entries";
const WIRE_POSTFORM = "how the panels are wired > the post form: one draft id per opening, a cleared button clears its address, and it starts from the first declared kind";
const WIRE_LINKSLIVE = "how the panels are wired > a links change that settled reloads the listing, whose booking and order addresses it rewrote";
const R1 = (n) => `round one: only what the person added or changed is judged, and nothing a person did not touch is lost > ${n}`;
const R1_LINKS_HELD = R1("a held http link passes when the person changes something else; a NEW link needs https");
const R1_LINKS_KIND = R1("a held link of a kind no longer offered passes; a new one of that kind does not");
const R1_DETAIL_LINK = R1("a held detail link keeps its scheme; a changed one needs a web address");
const R1_RESTORE = R1("a removed service comes back from what the network holds, price and description included, not as a bare one");
const R1_OWN = R1("a service the person names is filed under the network's category; without one, or empty, or twice, nothing is added");
const R1_KEEP = R1("a post keeps its language and its event times through an edit");
const R1_BUTTON = R1("a button the network no longer offers is kept as it is when the person leaves it, and refused when they set it anew");
const R1_EMPTYKIND = R1("a button with an empty kind does not leave an address behind");
const R1_DRAFT = R1("a new post gets a fresh 24-hex draft id each time");
const R1_WORDS = R1("success and waiting words follow the role: only an admin is told to approve");
const R1_STALE = R1("the api's refusal of a stale list is recognised by its code only");
const TITLES = "the lines of a change card (never raw JSON) > each field has a title";
const WIRE_HOME = "how the panels are wired > the page draws the four cards for an editable network, each KEYED by place and network";
const WIRE_SHELL = "how the panels are wired > the shell draws nothing unless the network's declaration offers the panel";
const WIRE_PROPOSE = "how the panels are wired > a proposal carries its place in its variables and is read through outcomeOf; the panel and the change list are refreshed once after it";
const WIRE_EDIT = "how the panels are wired > the edit card lists a change itself only when no panel lists it, for this network only";
const WIRE_POSTS = "how the panels are wired > the posts card reads what waits from the change list, and explains a delete before approval";
const PH_EDIT = "how the panel is wired (pinned as text: b2c vitest renders no DOM) > the edit card lists photo changes itself when the photos card is not drawn, and always lists another network's";
const C_WAIT = "the posts card > what waits on a post is read from the change list: that post has no Edit or Delete and says what is waiting";
const C_PARTIAL = "the posts card > a partial list says so and still allows a new post";
const C_NOEDIT = "the posts card > a network that does not let posts be edited offers delete only";
const C_VIEWER = "the posts card > a viewer sees the posts and no control, and is told it is their role";
const C_CHANGES = "the posts card > until the change list has answered, writing and deleting are withheld and it says why";
const C_SVC_NOTICE = "the services card > when the network's list did not load it says so, still shows what is held, and offers no add";
const C_SVC_LIST = "the services card > lists what the network holds with the network's own names, offers only services not held, and each can be removed";
const C_DET_DEP = "the details card > offers each detail the network offers, never a deprecated one";
const C_DET_HELD = "the details card > what is held but no longer offered is shown and can be removed, not edited";
const C_DET_NOTICE = "the details card > when the network's list did not load, the held details are shown as lines and no editor is drawn";
const C_LINKS = "the links card > lists the links with the api's words, marks the preferred, and says a partner's are not touched";
const C_OTHERNET = "a panel lists its own network's changes > another network's change is not listed under this one";

/** [id, kind, file, anchor, replacement, killers] */
const MUTANTS = [
  // ── panel gating ──
  ["gate-open-unless-denied", "kill", LIB, "return cap?.panels?.[field] === true;", "return cap?.panels?.[field] !== false;", t(T, GATE).concat(t(T_CARD, NOPANELS("posts"), NOPANELS("services"), NOPANELS("links"), NOPANELS("attributes")))],
  ["shell-draws-undeclared", "kill", SHELL, "if (!listing || !network || !target || !drawn) return null;", "if (!listing || !network || !target) return null;", t(T_CARD, UNDECLARED("posts"), UNDECLARED("services"), UNDECLARED("links"), UNDECLARED("attributes")).concat(t(T_WIRE, WIRE_SHELL))],
  ["shell-reads-wrong-panel", "kill", SHELL, "drawsPanel(capabilityOf(caps.data, network), field)", 'drawsPanel(capabilityOf(caps.data, network), "posts")', t(T_CARD, "a panel is drawn only for a network that declares it > one panel declared does not draw another").concat(t(T_WIRE, WIRE_SHELL))],
  ["shell-reads-network-undeclared", "kill", SHELL, "useExtra(field, listing?.id, network, drawn)", "useExtra(field, listing?.id, network)", t(T_WIRE, WIRE_SHELL)],
  ["drawn-fields-ignore-panels", "kill", LIB, "return EXTRA_FIELDS.filter((f) => drawsPanel(cap, f));", "return [...EXTRA_FIELDS];", t(T, GATE)],
  ["page-draws-without-edit", "kill", HOME, "                {editOn ? (\n                  <>\n                    <PostsCard", "                {true ? (\n                  <>\n                    <PostsCard", t(T_WIRE, WIRE_HOME)],
  ["posts-card-not-keyed", "kill", HOME, '<PostsCard key={`posts|${panelLocation ?? ""}|${panelNetwork ?? ""}`} ', "<PostsCard ", t(T_WIRE, WIRE_HOME)],

  // ── the post value ──
  ["post-length-off-by-one", "kill", LIB, "if (summary.length > decl.limits.summaryMaxLength) {", "if (summary.length >= decl.limits.summaryMaxLength) {", t(T, V_LEN)],
  ["post-length-unchecked", "kill", LIB, "if (summary.length > decl.limits.summaryMaxLength) {", "if (false) {", t(T, V_LEN)],
  ["post-empty-words-accepted", "kill", LIB, 'if (!summary) return { ok: false, message: "Write what you want to say." };', "", t(T, V_DECL)],
  ["post-kind-undeclared", "kill", LIB, 'if (!decl.kinds.includes(draft.kind)) return { ok: false, message: "That kind of post is not offered." };', "", t(T, V_DECL)],
  ["post-button-undeclared", "kill", LIB, 'if (!decl.actions.includes(type)) return { ok: false, message: "That button is not offered." };', "", t(T, V_DECL)],
  ["post-button-address-not-https", "kill", LIB, 'if (!HTTPS.test(url)) return { ok: false, message: "The button\'s web address must start with https://." };', "", t(T, V_BTN)],
  ["post-button-without-address", "kill", LIB, 'if (!url) return { ok: false, message: "That button needs a web address." };', "", t(T, V_BTN)],
  ["post-address-without-button", "kill", LIB, 'return { ok: false, message: "Choose a button for that web address, or clear it." };', 'return { ok: true, value: { ...op, kind: draft.kind, summary } as PostValue };', t(T, V_BTN)],
  ["post-call-takes-an-address", "kill", LIB, "if (draft.actionUrl.trim()) return { ok: false, message: \"That button calls your listing's phone number, so it takes no web address.\" };", "", t(T, V_CALL)],
  ["post-event-needs-no-title", "kill", LIB, "    if (!title) return { ok: false, message: `${draft.kind === \"offer\" ? \"An offer\" : \"An event\"} needs a title.` };\n", "", t(T, V_EVENT)],
  ["post-event-start-unchecked", "kill", LIB, 'if (!isDay(draft.start.trim())) return { ok: false, message: "Choose a start date." };', "", t(T, V_EVENT)],
  ["post-event-ends-before-start", "kill", LIB, 'if (end < draft.start.trim()) return { ok: false, message: "The end date is before the start date." };', "", t(T, V_EVENT)],
  ["post-update-sends-dates", "kill", LIB, 'if (draft.kind === "event" || draft.kind === "offer") {\n    const title', "if (true) {\n    const title", t(T, V_PLAIN, V_EVENT)],
  ["post-redeem-not-https", "kill", LIB, 'if (redeemUrl && !HTTPS.test(redeemUrl)) return { ok: false, message: "The redeem link must start with https://." };', "", t(T, V_REDEEM)],
  ["post-offer-drops-terms", "kill", LIB, "...(terms ? { terms } : {}) };\n  }\n  return { ok: true", "};\n  }\n  return { ok: true", t(T, V_FULL)],
  ["post-edit-loses-its-ref", "kill", LIB, "return { ok: true, value: { ...op, ...value } as PostValue };", "return { ok: true, value: { op: op.op, ...value } as PostValue };", t(T, V_FULL)],
  ["delete-note-swapped", "kill", LIB, "return decl.removal.restorable", "return !decl.removal.restorable", t(T, NOTE)],
  ["post-state-live-unsaid", "kill", LIB, 'if (state === "live") return { text: `Showing on ${label}`, tone: "good" };', "", t(T, STATES)],

  // ── what a person may press ──
  ["edit-offered-where-network-refuses", "kill", LIB, "return { edit: decl.edit, remove: true, note: null };", "return { edit: true, remove: true, note: null };", t(T, CTL_NOEDIT).concat(t(T_CARD, C_NOEDIT))],
  ["edit-withheld-everywhere", "kill", LIB, "return { edit: decl.edit, remove: true, note: null };", "return { edit: false, remove: true, note: null };", t(T, CTL_EDIT)],
  ["controls-ignore-waiting-change", "kill", LIB, "  if (pending) return { edit: false, remove: false, note: null };\n", "", t(T, CTL_WAIT)],
  ["controls-ignore-role", "kill", LIB, 'if (access.mode !== "edit") return { edit: false, remove: false, note: access.why };', "", t(T, CTL_WAIT).concat(t(T_CARD, C_VIEWER))],
  ["role-no-is-yes", "kill", LIB, "if (can) return can.propose ? { mode: \"edit\" }", "if (can) return true ? { mode: \"edit\" }", t(T, ACCESS).concat(t(T_CARD, C_VIEWER))],
  ["role-unknown-blamed-on-role", "kill", LIB, 'return { mode: "view", why: `We could not check what your role can do, so ${what} cannot be changed from here right now. Reload the page to try again.` };', "return { mode: \"view\", why: `Your role can look at your ${what} but not change them. Ask an editor, admin or owner.` };", t(T, ACCESS)],
  ["controls-before-changes-known", "kill", LIB, 'if (changes === "data" || changes === "data_stale") return access;', "return access;", t(T, KNOWN).concat(t(T_CARD, C_CHANGES))],
  ["changes-gate-loses-role-reason", "kill", LIB, 'if (access.mode !== "edit") return access;\n  if (changes ===', "if (changes ===", t(T, KNOWN)],
  ["shell-skips-changes-gate", "kill", SHELL, "withChangesKnown(extrasAccess(capsView, caps.data?.can, what), changesView, what)", "extrasAccess(capsView, caps.data?.can, what)", t(T_CARD, C_CHANGES)],
  ["empty-list-reads-as-ready", "kill", LIB, 'return itemCount === 0 ? { kind: "empty", stale } : { kind: "ready", stale };', 'return { kind: "ready", stale };', t(T, VIEWS)],
  ["failed-refresh-hides-data", "kill", LIB, 'if (v === "failed") return { kind: "failed" };', 'if (v === "failed" || v === "data_stale") return { kind: "failed" };', t(T, VIEWS)],

  // ── what waits comes from the change list ──
  ["waiting-ignores-network", "kill", LIB, "(c) => c.field === field && c.network === network)", "(c) => c.field === field)", t(T, LISTED).concat(t(T_CARD, C_OTHERNET))],
  ["sent-is-not-in-flight", "kill", LIB, 'const IN_FLIGHT = [...OPEN, "submitted"];', "const IN_FLIGHT = [...OPEN];", t(T, LISTED, SETTLED)],
  ["listing-caps-open-changes", "kill", LIB, "const keep = new Set([...all.filter((c) => IN_FLIGHT.includes(c.status)), ...settled].map((c) => c.id));", "const keep = new Set([...settled].map((c) => c.id));", t(T, LISTED)],
  ["history-uncapped", "kill", LIB, ".slice(0, settledCap);", ";", t(T, LISTED)],
  ["create-waits-on-an-existing-post", "kill", LIB, ' && (c.after as { op?: string } | null)?.op !== "create");', ");", t(T, PENDING)],
  ["pending-ignores-ref", "kill", LIB, "(c.after as { ref?: string } | null)?.ref === ref &&", "true &&", t(T, PENDING)],
  ["card-reads-waiting-from-nothing", "kill", POSTS, "const pending = pendingForPost(changes, network, p.ref);", "const pending = undefined;", t(T_CARD, C_WAIT).concat(t(T_WIRE, WIRE_POSTS))],
  ["settled-never-detected", "kill", LIB, "for (const id of before) if (!flying.has(id)) return true;", "for (const id of before) if (!flying.has(id) && false) return true;", t(T, SETTLED)],

  // ── services ──
  ["service-add-drops-the-rest", "kill", LIB, "[...current, back ?? { kind: \"listed\", id }]", "[{ kind: \"listed\", id }]", t(T, SVC_ADD)],
  ["service-remove-strips-price", "kill", LIB, "return current.filter((s) => serviceKey(s) !== key);", "return current.filter((s) => serviceKey(s) !== key).map((s) => { const { price: _p, ...rest } = s; return rest as ServiceEntry; });", t(T, SVC_DEL)],
  ["service-remove-removes-all", "kill", LIB, "return current.filter((s) => serviceKey(s) !== key);", "return [];", t(T, SVC_DEL)],
  ["service-offers-held", "kill", LIB, "return (options ?? []).filter((o) => !held.has(o.id));", "return options ?? [];", t(T, SVC_OFFER).concat(t(T_CARD, C_SVC_LIST))],
  ["service-added-twice", "kill", LIB, 'if (current.some((s) => s.kind === "listed" && s.id === id)) return [...current];', 'if (false) return [...current];', t(T, SVC_OFFER)],
  ["service-unchanged-is-a-change", "kill", LIB, 'if (a === b) return { ok: false, message: "Add or remove a service first." };', "", t(T, SVC_SAME)],
  ["services-notice-unsaid", "kill", SERVICES, "{data.optionsNotice && <p", "{false && <p", t(T_CARD, C_SVC_NOTICE)],
  ["services-add-without-choices", "kill", SERVICES, "{canEdit && addable.length > 0 && (", "{canEdit && (", t(T_CARD, C_SVC_NOTICE)],

  // ── details ──
  ["deprecated-detail-offered", "kill", LIB, "return (options ?? []).filter((o) => !o.deprecated);", "return options ?? [];", t(T, DET_DEP).concat(t(T_CARD, C_DET_DEP))],
  ["detail-set-drops-the-rest", "kill", LIB, "current.map((a, i) => (i === at ? entry : a))", "[entry]", t(T, DET_SET)],
  ["detail-clear-keeps-it", "kill", LIB, "return current.filter((a) => a.id !== id);", "return [...current];", t(T, DET_CLEAR, DET_CHOICE)],
  ["detail-clear-removes-all", "kill", LIB, "return current.filter((a) => a.id !== id);", "return [];", t(T, DET_CLEAR)],
  ["choice-all-unsaid-sent-empty", "kill", LIB, "return set.length + unset.length === 0 ? withoutDetail(current, id) : withDetail(", "return false ? withoutDetail(current, id) : withDetail(", t(T, DET_CHOICE)],
  ["choice-keeps-old-state", "kill", LIB, "const set = prev.set.filter((v) => v !== value);", "const set = [...prev.set];", t(T, DET_CHOICE)],
  ["held-but-not-offered-hidden", "kill", "src/components/presence/edit/details-card.tsx", "{canEdit && heldOther.length > 0 && (", "{false && (", t(T_CARD, C_DET_HELD)],
  ["details-notice-unsaid", "kill", "src/components/presence/edit/details-card.tsx", "{data.optionsNotice && <p", "{false && <p", t(T_CARD, C_DET_NOTICE)],
  ["details-edit-without-choices", "kill", "src/components/presence/edit/details-card.tsx", "const canEdit = access.mode === \"edit\" && !waiting && offered.length > 0;", 'const canEdit = access.mode === "edit" && !waiting;', t(T_CARD, C_DET_NOTICE)],

  // ── links ──
  ["preferred-kept-on-others", "kill", LIB, "return i === index ? { ...rest, preferred: true } : l.type === type ? rest : l;", "return i === index ? { ...rest, preferred: true } : l;", t(T, LINK_PREF)],
  ["preferred-cleared-everywhere", "kill", LIB, "return i === index ? { ...rest, preferred: true } : l.type === type ? rest : l;", "return i === index ? { ...rest, preferred: true } : rest;", t(T, LINK_PREF)],
  ["link-not-https", "kill", LIB, 'if (!HTTPS.test(l.uri)) return { ok: false, message: "A new web address must start with https://." };', "", t(T, LINK_REFUSE, R1_LINKS_HELD)],
  ["link-kind-unchecked", "kill", LIB, 'if (!types.some((t) => t.type === l.type)) return { ok: false, message: "That kind of link is not offered." };', "", t(T, LINK_REFUSE)],
  ["two-preferred-allowed", "kill", LIB, 'if (new Set(preferredTypes).size !== preferredTypes.length) return { ok: false, message: "Only one link of each kind can be the preferred one." };', "", t(T, LINK_REFUSE)],
  ["link-added-twice", "kill", LIB, "return current.some((l) => l.type === link.type && l.uri === link.uri) ? [...current] : [...current, link];", "return [...current, link];", t(T, LINK_ADD)],
  ["link-remove-wrong-one", "kill", LIB, "return current.filter((_, i) => i !== index);", "return current.filter((_, i) => i === index);", t(T, LINK_ADD)],
  ["partner-links-unsaid", "kill", "src/components/presence/edit/links-card.tsx", "Links that a partner provides are not shown here and are not changed.", "", t(T_CARD, C_LINKS)],


  // ── round one ──
  ["held-link-judged", "kill", LIB, "    if (held.has(`${l.type}|${l.uri}`)) continue;\n    if (!types.some", "    if (!types.some", t(T, R1_LINKS_HELD, R1_LINKS_KIND)],
  ["held-detail-link-judged", "kill", LIB, "    if (held.has(entryKey(e))) continue;\n", "", t(T, R1_DETAIL_LINK)],
  ["changed-detail-link-unjudged", "kill", LIB, 'if (e.kind === "link" && e.values.some((v) => !WEB.test(v))) return { ok: false, message: "A web address must start with http:// or https://." };', "", t(T, R1_DETAIL_LINK)],
  ["removed-service-comes-back-bare", "kill", LIB, "const back = held.find((s) => s.kind === \"listed\" && s.id === id);\n  return [...current, back ?? { kind: \"listed\", id }];", "return [...current, { kind: \"listed\", id }];", t(T, R1_RESTORE)],
  ["own-service-without-category", "kill", LIB, 'if (!categoryRef) return { ok: false, message: "We cannot file a service of your own until your main category is set." };', "", t(T, R1_OWN)],
  ["own-service-twice", "kill", LIB, "if (current.some((s) => serviceKey(s) === serviceKey(entry))) return", "if (false) return", t(T, R1_OWN)],
  ["post-language-dropped", "kill", LIB, "...(draft.languageCode.trim() ? { languageCode: draft.languageCode.trim() } : {}) };", "};", t(T, R1_KEEP)],
  ["post-event-times-dropped", "kill", LIB, "      ...(draft.startTime ? { startTime: draft.startTime } : {}),\n      ...(draft.endTime ? { endTime: draft.endTime } : {}),\n", "", t(T, R1_KEEP)],
  ["held-button-judged-again", "kill", LIB, "if (type && keptButton) {", "if (false) {", t(T, R1_BUTTON)],
  ["any-button-kept", "kill", LIB, "const keptButton = !!held && held.type.toUpperCase() === type && (held.url ?? \"\") === draft.actionUrl.trim();", "const keptButton = !!held;", t(T, R1_BUTTON)],
  ["no-button-keeps-address", "kill", POSTS, '...(e.target.value === "" || e.target.value === decl.actionWithoutUrl ? { actionUrl: "" } : {})', "...(e.target.value === decl.actionWithoutUrl ? { actionUrl: \"\" } : {})", t(T_WIRE, WIRE_POSTFORM)],
  ["address-without-button-allowed", "kill", LIB, 'return { ok: false, message: "Choose a button for that web address, or clear it." };', 'return { ok: true, value: { ...op, ...value } as PostValue };', t(T, R1_EMPTYKIND, V_BTN)],
  ["draft-id-constant", "kill", LIB, "globalThis.crypto.getRandomValues(bytes);", "bytes.fill(7);", t(T, R1_DRAFT)],
  ["draft-id-per-submit", "kill", POSTS, "const [draftId] = useState(() => newDraftId());", "const draftId = newDraftId();", t(T_WIRE, WIRE_POSTFORM)],
  ["form-starts-from-update", "kill", POSTS, 'emptyPostDraft(data.declaration.kinds[0] ?? "update")', "emptyPostDraft()", t(T_WIRE, WIRE_POSTFORM)],
  ["prepared-words-ignore-role", "kill", LIB, 'can?.approve ? "Review it below, then approve it." : "It is waiting below for an admin or owner to approve."', '"Review it below, then approve it."', t(T, R1_WORDS)],
  ["waiting-words-ignore-role", "kill", LIB, "return can?.approve\n    ? `A change to your ${what} is waiting below. Approve or decline it before making another.`", "return true\n    ? `A change to your ${what} is waiting below. Approve or decline it before making another.`", t(T, R1_WORDS)],
  ["stale-code-any", "kill", LIB, 'return (err as { code?: string } | null)?.code === LIST_CHANGED_CODE;', "return !!err;", t(T, R1_STALE)],
  ["base-not-sent", "kill", SHELL, "proposal: { field, value, ...(base ? { base } : {}) }", "proposal: { field, value }", t(T_WIRE, WIRE_PROPOSE)],
  ["stale-refusal-unhandled", "kill", SHELL, "if (isListChanged(err)) {", "if (false) {", t(T_WIRE, WIRE_PROPOSE)],
  ["shell-gated-on-listing-first", "kill", SHELL, "  if (!declared) return null;\n", "", t(T_CARD, "a panel is drawn only for a network that declares it > a network that declares no panel draws nothing even while its listing has not loaded or failed to load")],
  ["links-change-keeps-listing", "kill", "src/hooks/use-presence-extras.ts", 'if (field === "links") void qc.invalidateQueries({ queryKey: ["presence", "listing"] });', "", t(T_WIRE, WIRE_LINKSLIVE)],
  ["links-canonical-unsaid", "kill", "src/components/presence/edit/links-card.tsx", "booking address on your listing comes from your", "address on your listing comes from your", t(T_CARD, "round one > links: says which kind of link the booking and order addresses come from")],
  ["own-service-needs-no-category", "kill", SERVICES, "disabled={!data.categoryRef}", "", t(T_CARD, "round one > services: a service of your own can be added with a category, and not without one; removal needs no list")],

  // ── the lines of a change card ──
  ["card-lines-skip-posts", "kill", EDIT_LIB, '    case "posts":\n    case "services":', '    case "services":', t(T, LINES_POST)],
  ["card-lines-skip-lists", "kill", EDIT_LIB, '    case "attributes":\n    case "links":\n      return extraValueLines(field, value);', '      return extraValueLines(field, value);', t(T, LINES_LIST)],
  ["post-delete-line-lost", "kill", LIB, 'return ["This post will be removed"];', "return [];", t(T, LINES_POST)],
  ["post-words-lost", "kill", LIB, "const out = [`${KIND_LABEL[kind] ?? \"Post\"}: ${String(v.summary ?? \"\")}`];", "const out: string[] = [];", t(T, LINES_POST)],
  ["field-titles-lost", "kill", EDIT_LIB, "(PANEL_TITLES[field as ExtraField] ?? field)", "field", t(T, TITLES)],

  // ── the card shows what the api says ──
  ["partial-posts-unsaid", "kill", POSTS, "{!data.complete && (", "{false && (", t(T_CARD, C_PARTIAL)],
  ["partial-posts-block-new", "kill", POSTS, '{access.mode === "edit" && !form && (', '{access.mode === "edit" && data.complete && !form && (', t(T_CARD, C_PARTIAL)],

  // ── wiring ──
  ["proposal-without-its-place", "kill", "src/hooks/use-presence-extras.ts", "(v: ExtraTarget & { proposal: ExtraProposal })", "(v: { proposal: ExtraProposal })", t(T_WIRE, WIRE_PROPOSE)],
  ["proposal-counted-unread", "kill", SHELL, "outcomeOf(await m.propose.mutateAsync({ ...target!, proposal: { field, value, ...(base ? { base } : {}) } }))", '({ kind: "prepared", id: "x" } as const)', t(T_WIRE, WIRE_PROPOSE)],
  ["edit-card-lists-twice", "kill", EDIT_CARD, "|| extraFields.has(c.field))", "|| false)", t(T_WIRE, WIRE_EDIT).concat(t(T_PHOTOS, PH_EDIT))],
  ["edit-card-hides-other-networks", "kill", EDIT_CARD, "c.network === network && ((photoChangesElsewhere", "((photoChangesElsewhere", t(T_WIRE, WIRE_EDIT).concat(t(T_PHOTOS, PH_EDIT))],
];

// ── plumbing ──────────────────────────────────────────────────────────────────────────────
const only = process.argv.includes("--only") ? process.argv[process.argv.indexOf("--only") + 1] : undefined;
const orig = new Map();
const read = (f) => {
  if (!orig.has(f)) orig.set(f, readFileSync(f, "utf8"));
  return orig.get(f);
};
const restore = () => {
  for (const [f, s] of orig) writeFileSync(f, s);
};
for (const sig of ["SIGINT", "SIGTERM", "SIGHUP"]) {
  process.on(sig, () => {
    restore();
    process.exit(130);
  });
}
const out = mkdtempSync(join(tmpdir(), "mutate-b2c-pe12-"));
const vitest = "node_modules/vitest/vitest.mjs";

function runSpec(file, tag) {
  const json = join(out, `${tag}.json`);
  if (existsSync(json)) rmSync(json);
  const r = spawnSync(execPath, [vitest, "run", file, "--reporter=json", `--outputFile=${json}`], { encoding: "utf8", timeout: 600_000 });
  if (!existsSync(json)) throw new Error(`the runner produced no report for ${file} (status ${r.status}, signal ${r.signal}): ${String(r.stderr).slice(0, 300)}`);
  const rep = JSON.parse(readFileSync(json, "utf8"));
  const tests = rep.testResults.flatMap((s) => s.assertionResults);
  if (tests.length === 0) throw new Error(`no tests ran in ${file}`);
  return tests.map((x) => ({ title: [...(x.ancestorTitles ?? []), x.title].join(" > "), status: x.status }));
}

let failed = false;
try {
  const produced = new Map();
  for (const [id, , file, anchor, to] of MUTANTS) {
    const src = read(file);
    if (src.includes("\r")) throw new Error(`${file} has CRLF line endings: a multi-line anchor would not match`);
    const n = src.split(anchor).length - 1;
    if (n !== 1) throw new Error(`${id}: anchor appears ${n} times in ${file} (need exactly 1): ${anchor.slice(0, 70)}`);
    const next = src.replace(anchor, () => to);
    if (next === src) throw new Error(`${id}: the mutant changes nothing (inert)`);
    const key = file + "\u0000" + next;
    if (produced.has(key)) throw new Error(`${id} produces the same file as ${produced.get(key)} (two names, one mutation)`);
    produced.set(key, id);
  }
  const specs = [...new Set(MUTANTS.flatMap((m) => m[5].map((k) => k.file)))];
  const baseline = new Map();
  for (const sp of specs) {
    const res = runSpec(sp, "baseline-" + sp.replace(/\W/g, "_"));
    baseline.set(sp, res);
    const red = res.filter((x) => x.status !== "passed");
    if (red.length > 0) throw new Error(`baseline is not green in ${sp}: ${red.map((x) => x.title).join(" | ")}`);
  }
  for (const [id, , , , , killers] of MUTANTS) {
    for (const k of killers) {
      const n = baseline.get(k.file).filter((x) => x.title === k.name).length;
      if (n !== 1) throw new Error(`${id}: killer "${k.name}" appears ${n} times in ${k.file} (need exactly 1)`);
    }
  }
  console.log(`preflight ok: ${MUTANTS.length} mutants, ${specs.length} specs green, every anchor once, every killer once`);

  let killed = 0;
  let ran = 0;
  for (const [id, kind, file, anchor, to, killers] of MUTANTS) {
    if (only && id !== only) continue;
    ran++;
    const src = orig.get(file);
    writeFileSync(file, src.replace(anchor, () => to));
    let verdict;
    try {
      const failedTitles = new Set();
      for (const sp of [...new Set(killers.map((k) => k.file))]) {
        for (const x of runSpec(sp, id)) if (x.status === "failed") failedTitles.add(sp + "::" + x.title);
      }
      const designatedFailed = killers.filter((k) => failedTitles.has(k.file + "::" + k.name));
      const others = [...failedTitles].filter((x) => !killers.some((k) => k.file + "::" + k.name === x));
      if (designatedFailed.length > 0) {
        killed++;
        verdict = `KILLED by ${designatedFailed.length}/${killers.length} designated${others.length ? ` (+${others.length} other)` : ""}`;
      } else if (others.length > 0) {
        failed = true;
        verdict = `WRONG GUARD: failed only ${others.length} non-designated test(s): ${others.slice(0, 2).join(" | ")}`;
      } else {
        failed = true;
        verdict = "SURVIVED";
      }
    } finally {
      writeFileSync(file, src);
    }
    console.log(`${kind === "wrong-way" ? "[wrong-way]" : "[kill]     "} ${id}: ${verdict}`);
  }
  console.log(`\n${killed}/${ran} killed by a designated spec`);
} catch (e) {
  failed = true;
  console.error(String(e.message ?? e));
} finally {
  restore();
  for (const [f, s] of orig) {
    if (readFileSync(f, "utf8") !== s) {
      console.error(`RESTORE FAILED for ${f}`);
      failed = true;
    }
  }
}
process.exit(failed ? 1 : 0);
