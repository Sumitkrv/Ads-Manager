import { Buffer } from "node:buffer";
import type { AnalyticsMetric } from "@ai-ads/shared";
import type { DemoFact, MetricTotals } from "./engine.js";

export type ExportCampaignRow = {
  id: string;
  updated: string;
  name: string;
  platform: string;
  objective: string;
  status: string;
  currency: string;
  spend: number | null;
  impressions: number | null;
  clicks: number | null;
  ctr: number | null;
  cpc: number | null;
  cpm: number | null;
  conversions: number | null;
  cpa: number | null;
  roas: number | null;
};

export function csvCell(value: unknown): string {
  let text = value === null || value === undefined ? "" : typeof value === "number" ? String(value) : String(value);
  // Formula-like text is made inert for spreadsheet applications. Numeric values remain numeric.
  if (typeof value !== "number" && /^\s*[=+@-]/.test(text)) text = `'${text}`;
  if (/[",\r\n]/.test(text)) text = `"${text.replaceAll('"', '""')}"`;
  return text;
}

export function createCsv(headers: string[], rows: unknown[][]): Buffer {
  const normalized = [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n") + "\r\n";
  return Buffer.from(`\uFEFF${normalized}`, "utf8");
}

export function dailyFactsCsv(facts: DemoFact[]): Buffer {
  return createCsv(
    ["Date (UTC)", "Campaign", "Platform", "Objective", "Industry", "Scenario", "Source", "Currency", "Spend", "Impressions", "Clicks", "CTR (%)", "CPC", "Conversions", "CPA", "Revenue", "ROAS"],
    facts.map((fact) => [
      fact.date, fact.campaignName, fact.platform, fact.objective, fact.industry, fact.scenario, "DEMO_SIMULATION", fact.currency,
      fact.spend, fact.impressions, fact.clicks, fact.impressions ? Number((fact.clicks / fact.impressions * 100).toFixed(4)) : "",
      fact.clicks ? Number((fact.spend / fact.clicks).toFixed(4)) : "", fact.conversions,
      fact.conversions ? Number((fact.spend / fact.conversions).toFixed(4)) : "", fact.revenue ?? "",
      fact.revenue !== null && fact.spend > 0 ? Number((fact.revenue / fact.spend).toFixed(4)) : "",
    ]),
  );
}

export function campaignRowsCsv(rows: ExportCampaignRow[]): Buffer {
  return createCsv(["Campaign", "Platform", "Objective", "Status", "Currency", "Simulated Spend", "Impressions", "Clicks", "CTR (%)", "CPC", "CPM", "Conversions", "CPA", "ROAS"], rows.map((row) => [
    row.name, row.platform, row.objective, row.status, row.currency, row.spend ?? "", row.impressions ?? "", row.clicks ?? "", row.ctr ?? "", row.cpc ?? "", row.cpm ?? "", row.conversions ?? "", row.cpa ?? "", row.roas ?? "",
  ]));
}

export type PdfReportInput = {
  title: string;
  workspaceName: string;
  from: string;
  to: string;
  metric: AnalyticsMetric;
  metrics: MetricTotals;
  trend: Array<{ date: string; value: number | null }>;
  campaigns: ExportCampaignRow[];
  notes?: string[];
  generatedAt?: string;
};

function pdfText(value: unknown, max = 150): string {
  return String(value ?? "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[—–]/g, "-").replace(/[‘’]/g, "'").replace(/[“”]/g, '"')
    .replace(/[^\x20-\x7e]/g, " ").replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)").slice(0, max);
}

function money(value: number | null, currency: string) { return value === null ? "N/A" : `${currency} ${value.toFixed(2)}`; }
function metricLines(metrics: MetricTotals) {
  const spend = metrics.spendByCurrency.length ? metrics.spendByCurrency.map((item) => `${item.currency} ${item.spend.toFixed(2)}`).join(" | ") : "N/A";
  const ratioLines = metrics.spendByCurrency.map((item) => `${item.currency}: CPC ${money(item.cpc,item.currency)}; CPM ${money(item.cpm,item.currency)}; CPA ${money(item.cpa,item.currency)}; ROAS ${item.roas === null ? "N/A" : `${item.roas.toFixed(2)}x`}`);
  return [
    `Simulated spend: ${spend}`,
    `Impressions: ${metrics.impressions.toLocaleString("en-US")}  Clicks: ${metrics.clicks.toLocaleString("en-US")}  CTR: ${metrics.ctr === null ? "N/A" : `${metrics.ctr.toFixed(2)}%`}`,
    `Conversions: ${metrics.conversions.toLocaleString("en-US")}  Conversion rate: ${metrics.conversionRate === null ? "N/A" : `${metrics.conversionRate.toFixed(2)}%`}`,
    ...ratioLines,
  ];
}

function chartCommands(points: PdfReportInput["trend"]): string[] {
  const x0 = 52; const y0 = 468; const width = 490; const height = 114;
  const commands = ["0.45 0.52 0.64 RG 0.5 w", `${x0} ${y0} m ${x0 + width} ${y0} l S`, `${x0} ${y0} m ${x0} ${y0 + height} l S`];
  for (let i = 1; i <= 3; i += 1) {
    const y = y0 + height * i / 4;
    commands.push("0.84 0.87 0.91 RG 0.35 w", `${x0} ${y.toFixed(2)} m ${x0 + width} ${y.toFixed(2)} l S`);
  }
  const valid = points.filter((point) => typeof point.value === "number" && Number.isFinite(point.value));
  if (valid.length > 1) {
    const max = Math.max(1, ...valid.map((point) => point.value ?? 0));
    commands.push("0.20 0.42 0.86 RG 2 w");
    valid.forEach((point, index) => {
      const x = x0 + width * index / (valid.length - 1);
      const y = y0 + height * (point.value ?? 0) / max;
      commands.push(`${x.toFixed(2)} ${y.toFixed(2)} ${index === 0 ? "m" : "l"}`);
    });
    commands.push("S");
  } else {
    commands.push("BT /F1 10 Tf 0.28 0.34 0.42 rg 52 515 Td (No time series points for this selection.) Tj ET");
  }
  const first = points[0]?.date ?? ""; const last = points.at(-1)?.date ?? "";
  commands.push("BT /F1 8 Tf 0.28 0.34 0.42 rg 52 452 Td (" + pdfText(first, 20) + ") Tj 410 0 Td (" + pdfText(last, 20) + ") Tj ET");
  return commands;
}

function buildPageContent(input: PdfReportInput, pageIndex: number, totalPages: number, campaignStart: number): string {
  const commands: string[] = ["q", "1 1 1 rg 0 0 612 792 re f", "0.06 0.09 0.16 rg", "BT /F2 10 Tf 48 754 Td (TANDEM ADS) Tj ET", "0.18 0.37 0.76 rg", "BT /F2 18 Tf 48 718 Td (" + pdfText(input.title, 70) + ") Tj ET", "0.28 0.34 0.42 rg", `BT /F1 10 Tf 48 696 Td (${pdfText(input.workspaceName, 100)}) Tj ET`, `BT /F1 9 Tf 48 680 Td (UTC period: ${pdfText(input.from, 12)} to ${pdfText(input.to, 12)}) Tj ET`, "0.55 0.21 0.12 rg", "BT /F2 10 Tf 48 657 Td (SIMULATED DATA - NOT ACTUAL AD PERFORMANCE) Tj ET"];
  if (pageIndex === 0) {
    commands.push("0.06 0.09 0.16 rg", "BT /F2 12 Tf 48 627 Td (Performance summary) Tj ET");
    metricLines(input.metrics).forEach((line, index) => commands.push(`BT /F1 9 Tf 48 ${609 - index * 14} Td (${pdfText(line, 120)}) Tj ET`));
    const chartTop = 492;
    commands.push("0.06 0.09 0.16 rg", `BT /F2 12 Tf 48 ${chartTop} Td (${pdfText(input.metric.replaceAll("_", " ").toUpperCase(), 50)} - stored daily simulation) Tj ET`);
    commands.push(...chartCommands(input.trend));
    commands.push("0.06 0.09 0.16 rg", "BT /F2 12 Tf 48 428 Td (Campaign detail) Tj ET");
    commands.push("0.30 0.36 0.46 rg", "BT /F2 7 Tf 48 411 Td (Campaign / platform / currency) Tj 285 0 Td (Spend) Tj 65 0 Td (Impr.) Tj 55 0 Td (Clicks) Tj ET");
    input.campaigns.slice(campaignStart, campaignStart + 15).forEach((campaign, index) => {
      const y = 394 - index * 16;
      const title = `${campaign.name} / ${campaign.platform} / ${campaign.currency}`;
      commands.push(`BT /F1 7 Tf 48 ${y} Td (${pdfText(title, 64)}) Tj 285 0 Td (${campaign.spend === null ? "N/A" : campaign.spend.toFixed(2)}) Tj 65 0 Td (${campaign.impressions === null ? "N/A" : campaign.impressions.toLocaleString("en-US")}) Tj 55 0 Td (${campaign.clicks === null ? "N/A" : campaign.clicks.toLocaleString("en-US")}) Tj ET`);
    });
    if (input.notes?.length) commands.push("BT /F1 8 Tf 48 132 Td (" + pdfText(`Notes: ${input.notes.join("; ")}`, 180) + ") Tj ET");
    commands.push("BT /F1 8 Tf 48 112 Td (Source: DEMO_SIMULATION. No live Google Ads or Meta data was queried.) Tj ET");
  } else {
    commands.push("0.06 0.09 0.16 rg", "BT /F2 12 Tf 48 627 Td (Campaign detail - continued) Tj ET", "0.30 0.36 0.46 rg", "BT /F2 7 Tf 48 605 Td (Campaign / platform / currency) Tj 285 0 Td (Spend) Tj 65 0 Td (Impr.) Tj 55 0 Td (Clicks) Tj ET");
    input.campaigns.slice(campaignStart, campaignStart + 38).forEach((campaign, index) => {
      const y = 588 - index * 14;
      const title = `${campaign.name} / ${campaign.platform} / ${campaign.currency}`;
      commands.push(`BT /F1 7 Tf 48 ${y} Td (${pdfText(title, 64)}) Tj 285 0 Td (${campaign.spend === null ? "N/A" : campaign.spend.toFixed(2)}) Tj 65 0 Td (${campaign.impressions === null ? "N/A" : campaign.impressions.toLocaleString("en-US")}) Tj 55 0 Td (${campaign.clicks === null ? "N/A" : campaign.clicks.toLocaleString("en-US")}) Tj ET`);
    });
    commands.push("BT /F1 8 Tf 48 90 Td (Metric ratios are recomputed from raw counts and grouped by currency.) Tj ET");
  }
  commands.push("0.28 0.34 0.42 rg", `BT /F1 8 Tf 500 35 Td (Page ${pageIndex + 1} / ${totalPages}) Tj ET`, "Q");
  return commands.join("\n");
}

function pdfObject(index: number, body: string) { return `${index} 0 obj\n${body}\nendobj\n`; }

export function createReportPdf(input: PdfReportInput): Buffer {
  const extraRows = Math.max(0, input.campaigns.length - 15);
  const pageCount = 1 + Math.ceil(extraRows / 38);
  const objects: string[] = [];
  objects[1] = pdfObject(1, "<< /Type /Catalog /Pages 2 0 R >>");
  const pageIds = Array.from({ length: pageCount }, (_, index) => 6 + index * 2);
  objects[2] = pdfObject(2, `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageCount} >>`);
  objects[3] = pdfObject(3, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
  objects[4] = pdfObject(4, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");
  let start = 0;
  for (let page = 0; page < pageCount; page += 1) {
    const contentId = 5 + page * 2; const pageId = contentId + 1;
    const content = buildPageContent(input, page, pageCount, start);
    start += page === 0 ? 15 : 38;
    const stream = Buffer.from(content, "ascii");
    objects[contentId] = pdfObject(contentId, `<< /Length ${stream.length} >>\nstream\n${stream.toString("ascii")}\nendstream`);
    objects[pageId] = pdfObject(pageId, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentId} 0 R >>`);
  }
  let body = "%PDF-1.4\n% Tandem Ads generated locally\n";
  const offsets = [0];
  for (let id = 1; id < objects.length; id += 1) {
    offsets[id] = Buffer.byteLength(body, "ascii");
    body += objects[id] ?? "";
  }
  const xref = Buffer.byteLength(body, "ascii");
  body += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let id = 1; id < objects.length; id += 1) body += `${String(offsets[id]).padStart(10, "0")} 00000 n \n`;
  body += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(body, "ascii");
}
