/** Human-readable labels for all tag enum values */

export const SECTOR_LABELS: Record<string, string> = {
  aviation: "Aviation",
  hotels_hospitality: "Hotels & Hospitality",
  tour_operations: "Tour Operations",
  ota_travel_tech: "OTA & Travel Tech",
  tourism_policy: "Tourism Policy",
  cruise_maritime: "Cruise & Maritime",
  railways_transport: "Railways & Transport",
  mice_events: "MICE & Events",
  travel_insurance_forex: "Travel Insurance & Forex",
  destination_marketing: "Destination Marketing",
  aviation_infrastructure: "Aviation Infrastructure",
  food_beverage: "Food & Beverage",
  luxury_premium: "Luxury & Premium",
  budget_economy: "Budget & Economy",
  medical_tourism: "Medical Tourism",
  adventure_wildlife: "Adventure & Wildlife",
  spiritual_pilgrimage: "Spiritual & Pilgrimage",
  wedding_tourism: "Wedding Tourism",
};

export const AUDIENCE_LABELS: Record<string, string> = {
  airline_exec: "Airline Executives",
  hotel_leader: "Hotel Leaders",
  tour_operator: "Tour Operators",
  ota_tech: "OTA & Tech",
  policy_maker: "Policy Makers",
  embassy_foreign: "Embassy & Foreign Affairs",
  travel_journalist: "Travel Journalists",
  mice_organizer: "MICE Organizers",
  travel_educator: "Travel Educators",
  infrastructure_developer: "Infrastructure Developers",
};

export const CONTENT_TYPE_LABELS: Record<string, string> = {
  breaking_news: "Breaking News",
  analysis: "Analysis",
  opinion: "Opinion",
  data_report: "Data Report",
  policy_explainer: "Policy Explainer",
  company_profile: "Company Profile",
  trend_piece: "Trend Piece",
  competitive_intelligence: "Competitive Intel",
  prediction: "Prediction",
  roundup: "Roundup",
};

export const AD_ANGLE_LABELS: Record<string, string> = {
  data_led: "Lead with Data",
  contrarian: "Contrarian Take",
  story: "Story-Driven",
  fomo: "FOMO",
  value_first: "Value First",
  competitive: "Competitive Edge",
  urgency: "Urgency",
};

export const SENTIMENT_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  bullish: { label: "Bullish", color: "text-green-700", bg: "bg-green-100" },
  bearish: { label: "Bearish", color: "text-red-700", bg: "bg-red-100" },
  cautious: { label: "Cautious", color: "text-amber-700", bg: "bg-amber-100" },
  neutral: { label: "Neutral", color: "text-slate-700", bg: "bg-slate-100" },
  mixed: { label: "Mixed", color: "text-purple-700", bg: "bg-purple-100" },
};

export const SHELF_LIFE_LABELS: Record<string, string> = {
  "24h": "24 Hours",
  "1week": "1 Week",
  "1month": "1 Month",
  evergreen: "Evergreen",
};

/** Get a label for any enum value, with fallback to title-cased raw value */
export function label(map: Record<string, string>, key: string | undefined | null): string {
  if (!key) return "—";
  return map[key] || key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
