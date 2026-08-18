/** Display name for each Commerce agent key (shared across Commerce surfaces). */
export const AGENT_LABEL: Record<string, string> = {
  merchandiser: "Merchandiser",
  pricer: "Pricer",
  replenisher: "Replenisher",
  concierge: "Concierge",
  reputation: "Reputation",
  forecaster: "Forecaster",
};

/** Friendly name for an agent key, falling back to the raw key. */
export function agentLabel(agent: string): string {
  return AGENT_LABEL[agent] ?? agent;
}
