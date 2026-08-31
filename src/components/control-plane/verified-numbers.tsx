"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  BadgeCheck,
  Clock,
  MoreVertical,
  Plus,
  ShieldOff,
  Smartphone,
} from "lucide-react";
import { ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ConfirmDialog } from "@/components/molecules/confirm-dialog";
import type { MerchantContact } from "@/lib/api/control-plane";
import type { TeamMember } from "@/lib/auth";
import {
  assignableMembers,
  codeCountdown,
  contactHolders,
  contactsFor,
  describeQuietHours,
  hasLiveNumber,
  formatWaId,
  isPlausibleWaId,
  memberLabel,
  normaliseWaIdInput,
  registrationInputFor,
} from "@/lib/control-plane";
import {
  useRegisterContact,
  useResendCode,
  useRevokeContact,
  useVerifyContact,
} from "@/hooks/use-control-plane";
import { PreferencesDialog } from "./preferences-dialog";

/**
 * §02's "Verified numbers" — one row per person, and the state of their number.
 *
 * ── ⚠️★★REGISTERING AND VERIFYING ARE DIFFERENT PEOPLE ───────────────────
 *
 * Registering a number is an assertion about somebody else's identity, so it is
 * Owner/Admin. **Confirming it is the contact's own action and nobody else's** —
 * an Owner entering a teammate's code gets 403 `NOT_YOUR_NUMBER`, because the
 * row asserts `waId → userId` and an authenticated submit is what proves BOTH
 * halves: the session says which user, the code says which number.
 *
 * ★So the person who can finish a pending row is usually not the person looking
 * at the screen, and the page has to SAY so rather than offer a code box that
 * will 403. That is why the code box appears only on the viewer's OWN row.
 */

function StatusBadge({
  contact,
  now,
}: {
  contact: MerchantContact;
  now: number;
}) {
  if (contact.status === "verified") {
    return (
      <Badge variant="secondary" className="gap-1">
        <BadgeCheck className="size-3" aria-hidden />
        Verified
      </Badge>
    );
  }
  if (contact.status === "revoked") {
    return (
      <Badge variant="outline" className="gap-1 text-muted-foreground">
        <ShieldOff className="size-3" aria-hidden />
        Revoked
      </Badge>
    );
  }
  const left = codeCountdown(contact.codeExpiresAt, now);
  return (
    <Badge variant="outline" className="gap-1">
      <Clock className="size-3" aria-hidden />
      {/* ★★A COUNTDOWN, NOT A STATUS WORD. "Code sent" alone cannot tell
          somebody whether to wait or to press Resend, and the answer changes
          every second. ★And "Code expired" is a different sentence from
          "0:00 left" because it wants a different button. */}
      {left ? `Code sent · ${left} left` : "Code expired"}
    </Badge>
  );
}

