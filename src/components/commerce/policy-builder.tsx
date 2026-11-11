"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { Check, ExternalLink, Loader2, ScrollText } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import dynamic from "next/dynamic";
import { Highlighted } from "@/components/commerce/knowledge-base";
import {
  useApprovePolicyDraft,
  useGeneratePolicy,
  useKbCapabilities,
  useKbPolicies,
  useKbPublications,
  usePolicyFindings,
  usePolicyPrice,
  usePolicyQuestions,
  usePublishEntry,
  useResolvePublication,
  useSavePolicyAnswers,
  useUnpublish,
} from "@/hooks/use-knowledge-base";
import { useCommerceStores } from "@/hooks/use-commerce-stores";
import { KB_CONTENT_MAX, KB_TITLE_MAX, approveState, groupFindings, placeholdersIn, safeUrl, severityHeading } from "@/lib/knowledge-base";
import {
  DIVERGED_TEXT,
  KEEP_OURS,
  KEEP_OURS_HELP,
  KEEP_THEIRS,
  KEEP_THEIRS_HELP,
  KEEP_THEIRS_POLICY_NOTE,
  MARKET_CHECK_CLEAR,
  MARKET_CHECK_GAVE_UP,
  MARKET_CHECK_PENDING,
  NO_CHANNELS_LINE,
  POLICY_TYPES,
  RECONNECT_HREF,
  REMOVE_LABEL,
  TOP_UP_HREF,
  acceptable,
  buildSaveBody,
  channelLabelFor,
  countryName,
  findingNotice,
  findingSourceHref,
  generateErrorLine,
  generatedLine,
  marketCheckLines,
  marketsLine,
  offerLine,
  parseMarketsBox,
  policyLabel,
  policyStatus,
  policyStatusLine,
  priceCard,
  publicationLine,
  publishButtons,
  publishErrorLine,
  quoteLapsed,
  resolvedLine,
  runPolicyApprove,
  slotWords,
  sourceLine,
  splitOffer,
  valueText,
  valueToRaw,
  type AnswerShape,
  type CapabilitiesResponse,
  type GenerateResponse,
  type MarketCheck,
  type PolicyPrice,
  type PolicyRow,
  type PolicyType,
  type Prefill,
  type PublishButton,
  type PublishContext,
  type Publication,
  type Question,
} from "@/lib/policy-builder";

// the Drive picker is large: it loads when the screen is opened, not with the page (the route's first-load JS is budgeted)
const UploadPanel = dynamic(() => import("@/components/commerce/policy-upload"), { loading: () => <Skeleton className="h-32 w-full" /> });

/**
 * Commerce -> Assistant answers -> Policies. Answer a few questions about a policy (some are filled in from your orders), write it, check it against your
 * markets' rules, approve it, and publish it. Nothing is used by your assistant or put on a site until you approve or publish it.
 *
 * The decisions (which buttons, which words, the price card, what is sent) are in `lib/policy-builder.ts`; this file only draws them and passes the calls in.
 */
export function PolicyBuilder() {
  const policies = useKbPolicies();
  const stores = useCommerceStores();
  const caps = useKbCapabilities();
  const [open, setOpen] = useState<PolicyType | null>(null);
  // a business with no store connection publishes to its website: that is then the main path, so it is said first
  const noStore = stores.data !== undefined && stores.data.length === 0;

  let body: React.ReactNode;
  if (policies.isLoading) body = <Skeleton className="h-24 w-full" />;
  else if (policies.isError && !policies.data)
    body = (
      <div role="alert" className="flex flex-wrap items-center gap-2 text-sm text-destructive">
        Could not load your policies.
        <Button size="sm" variant="outline" onClick={() => void policies.refetch()}>
          Try again
        </Button>
      </div>
    );
  else if (!policies.data) body = null;
  else body = <PolicyList data={policies.data.policies} open={open} onOpen={(t) => setOpen((cur) => (cur === t ? null : t))} />;

  return (
    <section aria-labelledby="kb-policies" className="space-y-3">
      <h2 id="kb-policies" className="flex items-center gap-2 text-lg font-semibold">
        <ScrollText className="size-5" aria-hidden="true" />
        Policies
      </h2>
      <p className="text-sm text-muted-foreground">
        Write your returns, shipping and other policies from a few answers, check them against the rules of your markets, and publish them. Your assistant and your site use a policy only after you approve it.
      </p>
      {noStore && <WebsiteBand caps={caps.data} />}
      {body}
      {open && <PolicyEditor key={open} type={open} onClose={() => setOpen(null)} />}
      <UploadPanel />
    </section>
  );
}

