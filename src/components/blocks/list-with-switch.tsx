"use client";

import { useState } from "react";

import {
  Item,
  ItemActions,
  ItemContent,
  ItemGroup,
  ItemTitle,
} from "@/components/blocks/item";
import { Switch } from "@/components/ui/switch";

export const title = "With Switch";

const settings = [
  { id: "deploy", label: "Deploy notifications", defaultOn: true },
  { id: "billing", label: "Billing alerts", defaultOn: true },
  { id: "digest", label: "Weekly digest", defaultOn: false },
];

const Example = () => {
  const [values, setValues] = useState<Record<string, boolean>>(
    Object.fromEntries(settings.map((s) => [s.id, s.defaultOn])),
  );

  return (
    <div className="w-full max-w-md">
      <ItemGroup>
        {settings.map((setting) => (
          <Item className="bg-background" key={setting.id} variant="outline">
            <ItemContent>
              <ItemTitle>{setting.label}</ItemTitle>
            </ItemContent>
            <ItemActions>
              <Switch
                aria-label={setting.label}
                checked={values[setting.id]}
                onCheckedChange={(checked) =>
                  setValues((current) => ({
                    ...current,
                    [setting.id]: checked,
                  }))
                }
              />
            </ItemActions>
          </Item>
        ))}
      </ItemGroup>
    </div>
  );
};

export default Example;
