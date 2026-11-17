import { generateCsv, downloadCsv } from "@/lib/csv";
import { EmailTemplate, Invoice, SmtpConfig, TenantOrganization } from "../_types";

export const simulateApiDelay = (ms: number = 220): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

export async function withSimulatedRequest<T>(
  action: () => T,
  options: { delayMs?: number; shouldFail?: boolean; errorMessage?: string } = {}
): Promise<T> {
  const { delayMs = 200, shouldFail = false, errorMessage = "Service temporarily unreachable. Please try again." } = options;
  await simulateApiDelay(delayMs);
  if (shouldFail) {
    throw new Error(errorMessage);
  }
  return action();
}

export function formatCurrency(amount: number, currency: string = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatCurrencyExact(amount: number, currency: string = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatShortDate(isoOrDate: string): string {
  if (!isoOrDate) return "—";
  const d = new Date(isoOrDate);
  if (Number.isNaN(d.getTime())) return isoOrDate;
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatDateTime(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export function isValidSlug(slug: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug.trim());
}

export const TEMPLATE_PLACEHOLDER_MAP: Record<string, string> = {
  user_name: "Recipient Name",
  organization_name: "Company Name",
  inviter_name: "Sender Name",
  plan_name: "Plan Name",
  invoice_number: "Invoice #",
  amount: "Amount",
  due_date: "Due Date",
  expiry_date: "Expiry Date",
  project_name: "Project Name",
  maintenance_window: "Maintenance Window",
  action_url: "Action Link",
};

const REVERSE_PLACEHOLDER_MAP: Record<string, string> = Object.entries(
  TEMPLATE_PLACEHOLDER_MAP
).reduce<Record<string, string>>((acc, [key, label]) => {
  acc[label.toLowerCase()] = key;
  return acc;
}, {});

/** Converts technical `{{key}}` tokens into plain-language `[Friendly Name]` placeholders. */
export function toFriendlyPlaceholders(text: string): string {
  return text.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key: string) => {
    const label = TEMPLATE_PLACEHOLDER_MAP[key];
    return label ? `[${label}]` : `[${key.replace(/_/g, " ")}]`;
  });
}

export function extractTemplateVariables(text: string): string[] {
  const unique = new Set<string>();
  const curlyMatches = text.match(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g) || [];
  curlyMatches.forEach((m) => {
    const key = m.replace(/\{\{|\}\}/g, "").trim();
    if (key) unique.add(key);
  });
  const bracketMatches = text.match(/\[([a-zA-Z0-9 #_]+)\]/g) || [];
  bracketMatches.forEach((m) => {
    const label = m.slice(1, -1).trim();
    const mapped = REVERSE_PLACEHOLDER_MAP[label.toLowerCase()];
    if (mapped) unique.add(mapped);
  });
  return Array.from(unique);
}

export function interpolateTemplate(
  template: string,
  values: Record<string, string>
): string {
  const afterCurly = template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key: string) => {
    const friendly = TEMPLATE_PLACEHOLDER_MAP[key] || key;
    return values[key] !== undefined && values[key] !== "" ? values[key] : `[${friendly}]`;
  });

  return afterCurly.replace(/\[([a-zA-Z0-9 #_]+)\]/g, (full, label: string) => {
    const key = REVERSE_PLACEHOLDER_MAP[label.trim().toLowerCase()];
    if (!key) return full;
    return values[key] !== undefined && values[key] !== "" ? values[key] : full;
  });
}

export function renderTemplateSummaryText(tpl: EmailTemplate, values: Record<string, string>): string {
  const headline = interpolateTemplate(tpl.headline, values);
  const body = interpolateTemplate(tpl.bodyParagraphs, values);
  const cta = interpolateTemplate(tpl.ctaLabel, values);
  return `${headline}\n\n${body}\n\n[${cta}]`;
}

export function exportRowsToCsv(
  filename: string,
  headers: string[],
  rows: (string | number | boolean | null | undefined)[][]
): void {
  const csv = generateCsv(headers, rows);
  downloadCsv(filename, csv);
}

export interface SmtpCheckStep {
  label: string;
  passed: boolean;
  detail: string;
}

export async function simulateSmtpHandshake(
  config: SmtpConfig,
  pendingNewSecret?: string
): Promise<{
  ok: boolean;
  checks: SmtpCheckStep[];
  message: string;
}> {
  await simulateApiDelay(400);

  const hasHost = Boolean(config.host.trim());
  const validPort = config.port >= 1 && config.port <= 65535;
  const validSender = isValidEmail(config.fromEmail);
  const hasCreds = Boolean(config.username.trim()) && (config.hasPasswordConfigured || Boolean(pendingNewSecret?.trim()));

  const checks: SmtpCheckStep[] = [
    {
      label: "Mail Server Reachability",
      passed: hasHost && validPort,
      detail: hasHost && validPort
        ? `Connected to ${config.host} on port ${config.port} (simulated).`
        : "Please enter a valid server host and port (1–65535).",
    },
    {
      label: "Transport Security",
      passed: config.encryption !== "NONE",
      detail:
        config.encryption === "NONE"
          ? "Unencrypted connection selected. TLS or SSL is recommended."
          : `${config.encryption} encryption handshake verified (simulated).`,
    },
    {
      label: "Account Authentication",
      passed: hasCreds,
      detail: hasCreds
        ? `Authenticated account "${config.username}" without exposing stored credentials.`
        : "Account username and API key/password are required.",
    },
    {
      label: "Sender Identity Readiness",
      passed: validSender,
      detail: validSender
        ? `Ready to deliver as ${config.fromName} <${config.fromEmail}>.`
        : "Enter a valid sender email address.",
    },
  ];

  const ok = hasHost && validPort && hasCreds && validSender;
  return {
    ok,
    checks,
    message: ok
      ? `Mail relay reachable, ${config.encryption} verified, and sender authenticated (simulated).`
      : "Connection verification failed. Review the highlighted checks below.",
  };
}

function escapePdfText(input: string): string {
  return input
    .replace(/[^\x20-\x7E]/g, " ")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

export function generateInvoicePdfBlob(
  invoice: Invoice,
  org?: TenantOrganization,
  planName?: string
): Blob {
  const lines: { text: string; size: number; y: number; bold?: boolean }[] = [];
  let y = 755;

  const pushLine = (text: string, size = 10, gap = 16, bold = false) => {
    lines.push({ text, size, y, bold });
    y -= gap;
  };

  pushLine("PROWISE SAAS PLATFORM — COMMERCIAL INVOICE", 15, 22, true);
  pushLine(`Invoice Number: ${invoice.invoiceNumber}    |    Status: ${invoice.status}`, 10, 16, true);
  pushLine(`Issue Date: ${invoice.issueDate}    |    Due Date: ${invoice.dueDate}`, 10, 22);

  pushLine("--------------------------------------------------------------------------", 10, 16);
  pushLine(`Billed To: ${org ? org.name : invoice.orgId}`, 11, 16, true);
  if (org) {
    pushLine(`Owner: ${org.ownerName} <${org.ownerEmail}>`, 10, 14);
    pushLine(`Domain: ${org.domain}   |   Country: ${org.country}`, 10, 14);
  }
  if (planName) {
    pushLine(`Subscription Plan: ${planName}`, 10, 18);
  }
  pushLine("--------------------------------------------------------------------------", 10, 18);

  pushLine("LINE ITEMS", 11, 16, true);
  invoice.lineItems.forEach((item, idx) => {
    const desc = item.description.slice(0, 52);
    pushLine(
      `${idx + 1}. ${desc} (x${item.quantity} @ ${formatCurrencyExact(item.unitPrice)}) = ${formatCurrencyExact(item.total)}`,
      9.5,
      15
    );
  });

  y -= 8;
  pushLine("--------------------------------------------------------------------------", 10, 18);
  pushLine(`Subtotal: ${formatCurrencyExact(invoice.subtotal)}`, 10, 15);
  pushLine(`Tax (${invoice.taxRate}%): ${formatCurrencyExact(invoice.taxAmount)}`, 10, 15);
  pushLine(`Total Due: ${formatCurrencyExact(invoice.total)} USD`, 12, 22, true);

  if (invoice.paidAt) {
    pushLine(`Settled At: ${formatDateTime(invoice.paidAt)}`, 9.5, 16);
  }
  if (invoice.notes) {
    pushLine(`Notes: ${invoice.notes.slice(0, 80)}`, 9.5, 18);
  }

  y -= 10;
  pushLine("[SIMULATED CLIENT-SIDE PDF] Generated by ProWise Super Admin Panel.", 8.5, 14);
  pushLine("Connect backend billing service for live server-issued archival PDFs.", 8.5, 14);

  const streamOps = lines
    .map((l) => {
      const font = l.bold ? "/F2" : "/F1";
      return `BT ${font} ${l.size} Tf 48 ${l.y} Td (${escapePdfText(l.text)}) Tj ET`;
    })
    .join("\n");

  const objects: string[] = [
    "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n",
    "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n",
    "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> >>\nendobj\n",
    `4 0 obj\n<< /Length ${streamOps.length} >>\nstream\n${streamOps}\nendstream\nendobj\n`,
    "5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n",
    "6 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj\n",
  ];

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [0];
  for (const obj of objects) {
    offsets.push(pdf.length);
    pdf += obj;
  }

  const xrefStart = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (let i = 1; i <= objects.length; i++) {
    pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;

  return new Blob([pdf], { type: "application/pdf" });
}

export function downloadInvoicePdf(
  invoice: Invoice,
  org?: TenantOrganization,
  planName?: string
): void {
  const blob = generateInvoicePdfBlob(invoice, org, planName);
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${invoice.invoiceNumber}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Opens the browser Print / Save-as-PDF dialog for a formatted commercial invoice. */
export function printInvoicePdf(
  invoice: Invoice,
  org?: TenantOrganization,
  planName?: string
): void {
  if (typeof document === "undefined") return;

  const itemRows = invoice.lineItems
    .map(
      (item, idx) => `
      <tr>
        <td>${idx + 1}</td>
        <td>${escapeHtml(item.description)}</td>
        <td style="text-align:right">${item.quantity}</td>
        <td style="text-align:right">${escapeHtml(formatCurrencyExact(item.unitPrice))}</td>
        <td style="text-align:right;font-weight:600">${escapeHtml(formatCurrencyExact(item.total))}</td>
      </tr>`
    )
    .join("");

  const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(invoice.invoiceNumber)} — ProWise Invoice</title>
  <style>
    @page { size: letter; margin: 16mm; }
    * { box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
    body { margin: 0; color: #0f172a; font-size: 12px; line-height: 1.5; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #2563eb; padding-bottom: 14px; margin-bottom: 18px; }
    .brand { font-size: 18px; font-weight: 800; letter-spacing: -0.02em; color: #1e293b; }
    .sub { font-size: 11px; color: #64748b; }
    .badge { display: inline-block; padding: 3px 10px; border-radius: 999px; font-size: 10px; font-weight: 700; border: 1px solid #cbd5e1; background: #f8fafc; color: #0f172a; }
    .grid { display: flex; gap: 20px; margin-bottom: 18px; }
    .card { flex: 1; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; background: #f8fafc; }
    .card h4 { margin: 0 0 6px; font-size: 10px; text-transform: uppercase; letter-spacing: 0.06em; color: #64748b; }
    .card p { margin: 2px 0; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
    th { text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em; color: #475569; background: #f1f5f9; border-bottom: 1px solid #cbd5e1; padding: 8px; }
    td { padding: 8px; border-bottom: 1px solid #e2e8f0; }
    .totals { margin-left: auto; width: 240px; }
    .totals-row { display: flex; justify-content: space-between; padding: 4px 0; color: #475569; }
    .totals-final { display: flex; justify-content: space-between; padding: 8px 0 0; margin-top: 6px; border-top: 2px solid #0f172a; font-size: 14px; font-weight: 800; color: #0f172a; }
    .notes { margin-top: 16px; padding: 10px 12px; border: 1px solid #e2e8f0; border-radius: 8px; background: #f8fafc; font-size: 11px; color: #475569; }
    .footer { margin-top: 28px; padding-top: 10px; border-top: 1px solid #e2e8f0; font-size: 10px; color: #64748b; text-align: center; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="brand">ProWise SaaS Platform</div>
      <div class="sub">Commercial Billing &amp; Governance Ledger</div>
    </div>
    <div style="text-align:right">
      <div style="font-size:16px;font-weight:700;font-family:monospace">${escapeHtml(invoice.invoiceNumber)}</div>
      <div class="sub">Issued ${escapeHtml(formatShortDate(invoice.issueDate))} • Due ${escapeHtml(formatShortDate(invoice.dueDate))}</div>
      <div style="margin-top:6px"><span class="badge">${escapeHtml(invoice.status)}</span></div>
    </div>
  </div>
  <div class="grid">
    <div class="card">
      <h4>Billed Organization</h4>
      <p><strong>${escapeHtml(org?.name || invoice.orgId)}</strong></p>
      ${org ? `<p>${escapeHtml(org.ownerName)} &lt;${escapeHtml(org.ownerEmail)}&gt;</p><p>${escapeHtml(org.domain)} (${escapeHtml(org.country)})</p>` : ""}
    </div>
    <div class="card">
      <h4>Billing Summary</h4>
      <p><strong>Plan:</strong> ${escapeHtml(planName || "Custom")}</p>
      <p><strong>Currency:</strong> USD</p>
      ${invoice.paidAt ? `<p><strong>Settled:</strong> ${escapeHtml(formatDateTime(invoice.paidAt))}</p>` : ""}
    </div>
  </div>
  <table>
    <thead>
      <tr>
        <th style="width:40px">#</th>
        <th>Description</th>
        <th style="text-align:right">Qty</th>
        <th style="text-align:right">Unit Price</th>
        <th style="text-align:right">Line Total</th>
      </tr>
    </thead>
    <tbody>${itemRows}</tbody>
  </table>
  <div class="totals">
    <div class="totals-row"><span>Subtotal</span><span>${escapeHtml(formatCurrencyExact(invoice.subtotal))}</span></div>
    <div class="totals-row"><span>Tax (${invoice.taxRate}%)</span><span>${escapeHtml(formatCurrencyExact(invoice.taxAmount))}</span></div>
    <div class="totals-final"><span>Total</span><span>${escapeHtml(formatCurrencyExact(invoice.total))} USD</span></div>
  </div>
  ${invoice.notes ? `<div class="notes"><strong>Notes:</strong> ${escapeHtml(invoice.notes)}</div>` : ""}
  <div class="footer">ProWise Super Admin Panel • Simulated Client-Side Commercial Invoice Receipt</div>
</body>
</html>`;

  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  iframe.style.opacity = "0";
  iframe.style.pointerEvents = "none";
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (doc) {
    doc.open();
    doc.write(html);
    doc.close();
    setTimeout(() => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } finally {
        setTimeout(() => {
          iframe.remove();
        }, 1000);
      }
    }, 150);
  } else {
    iframe.remove();
  }
}
