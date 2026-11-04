"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, ApiError } from "@/lib/api";
import { parseShopperCapInput, SHOPPER_CAP_KEY, shopperCapStatus, type ShopperCap } from "@/lib/shopper-cap";

/**
 * "Limit what shopper chats can use" on the Peaks page. Off until a number is set. Only owners and admins can save; for anyone else the
 * api answers 403 and the card says so. The card shows what the api says was saved, not what was typed.
 */
export function ShopperCapCard() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: [SHOPPER_CAP_KEY],
    queryFn: () => api.get<ShopperCap>(SHOPPER_CAP_KEY),
    staleTime: 60_000,
  });
  // null = untouched: the field shows the saved cap, so a save or another tab is followed without an effect.
  const [typed, setTyped] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  const save = useMutation({
    mutationFn: (cap: number | null) => api.put<ShopperCap>(SHOPPER_CAP_KEY, { cap }),
    onSuccess: (next) => {
      qc.setQueryData([SHOPPER_CAP_KEY], next);
      setTyped(null);
      setSaved(true);
      setError("");
    },
    onError: (err) => {
      setSaved(false);
      const denied = err instanceof ApiError && err.status === 403;
      setError(denied ? "Only an owner or admin can change this limit." : "Your limit was not saved. Please try again in a moment.");
      toast.error("Couldn't save the limit.");
    },
  });

  // Secondary: a failed read hides the card rather than blocking the page.
  if (!data) return null;
  const text = typed ?? (data.cap === null ? "" : String(data.cap));

  const onSave = () => {
    setSaved(false);
    const parsed = parseShopperCapInput(text);
    if (!parsed.ok) {
      setError(parsed.message);
      return;
    }
    setError("");
    save.mutate(parsed.cap);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <MessageCircle className="size-4" />
          Limit what shopper chats can use
        </CardTitle>
        <CardDescription className="mt-1">
          Set the most Peaks shopper chats may use in a month. This only counts what your shoppers use; it does not limit your own work. It is off until you set a number.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="shopper-cap">Most Peaks shopper chats may use each month</Label>
          <div className="flex items-center gap-2">
            <Input
              id="shopper-cap"
              inputMode="numeric"
              placeholder="No limit"
              className="max-w-48"
              value={text}
              disabled={save.isPending}
              onChange={(e) => {
                setTyped(e.target.value);
                setSaved(false);
              }}
            />
            <Button size="sm" variant="outline" onClick={onSave} disabled={save.isPending}>
              Save limit
            </Button>
            {saved ? <span className="text-sm text-muted-foreground">Saved.</span> : null}
          </div>
        </div>
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {shopperCapStatus(data)}
        </p>
        {error ? (
          <p className="text-sm text-destructive-on-tint" role="alert">
            {error}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
