"use client";

import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/providers/auth-provider";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { googleAdsApi, type GoogleAdAccount, type GoogleBiddingForm, type GoogleBiddingHistory, type GoogleChannelType } from "@/lib/api/google-ads";
import {
  GOOGLE_BIDDING_FORMS,
  GOOGLE_BIDDING_HISTORY_UNREAD,
  googleBiddingProblem,
  googleBiddingStrategiesFor,
  googleBiddingUnavailable,
  googleBiddingWarning,
  googleBiddingWithPick,
  googleDefaultBiddingLabel,
  googlePortfolioOffered,
  type GoogleBiddingDraft,
  type GoogleBiddingPick,
} from "@/lib/google-bidding-view";

/**
 * ★★G-14b — the Google bidding control (RMF C.96–C.98, M.96–M.98): a strategy,
 * its form (Standard or Portfolio) and its target. Controlled, so the create
 * form (`google-ads-panel.tsx`) and a campaign's bidding dialog
 * (`google-bidding-dialog.tsx`) share it. Every rule and sentence is
 * `google-bidding-view.ts`'s.
 *
 * ★THE TARGET IS THE MERCHANT'S: the "fewer than 15 conversions" warning is
 * shown under it, and nothing here stops it being sent.
 */
export function GoogleBiddingFields({
  channelType,
  currency,
  value,
  onChange,
  history,
  allowDefault,
  disabled,
}: {
  channelType: GoogleChannelType | undefined;
  currency: string | undefined;
  value: GoogleBiddingDraft;
  onChange: (next: GoogleBiddingDraft) => void;
  /** The account's last 30 days, for the warning; absent until read. */
  history: GoogleBiddingHistory | undefined;
  /** The create form offers the type's default (no `bidding` sent); a campaign's dialog does not. */
  allowDefault: boolean;
  disabled?: boolean;
}) {
  const strategies = googleBiddingStrategiesFor(channelType);
  const targeted = value.pick === "TARGET_CPA" || value.pick === "TARGET_ROAS";
  // Shown too while a Portfolio pick is held for a type that takes none (the type changed), so it can be undone here.
  const portfolio = targeted && (googlePortfolioOffered(channelType) || value.form === "portfolio");
  const problem = googleBiddingProblem(channelType, value, allowDefault);
  const warning = googleBiddingWarning(value.pick, history);
  // A pick the type does not offer (the type changed under it) is shown as the problem, not silently swapped.
  const offered = value.pick === "DEFAULT" || strategies.some((s) => s.value === value.pick);
  const pickLabel = (p: GoogleBiddingPick) => (p === "DEFAULT" ? `Default (${googleDefaultBiddingLabel(channelType)})` : (strategies.find((s) => s.value === p)?.label ?? p));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-4">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Bidding</Label>
          <Select value={value.pick} onValueChange={(v) => onChange(googleBiddingWithPick(value, v as GoogleBiddingPick))} disabled={disabled}>
            <SelectTrigger className="w-64">
              <SelectValue>{pickLabel(value.pick)}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {allowDefault ? <SelectItem value="DEFAULT">{pickLabel("DEFAULT")}</SelectItem> : null}
              {strategies.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {portfolio ? (
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Strategy kept as</Label>
            <Select value={value.form} onValueChange={(v) => onChange({ ...value, form: v as GoogleBiddingForm })} disabled={disabled}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {GOOGLE_BIDDING_FORMS.map((f) => (
                  <SelectItem key={f.value} value={f.value} disabled={value.pick !== "DEFAULT" && googleBiddingUnavailable(channelType, value.pick, f.value) !== null}>
                    {f.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}
        {targeted ? (
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">
              {value.pick === "TARGET_CPA" ? `Target cost per conversion${currency ? ` (${currency.toUpperCase()})` : ""}` : "Target return on ad spend (%)"}
            </Label>
            <Input
              type="number"
              min="0"
              step={value.pick === "TARGET_CPA" ? "0.01" : "1"}
              inputMode="decimal"
              value={value.target}
              onChange={(e) => onChange({ ...value, target: e.target.value })}
              placeholder={value.pick === "TARGET_ROAS" ? "350" : ""}
              className="w-44"
              disabled={disabled}
            />
          </div>
        ) : null}
      </div>
      {value.pick !== "DEFAULT" && offered ? (
        <p className="text-xs text-muted-foreground">
          {strategies.find((s) => s.value === value.pick)?.hint}
          {portfolio ? ` ${GOOGLE_BIDDING_FORMS.find((f) => f.value === value.form)?.hint}` : ""}
        </p>
      ) : null}
      {warning ? <p className="text-xs text-warning-on-tint">{warning}</p> : null}
      {problem ? <p className="text-xs text-muted-foreground">{problem}</p> : null}
    </div>
  );
}

/**
 * The control as the create form mounts it: the type's default offered, and
 * the account's history read (`GET /bidding/history`) only once a target
 * strategy is picked, for the warning.
 */
export function GoogleCreateBiddingFields({
  account,
  channelType,
  currency,
  value,
  onChange,
  disabled,
}: {
  account: GoogleAdAccount;
  channelType: GoogleChannelType;
  currency: string | undefined;
  value: GoogleBiddingDraft;
  onChange: (next: GoogleBiddingDraft) => void;
  disabled?: boolean;
}) {
  const { business } = useAuth();
  const targeted = value.pick === "TARGET_CPA" || value.pick === "TARGET_ROAS";
  const history = useQuery({
    queryKey: ["google-ads-bidding-history", business?._id ?? "none", account.id],
    queryFn: () => googleAdsApi.getBiddingHistory(account.id),
    enabled: targeted && !!business,
    retry: false,
    staleTime: 10 * 60_000,
  });
  return (
    <GoogleBiddingFields
      channelType={channelType}
      currency={currency}
      value={value}
      onChange={onChange}
      // An unreadable history is said as such by the warning; a failed request is the same thing to the merchant.
      history={history.data?.history ?? (history.isError ? GOOGLE_BIDDING_HISTORY_UNREAD : undefined)}
      allowDefault
      disabled={disabled}
    />
  );
}
