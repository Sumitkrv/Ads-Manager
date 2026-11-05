import { createHash } from "node:crypto";
import { INDUSTRIES } from "@ai-ads/shared";
import { CreativeDocumentSchema, CreativeVariationSchema } from "@ai-ads/shared";
const templates = [
    { key: "product-promotion", name: "Product spotlight", category: "Product Promotion", description: "A strong product line with a compact offer panel.", industries: ["ecommerce_retail", "automobile_dealerships"], eyebrow: "MADE FOR YOUR DAY", headline: "Put your product in focus", subhead: "A clear benefit gives people a reason to look closer.", accent: "#7C9EFF" },
    { key: "lead-generation", name: "Local lead story", category: "Lead Generation", description: "A focused service message and prominent response path.", industries: ["real_estate", "healthcare_clinics", "professional_services", "home_services", "finance_insurance"], eyebrow: "A BETTER NEXT STEP", headline: "Make your next move with clarity", subhead: "A useful conversation starts with the right details.", accent: "#A994FF" },
    { key: "brand-awareness", name: "Brand statement", category: "Brand Awareness", description: "Editorial typography with space for the brand message.", industries: ["marketing_agencies", "hotels_hospitality", "salons_beauty", "other"], eyebrow: "A NOTE FROM THE BRAND", headline: "Good work should feel unmistakable", subhead: "Bring your point of view into focus.", accent: "#FFB36B" },
    { key: "event-promotion", name: "Event invitation", category: "Event Promotion", description: "Date and invitation-forward composition.", industries: ["events_entertainment", "gyms_fitness"], eyebrow: "SAVE YOUR PLACE", headline: "Something worth showing up for", subhead: "A thoughtful invitation, with the details up front.", accent: "#FF87A6" },
    { key: "local-business-offer", name: "Neighborhood offer", category: "Local Business Offer", description: "Local service promotion with a clear action.", industries: ["restaurants_cafes", "salons_beauty", "home_services"], eyebrow: "FOR YOUR NEIGHBORHOOD", headline: "A little more care, close to home", subhead: "Local service shaped around what matters to you.", accent: "#78D5BC" },
    { key: "seasonal-campaign", name: "Seasonal moment", category: "Seasonal Campaign", description: "A flexible seasonal message with room for a campaign hook.", industries: ["ecommerce_retail", "travel_tourism", "restaurants_cafes", "other"], eyebrow: "THE SEASON, RECONSIDERED", headline: "Make room for something new", subhead: "A seasonal idea, ready for your own message.", accent: "#C6A6FF" },
    { key: "service-advertisement", name: "Service introduction", category: "Service Advertisement", description: "A service-first layout that puts practical information first.", industries: ["healthcare_clinics", "professional_services", "home_services", "finance_insurance"], eyebrow: "HERE WHEN IT MATTERS", headline: "Thoughtful service. Clear next steps.", subhead: "Explain what you offer without overstating the outcome.", accent: "#78B9FF" },
    { key: "education-enrollment", name: "Enrollment announcement", category: "Education Enrollment", description: "A course or enrollment message with a clear period.", industries: ["education_coaching"], eyebrow: "LEARN AT YOUR PACE", headline: "Make the next skill yours", subhead: "Explore the program, format, and upcoming dates.", accent: "#79CDB7" },
    { key: "fitness-membership", name: "Studio session", category: "Fitness Membership", description: "A movement-led invitation without body or health promises.", industries: ["gyms_fitness"], eyebrow: "FIND YOUR RHYTHM", headline: "Your space to keep moving", subhead: "Classes and training built around your routine.", accent: "#FA8F7F" },
    { key: "restaurant-promotion", name: "Table for today", category: "Restaurant Promotion", description: "A menu or reservation concept with appetite-led typography.", industries: ["restaurants_cafes"], eyebrow: "AT THE TABLE", headline: "A fresh reason to get together", subhead: "Discover the menu, then choose your moment.", accent: "#E1AE70" },
    { key: "travel-package", name: "A place to pause", category: "Travel Package", description: "A destination-led composition with flexible trip details.", industries: ["travel_tourism", "hotels_hospitality"], eyebrow: "TAKE THE LONG WAY", headline: "Find a little space elsewhere", subhead: "Explore the details and decide what suits your trip.", accent: "#8CBBCB" },
    { key: "real-estate-listing", name: "Property details", category: "Real Estate Listing", description: "A property title and location layout; add verified listing facts.", industries: ["real_estate"], eyebrow: "A PLACE TO CALL YOURS", headline: "Room for the life you imagine", subhead: "Add verified property details and location before publishing.", accent: "#E6B57A" },
    { key: "ecommerce-product-offer", name: "Shop the edit", category: "E-commerce Product Offer", description: "Product and offer pairing with a distinct CTA area.", industries: ["ecommerce_retail", "salons_beauty"], eyebrow: "THE CURRENT EDIT", headline: "Find your new everyday favorite", subhead: "A considered product story, in your own voice.", accent: "#D6A2D4" },
    { key: "professional-services", name: "Expertise, clearly", category: "Professional Services", description: "An expertise statement designed for considered services.", industries: ["professional_services", "marketing_agencies", "finance_insurance"], eyebrow: "A CLEARER WAY FORWARD", headline: "Make the complex feel manageable", subhead: "Start with context, then explore the right next step.", accent: "#8F9FFF" },
];
export const INDUSTRY_TEMPLATE_KEYS = {
    real_estate: ["real-estate-listing", "lead-generation"],
    ecommerce_retail: ["ecommerce-product-offer", "product-promotion", "seasonal-campaign"],
    healthcare_clinics: ["service-advertisement", "lead-generation"],
    education_coaching: ["education-enrollment", "brand-awareness"],
    gyms_fitness: ["fitness-membership", "event-promotion"],
    restaurants_cafes: ["restaurant-promotion", "local-business-offer"],
    hotels_hospitality: ["travel-package", "brand-awareness"],
    travel_tourism: ["travel-package", "seasonal-campaign"],
    automobile_dealerships: ["product-promotion", "service-advertisement"],
    salons_beauty: ["local-business-offer", "ecommerce-product-offer"],
    professional_services: ["professional-services", "lead-generation"],
    marketing_agencies: ["professional-services", "brand-awareness"],
    home_services: ["service-advertisement", "local-business-offer"],
    finance_insurance: ["lead-generation", "professional-services"],
    events_entertainment: ["event-promotion", "brand-awareness"],
    other: ["brand-awareness", "service-advertisement"],
};
const tones = {
    real_estate: "A considered home search starts with verified details.",
    ecommerce_retail: "An everyday product story, with the benefit made clear.",
    healthcare_clinics: "Clear information can help people understand available care.",
    education_coaching: "A useful learning path begins with a practical next step.",
    gyms_fitness: "A welcoming invitation to explore a routine that fits.",
    restaurants_cafes: "A thoughtful menu moment, ready to share.",
    hotels_hospitality: "A stay described with care, context, and practical details.",
    travel_tourism: "A destination story shaped around the traveller's own plans.",
    automobile_dealerships: "Explore the vehicle details and arrange a conversation.",
    salons_beauty: "A considered service experience, described in your own voice.",
    professional_services: "Explain the process, scope, and next step clearly.",
    marketing_agencies: "Show the work and point of view behind your approach.",
    home_services: "Describe the service area and scope before setting expectations.",
    finance_insurance: "Provide clear product information without guaranteed outcomes.",
    events_entertainment: "Share the occasion, date, and practical ways to take part.",
    other: "A direct introduction that leaves room for your business specifics.",
};
function stableUuid(seed, index) {
    const hex = createHash("sha256").update("tandem-creative:" + seed + ":" + index).digest("hex").slice(0, 32).split("");
    hex[12] = "4";
    hex[16] = ["8", "9", "a", "b"][parseInt(hex[16], 16) % 4];
    const value = hex.join("");
    return value.slice(0, 8) + "-" + value.slice(8, 12) + "-" + value.slice(12, 16) + "-" + value.slice(16, 20) + "-" + value.slice(20);
}
function dimensions(ratio) {
    return ratio === "portrait" ? { width: 1080, height: 1350 }
        : ratio === "vertical" ? { width: 1080, height: 1920 }
            : ratio === "landscape" ? { width: 1200, height: 628 }
                : { width: 1080, height: 1080 };
}
function textElement(seed, index, text, x, y, width, height, fontSize, color, fontFamily, align = "left", weight = "600") {
    return { id: stableUuid(seed, index), type: "text", x, y, width, height, rotation: 0, opacity: 1, locked: false, text, fontFamily, fontSize, fontWeight: weight, letterSpacing: 0, color, align };
}
function shapeElement(seed, index, x, y, width, height, fill, shape = "rectangle", radius = 20) {
    return { id: stableUuid(seed, index), type: "shape", x, y, width, height, rotation: 0, opacity: 1, locked: false, shape, fill, borderColor: null, borderWidth: 0, radius };
}
export class OfflineCreativeVariationProvider {
    generateTemplates(industry) {
        return templates.filter((template) => !industry || INDUSTRY_TEMPLATE_KEYS[industry].includes(template.key)).map(({ key, name, category, description }) => ({
            key, name, category, description,
            industries: INDUSTRIES.filter((candidate) => INDUSTRY_TEMPLATE_KEYS[candidate.key].includes(key)).map((candidate) => candidate.key),
        }));
    }
    templateDocument(templateKey, seed, brand) {
        const template = templates.find((item) => item.key === templateKey);
        if (!template)
            throw new Error("Creative template was not found.");
        const primary = brand?.primaryColor ?? "#1C2842";
        const accent = brand?.accentColors[0] ?? template.accent;
        const headingFont = brand?.headingFont ?? "Inter";
        const bodyFont = brand?.bodyFont ?? "Inter";
        const document = {
            version: 1,
            width: 1080,
            height: 1080,
            background: { kind: "gradient", from: "#101827", to: "#222D43", angle: 135 },
            elements: [
                shapeElement(seed, 1, 700, -80, 500, 500, accent, "circle", 250),
                shapeElement(seed, 2, -180, 700, 560, 560, primary, "circle", 280),
                textElement(seed, 3, "TEMPLATE · REPLACE WITH YOUR COPY", 88, 95, 860, 36, 17, accent, bodyFont, "left", "700"),
                textElement(seed, 4, template.eyebrow, 88, 300, 860, 38, 18, "#CBD5E1", bodyFont, "left", "700"),
                textElement(seed, 5, template.headline, 88, 365, 850, 190, 68, "#FFFFFF", headingFont, "left", "700"),
                textElement(seed, 6, template.subhead, 88, 590, 770, 120, 28, "#D2D9E5", bodyFont, "left", "400"),
                shapeElement(seed, 7, 88, 825, 280, 74, accent, "rectangle", 24),
                textElement(seed, 8, "YOUR CALL TO ACTION", 112, 843, 230, 38, 18, "#0B1120", bodyFont, "center", "700"),
            ],
        };
        return CreativeDocumentSchema.parse(document);
    }
    generateVariations(input) {
        const preset = dimensions(input.aspectRatio);
        const brand = input.brand;
        const accent = brand?.accentColors[0] ?? "#91A9FF";
        const dark = brand?.primaryColor ?? "#15213A";
        const headingFont = brand?.headingFont ?? "Inter";
        const bodyFont = brand?.bodyFont ?? "Inter";
        const objectiveFallback = { awareness: "Introduce the brand with a clear, memorable point of view.", traffic: "Give interested people a clear reason to explore more.", website_traffic: "Give interested people a clear reason to explore more.", leads: "Make the next step easy to understand.", lead_generation: "Make the next step easy to understand.", sales: "Bring the product and its value into focus.", engagement: "Start a useful conversation with your community.", app_promotion: "Show what people can explore in the app." };
        const description = input.hook.trim() || input.offer.trim() || input.mainMessage.trim() || objectiveFallback[input.objective] || tones[input.industry];
        const headline = input.productService.trim() || input.businessName.trim() || INDUSTRIES.find((industry) => industry.key === input.industry)?.name || "Your next idea";
        const styles = [
            { name: "Editorial", eyebrow: "A CLEAR POINT OF VIEW", background: { kind: "solid", color: "#F1F0EC" }, text: "#172033", accent, y: 230 },
            { name: "Minimal product focus", eyebrow: "MADE WITH INTENTION", background: { kind: "solid", color: dark }, text: "#FFFFFF", accent: brand?.secondaryColor ?? "#C5D2FF", y: 330 },
            { name: "Bold type", eyebrow: "TAKE A CLOSER LOOK", background: { kind: "gradient", from: dark, to: accent, angle: 140 }, text: "#FFFFFF", accent: "#FFFFFF", y: 280 },
            { name: "Split composition", eyebrow: "THE DETAILS MATTER", background: { kind: "solid", color: "#111827" }, text: "#FFFFFF", accent, y: 400 },
            { name: "Offer-led", eyebrow: "A THOUGHTFUL OFFER", background: { kind: "solid", color: "#211A2F" }, text: "#FFFFFF", accent: "#F1B97A", y: 320 },
            { name: "Image-led", eyebrow: "YOUR STORY, IN FRAME", background: { kind: "solid", color: "#172033" }, text: "#FFFFFF", accent, y: 575 },
            { name: "Premium", eyebrow: "A MORE CONSIDERED CHOICE", background: { kind: "solid", color: "#111111" }, text: "#F7F1E8", accent: "#C9A76D", y: 330 },
            { name: "Local invitation", eyebrow: "A NOTE FROM YOUR COMMUNITY", background: { kind: "solid", color: "#10201F" }, text: "#F3F7F5", accent: "#82D1B7", y: 320 },
        ];
        return styles.map((style, index) => {
            const imageTop = Math.round(preset.height * 0.47);
            const imageLayer = input.imageAssetId && ["Split composition", "Image-led"].includes(style.name)
                ? [{ id: stableUuid(input.seed + index, 3), type: "image", x: 0, y: imageTop, width: preset.width, height: preset.height - imageTop, rotation: 0, opacity: 1, locked: false, assetId: input.imageAssetId, fit: "cover" }]
                : [];
            const elements = [
                ...(style.background.kind === "solid" ? [shapeElement(input.seed + index, 1, 0, 0, preset.width, preset.height, style.background.color, "rectangle", 0)] : []),
                shapeElement(input.seed + index, 2, Math.round(preset.width * 0.74), -Math.round(preset.height * 0.08), Math.round(preset.width * 0.38), Math.round(preset.width * 0.38), style.accent, "circle", 220),
                ...imageLayer,
                textElement(input.seed + index, 4, style.eyebrow, 72, 90, preset.width - 144, 36, Math.max(14, Math.round(preset.width / 64)), style.accent, bodyFont, "left", "700"),
                textElement(input.seed + index, 5, headline, 72, style.y, preset.width - 144, Math.round(preset.height * 0.22), Math.max(34, Math.round(preset.width / 14)), style.text, headingFont, index === 0 ? "left" : "center", "700"),
                textElement(input.seed + index, 6, description, 76, style.y + Math.round(preset.height * 0.22), preset.width - 152, 110, Math.max(16, Math.round(preset.width / 44)), style.text, bodyFont, index === 0 ? "left" : "center", "400"),
                shapeElement(input.seed + index, 7, 76, preset.height - 154, Math.min(380, preset.width - 152), 72, style.accent, "rectangle", 24),
                textElement(input.seed + index, 8, input.cta.trim() || "LEARN MORE", 92, preset.height - 136, Math.min(348, preset.width - 184), 38, Math.max(15, Math.round(preset.width / 60)), style.background.kind === "solid" ? style.background.color : dark, bodyFont, "center", "700"),
            ];
            const document = CreativeDocumentSchema.parse({ version: 1, ...preset, background: style.background, elements, generation: { mode: "offline", label: "Offline Creative Variations", seed: input.seed + index, style: style.name } });
            return CreativeVariationSchema.parse({ name: style.name + " · " + (input.businessName || INDUSTRIES.find((industry) => industry.key === input.industry)?.name || "Creative"), style: style.name, seed: input.seed + index, document, label: "Offline Creative Variations" });
        });
    }
}
