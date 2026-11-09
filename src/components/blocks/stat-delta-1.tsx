import {
  Stat,
  StatDelta,
  StatLabel,
  StatValue,
} from "@/components/blocks/stat";

export const title = "Stat with delta";

const Example = () => (
  <Stat className="w-full max-w-xs">
    <StatLabel>Net revenue</StatLabel>
    <StatValue>$128,400</StatValue>
    <StatDelta trend="up">+12.4% vs last month</StatDelta>
  </Stat>
);

export default Example;
