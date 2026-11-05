import assert from "node:assert/strict";
import test from "node:test";
import { aggregateMetrics, buildTimeSeries, type DemoFact } from "./engine.js";
import { createCsv, createReportPdf } from "./exports.js";

const facts: DemoFact[] = [
  { date:"2026-10-27",workspaceId:"w",campaignId:"a",campaignName:"Alpha",platform:"google_ads",objective:"traffic",status:"demo_published",industry:"professional_services",scenario:"average",simulationId:"s1",seed:19,currency:"USD",impressions:1000,clicks:50,spend:20,conversions:5,revenue:80 },
  { date:"2026-10-28",workspaceId:"w",campaignId:"b",campaignName:"Beta",platform:"meta_ads",objective:"sales",status:"demo_published",industry:"ecommerce_retail",scenario:"average",simulationId:"s2",seed:19,currency:"USD",impressions:500,clicks:25,spend:10,conversions:2,revenue:40 },
  { date:"2026-10-28",workspaceId:"w",campaignId:"c",campaignName:"Gamma",platform:"meta_ads",objective:"sales",status:"demo_published",industry:"ecommerce_retail",scenario:"average",simulationId:"s3",seed:19,currency:"EUR",impressions:500,clicks:0,spend:5,conversions:0,revenue:null },
];

test("analytics aggregation recomputes weighted ratios from raw counts", () => {
  const total = aggregateMetrics(facts);
  assert.equal(total.impressions, 2000);
  assert.equal(total.clicks, 75);
  assert.equal(total.ctr, 3.75);
  assert.equal(total.conversionRate, Number((7 / 75 * 100).toFixed(2)));
  assert.equal(total.cpc, null, "mixed currencies do not produce one cost ratio");
  assert.equal(total.spendByCurrency.find((item) => item.currency === "USD")?.cpc, 0.4);
  assert.equal(total.spendByCurrency.find((item) => item.currency === "USD")?.cpm, 20);
  assert.equal(total.spendByCurrency.find((item) => item.currency === "USD")?.cpa, 4.29);
  assert.equal(total.spendByCurrency.find((item) => item.currency === "USD")?.roas, 4);
  assert.equal(total.spendByCurrency.find((item) => item.currency === "EUR")?.cpc, null);
  assert.equal(total.spendByCurrency.find((item) => item.currency === "EUR")?.roas, null);
});

test("CSV export neutralizes spreadsheet formula injection and escapes cells", () => {
  const output = createCsv(["Campaign", "Metric"], [["=HYPERLINK(\"bad\")", "line,one\nline two"]]).toString("utf8");
  assert.ok(output.startsWith("\uFEFFCampaign,Metric"));
  assert.ok(output.includes("'=HYPERLINK(\""));
  assert.ok(output.includes('"line,one\nline two"'));
});

test("PDF export produces a complete local PDF with title and simulated-data disclosure", () => {
  const pdf = createReportPdf({ title:"Executive overview",workspaceName:"Northstar Workspace",from:"2026-10-01",to:"2026-10-28",metric:"clicks",metrics:aggregateMetrics(facts),trend:[{date:"2026-10-27",value:50},{date:"2026-10-28",value:25}],campaigns:[],notes:["Review period"] });
  const text = pdf.toString("ascii");
  assert.ok(text.startsWith("%PDF-1.4"));
  assert.ok(text.includes("Executive overview"));
  assert.ok(text.includes("SIMULATED DATA - NOT ACTUAL AD PERFORMANCE"));
  assert.ok(text.includes("xref\n"));
  assert.ok(text.endsWith("%%EOF\n"));
});

test("metric time series preserve daily points and deterministic ordering", () => {
  const first = buildTimeSeries(facts,"spend"); const second = buildTimeSeries(facts,"spend");
  assert.deepEqual(first,second);
  assert.equal(first.series.length,2);
  assert.deepEqual(first.series.find((item)=>item.currency==="USD")?.points.map((point)=>point.date),["2026-10-27","2026-10-28"]);
});
