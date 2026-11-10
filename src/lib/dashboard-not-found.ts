/** The five places most merchants are looking for when a link is stale. */
export const NOT_FOUND_DESTINATIONS = [
  { label: "Overview", href: "/dashboard/overview", hint: "Your day at a glance" },
  { label: "Strategist", href: "/dashboard/strategist", hint: "Ideas worth acting on" },
  { label: "Content", href: "/dashboard/content", hint: "Posts and drafts" },
  { label: "Growth", href: "/dashboard/growth", hint: "What to do next to grow" },
  { label: "Integrations", href: "/dashboard/integrations", hint: "Connect your accounts" },
] as const;
