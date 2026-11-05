import { describe, expect, it } from "vitest";
import {
  INDUSTRIES,
  INDUSTRY_ONBOARDING_GUIDANCE,
  UserOnboardingPreferencesInputSchema,
  PlatformTourProgressInputSchema,
  WorkspaceOnboardingPatchSchema,
} from "@ai-ads/shared";
import { getPlatformOperatorTour, getProductTour, toursForRole } from "./tours";

describe("onboarding contracts and guidance", () => {
  it("provides guidance for every industry in the existing catalogue", () => {
    expect(Object.keys(INDUSTRY_ONBOARDING_GUIDANCE).sort()).toEqual(INDUSTRIES.map((item) => item.key).sort());
    for (const industry of INDUSTRIES) {
      expect(INDUSTRY_ONBOARDING_GUIDANCE[industry.key]?.goal).toBeTruthy();
      expect(INDUSTRY_ONBOARDING_GUIDANCE[industry.key]?.example).toBeTruthy();
    }
  });

  it("keeps pre-workspace drafts user-owned and rejects unexpected fields", () => {
    expect(UserOnboardingPreferencesInputSchema.safeParse({ setupPath: "business", draft: { businessName: "Northstar", currentStep: 2 } }).success).toBe(true);
    expect(UserOnboardingPreferencesInputSchema.safeParse({ setupPath: "business", draft: { accessToken: "secret" } }).success).toBe(false);
    expect(UserOnboardingPreferencesInputSchema.safeParse({ setupPath: "business", draft: { businessName: "x", anotherTenantId: "b3000000-0000-4000-8000-000000000002" } }).success).toBe(false);
  });

  it("does not accept client-supplied onboarding completion flags", () => {
    expect(WorkspaceOnboardingPatchSchema.safeParse({ setupData: { mainOffering: "Consulting" }, currentStep: 2, lastCompletedStep: 1 }).success).toBe(true);
    expect(WorkspaceOnboardingPatchSchema.safeParse({ setupData: {}, currentStep: 6, lastCompletedStep: 6, markComplete: true }).success).toBe(false);
  });

  it("validates user-scoped platform tour progress without accepting caller identity", () => {
    expect(PlatformTourProgressInputSchema.safeParse({ tourId: "platform-operator", stepIndex: 8, status: "running" }).success).toBe(true);
    expect(PlatformTourProgressInputSchema.safeParse({ tourId: "platform-operator", stepIndex: 9, status: "running" }).success).toBe(false);
    expect(PlatformTourProgressInputSchema.safeParse({ tourId: "platform-operator", stepIndex: 0, status: "completed", userId: "21000000-0000-4000-8000-000000000001" }).success).toBe(false);
  });
});

describe("role-aware product tours", () => {
  it("offers workspace owner modules to owners and agency owners", () => {
    expect(toursForRole("owner").map((tour) => tour.id)).toContain("owner-overview");
    expect(toursForRole("owner", true).map((tour) => tour.id)).toContain("agency-command-center");
    expect(toursForRole("owner", true).map((tour) => tour.id)).toContain("owner-overview");
  });

  it("keeps edit tours out of the viewer experience", () => {
    const viewerTours = toursForRole("viewer").map((tour) => tour.id);
    expect(viewerTours).toContain("viewer-reporting");
    expect(viewerTours).not.toContain("campaign-studio");
    expect(viewerTours).not.toContain("creative-studio");
  });

  it("uses semantic targets and builds a platform tour from only authorized console capabilities", () => {
    expect(getProductTour("campaign-studio")?.steps.map((step) => step.target)).toEqual(["nav-campaigns", "campaign-new"]);
    const supportTour = getPlatformOperatorTour({ "platform.dashboard.read": true, "platform.support.manage": true });
    expect(supportTour?.steps.map((step) => step.target)).toEqual(["platform-page-title", "platform-nav-support"]);
    expect(supportTour?.steps.some((step) => step.body.includes("customer content"))).toBe(true);
    expect(getPlatformOperatorTour({ "platform.support.manage": false })).toBeUndefined();
    expect(getPlatformOperatorTour({ "platform.support.manage": true })).toBeUndefined();
  });
});