/** For a business with no store: the website is where its policies go. Says so, and where to connect it when nothing is connected. */
export function WebsiteBand({ caps }: { caps: CapabilitiesResponse | undefined }) {
  const connected = (caps?.channels.length ?? 0) > 0;
  return (
    <div data-kb-website-band className="rounded-md border-2 border-primary/40 bg-primary/5 p-3 text-sm">
      <p className="font-medium">Publish your policies to your website</p>
      <p className="text-muted-foreground">
        {connected ? "Once a policy is approved you can publish it to your website from here." : NO_CHANNELS_LINE}{" "}
        {!connected && (
          <Link href={RECONNECT_HREF} className="font-medium underline underline-offset-2">
            Connect your website
          </Link>
        )}
      </p>
    </div>
  );
}

export function PolicyList({ data, open, onOpen }: { data: Record<PolicyType, PolicyRow[]>; open: PolicyType | null; onOpen: (t: PolicyType) => void }) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {POLICY_TYPES.map((t) => (
        <PolicyCard key={t} type={t} rows={data[t] ?? []} open={open === t} onOpen={() => onOpen(t)} />
      ))}
    </ul>
  );
}

export function PolicyCard({ type, rows, open, onOpen }: { type: PolicyType; rows: PolicyRow[]; open: boolean; onOpen: () => void }) {
  const status = policyStatus(rows);
  return (
    <li>
      <Card>
        <CardContent className="space-y-2 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-medium">{policyLabel(type)}</p>
            <Badge variant={status === "live" ? "default" : "outline"}>{policyStatusLine(status)}</Badge>
          </div>
          {rows.length > 0 && (
            <ul className="text-xs text-muted-foreground">
              {rows.map((r) => (
                <li key={r.id}>
                  {marketsLine(r.markets)}: {r.status === "active" ? "live" : "answers saved"}
                </li>
              ))}
            </ul>
          )}
          <Button size="sm" variant={status === "not_started" ? "default" : "outline"} aria-expanded={open} aria-label={`${status === "not_started" ? "Set up" : "Open"} ${policyLabel(type).toLowerCase()} policy`} onClick={onOpen}>
            {open ? "Close" : status === "not_started" ? "Set up" : "Open"}
          </Button>
        </CardContent>
      </Card>
    </li>
  );
}

// -- One policy ---------------------------------------------------------------------------------------------------------------

function PolicyEditor({ type, onClose }: { type: PolicyType; onClose: () => void }) {
  const [markets, setMarkets] = useState<string[]>([]);
  const [chosen, setChosen] = useState(false);
  const [box, setBox] = useState("");
  const [boxError, setBoxError] = useState<string | null>(null);
  const boxId = useId();
  const apply = (raw: string) => {
    const r = parseMarketsBox(raw);
    if (!r.ok) return setBoxError(r.error);
    setBoxError(null);
    setMarkets(r.markets);
  };
  const split = (list: string[]) => {
    setChosen(true);
    setBox(list.join(", "));
    setBoxError(null);
    setMarkets(list);
  };
  return (
    <Card>
      <CardContent className="space-y-4 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-base font-semibold">{policyLabel(type)} policy</h3>
          <Button size="sm" variant="ghost" onClick={onClose}>
            Close
          </Button>
        </div>
        <fieldset className="space-y-2 text-sm">
          <legend className="font-medium">Which countries is this policy for?</legend>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={chosen}
              onChange={(e) => {
                setChosen(e.target.checked);
                if (!e.target.checked) {
                  setMarkets([]);
                  setBox("");
                  setBoxError(null);
                }
              }}
            />
            Only some countries (leave this off for every country)
          </label>
          {chosen && (
            <div className="space-y-1">
              <label htmlFor={boxId} className="block text-xs text-muted-foreground">
                Two-letter country codes, separated by commas, such as GB, IN
              </label>
              <Input id={boxId} value={box} aria-invalid={boxError ? true : undefined} aria-describedby={boxError ? `${boxId}-err` : undefined} onChange={(e) => setBox(e.target.value)} onBlur={() => apply(box)} placeholder="GB, IN" />
              {boxError && (
                <p id={`${boxId}-err`} role="alert" className="text-sm text-destructive">
                  {boxError}
                </p>
              )}
              {markets.length > 0 && <p className="text-xs text-muted-foreground">{markets.map(countryName).join(", ")}</p>}
            </div>
          )}
        </fieldset>
        <PolicyBody key={markets.join(",")} type={type} markets={markets} onSplit={split} />
      </CardContent>
    </Card>
  );
}

