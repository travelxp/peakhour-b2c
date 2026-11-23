"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Megaphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { metaAdsApi, type MetaAdsPage, type MetaPagePost } from "@/lib/api/meta-ads";
import { metaAdsErrorMessage } from "@/lib/meta-ads-view";

/**
 * MR-H1: the Facebook Page an ad runs as, the ads that have already run from it, and "Promote a post".
 *
 * ★EVERY READ GOES THROUGH THE API'S PAGE ROUTES, which use the Page's own access token on the server. Nothing here sees one.
 * ★THE PICKER SHOWS EVERY PAGE THE LOGIN REACHES, but a Page the person cannot advertise for is disabled with the reason, because
 * an ad cannot run as it and Meta would only refuse later.
 */

const STALE_MS = 60_000;

/** A post's date as a person reads it, or nothing when Meta sent none (or one that is not a date). */
function postDate(iso: string | undefined): string {
  if (!iso) return "";
  const at = new Date(iso);
  return Number.isNaN(at.getTime()) ? "" : at.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

export function MetaPagesCard({
  businessId,
  onPromote,
}: {
  businessId?: string;
  /** Opens the New campaign dialog with this post as the ad. */
  onPromote: (pageId: string, post: MetaPagePost) => void;
}) {
  const scope = businessId ?? "none";
  const pages = useQuery({
    queryKey: ["meta-ads-pages", scope],
    queryFn: () => metaAdsApi.listPages(),
    retry: false,
    staleTime: STALE_MS,
  });
  const [picked, setPicked] = useState<string | null>(null);
  const [showPosts, setShowPosts] = useState(false);

  const list = pages.data?.pages ?? [];
  // The merchant's pick, else the saved Page, else the first Page an ad can run as.
  const page: MetaAdsPage | null =
    list.find((p) => p.id === picked) ??
    list.find((p) => p.id === pages.data?.savedPageId && p.canAdvertise) ??
    list.find((p) => p.canAdvertise) ??
    null;

  const adsPosts = useQuery({
    queryKey: ["meta-ads-page-ads-posts", scope, page?.id ?? ""],
    queryFn: () => metaAdsApi.listPageAdsPosts(page!.id),
    enabled: Boolean(page),
    retry: false,
    staleTime: STALE_MS,
  });
  const posts = useQuery({
    queryKey: ["meta-ads-page-posts", scope, page?.id ?? ""],
    queryFn: () => metaAdsApi.listPagePosts(page!.id),
    enabled: Boolean(page) && showPosts,
    retry: false,
    staleTime: STALE_MS,
  });

  return (
    <Card aria-label="Facebook Page">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Megaphone className="size-4" />
          Facebook Page
        </CardTitle>
        <CardDescription>
          People see your ads as coming from a Facebook Page. Choose one to see the ads that have run from it, or to promote one of its posts.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5 text-sm">
        {pages.isLoading ? (
          <Skeleton className="h-9 w-80" />
        ) : pages.isError ? (
          <p role="status" className="text-destructive">
            {metaAdsErrorMessage(pages.error, "Couldn't read your Facebook Pages just now. Try again in a moment.")}
          </p>
        ) : list.length === 0 ? (
          <p role="status" className="text-muted-foreground">
            Your Meta login has no Facebook Page. Connect one under Connected accounts to run ads as a Page.
          </p>
        ) : (
          <div className="space-y-1.5">
            <Label htmlFor="mp-page">Page</Label>
            <Select value={page?.id ?? ""} onValueChange={setPicked}>
              <SelectTrigger id="mp-page" aria-label="Facebook Page" className="w-80">
                <SelectValue placeholder="Choose a Page" />
              </SelectTrigger>
              <SelectContent>
                {list.map((p) => (
                  <SelectItem key={p.id} value={p.id} disabled={!p.canAdvertise}>
                    {p.name}
                    {p.isSaved ? " · saved" : ""}
                    {p.canAdvertise ? "" : " · you can't run ads as this Page"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {page === null ? (
              <p role="status" className="text-muted-foreground">
                None of your Facebook Pages lets you run ads. Ask the Page&apos;s owner to give you permission to advertise.
              </p>
            ) : null}
          </div>
        )}

        {page ? (
          <section aria-label="Ads on this Page" className="space-y-2">
            <h3 className="font-medium">Ads on this Page</h3>
            {adsPosts.isLoading ? (
              <Skeleton className="h-12 w-full" />
            ) : adsPosts.isError ? (
              <p role="status" className="text-destructive">
                {metaAdsErrorMessage(adsPosts.error, "Couldn't read the ads from this Page just now.")}
              </p>
            ) : (adsPosts.data?.posts.length ?? 0) === 0 ? (
              <p className="text-muted-foreground">No ads have run from this Page yet.</p>
            ) : (
              <ul className="divide-y rounded-md border">
                {adsPosts.data!.posts.map((post) => (
                  <PostRow key={post.id} post={post} />
                ))}
              </ul>
            )}
            {adsPosts.data?.truncated ? <p className="text-xs text-muted-foreground">Showing the most recent ads only.</p> : null}
          </section>
        ) : null}

        {page ? (
          <section aria-label="Promote a post" className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-medium">Promote a post</h3>
              <Button variant="outline" size="sm" onClick={() => setShowPosts((v) => !v)} aria-expanded={showPosts}>
                {showPosts ? "Hide posts" : "Choose a post to promote"}
              </Button>
            </div>
            {showPosts ? (
              posts.isLoading ? (
                <Skeleton className="h-12 w-full" />
              ) : posts.isError ? (
                <p role="status" className="text-destructive">
                  {metaAdsErrorMessage(posts.error, "Couldn't read this Page's posts just now.")}
                </p>
              ) : (posts.data?.posts.length ?? 0) === 0 ? (
                <p className="text-muted-foreground">This Page has no posts to promote yet.</p>
              ) : (
                <ul className="divide-y rounded-md border">
                  {posts.data!.posts.map((post) => (
                    <PostRow
                      key={post.id}
                      post={post}
                      action={
                        <Button size="sm" onClick={() => onPromote(page.id, post)}>
                          Promote
                        </Button>
                      }
                    />
                  ))}
                </ul>
              )
            ) : (
              <p className="text-muted-foreground">Turn a post you already published into an ad. It starts paused.</p>
            )}
          </section>
        ) : null}
      </CardContent>
    </Card>
  );
}

/** One post: thumbnail, text, date, link, and an optional action. */
function PostRow({ post, action }: { post: MetaPagePost; action?: React.ReactNode }) {
  const date = postDate(post.createdTime);
  // Only a web link is shown as one.
  const link = post.permalinkUrl?.startsWith("https://") ? post.permalinkUrl : null;
  return (
    <li className="flex items-start gap-3 p-3" data-testid="page-post-row">
      {post.pictureUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={post.pictureUrl} alt="" className="size-14 shrink-0 rounded object-cover" />
      ) : (
        <div className="size-14 shrink-0 rounded bg-muted" aria-hidden />
      )}
      <div className="min-w-0 flex-1 space-y-0.5">
        <p className="line-clamp-2">{post.message || "A post with no text."}</p>
        <p className="text-xs text-muted-foreground">
          {date}
          {date && link ? " · " : ""}
          {link ? (
            <a href={link} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">
              View on Facebook
            </a>
          ) : null}
        </p>
      </div>
      {action}
    </li>
  );
}
