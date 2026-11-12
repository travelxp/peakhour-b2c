import { TabsContent } from "@/components/ui/tabs";

/**
 * Empty, force-mounted panels for a Tabs strip that acts as a filter: the
 * content below the strip is shared, so no TabsContent exists per value. Radix
 * still gives every TabsTrigger `aria-controls` pointing at its panel id, and
 * an id with no element fails axe `aria-valid-attr-value`. Rendering one
 * hidden stub per value keeps each reference valid. Pass every trigger value.
 */
export function TabPanelStubs({ values }: { values: readonly string[] }) {
  return (
    <>
      {values.map((v) => (
        <TabsContent key={v} value={v} forceMount hidden />
      ))}
    </>
  );
}
