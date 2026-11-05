import { INDUSTRIES, type IndustryKey } from "@ai-ads/shared";
import type { AutomationRuleDefinition } from "@ai-ads/shared";

export type AutomationTemplate = {
  key: string;
  name: string;
  description: string;
  definition: AutomationRuleDefinition;
  enabled: false;
};

const context: Record<IndustryKey, string> = {
  real_estate: "Review listing inquiry copy, location fit and property details.",
  ecommerce_retail: "Review product-page clarity, offer terms and the checkout path.",
  healthcare_clinics: "Review appointment access and evidence-based service descriptions; avoid outcome promises.",
  education_coaching: "Review course fit, enrollment dates and registration information.",
  gyms_fitness: "Review trial-class or membership details and the local sign-up path.",
  restaurants_cafes: "Review menu details, reservation options and local visit messaging.",
  hotels_hospitality: "Review booking dates, stay details and seasonal offer assumptions.",
  travel_tourism: "Review itinerary details, availability assumptions and booking steps.",
  automobile_dealerships: "Review vehicle or service details, availability and appointment paths.",
  salons_beauty: "Review service menus, booking options and local availability.",
  professional_services: "Review service scope, consultation details and destination-page clarity.",
  marketing_agencies: "Review lead qualification, service scope and substantiated case details.",
  home_services: "Review service area, job scope and appointment availability.",
  finance_insurance: "Review required disclosures and eligibility language; avoid rate or outcome guarantees.",
  events_entertainment: "Review event dates, venue details, availability and registration steps.",
  other: "Review the workspace-defined offering and verify the destination matches the campaign brief.",
};

export function automationTemplatesForIndustry(industry: IndustryKey): AutomationTemplate[] {
  const label = INDUSTRIES.find((item) => item.key === industry)?.name ?? "Business";
  const definition = (metric: "ctr" | "cpa" | "budget_utilization", operator: "lt" | "gt", threshold: number, action: AutomationRuleDefinition["action"]): AutomationRuleDefinition => ({
    version: 1,
    trigger: "manual",
    conditionLogic: "all",
    conditions: [{ metric, operator, threshold }],
    action,
    approvalRequired: true,
    industry,
  });
  return [
    { key: "low-ctr-review", name: `${label} · low CTR review`, description: context[industry], definition: definition("ctr", "lt", 1, "create_recommendation"), enabled: false },
    { key: "high-cpa-review", name: `${label} · cost per conversion review`, description: "Flag the demo campaign for a human check when simulated CPA exceeds the threshold.", definition: definition("cpa", "gt", 50, "create_review_task"), enabled: false },
    { key: "budget-threshold-review", name: `${label} · budget threshold check`, description: "Create an approval-gated review when simulated budget utilization crosses the configured threshold.", definition: definition("budget_utilization", "gt", 90, "flag_campaign"), enabled: false },
  ];
}
