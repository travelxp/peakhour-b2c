export interface SkillTemplate {
  _id: string;
  skillId: string;
  displayName: string;
  description: string;
  category: string;
  /** Free-form sub-grouping within `category` (e.g. 'seo', 'long_form', 'ad_copy'). */
  subCategory?: string;
  agent: string;
  /** Platforms this skill targets. ['all'] = platform-agnostic. */
  platforms: string[];
  role: string;
  trustLevel: number;
  executionType: "ai" | "code" | "hybrid";
  systemPrompt?: string;
  userPromptTemplate?: string;
  inputSchema?: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
  constraints?: {
    maxOutputChars?: number;
    requiredElements?: string[];
    forbiddenPatterns?: string[];
  };
  defaultEffectiveness: number;
  tags: string[];
  triggerPhrases?: string[];
  codeHandler?: string;
  version: number;
  status: "active" | "draft" | "deprecated";
}

export interface BizSkill {
  _id: string;
  orgId: string;
  businessId: string;
  skillId: string;
  templateId: string;
  displayName?: string;
  agent?: string;
  platform?: string;
  businessContext?: { businessName?: string };
  effectiveness: {
    score: number;
    totalUses: number;
    accepted: number;
    rejected: number;
    edited: number;
  };
  learnings: {
    whatWorks: string[];
    whatDoesntWork: string[];
  };
  status: "active" | "paused" | "deprecated";
}

export interface BusinessSkillsResponse {
  business: { name: string; type: string };
  skills: Array<
    BizSkill & {
      agent: string;
      platforms: string[];
      /** First entry of `platforms[]` for backward compat with single-Badge UIs. */
      platform: string;
      subCategory?: string;
      displayName: string;
    }
  >;
  autonomyScore: number;
}

/** Replace all underscores with spaces */
export function humanize(s: string): string {
  return s.replace(/_/g, " ");
}
