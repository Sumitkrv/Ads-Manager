import { describe, expect, it } from "vitest";
import { INDUSTRIES } from "@ai-ads/shared";
import { automationTemplatesForIndustry } from "./automationTemplates";

describe("industry-aware automation templates", () => {
  it("provides editable, disabled approval-gated templates for all workspace industries", () => {
    for (const industry of INDUSTRIES) {
      const templates = automationTemplatesForIndustry(industry.key);
      expect(templates).toHaveLength(3);
      expect(templates.every((template) => template.enabled === false)).toBe(true);
      expect(templates.every((template) => template.definition.industry === industry.key)).toBe(true);
      expect(templates.every((template) => template.definition.approvalRequired)).toBe(true);
      expect(new Set(templates.map((template) => template.key)).size).toBe(templates.length);
    }
  });

  it("keeps regulated-industry guidance cautious", () => {
    expect(automationTemplatesForIndustry("healthcare_clinics")[0]?.description).toContain("avoid outcome promises");
    expect(automationTemplatesForIndustry("finance_insurance")[0]?.description).toContain("avoid rate or outcome guarantees");
  });
});
