"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { HomeRefusalCode } from "@/lib/api/growth-v2";
import { GROWTH_HOME } from "@/lib/growth-v2-nav";

/** The two refusals the api gives instead of a page: no mandate, or no business clock. */
export function NotSetUp({ code }: { code: HomeRefusalCode }) {
  const noMandate = code === "NO_MANDATE";
  return (
    <Card>
      <CardHeader>
        <CardTitle>{noMandate ? "Growth isn't set up yet" : "Set your business time zone"}</CardTitle>
        <CardDescription>
          {noMandate
            ? "Tell us what you want more of and what you can spend, and the engine will start reporting here."
            : "Your figures cover whole days on your own clock. Set the time zone in Rules and this page will fill in."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button asChild>
          <Link href={noMandate ? `${GROWTH_HOME}/start` : `${GROWTH_HOME}/rules`}>{noMandate ? "Set up Growth" : "Open Rules"}</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
