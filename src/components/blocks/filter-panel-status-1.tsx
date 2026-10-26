"use client";

import * as React from "react";

import {
  FilterPanel,
  FilterPanelOption,
  FilterPanelSection,
} from "@/components/blocks/filter-panel";

export const title = "Status count filters";

const options = [
  { id: "all", label: "All", count: 128 },
  { id: "active", label: "Active", count: 96 },
  { id: "draft", label: "Draft", count: 18 },
  { id: "archived", label: "Archived", count: 14 },
];

const Example = () => {
  const [active, setActive] = React.useState("all");

  return (
    <FilterPanel className="w-full max-w-xs">
      <FilterPanelSection title="Status">
        {options.map((option) => (
          <FilterPanelOption
            key={option.id}
            count={option.count}
            active={active === option.id}
            onClick={() => setActive(option.id)}
          >
            {option.label}
          </FilterPanelOption>
        ))}
      </FilterPanelSection>
    </FilterPanel>
  );
};

export default Example;