function PolicyBody({ type, markets, onSplit }: { type: PolicyType; markets: string[]; onSplit: (m: string[]) => void }) {
  const q = usePolicyQuestions(type, markets);
  if (q.isLoading) return <Skeleton className="h-32 w-full" />;
  if (q.isError && !q.data)
    return (
      <div role="alert" className="flex flex-wrap items-center gap-2 text-sm text-destructive">
        Could not load the questions.
        <Button size="sm" variant="outline" onClick={() => void q.refetch()}>
          Try again
        </Button>
      </div>
    );
  if (!q.data) return null;
  return <AnswersAndWrite type={type} markets={markets} questions={q.data.questions} note={q.data.prefillNote} onSplit={onSplit} />;
}

function AnswersAndWrite({ type, markets, questions, note, onSplit }: { type: PolicyType; markets: string[]; questions: Question[]; note?: string; onSplit: (m: string[]) => void }) {
  const initial = () => Object.fromEntries(questions.map((q) => [q.fact, valueToRaw(q.shape, q.answer)]));
  const [raw, setRaw] = useState<Record<string, string>>(initial);
  const [saved, setSaved] = useState<Record<string, string>>(initial);
  const [accepted, setAccepted] = useState<ReadonlySet<string>>(new Set());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [summary, setSummary] = useState<string | null>(null);
  const save = useSavePolicyAnswers(type);
  const dirty = questions.some((q) => (raw[q.fact] ?? "") !== (saved[q.fact] ?? ""));

  const doSave = async () => {
    const r = buildSaveBody(questions, raw, accepted, markets);
    if (!r.ok) {
      setErrors(r.errors);
      setSummary(r.summary);
      return;
    }
    setErrors({});
    setSummary(null);
    try {
      await save.mutateAsync(r.body);
      setSaved({ ...raw });
      toast.success("Answers saved. Nothing is written or published yet.");
    } catch (e) {
      setSummary(e instanceof Error && e.message ? e.message : "That did not save. Please try again.");
    }
  };

  return (
    <>
      <div className="space-y-4">
        {note && <p className="text-xs text-muted-foreground">{note}</p>}
        {questions.map((q) => (
          <QuestionField
            key={q.fact}
            q={q}
            value={raw[q.fact] ?? ""}
            savedValue={saved[q.fact] ?? ""}
            error={errors[q.fact]}
            onChange={(v) => setRaw((r) => ({ ...r, [q.fact]: v }))}
            onUse={(p) => {
              setRaw((r) => ({ ...r, [q.fact]: valueToRaw(q.shape, p.value) }));
              setAccepted((a) => new Set(a).add(q.fact));
            }}
          />
        ))}
        {summary && (
          <p role="alert" className="text-sm text-destructive">
            {summary}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" onClick={() => void doSave()} disabled={save.isPending}>
            {save.isPending && <Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" />}
            Save answers
          </Button>
          {dirty && <span className="text-xs text-muted-foreground">You have changes that are not saved yet.</span>}
        </div>
      </div>
      <WriteSection type={type} markets={markets} dirty={dirty} onSplit={onSplit} />
    </>
  );
}

/** One question: its box, what we already know (with a Use button), where the saved answer came from, and its error. */
export function QuestionField({
  q,
  value,
  savedValue,
  error,
  onChange,
  onUse,
}: {
  q: Question;
  value: string;
  savedValue: string;
  error?: string;
  onChange: (v: string) => void;
  onUse: (p: Prefill) => void;
}) {
  const id = useId();
  const helpId = `${id}-help`;
  const errId = `${id}-err`;
  const from = value === savedValue ? sourceLine(q.answerSource) : null;
  const describedBy = [q.help ? helpId : null, error ? errId : null].filter(Boolean).join(" ") || undefined;
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-sm font-medium">
        {q.ask}
      </label>
      {q.help && (
        <p id={helpId} className="text-xs text-muted-foreground">
          {q.help}
        </p>
      )}
      <AnswerInput id={id} shape={q.shape} value={value} invalid={!!error} describedBy={describedBy} onChange={onChange} />
      {error && (
        <p id={errId} role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {from && <p className="text-xs text-muted-foreground">{from}</p>}
      {q.prefill.map((p, i) => (
        <div key={`${p.kind}-${i}`} data-kb-prefill className="flex flex-wrap items-center gap-2 rounded-md bg-muted/50 px-2 py-1 text-xs">
          <span>{offerLine(p)}</span>
          {acceptable(p) && valueToRaw(q.shape, p.value) !== value && (
            <Button type="button" size="sm" variant="outline" className="h-6 px-2 text-xs" aria-label={`Use ${valueText(p.value)} for: ${q.ask}`} onClick={() => onUse(p)}>
              Use this
            </Button>
          )}
        </div>
      ))}
    </div>
  );
}

const UNIT: Record<string, string> = { days: "days", hours: "hours", months: "months", percent: "percent", money: "in your store's currency" };

export function AnswerInput({ id, shape, value, invalid, describedBy, onChange }: { id: string; shape: AnswerShape; value: string; invalid: boolean; describedBy?: string; onChange: (v: string) => void }) {
  const common = { id, "aria-invalid": invalid ? true : undefined, "aria-describedby": describedBy } as const;
  const selectClass = "rounded-md border bg-background px-2 py-1.5 text-sm";
  switch (shape.kind) {
    case "yesno":
      return (
        <select {...common} className={selectClass} value={value} onChange={(e) => onChange(e.target.value)}>
          <option value="">Not answered</option>
          <option value="yes">Yes</option>
          <option value="no">No</option>
        </select>
      );
    case "choice":
      return (
        <select {...common} className={selectClass} value={value} onChange={(e) => onChange(e.target.value)}>
          <option value="">Not answered</option>
          {shape.options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      );
    case "days":
    case "hours":
    case "months":
    case "money":
    case "percent":
      return (
        <span className="flex items-center gap-2">
          <Input {...common} type="number" inputMode="decimal" min={shape.min} max={shape.max} className="w-32" value={value} onChange={(e) => onChange(e.target.value)} />
          <span className="text-xs text-muted-foreground">{UNIT[shape.kind]}</span>
        </span>
      );
    case "list":
      return <Textarea {...common} rows={3} value={value} onChange={(e) => onChange(e.target.value)} placeholder="One per line" />;
    case "markets":
      return <Input {...common} value={value} onChange={(e) => onChange(e.target.value)} placeholder="GB, IN" />;
    case "time":
      return <Input {...common} className="w-32" value={value} onChange={(e) => onChange(e.target.value)} placeholder="09:30" />;
    case "text":
      return <Textarea {...common} rows={2} maxLength={shape.maxLength} value={value} onChange={(e) => onChange(e.target.value)} />;
  }
}

// -- Writing, the price first ------------------------------------------------------------------------------------------------

/** The price card: BEFORE the click, with the balance and a top-up link when it is short. */
export function PriceCardView({ price }: { price: PolicyPrice }) {
  const card = priceCard(price);
  return (
    <div data-kb-price className="space-y-1 rounded-md border p-3 text-sm">
      <p className="font-medium">Price: {card.price}</p>
      {card.lines.map((l) => (
        <p key={l} className="text-muted-foreground">
          {l}
        </p>
      ))}
      {card.short && (
        <p>
          <Link href={TOP_UP_HREF} className="font-medium underline underline-offset-2">
            Add Peaks
          </Link>
        </p>
      )}
    </div>
  );
}

function WriteSection({ type, markets, dirty, onSplit }: { type: PolicyType; markets: string[]; dirty: boolean; onSplit: (m: string[]) => void }) {
  const price = usePolicyPrice(type, markets);
  const gen = useGeneratePolicy(type);
  const [written, setWritten] = useState<Extract<GenerateResponse, { drafted: true }> | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [topUp, setTopUp] = useState(false);
  const card = price.data ? priceCard(price.data) : null;
  const blockedReason = dirty ? "Save your answers first, so the policy is written from them." : card?.needsAnswers ? "Save your answers first, then we can write the policy." : null;

  const click = async () => {
    const p = price.data;
    if (!p || gen.isPending) return;
    setMessage(null);
    setTopUp(false);
    // the signed price is refused once it lapses; read it again and let the merchant look at it before charging
    if (quoteLapsed(p, Date.now())) {
      await price.refetch();
      setMessage("The price was out of date. Check it below, then click again.");
      return;
    }
    try {
      const r = await gen.mutateAsync({ markets, quoteToken: p.token });
      if (!r.drafted) setMessage(r.message);
      else setWritten(r);
    } catch (e) {
      const line = generateErrorLine(e);
      setMessage(line.message);
      setTopUp(line.topUp);
      if (line.refreshPrice) void price.refetch();
    }
  };

  return (
    <div className="space-y-3 border-t pt-4">
      <h4 className="text-sm font-semibold">Write my policy</h4>
      {price.isLoading ? (
        <Skeleton className="h-16 w-full" />
      ) : price.data ? (
        <PriceCardView price={price.data} />
      ) : (
        <p role="alert" className="text-sm text-destructive">
          We cannot show the price right now, so nothing can be written. Please try again later.
        </p>
      )}
      {blockedReason && <p className="text-sm text-muted-foreground">{blockedReason}</p>}
      {message && (
        <p role="alert" className="text-sm text-destructive">
          {message}{" "}
          {topUp && (
            <Link href={TOP_UP_HREF} className="font-medium underline underline-offset-2">
              Add Peaks
            </Link>
          )}
        </p>
      )}
      <Button size="sm" onClick={() => void click()} disabled={!price.data || gen.isPending || !!blockedReason}>
        {gen.isPending && <Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" />}
        Write my policy
      </Button>
      {written && <DraftReview key={written.entry.id + written.entry.content} response={written} type={type} markets={markets} onSplit={onSplit} />}
    </div>
  );
}

// -- The draft, its market findings, approval --------------------------------------------------------------------------------

function DraftReview({ response, type, markets, onSplit }: { response: Extract<GenerateResponse, { drafted: true }>; type: PolicyType; markets: string[]; onSplit: (m: string[]) => void }) {
  const [title, setTitle] = useState(response.entry.title);
  const [content, setContent] = useState(response.entry.content);
  const [error, setError] = useState<string | null>(null);
  const [stale, setStale] = useState(false);
  const [approvedLine, setApprovedLine] = useState<string | null>(null);
  const approve = useApprovePolicyDraft();
  const state = approveState(title, content);
  const reasonId = useId();
  const needsFacts = response.needsFacts;

  const doApprove = async () => {
    setError(null);
    const r = await runPolicyApprove((p) => approve.mutateAsync({ id: response.entry.id, ...p }), title, content);
    if (r.ok) setApprovedLine(r.line);
    else {
      setError(r.error);
      setStale(r.stale);
    }
  };

  return (
    <div className="space-y-3">
      <p role="status" className="flex items-start gap-2 text-sm">
        <Check className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        {generatedLine(response)}
      </p>
      <label className="block space-y-1 text-sm">
        <span className="font-medium">Title</span>
        <Input value={title} maxLength={KB_TITLE_MAX} disabled={approvedLine !== null} onChange={(e) => setTitle(e.target.value)} />
      </label>
      <label className="block space-y-1 text-sm">
        <span className="font-medium">Your policy</span>
        <Textarea rows={10} value={content} maxLength={KB_CONTENT_MAX} disabled={approvedLine !== null} onChange={(e) => setContent(e.target.value)} />
      </label>
      {placeholdersIn(`${title}\n${content}`).length > 0 && (
        <div data-kb-preview className="space-y-1 rounded-md border p-2 text-sm">
          <p className="whitespace-pre-line">
            <Highlighted text={content} />
          </p>
        </div>
      )}
      {needsFacts.length > 0 && (
        <div className="text-sm">
          <p className="font-medium">We left these for you to fill in:</p>
          <ul className="list-disc pl-5 text-muted-foreground">
            {needsFacts.map((n, i) => (
              <li key={`${i}-${n}`}>{n}</li>
            ))}
          </ul>
        </div>
      )}
      <MarketFindingsSection type={type} markets={markets} response={response} onSplit={onSplit} />
      {approvedLine === null ? (
        <>
          {!state.enabled && (
            <p id={reasonId} className="text-sm text-muted-foreground">
              {state.reason}
            </p>
          )}
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          {stale && <p className="text-xs text-muted-foreground">Your edits to this draft are not kept when you write it again.</p>}
          <Button size="sm" onClick={() => void doApprove()} disabled={approve.isPending || !state.enabled} aria-describedby={state.enabled ? undefined : reasonId}>
            {approve.isPending && <Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" />}
            Approve this policy
          </Button>
        </>
      ) : (
        <>
          <p role="status" className="flex items-start gap-2 text-sm">
            <Check className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            {approvedLine}
          </p>
          <PublishPanel entryId={response.entry.id} ctx={{ policyType: type, markets }} />
        </>
      )}
    </div>
  );
}

function MarketFindingsSection({ type, markets, response, onSplit }: { type: PolicyType; markets: string[]; response: Extract<GenerateResponse, { drafted: true }>; onSplit: (m: string[]) => void }) {
  const pending = response.marketCheck === "pending" && response.marketFindings === null;
  // the generate reply said "pending": the free findings read runs the same check on the draft's own text
  const polled = usePolicyFindings(type, markets, pending);
  const check: MarketCheck | null = response.marketFindings ?? polled.data?.marketFindings ?? null;
  if (check) return <MarketFindingsView check={check} markets={markets} onSplit={onSplit} />;
  if (pending && polled.isError) return <p className="text-sm text-muted-foreground">{MARKET_CHECK_GAVE_UP}</p>;
  return (
    <p role="status" className="text-sm text-muted-foreground">
      {MARKET_CHECK_PENDING}
    </p>
  );
}

/** The market findings: the api's words ("worth a revisit"), the official source as a link, and the "not legal advice" line on every one. */
export function MarketFindingsView({ check, markets, onSplit }: { check: MarketCheck; markets: readonly string[]; onSplit?: (m: string[]) => void }) {
  const groups = groupFindings(check.findings);
  const extra = marketCheckLines(check);
  const offer = splitOffer(check, markets);
  return (
    <div data-kb-market-findings className="space-y-3">
      {check.findings.length === 0 ? (
        <p className="text-sm text-muted-foreground">{MARKET_CHECK_CLEAR}</p>
      ) : (
        groups.map((g) => (
          <div key={g.severity} data-kb-severity={g.severity} className="space-y-2">
            <h5 className="text-sm font-semibold">{severityHeading(g.severity)}</h5>
            <ul className="space-y-2">
              {g.findings.map((f) => {
                const href = findingSourceHref(f);
                return (
                  <li key={`${f.ruleKey}-${f.market}`} className="space-y-1 rounded-md border p-3 text-sm">
                    {f.market !== "*" && <p className="text-xs text-muted-foreground">{countryName(f.market)}</p>}
                    {f.quote && <blockquote className="border-l-2 pl-3 italic">{f.quote}</blockquote>}
                    <p>{f.why}</p>
                    <p className="whitespace-pre-line">{f.suggestion}</p>
                    <p className="text-xs text-muted-foreground">
                      {href && (
                        <>
                          <a href={href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 underline">
                            {f.source.title || "Official source"} <ExternalLink className="size-3" aria-hidden="true" />
                          </a>
                          {" · "}
                        </>
                      )}
                      {findingNotice(f)}
                    </p>
                  </li>
                );
              })}
            </ul>
          </div>
        ))
      )}
      {extra.map((l) => (
        <p key={l} className="text-sm text-muted-foreground">
          {l}
        </p>
      ))}
      {offer && onSplit && (
        <div className="space-y-1 text-sm">
          <p>{offer.text}</p>
          <div className="flex flex-wrap gap-2">
            {offer.markets.map((m) => (
              <Button key={m} size="sm" variant="outline" onClick={() => onSplit([m])}>
                Write one for {countryName(m)}
              </Button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// -- Publishing ---------------------------------------------------------------------------------------------------------------

/** Where an approved entry is published, and the buttons to publish it: drawn from the api's capabilities only. */
export function PublishPanel({ entryId, ctx }: { entryId: string; ctx: PublishContext }) {
  const caps = useKbCapabilities();
  const pubs = useKbPublications(entryId);
  if (caps.isLoading) return <Skeleton className="h-10 w-full" />;
  if (caps.isError && !caps.data)
    return (
      <div role="alert" className="flex flex-wrap items-center gap-2 text-sm text-destructive">
        Could not load where you can publish.
        <Button size="sm" variant="outline" onClick={() => void caps.refetch()}>
          Try again
        </Button>
      </div>
    );
  return <PublishPanelView entryId={entryId} caps={caps.data} publications={pubs.data?.publications ?? []} checking={pubs.isFetching} checkFailed={pubs.isError} ctx={ctx} />;
}

export function PublishPanelView({
  entryId,
  caps,
  publications,
  checking,
  checkFailed,
  ctx,
}: {
  entryId: string;
  caps: CapabilitiesResponse | undefined;
  publications: Publication[];
  checking: boolean;
  checkFailed: boolean;
  ctx: PublishContext;
}) {
  const publish = usePublishEntry();
  const [errors, setErrors] = useState<Record<string, { message: string; reapprove: boolean }>>({});
  const [done, setDone] = useState<string | null>(null);
  const buttons = publishButtons(caps, ctx);
  const noChannels = (caps?.channels.length ?? 0) === 0;
  // a copy that is out and changed on the site is settled in its banner, not republished over
  const diverged = new Set(publications.filter((p) => p.state === "diverged").map((p) => `${p.channel}:${p.slot}`));

  const run = async (b: PublishButton) => {
    setErrors((e) => Object.fromEntries(Object.entries(e).filter(([k]) => k !== b.key)));
    setDone(null);
    try {
      await publish.mutateAsync({ id: entryId, channel: b.channel, slot: b.slot, connectionId: b.connectionId });
      setDone(`Published as ${slotWords(b.slot).noun} on ${b.target}.`);
    } catch (e) {
      setErrors((x) => ({ ...x, [b.key]: publishErrorLine(e) }));
    }
  };

  return (
    <div data-kb-publish className="space-y-3 rounded-md border p-3">
      <h4 className="text-sm font-semibold">Publish</h4>
      {publications.map((p) => (
        <PublicationRow key={p.id} pub={p} caps={caps} />
      ))}
      {checking && publications.length === 0 && <p className="text-xs text-muted-foreground">Checking where this is published...</p>}
      {checkFailed && <p className="text-xs text-muted-foreground">We could not check where this is published just now.</p>}
      {noChannels ? (
        <p className="text-sm text-muted-foreground">
          {NO_CHANNELS_LINE}{" "}
          <Link href={RECONNECT_HREF} className="font-medium underline underline-offset-2">
            Connect it
          </Link>
        </p>
      ) : (
        <ul className="space-y-2">
          {buttons
            .filter((b) => !diverged.has(`${b.channel}:${b.slot}`))
            .map((b) => {
              const err = errors[b.key];
              const has = publications.some((p) => p.channel === b.channel && p.slot === b.slot);
              return (
                <li key={b.key} className="space-y-1 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <Button size="sm" variant="outline" disabled={!b.enabled || publish.isPending} onClick={() => void run(b)} aria-label={`${has ? "Publish again" : b.label} to ${b.target}`}>
                      {publish.isPending && publish.variables?.slot === b.slot && publish.variables?.connectionId === b.connectionId && <Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" />}
                      {has ? "Publish again" : b.label}
                    </Button>
                    <span className="text-xs text-muted-foreground">to {b.target}</span>
                  </div>
                  {b.note && (
                    <p className="text-xs text-muted-foreground">
                      {b.note}{" "}
                      {b.reapprove && (
                        <Link href={RECONNECT_HREF} className="font-medium underline underline-offset-2">
                          Reconnect
                        </Link>
                      )}
                    </p>
                  )}
                  {b.help && <p className="text-xs text-muted-foreground">{b.help}</p>}
                  {err && (
                    <p role="alert" className="text-xs text-destructive">
                      {err.message}{" "}
                      {err.reapprove && (
                        <Link href={RECONNECT_HREF} className="font-medium underline underline-offset-2">
                          Reconnect
                        </Link>
                      )}
                    </p>
                  )}
                </li>
              );
            })}
        </ul>
      )}
      {done && (
        <p role="status" className="text-sm">
          {done}
        </p>
      )}
    </div>
  );
}

/** One publication: where it is live, whether it is out of date, and, when the site's text was changed, the banner with both ways out. */
export function PublicationRow({ pub, caps }: { pub: Publication; caps: CapabilitiesResponse | undefined }) {
  const line = publicationLine(pub, channelLabelFor(caps, pub.channel));
  const resolve = useResolvePublication();
  const remove = useUnpublish();
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const href = safeUrl(pub.url);
  const busy = resolve.isPending || remove.isPending;
  const store = pub.store ?? channelLabelFor(caps, pub.channel);

  const settle = async (keep: "ours" | "theirs") => {
    setError(null);
    try {
      await resolve.mutateAsync({ id: pub.id, keep });
      setNote(resolvedLine(keep, pub.slot));
    } catch (e) {
      setError(publishErrorLine(e).message);
    }
  };
  const take = async () => {
    setError(null);
    try {
      await remove.mutateAsync(pub.id);
    } catch (e) {
      setError(publishErrorLine(e).message);
    }
  };
  return (
    <div data-kb-publication={pub.state} className="space-y-2 text-sm">
      <p className={line.tone === "bad" ? "text-destructive" : line.tone === "warn" ? "font-medium" : undefined}>{line.text}</p>
      {pub.checkError && <p className="text-xs text-muted-foreground">We could not read it back just now: {pub.checkError}</p>}
      {href && (
        <a href={href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs underline">
          See it on {store} <ExternalLink className="size-3" aria-hidden="true" />
        </a>
      )}
      {pub.state === "diverged" && (
        <div data-kb-diverged role="group" aria-label="Your site's text was changed" className="space-y-2 rounded-md border-2 border-warning/50 p-3">
          <p className="font-medium">You changed this on {store} after Peakhour published it.</p>
          <p className="text-muted-foreground">{DIVERGED_TEXT}</p>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="space-y-1">
              <Button size="sm" variant="outline" disabled={busy} onClick={() => void settle("ours")}>
                {KEEP_OURS}
              </Button>
              <p className="text-xs text-muted-foreground">{KEEP_OURS_HELP}</p>
            </div>
            <div className="space-y-1">
              <Button size="sm" variant="outline" disabled={busy} onClick={() => void settle("theirs")}>
                {KEEP_THEIRS}
              </Button>
              <p className="text-xs text-muted-foreground">{KEEP_THEIRS_HELP}</p>
              {pub.slot === "legal_policy" && <p className="text-xs text-muted-foreground">{KEEP_THEIRS_POLICY_NOTE}</p>}
            </div>
          </div>
        </div>
      )}
      {pub.state !== "diverged" && (
        <Button size="sm" variant="ghost" disabled={busy} onClick={() => void take()}>
          {REMOVE_LABEL}
        </Button>
      )}
      {note && (
        <p role="status" className="text-sm">
          {note}
        </p>
      )}
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

/** A "Publish" disclosure for an entry in the list. The panel (and its read-back of where the entry is published) loads only when it is opened. */
export function EntryPublish({ entryId }: { entryId: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="space-y-2">
      <Button size="sm" variant="ghost" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        {open ? "Hide publishing" : "Publish"}
      </Button>
      {open && <PublishPanel entryId={entryId} ctx={{}} />}
    </div>
  );
}
