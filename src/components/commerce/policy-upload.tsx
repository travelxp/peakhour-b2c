"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { DrivePicker } from "@/components/drive/drive-picker";
import { useUploadKnowledge, useUploadPrice } from "@/hooks/use-knowledge-base";
import { TOP_UP_HREF, conflictLine, quoteLapsed, uploadBody, uploadErrorLine, uploadLimitsLine, uploadPriceLine, uploadResultLines, type UploadSummary } from "@/lib/policy-builder";

/**
 * Start a policy from a document or a page (KE-2.4 upload). Its own file so the Drive picker is loaded only when this screen is opened, not with the rest of
 * the page: the dashboard bundle budget counts first-load JS per route.
 */
// -- Upload ----------------------------------------------------------------------------------------------------------------

export default function UploadPanel() {
  const price = useUploadPrice();
  const upload = useUploadKnowledge();
  const [file, setFile] = useState<{ id: string; name: string } | null>(null);
  const [url, setUrl] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [topUp, setTopUp] = useState(false);
  const [result, setResult] = useState<UploadSummary | null>(null);
  const urlId = useId();

  const go = async () => {
    const p = price.data;
    if (!p || upload.isPending) return;
    setMessage(null);
    setTopUp(false);
    setResult(null);
    const b = uploadBody(file ? { driveFileId: file.id } : { url });
    if (!b.ok) return setMessage(b.error);
    if (quoteLapsed(p, Date.now())) {
      await price.refetch();
      setMessage("The price was out of date. Check it below, then click again.");
      return;
    }
    try {
      setResult(await upload.mutateAsync({ body: b.body, quoteToken: p.token }));
    } catch (e) {
      const line = uploadErrorLine(e);
      setMessage(line.message);
      setTopUp(line.topUp);
      if (line.refreshPrice) void price.refetch();
    }
  };

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <h3 className="flex items-center gap-2 text-base font-semibold">
          <FileText className="size-4" aria-hidden="true" />
          Start from a document or a page
        </h3>
        <p className="text-sm text-muted-foreground">Add a policy document or the address of a page. We suggest answers and fill in policy answers from it. Nothing is live until you approve it.</p>
        {price.data && (
          <div data-kb-upload-price className="space-y-1 text-sm">
            <p className="font-medium">{uploadPriceLine(price.data)}</p>
            <p className="text-xs text-muted-foreground">{uploadLimitsLine(price.data.limits)}</p>
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <DrivePicker
            kinds={["document"]}
            tabs={["drive", "upload"]}
            maxSelection={1}
            requirePublicUrl={false}
            needUrl={false}
            uploadAs="private"
            addLabel="Use this file"
            trigger={
              <Button type="button" size="sm" variant="outline">
                Choose a file from Drive
              </Button>
            }
            onSelect={(assets) => {
              const a = assets[0];
              if (a) {
                setFile({ id: a.id, name: a.name ?? "Your file" });
                setUrl("");
              }
            }}
          />
          {file && (
            <span className="text-sm">
              {file.name}{" "}
              <Button type="button" size="sm" variant="ghost" onClick={() => setFile(null)}>
                Remove
              </Button>
            </span>
          )}
        </div>
        {!file && (
          <div className="space-y-1">
            <label htmlFor={urlId} className="block text-sm font-medium">
              Or the address of a page
            </label>
            <Input id={urlId} type="url" inputMode="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://yourstore.com/pages/returns" />
          </div>
        )}
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
        <Button size="sm" onClick={() => void go()} disabled={!price.data || upload.isPending || (!file && url.trim() === "")}>
          {upload.isPending && <Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" />}
          Read it
        </Button>
        {result && <UploadResultView result={result} />}
      </CardContent>
    </Card>
  );
}

/** What an upload did, and the conflicts it reported: the merchant's saved answer is kept and the document's is said beside it. */
export function UploadResultView({ result }: { result: UploadSummary }) {
  const lines = uploadResultLines(result);
  return (
    <div data-kb-upload-result role="status" className="space-y-2 text-sm">
      {lines.length === 0 && <p>Done.</p>}
      {lines.map((l) => (
        <p key={l}>{l}</p>
      ))}
      {result.conflicts.length > 0 && (
        <div className="space-y-1">
          <p className="font-medium">The document disagrees with answers you already gave</p>
          <ul className="list-disc pl-5 text-muted-foreground">
            {result.conflicts.map((c, i) => (
              <li key={`${c.policyType}-${c.fact}-${i}`}>{conflictLine(c)}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
