import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { briefHref, goodUntil } from "@/lib/studio";
import { STUDIO_COPY } from "@/lib/studio-copy";
import type { PostIdea } from "@/lib/api/creative";

/** Photos arrive with the Library link (CS-7a); until then a product shows as its title in a tile, never a broken image. */
const MAX_PRODUCTS_SHOWN = 3;

/**
 * One idea (UX spec S1): the kind and format chips, the api's `reason` line unedited, up to three products, and two actions.
 * "Make previews" is a link to the brief (free, no call). "Not now" hides the idea.
 *
 * An `article` whose reason is the accessible description of both buttons, so a screen reader hears what each button is about.
 */
export function IdeaCard({
  idea,
  index,
  onNotNow,
  locale,
}: {
  idea: PostIdea;
  index: number;
  onNotNow: (idea: PostIdea) => void;
  locale?: string;
}) {
  const reasonId = `studio-idea-reason-${index}`;
  const until = goodUntil(idea, locale);
  const shown = idea.products.slice(0, MAX_PRODUCTS_SHOWN);
  const more = idea.products.length - shown.length;
  return (
    <article data-slot="studio-idea" className="flex flex-col gap-3 rounded-lg border bg-card p-4 text-card-foreground">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary">{STUDIO_COPY.kinds[idea.kind] ?? idea.kind}</Badge>
        <Badge variant="outline">{STUDIO_COPY.formats[idea.format] ?? idea.format}</Badge>
        {until && <span className="text-xs text-muted-foreground">{until}</span>}
      </div>
      <p id={reasonId} className="wrap-break-word text-sm font-medium">
        {idea.reason}
      </p>
      {shown.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {shown.map((p) => (
            <li key={p.id} className="max-w-full truncate rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground">
              {p.title}
            </li>
          ))}
          {more > 0 && <li className="rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground">{`+${more}`}</li>}
        </ul>
      )}
      <div className="mt-auto flex flex-col gap-2 pt-1 sm:flex-row">
        <Button asChild className="h-11 w-full sm:w-auto">
          <Link href={briefHref(idea.id)} data-idea-make={idea.id} aria-describedby={reasonId}>
            {STUDIO_COPY.ideas.makePreviews}
          </Link>
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="h-11 w-full sm:w-auto"
          aria-describedby={reasonId}
          onClick={() => onNotNow(idea)}
        >
          {STUDIO_COPY.ideas.notNow}
        </Button>
      </div>
    </article>
  );
}
