function safe(value, max = 100) {
    return String(value ?? "").normalize("NFKD").replace(/[^\x20-\x7E]/g, "?").replace(/[()\\]/g, "\\$&").slice(0, max);
}
export function createDemoInvoicePdf(input) {
    const amount = (minor) => {
        const n = Number(minor);
        return Number.isSafeInteger(n) ? `${safe(input.currency, 3)} ${(n / 100).toFixed(2)}` : "N/A";
    };
    const lines = [
        "DEMO DOCUMENT - NOT A TAX INVOICE",
        "NO PAYMENT WAS PROCESSED",
        "",
        `Workspace: ${safe(input.workspaceName)}`,
        `Document reference: DEMO-${safe(input.invoiceId, 36)}`,
        `Plan: ${safe(input.planName)} (${safe(input.interval, 16)})`,
        `Period: ${safe(input.periodStart, 24)} to ${safe(input.periodEnd, 24)}`,
        "",
        "Description                                      Amount",
        ...input.items.slice(0, 12).map((item) => `${safe(item.description, 45).padEnd(47)} ${amount(item.amount_minor)}`),
        "",
        `Subtotal: ${amount(input.subtotalMinor)}`,
        `Illustrative tax estimate: ${amount(input.taxMinor)}`,
        `Simulated total: ${amount(input.totalMinor)}`,
        "",
        "Billing simulation only. No money was charged or transferred.",
        "This document is not a tax invoice or proof of payment.",
    ];
    const commands = ["BT /F1 18 Tf 48 748 Td (TANDEM ADS) Tj ET", "0.08 0.12 0.2 rg"];
    lines.forEach((line, index) => {
        const fontSize = index < 2 ? 11 : 10;
        const y = 710 - index * 27;
        commands.push(`BT /F1 ${fontSize} Tf 48 ${y} Td (${safe(line, 120)}) Tj ET`);
    });
    const stream = commands.join("\n");
    const objects = [
        "<< /Type /Catalog /Pages 2 0 R >>",
        "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
        "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
        `<< /Length ${Buffer.byteLength(stream, "ascii")} >>\nstream\n${stream}\nendstream`,
    ];
    let document = "%PDF-1.4\n% Tandem Ads local billing simulation\n";
    const offsets = [0];
    objects.forEach((object, index) => {
        offsets.push(Buffer.byteLength(document, "ascii"));
        document += `${index + 1} 0 obj\n${object}\nendobj\n`;
    });
    const xref = Buffer.byteLength(document, "ascii");
    document += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
    offsets.slice(1).forEach((offset) => { document += `${String(offset).padStart(10, "0")} 00000 n \n`; });
    document += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
    return Buffer.from(document, "ascii");
}
