"use client";

import { Bell, LayoutDashboard, Sparkles, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Stepper,
  StepperContent,
  StepperIndicator,
  StepperItem,
  StepperList,
  StepperNext,
  StepperPrev,
  StepperSeparator,
  StepperTrigger,
} from "@/components/blocks/stepper";

export const title = "Icon onboarding";

const steps = [
  {
    value: "welcome",
    title: "Welcome",
    body: "Set up your workspace in a few quick steps.",
    icon: Sparkles,
  },
  {
    value: "team",
    title: "Invite your team",
    body: "Add collaborators so everyone can contribute.",
    icon: Users,
  },
  {
    value: "board",
    title: "Create a board",
    body: "Start with a template or a blank canvas.",
    icon: LayoutDashboard,
  },
  {
    value: "alerts",
    title: "Turn on alerts",
    body: "Get notified when something needs attention.",
    icon: Bell,
  },
];

const Example = () => (
  <Stepper defaultValue="welcome" className="w-full max-w-md">
    <StepperList>
      {steps.map((step) => {
        const Icon = step.icon;
        return (
          <StepperItem key={step.value} value={step.value}>
            <StepperTrigger>
              <StepperIndicator>
                {(state) =>
                  state === "completed" ? (
                    <Icon className="size-3.5" />
                  ) : (
                    <Icon className="size-3.5" />
                  )
                }
              </StepperIndicator>
            </StepperTrigger>
            <StepperSeparator />
          </StepperItem>
        );
      })}
    </StepperList>
    {steps.map((step) => (
      <StepperContent
        key={step.value}
        value={step.value}
        className="flex flex-col items-center gap-2 rounded-md border p-6 text-center"
      >
        <h3 className="text-lg font-semibold">{step.title}</h3>
        <p className="text-sm text-muted-foreground">{step.body}</p>
      </StepperContent>
    ))}
    <div className="flex justify-between">
      <StepperPrev render={<Button type="button" variant="ghost" />}>
        Skip
      </StepperPrev>
      <StepperNext render={<Button type="button" />}>Continue</StepperNext>
    </div>
  </Stepper>
);

export default Example;