export function VerifiedNumbers({
  contacts,
  members,
  isAdmin,
  currentUserId,
}: {
  contacts: MerchantContact[];
  members: TeamMember[];
  isAdmin: boolean;
  currentUserId: string | null;
}) {
  // ★A TICKING CLOCK, because the countdown is the point. One second is the
  //  coarsest interval that still renders `4:12` correctly.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const [addOpen, setAddOpen] = useState(false);
  const [waIdInput, setWaIdInput] = useState("");
  const [subjectId, setSubjectId] = useState<string>("");

  /**
   * ⚠️★★OPENING THE DIALOG CLEARS IT, and CANCELLING clears it too.
   *
   * 🚫A first version cleared only on SUCCESS. The per-row "Register a
   * number" button pre-selects a teammate, so: press it on Asha's row,
   * cancel, then press "Add a teammate" — **the dialog reopens with Asha
   * still selected**, and the number gets registered against the wrong
   * `userId`. ★That is not a cosmetic slip: only the person a row names can
   * verify it, so the number becomes one **nobody who has it can confirm.**
   */
  function openAddDialog(forUserId = "") {
    // ── ⚠️★★BLANK, AND THAT BLANK IS THE POINT ───────────────────────────
    //
    //  `POST /contacts` DEFAULTS `userId` TO THE CALLER when it is omitted,
    //  so a subject this form did not ask for becomes the person holding the
    //  screen. Only the person a row NAMES can verify it, so a teammate's
    //  handset filed under the Owner is either unconfirmable — or confirmed
    //  by the Owner, **authorising that handset as the Owner.**
    //
    //  🚫★I "FIXED" THAT ONCE BY DEFAULTING TO THE VIEWER, WHICH IS THE SAME
    //  BUG WITH A NAME ON IT. "Add a teammate" then opened pre-selected on
    //  the Owner: type a teammate's number, press Send, and it lands under
    //  the Owner exactly as before. **The empty state was the forcing
    //  function** — with `Send` disabled until somebody chooses, the
    //  question cannot be skipped. The per-row button still pre-fills, and
    //  registering your own number means picking yourself.
    setSubjectId(forUserId);
    setWaIdInput("");
    setAddOpen(true);
  }
  function closeAddDialog() {
    setAddOpen(false);
    setSubjectId("");
    setWaIdInput("");
  }
  const [codeFor, setCodeFor] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [prefsFor, setPrefsFor] = useState<MerchantContact | null>(null);

  const register = useRegisterContact();
  const resend = useResendCode();
  const verify = useVerifyContact();
  const revoke = useRevokeContact();

  // ⚠️★★HOLDERS, NOT MEMBERS. A number outlives the membership that
  //  registered it: `plt_merchant_contacts` is untouched when somebody is
  //  removed from `members[]`, and `resolveRecipients` asks only for
  //  `status: "verified"`. 🚫Iterating members made that row INVISIBLE — not
  //  shown, not revocable, and still able to command Peakhour.
  const holders = contactHolders(members, contacts);
  // ★The REGISTER dialog still offers members only: you cannot register a
  //  new number for somebody who has left, and the api would refuse it.
  const people = assignableMembers(members);
  const digits = normaliseWaIdInput(waIdInput);

  /** ★RAW `message`, deliberately: every failure this page can produce is one
   *  the api wrote copy for — `NOT_YOUR_NUMBER`, `DOMAIN_DEPRECATED`,
   *  `CELL_UNADDRESSABLE`, the two 429s. Substituting our own would lose the
   *  half of the sentence that says what to do next. */
  const say = (err: unknown, fallback: string) =>
    toast.error(err instanceof ApiError ? err.message : fallback);

  async function onRegister() {
    // ★★BOTH HALVES, AND `subjectId` IS THE ONE THAT MATTERED. Sending the
    //  number without a subject is not "register it for nobody" — it is
    //  "register it for whoever is signed in", which is the one answer this
    //  dialog must never guess at.
    // ★★BOTH HALVES THROUGH ONE BUILDER, so the rule lives where a test can
    //  reach it rather than in a condition nothing exercises.
    const input = registrationInputFor(waIdInput, subjectId || null);
    if (!input) return;
    try {
      await register.mutateAsync(input);
      closeAddDialog();
      toast.success(
        // ★★THE MESSAGE NAMES WHO HAS TO ACT, because it is usually not the
        //  person reading it.
        subjectId && subjectId !== currentUserId
          ? "Code sent. They confirm it on WhatsApp before Peakhour will take an instruction from that number."
          : "Code sent on WhatsApp. Enter it below to finish.",
      );
    } catch (err) {
      say(err, "Could not register that number.");
    }
  }

  async function onVerify(id: string) {
    try {
      await verify.mutateAsync({ id, code: code.trim() });
      setCodeFor(null);
      setCode("");
      toast.success("Number confirmed.");
    } catch (err) {
      say(err, "That code did not work.");
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Smartphone className="size-4" aria-hidden />
              <h2 className="text-base font-semibold">Verified numbers</h2>
            </CardTitle>
            <CardDescription>
              Peakhour will only take an instruction from a number somebody has
              confirmed. Only Owners and Admins can register one.
            </CardDescription>
          </div>
          {isAdmin && (
            <Button size="sm" onClick={() => openAddDialog()}>
              <Plus className="size-4" aria-hidden />
              Add a teammate
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {holders.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No teammates yet. Invite somebody from Settings → Team first.
          </p>
        )}

        {holders.map((m) => {
          const rows = contactsFor(m.userId, contacts);
          const isSelf = m.userId === currentUserId;
          return (
            <div
              key={m.userId}
              className="rounded-lg border p-3 flex flex-col gap-2"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{m.label}</p>
                  {m.isMember ? (
                    <p className="text-xs text-muted-foreground capitalize">
                      {m.role}
                    </p>
                  ) : (
                    // ⚠️★★NO LONGER ON THE TEAM, AND STILL ABLE TO COMMAND.
                    //  Removing somebody from the org does not revoke their
                    //  number — nothing joins the two — so this row is the only
                    //  place the merchant can find out, and Revoke is the only
                    //  control that closes it.
                    <p className="text-xs text-destructive">
                      No longer on the team — revoke this number
                    </p>
                  )}
                </div>
                {/* ★★"HAS NO LIVE NUMBER", NOT "HAS NO ROWS". 🚫Gating on
                    `rows.length === 0` left somebody whose only number was
                    REVOKED with no control at all — the dropdown is hidden for
                    a revoked row too, so the row became a dead end for the one
                    person most likely to need a new number. */}
                {!hasLiveNumber(rows) && isAdmin && m.isMember && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => openAddDialog(m.userId)}
                  >
                    Register {rows.length > 0 ? "another" : "a"} number
                  </Button>
                )}
              </div>

              {!hasLiveNumber(rows) && (
                <p className="text-xs text-muted-foreground">
                  {rows.length === 0
                    ? "No number registered — Peakhour cannot take an instruction from them."
                    : "No live number — Peakhour cannot take an instruction from them."}
                </p>
              )}

              {rows.map((contact) => (
                <div
                  key={contact.id}
                  className="flex flex-wrap items-center gap-2 border-t pt-2 first:border-t-0 first:pt-0"
                >
                  <span className="text-sm font-mono">
                    {formatWaId(contact.waId)}
                  </span>
                  <StatusBadge contact={contact} now={now} />
                  {contact.locale && (
                    <Badge variant="outline">{contact.locale}</Badge>
                  )}
                  {contact.register && (
                    <Badge variant="outline">
                      {contact.register === "casual"
                        ? "plainer register"
                        : "comfortable with detail"}
                    </Badge>
                  )}
                  {contact.quietHours && (
                    // ★★A SETTING NOBODY CAN SEE IS ONE THEY WILL SET TWICE.
                    //  §02 does not draw quiet hours on the row, and it should:
                    //  the zone is what makes the window mean anything, and it
                    //  is the half most likely to be wrong.
                    <Badge variant="outline">
                      {describeQuietHours(contact.quietHours)}
                    </Badge>
                  )}

                  <div className="ml-auto flex items-center gap-2">
                    {/* ★★THE CODE BOX APPEARS ONLY ON THE VIEWER'S OWN ROW.
                        Offering it on a teammate's would be offering a control
                        that answers 403 `NOT_YOUR_NUMBER` every time. */}
                    {contact.status === "pending" && isSelf && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setCodeFor(contact.id);
                          setCode("");
                        }}
                      >
                        Enter code
                      </Button>
                    )}
                    {contact.status === "pending" && !isSelf && (
                      // ★A DEPARTED HOLDER IS LABELLED BY THEIR NUMBER, because
                      //  `GET /contacts` carries no name — so 🚫splitting the
                      //  label on a space rendered "+91 enters this code
                      //  themselves". They also cannot sign in to enter it, which
                      //  is the more useful thing to say.
                      <span className="text-xs text-muted-foreground">
                        {m.isMember
                          ? `${m.label.split(" ")[0]} enters this code themselves`
                          : "Only the person this number belongs to can confirm it"}
                      </span>
                    )}
                    {/* ⚠️★★GATED ON THE CALLER, NOT ON THE ROW'S STATUS. The
                        api's `PATCH` rule is **self, or Owner/Admin** — so 🚫a
                        first version reading `status === "verified" || isSelf`
                        offered an EDITOR the control on everybody's verified
                        number (403 on save) and denied an ADMIN it on a
                        teammate's pending row, which is exactly the row an
                        Admin has to fix when somebody sets a language and
                        then leaves. */}
                    {(isSelf || isAdmin) && contact.status !== "revoked" && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setPrefsFor(contact)}
                      >
                        Preferences
                      </Button>
                    )}
                    {isAdmin && contact.status !== "revoked" && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            size="icon"
                            variant="ghost"
                            aria-label={`Actions for ${formatWaId(contact.waId)}`}
                          >
                            <MoreVertical className="size-4" aria-hidden />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {contact.status === "pending" && (
                            <DropdownMenuItem
                              onClick={async () => {
                                try {
                                  await resend.mutateAsync(contact.id);
                                  toast.success("Code sent again.");
                                } catch (err) {
                                  say(err, "Could not resend the code.");
                                }
                              }}
                            >
                              Resend code
                            </DropdownMenuItem>
                          )}
                          <ConfirmDialog
                            trigger={
                              <DropdownMenuItem
                                onSelect={(e) => e.preventDefault()}
                                className="text-destructive"
                              >
                                Revoke
                              </DropdownMenuItem>
                            }
                            title="Revoke this number?"
                            description="Peakhour will stop taking instructions from it immediately, and any code still outstanding stops working. Anything routed to this person falls through to the Owner."
                            confirmLabel="Revoke"
                            variant="destructive"
                            onConfirm={async () => {
                              try {
                                await revoke.mutateAsync(contact.id);
                                toast.success("Number revoked.");
                              } catch (err) {
                                say(err, "Could not revoke that number.");
                              }
                            }}
                          />
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>

                  {/* ★AND STILL PENDING. 🚫Without the second half the box
                      stayed on screen after the row was verified or revoked
                      from another device — inviting somebody to type a code
                      into a row that no longer accepts one. */}
                  {codeFor === contact.id && contact.status === "pending" && (
                    <div className="flex w-full items-center gap-2 pt-2">
                      <Input
                        value={code}
                        onChange={(e) =>
                          setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                        }
                        placeholder="6-digit code"
                        inputMode="numeric"
                        aria-label="The 6-digit code we sent on WhatsApp"
                        className="max-w-40"
                      />
                      <Button
                        size="sm"
                        disabled={code.length !== 6 || verify.isPending}
                        onClick={() => onVerify(contact.id)}
                      >
                        Confirm
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setCodeFor(null)}
                      >
                        Cancel
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          );
        })}
      </CardContent>

      <Dialog
        open={addOpen}
        onOpenChange={(v) => (v ? setAddOpen(true) : closeAddDialog())}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Register a WhatsApp number</DialogTitle>
            <DialogDescription>
              They confirm the number on WhatsApp before Peakhour will take an
              instruction from it.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="cp-subject">Whose number is it?</Label>
              <Select value={subjectId} onValueChange={setSubjectId}>
                <SelectTrigger id="cp-subject">
                  <SelectValue placeholder="Choose a teammate" />
                </SelectTrigger>
                <SelectContent>
                  {people.map((m) => (
                    <SelectItem key={m.userId} value={m.userId}>
                      {memberLabel(m)}
                      {m.userId === currentUserId ? " (you)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="cp-waid">WhatsApp number</Label>
              <Input
                id="cp-waid"
                value={waIdInput}
                onChange={(e) => setWaIdInput(e.target.value)}
                placeholder="+91 98204 11207"
                inputMode="tel"
              />
              {/* ★THE COUNTRY CODE IS REQUIRED AND THE FIELD SAYS SO. WhatsApp
                  has no concept of a local number, and a merchant typing ten
                  digits would otherwise get a 400 that says "E.164". */}
              <p className="text-xs text-muted-foreground">
                Include the country code. {digits && !isPlausibleWaId(digits)
                  ? "That does not look like a full international number yet."
                  : ""}
              </p>
              {!subjectId && (
                // ★SAYS WHY `Send` IS DISABLED. A disabled button with no
                //  reason reads as a broken page, and the reason here is the
                //  whole safeguard.
                <p className="text-xs text-muted-foreground">
                  Choose whose number it is first — Peakhour will only take an
                  instruction from a number the right person has confirmed.
                </p>
              )}
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={closeAddDialog}>
              Cancel
            </Button>
            <Button
              disabled={!isPlausibleWaId(digits) || !subjectId || register.isPending}
              onClick={onRegister}
            >
              Send the code
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {prefsFor && (
        <PreferencesDialog
          contact={prefsFor}
          open={!!prefsFor}
          onOpenChange={(v) => !v && setPrefsFor(null)}
        />
      )}
    </Card>
  );
}
