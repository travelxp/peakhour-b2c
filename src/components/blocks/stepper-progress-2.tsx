"use client";

import {
  Stepper,
  StepperIndicator,
  StepperItem,
  StepperList,
  StepperSeparator,
  StepperTitle,
  StepperTrigger,
} from "@/components/blocks/stepper";

export const title = "Segmented progress separators";

const steps = [
  { value: "intake", title: "Intake" },
  { value: "review", title: "Review" },
  { value: "approve", title: "Approve" },
  { value: "done", title: "Done" },
];

const Example = () => (
  <Stepper defaultValue="review" className="w-full max-w-2xl">
    <StepperList>
      {steps.map((step) => (
        <StepperItem key={step.value} value={step.value}>
          <StepperTrigger className="flex-col gap-2">
            <StepperIndicator />
            <StepperTitle>{step.title}</StepperTitle>
          </StepperTrigger>
          <StepperSeparator className="mx-2 h-1.5 rounded-full" />
        </StepperItem>
      ))}
    </StepperList>
  </Stepper>
);

export default Example;
