import assert from "node:assert/strict";
import test from "node:test";
import { INDUSTRIES } from "@ai-ads/shared";
import { INDUSTRY_TEMPLATE_KEYS, OfflineCreativeVariationProvider } from "./generator.js";
const provider = new OfflineCreativeVariationProvider();
const brand = {
    primaryColor: "#24385C", secondaryColor: "#8297F5", accentColors: ["#E9A967"], headingFont: "Space Grotesk", bodyFont: "Inter",
};
test("all sixteen workspace industries have relevant editable starter templates", () => {
    assert.equal(Object.keys(INDUSTRY_TEMPLATE_KEYS).length, 16);
    for (const industry of INDUSTRIES) {
        const templates = provider.generateTemplates(industry.key);
        assert.ok(templates.length >= 2, `${industry.key} has more than one relevant starter`);
        assert.ok(templates.every((template) => template.industries.includes(industry.key)));
    }
});
test("offline variations are deterministic, structured and use business inputs", () => {
    const input = {
        industry: "ecommerce_retail", businessName: "Northstar Goods", productService: "Ceramic travel mug",
        offer: "A considered everyday cup", mainMessage: "Made for the morning commute", cta: "Explore the collection",
        objective: "sales", aspectRatio: "portrait", imageAssetId: null, hook: "Carry a little calm", seed: 1729, brand,
    };
    const first = provider.generateVariations(input);
    const replay = provider.generateVariations(input);
    assert.deepEqual(first, replay);
    assert.equal(first.length, 8);
    assert.ok(first.every((variation) => variation.label === "Offline Creative Variations"));
    assert.ok(first.every((variation) => variation.document.width === 1080 && variation.document.height === 1350));
    assert.ok(first.every((variation) => variation.document.elements.some((item) => item.type === "text" && item.text.includes("Ceramic travel mug"))));
    assert.ok(first.every((variation) => variation.document.elements.some((item) => item.type === "text" && item.fontFamily === "Space Grotesk")));
});
test("regulated industries use cautious claims and no factual performance guarantees", () => {
    const results = provider.generateVariations({ industry: "healthcare_clinics", businessName: "Harbor Clinic", productService: "Consultation", offer: "", mainMessage: "Learn about available care", cta: "Read more", objective: "lead_generation", aspectRatio: "square", imageAssetId: null, hook: "", seed: 5 });
    const copy = results.flatMap((variation) => variation.document.elements.filter((element) => element.type === "text").map((element) => element.text)).join(" ").toLowerCase();
    assert.ok(!copy.includes("guaranteed cure"));
    assert.ok(copy.includes("learn about available care"));
});
