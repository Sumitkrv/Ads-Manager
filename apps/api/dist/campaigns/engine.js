import { createHash } from "node:crypto";
import { CampaignBriefSchema, CampaignPlanSchema } from "@ai-ads/shared";
const INDUSTRY_GUIDANCE = {
    real_estate: { focus: "property discovery and qualified enquiries", audience: "people exploring homes or property options in the selected area", keywords: ["homes in", "property for sale", "real estate near"] },
    ecommerce_retail: { focus: "product discovery and online purchases", audience: "shoppers interested in the product category and value proposition", keywords: ["shop", "buy online", "best"] },
    healthcare_clinics: { focus: "service information and appointment enquiries", audience: "people looking for general information about local care services", keywords: ["clinic near", "book an appointment", "health service"], warning: "Healthcare messaging needs provider and jurisdiction review. Avoid personal-attribute, outcome, or unverified medical claims." },
    education_coaching: { focus: "course discovery and enrolment enquiries", audience: "learners comparing programs, course formats, or upcoming intakes", keywords: ["course", "training program", "enrolment"] },
    gyms_fitness: { focus: "membership interest and trial-class enquiries", audience: "local people comparing fitness memberships, classes, or facilities", keywords: ["gym membership", "fitness classes", "trial class"] },
    restaurants_cafes: { focus: "menu discovery and local visits", audience: "nearby diners exploring food, occasions, or reservations", keywords: ["restaurant", "book a table", "food near"] },
    hotels_hospitality: { focus: "stay discovery and booking enquiries", audience: "travellers comparing accommodation, amenities, and locations", keywords: ["hotel", "places to stay", "book a stay"] },
    travel_tourism: { focus: "destination and experience discovery", audience: "travellers exploring itineraries, destinations, and trip options", keywords: ["travel experience", "guided tour", "holiday package"] },
    automobile_dealerships: { focus: "vehicle discovery and test-drive enquiries", audience: "local buyers comparing vehicle options and dealership services", keywords: ["cars for sale", "vehicle dealer", "book a test drive"] },
    salons_beauty: { focus: "service discovery and appointment enquiries", audience: "local customers comparing salon, spa, or personal care services", keywords: ["salon near", "beauty appointment", "book a service"] },
    professional_services: { focus: "service discovery and consultation enquiries", audience: "organizations evaluating specialist services and expertise", keywords: ["professional services", "consulting", "business advisor"] },
    marketing_agencies: { focus: "agency capability discovery and consultation leads", audience: "business teams comparing marketing support and agency capabilities", keywords: ["marketing agency", "advertising services", "campaign support"] },
    home_services: { focus: "local service discovery and estimate enquiries", audience: "nearby households comparing service providers and project support", keywords: ["home service", "local repair", "request an estimate"] },
    finance_insurance: { focus: "service education and qualified enquiries", audience: "people comparing general financial or insurance service information", keywords: ["financial services", "insurance options", "speak with an advisor"], warning: "Financial and insurance content needs legal and provider review. Do not imply guaranteed returns, eligibility, or outcomes." },
    events_entertainment: { focus: "event discovery and registration intent", audience: "people looking for upcoming experiences, shows, or gatherings", keywords: ["events near", "tickets", "upcoming experience"] },
    other: { focus: "offer discovery and relevant enquiries", audience: "people with an interest in the service described in this brief", keywords: ["learn more", "services", "contact"] },
};
function hash(input) { return createHash("sha256").update(input).digest("hex"); }
function stableId(seed, key) {
    const h = hash(`${seed}:${key}`).slice(0, 32).split("");
    h[12] = "4";
    h[16] = ((parseInt(h[16] ?? "0", 16) & 3) | 8).toString(16);
    const s = h.join("");
    return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20)}`;
}
function seedFor(input) { return Number.parseInt(hash(JSON.stringify(input)).slice(0, 8), 16); }
function shorten(value, max) { return value.length <= max ? value : `${value.slice(0, Math.max(0, max - 1)).trimEnd()}…`; }
function title(value) { return value.replace(/\s+/g, " ").trim(); }
export class SimulationCampaignProvider {
    mode = "simulation";
    generateCampaign(input) {
        const brief = CampaignBriefSchema.parse(input.brief);
        const seed = input.seed ?? seedFor({ platform: input.platform, objective: input.objective, brief });
        const guide = INDUSTRY_GUIDANCE[brief.industry];
        const place = brief.regions[0] ?? brief.country;
        const offer = brief.offer.trim() || brief.productService;
        const benefit = brief.uniqueSellingPoints[0] ?? (brief.mainMessage.trim() || guide.focus);
        const business = title(brief.businessName);
        const product = title(brief.productService);
        const cta = title(brief.preferredCta);
        const hooks = [
            `${business} | ${product}`,
            `${product} in ${place}`,
            `${shorten(offer, 30)}`,
            `${shorten(benefit, 30)}`,
            `${business} ${shorten(cta, 15)}`,
            `${shorten(guide.focus, 30)}`,
        ];
        const descriptions = [
            `${business} helps with ${product.toLowerCase()} in ${place}. ${shorten(benefit, 56)}.`,
            `${shorten(offer, 52)}. Explore details and ${cta.toLowerCase()} with ${business}.`,
            `${shorten(brief.audienceDescription || guide.audience, 70)}. See options from ${business}.`,
        ];
        const selected = seed % hooks.length;
        const warnings = [
            "Demo output is rule-based. Review every claim, destination and platform field before use.",
            ...(guide.warning ? [guide.warning] : []),
            ...(brief.industry === "real_estate" || brief.industry === "finance_insurance" ? ["Targeting and copy for regulated or special-category campaigns require policy review."] : []),
        ];
        const common = {
            platform: input.platform,
            objective: input.objective,
            strategy: `Use a ${input.platform === "google_ads" ? "Search draft" : "Meta ad set"} focused on ${guide.focus}. Lead with ${benefit.toLowerCase()}, present ${offer.toLowerCase()} clearly, and direct ${place} audiences to the supplied landing page. Budget and targeting are planning inputs only.`,
            audienceSuggestions: [
                `${guide.audience} in ${place}.`,
                ...(brief.interestThemes.length ? [`Interest themes to review: ${brief.interestThemes.join(", ")}.`] : []),
                ...(brief.exclusions.length ? [`Exclude where supported and appropriate: ${brief.exclusions.join(", ")}.`] : []),
            ],
            creativeSuggestions: [
                `Lead with ${benefit.toLowerCase()} in a ${brief.brandVoice} voice.`,
                brief.promotionalHook ? `Test the supplied hook: ${brief.promotionalHook}.` : `Test a concise opening about ${offer.toLowerCase()}.`,
                `Use a clear ${cta} call to action and verify the page matches the ad.`
            ],
            warnings,
            generation: {
                mode: "simulation", label: "AI Simulation", version: "tandem-rule-engine-v1", seed,
                generatedAt: new Date().toISOString(), inputSnapshot: JSON.parse(JSON.stringify({ ...input, seed })),
                selectedVariations: [selected, (selected + 1) % hooks.length], userModifications: [],
            },
        };
        const output = input.platform === "google_ads"
            ? {
                ...common,
                google: { adGroups: [{ id: stableId(seed, "group:0"), name: shorten(`${product} | ${place}`, 100),
                            keywords: (brief.keywords.length ? brief.keywords : guide.keywords.map((word) => `${word} ${place}`)).slice(0, 12).map((text, index) => ({ text, matchType: index < 3 ? "phrase" : "broad" })),
                            ads: [{ id: stableId(seed, "search-ad:0"), headlines: hooks.map((value) => shorten(value, 30)).slice(0, 6), descriptions: descriptions.map((value) => shorten(value, 90)).slice(0, 3), finalUrl: brief.landingPageUrl }], }] },
            }
            : {
                ...common,
                meta: { adSets: [{ id: stableId(seed, "ad-set:0"), name: shorten(`${product} | ${place}`, 100),
                            audience: brief.audienceDescription || guide.audience,
                            locations: brief.regions.length ? brief.regions : [brief.country], placements: ["feed", "stories", "reels"],
                            budgetAmount: brief.budgetAmount, budgetType: brief.budgetType,
                            ads: [{ id: stableId(seed, "meta-ad:0"), primaryText: `${brief.promotionalHook ? `${brief.promotionalHook} ` : ""}${business}: ${benefit}. ${shorten(offer, 220)}. ${brief.mainMessage ? `${brief.mainMessage} ` : ""}${cta}.`,
                                    headline: shorten(`${product} from ${business}`, 255), description: shorten(brief.businessDescription || guide.focus, 500), cta, destinationUrl: brief.landingPageUrl, creativeReference: null }], }] },
            };
        return CampaignPlanSchema.parse(output);
    }
    regenerateSection(plan, section, seed) {
        const brief = CampaignBriefSchema.parse(plan.generation.inputSnapshot.brief);
        const revised = this.generateCampaign({ platform: plan.platform, objective: plan.objective, brief, seed });
        const merged = structuredClone(plan);
        if (section === "copy") {
            if (merged.google && revised.google)
                merged.google = revised.google;
            if (merged.meta && revised.meta)
                merged.meta = revised.meta;
        }
        else if (section === "audience")
            merged.audienceSuggestions = revised.audienceSuggestions;
        else
            merged.creativeSuggestions = revised.creativeSuggestions;
        merged.generation.selectedVariations = revised.generation.selectedVariations;
        return CampaignPlanSchema.parse(merged);
    }
    generateHeadlines(input) {
        const plan = this.generateCampaign(input);
        return plan.platform === "google_ads" ? plan.google?.adGroups[0]?.ads[0]?.headlines ?? [] : plan.meta?.adSets[0]?.ads.map((ad) => ad.headline) ?? [];
    }
    generateDescriptions(input) {
        const plan = this.generateCampaign(input);
        return plan.platform === "google_ads" ? plan.google?.adGroups[0]?.ads[0]?.descriptions ?? [] : plan.meta?.adSets[0]?.ads.map((ad) => ad.description) ?? [];
    }
    suggestKeywords(brief) {
        const guide = INDUSTRY_GUIDANCE[brief.industry];
        const location = brief.regions[0] ?? brief.country;
        return (brief.keywords.length ? brief.keywords : guide.keywords.map((keyword) => `${keyword} ${location}`)).slice(0, 12);
    }
    suggestAudience(brief) {
        const guide = INDUSTRY_GUIDANCE[brief.industry];
        return [`${brief.audienceDescription || guide.audience} in ${brief.regions[0] ?? brief.country}`];
    }
    generateCreativeBrief(brief) {
        const guide = INDUSTRY_GUIDANCE[brief.industry];
        const emphasis = brief.uniqueSellingPoints[0] ?? (brief.mainMessage.trim() || guide.focus);
        return [`Emphasize ${emphasis}.`, `Use a ${brief.tone} tone and a ${brief.preferredCta} call to action.`];
    }
    generateBudgetRationale(brief) {
        return brief.budgetRationale || `${brief.budgetType === "daily" ? "Daily" : "Lifetime"} planning amount of ${brief.budgetAmount} ${brief.currency} for ${brief.industry.replaceAll("_", " ")} promotion. This value is not a provider forecast or accepted budget.`;
    }
}
export function validateCampaign(brief, plan, expectedPlatform, expectedObjective) {
    const parsed = CampaignBriefSchema.safeParse(brief);
    const issues = [];
    if (!parsed.success)
        for (const issue of parsed.error.issues)
            issues.push({ severity: "error", code: "brief_invalid", message: issue.message, field: issue.path.join(".") || null });
    if (!plan) {
        issues.push({ severity: "error", code: "generation_required", message: "Generate a campaign plan before review.", field: "plan" });
        return issues;
    }
    const generated = CampaignPlanSchema.safeParse(plan);
    if (!generated.success)
        for (const issue of generated.error.issues)
            issues.push({ severity: "error", code: "plan_invalid", message: issue.message, field: issue.path.join(".") || null });
    if (expectedPlatform && plan.platform !== expectedPlatform)
        issues.push({ severity: "error", code: "plan_platform_mismatch", message: "Draft structure does not match the selected campaign platform.", field: "platform" });
    if (expectedObjective && plan.objective !== expectedObjective)
        issues.push({ severity: "error", code: "plan_objective_mismatch", message: "Draft objective does not match the campaign objective.", field: "objective" });
    if (parsed.success && parsed.data.budgetAmount < 5)
        issues.push({ severity: "warning", code: "demo_budget_low", message: "This demo budget is under 5 units of the selected currency; adjust it for a useful planning exercise.", field: "budgetAmount" });
    if (parsed.success && parsed.data.industry === "healthcare_clinics")
        issues.push({ severity: "warning", code: "regulated_copy_review", message: "Healthcare messaging needs a qualified policy and regulatory review.", field: "brief" });
    issues.push({ severity: "information", code: "provider_unverified", message: "Local validation does not verify provider eligibility, reach, policy approval, or delivery.", field: null });
    return issues;
}
