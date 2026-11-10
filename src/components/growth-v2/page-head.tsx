import type * as React from "react";
import { PageHeader } from "@/components/dashboard/page-shell";

/** The title block every Growth screen opens with: a question, then one sentence. Delegates to PageHeader so it is the page's one <h1>. */
export function PageHead({ title, description, actions }: { title: string; description: string; actions?: React.ReactNode }) {
  return <PageHeader title={title} description={description} actions={actions} />;
}
