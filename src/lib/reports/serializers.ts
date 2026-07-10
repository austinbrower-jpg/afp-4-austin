import type { ReportDocument, ReportSessionLine, ReportSubtotal } from "./types";

export function formatMoney(value: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
}

export function formatMinutes(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return `${hours}h ${String(remainder).padStart(2, "0")}m`;
}

function md(value: string): string {
  return value.replace(/\|/g, "\\|").replace(/\s*\n+\s*/g, " ").trim();
}

function pushIdentity(lines: string[], report: ReportDocument) {
  const contractor = [report.contractor.name, report.contractor.businessName].filter(Boolean).join(" · ");
  if (contractor) lines.push(`**From:** ${md(contractor)}  `);
  lines.push(`**Client:** ${md(report.client.name)}  `);
  if (report.client.billingContact) lines.push(`**Billing contact:** ${md(report.client.billingContact)}  `);
  if (report.client.billingEmail) lines.push(`**Billing email:** ${md(report.client.billingEmail)}  `);
  lines.push(`**Reporting period:** ${report.invoice.periodStart} to ${report.invoice.periodEnd}  `);
  if (report.type !== "work-log-report") {
    lines.push(`**Invoice number:** ${md(report.invoice.number || "Not provided")}  `);
    lines.push(`**Invoice date:** ${report.invoice.invoiceDate || "Not provided"}  `);
    lines.push(`**Due date:** ${report.invoice.dueDate || "Not provided"}  `);
    lines.push(`**Payment terms:** ${md(report.invoice.paymentTerms || "Not provided")}  `);
  }
  lines.push("");
}

function pushTotalsTable(lines: string[], heading: string, rows: ReportSubtotal[]) {
  lines.push(`## ${heading}`, "");
  if (rows.length === 0) {
    lines.push("_No included time._", "");
    return;
  }
  lines.push("| Group | Time | Amount |", "| --- | ---: | ---: |");
  for (const row of rows) {
    lines.push(`| ${md(row.label)} | ${formatMinutes(row.exactMinutes)} | ${formatMoney(row.amount)} |`);
  }
  lines.push("");
}

function pushSessions(lines: string[], sessions: ReportSessionLine[]) {
  lines.push("## Billable Sessions", "");
  if (sessions.length === 0) {
    lines.push("_No approved billable sessions._", "");
    return;
  }
  lines.push(
    "| Date | Time | Duration | Project | Description | Rate | Amount |",
    "| --- | --- | ---: | --- | --- | ---: | ---: |",
  );
  for (const line of sessions.filter((session) => session.billable)) {
    lines.push(
      `| ${line.date} | ${line.startTime}–${line.endTime} | ${formatMinutes(line.exactMinutes)} | ${md(line.projectName)} | ${md(line.description)} | ${formatMoney(line.hourlyRate)}/hr | ${formatMoney(line.amount)} |`,
    );
  }
  lines.push("");
}

function pushInvoice(lines: string[], report: ReportDocument) {
  lines.push("## Summary", "", report.summary, "");
  if (report.type === "detailed-invoice") {
    pushSessions(lines, report.sessions);
    pushTotalsTable(lines, "Daily Subtotals", report.dailyTotals.filter((row) => row.amount > 0));
  }
  pushTotalsTable(lines, "Project Totals", report.projectTotals.filter((row) => row.amount > 0));
  const rates = report.totals.hourlyRates.map((rate) => `${formatMoney(rate)}/hr`).join(", ") || "—";
  lines.push(
    "## Amount Due",
    "",
    `**Total billable time:** ${formatMinutes(report.totals.billableMinutes)}  `,
    `**Hourly rate${report.totals.hourlyRates.length === 1 ? "" : "s"}:** ${rates}  `,
    `**Amount due:** ${formatMoney(report.totals.amountDue)}`,
    "",
  );
  if (report.invoice.notes) lines.push("## Notes", "", report.invoice.notes, "");
}

function pushBulletSection(lines: string[], title: string, items: string[]) {
  if (items.length === 0) return;
  lines.push(`### ${title}`, "");
  for (const item of items) lines.push(`- ${item}`);
  lines.push("");
}

function pushWorkLog(lines: string[], report: ReportDocument) {
  lines.push("## Executive Summary", "", report.summary, "", "## Daily Work Breakdown", "");
  const dates = [...new Set(report.workItems.map((item) => item.date))].sort();
  if (dates.length === 0) lines.push("_No approved client-visible work entries._", "");
  for (const date of dates) {
    lines.push(`### ${date}`, "");
    for (const item of report.workItems.filter((candidate) => candidate.date === date)) {
      lines.push(`#### ${md(item.title)}`, "", `**Project:** ${md(item.projectName)}  `, item.description, "");
      pushBulletSection(lines, "Deliverables completed", item.deliverables);
      pushBulletSection(lines, "Testing and verification", item.testingPerformed);
      pushBulletSection(lines, "Blockers", item.blockers);
      pushBulletSection(lines, "Follow-up items", item.followUpItems);
      pushBulletSection(lines, "Evidence", item.evidenceLinks);
      lines.push(`**Related time:** ${formatMinutes(item.relatedHoursMinutes)}`, "");
    }
  }
  if (report.knowledgeItems.length > 0) {
    lines.push("## Related Knowledge", "");
    for (const item of report.knowledgeItems) {
      lines.push(`### ${md(item.title)}`, "", `**Project:** ${md(item.projectName)}  `, item.summary, "");
      if (item.sourcePage) lines.push(`[Source page](${item.sourcePage})`, "");
    }
  }
  pushTotalsTable(lines, "Hours by Day", report.dailyTotals);
  pushTotalsTable(lines, "Hours by Project", report.projectTotals);
  lines.push(
    "## Time Summary",
    "",
    `**Billable:** ${formatMinutes(report.totals.billableMinutes)}  `,
    `**Non-billable:** ${formatMinutes(report.totals.nonBillableMinutes)}  `,
    `**Total:** ${formatMinutes(report.totals.billableMinutes + report.totals.nonBillableMinutes)}`,
    "",
  );
}

export function serializeReportMarkdown(report: ReportDocument): string {
  const lines = [`# ${report.title}`, ""];
  pushIdentity(lines, report);
  if (report.type === "work-log-report") pushWorkLog(lines, report);
  else pushInvoice(lines, report);
  return lines.join("\n").trimEnd() + "\n";
}

/**
 * Audit snapshot is deterministic. Excluded-record titles are a builder-only
 * diagnostic and are redacted from the downloadable client snapshot because
 * those records did not pass the client-visible privacy gate.
 */
export function serializeReportJson(report: ReportDocument): string {
  const snapshot = {
    ...report,
    excludedRecords: report.excludedRecords.map(({ id, kind, reason }) => ({ id, kind, reason })),
  };
  return JSON.stringify(snapshot, null, 2) + "\n";
}

function html(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function subtotalRows(rows: ReportSubtotal[]): string {
  return rows.map((row) => `<tr><td>${html(row.label)}</td><td>${formatMinutes(row.exactMinutes)}</td><td>${formatMoney(row.amount)}</td></tr>`).join("");
}

function reportBodyHtml(report: ReportDocument): string {
  const identity = `<section class="meta"><div><span>From</span>${html([report.contractor.name, report.contractor.businessName].filter(Boolean).join(" · "))}</div><div><span>Client</span>${html(report.client.name)}</div><div><span>Period</span>${report.invoice.periodStart} to ${report.invoice.periodEnd}</div>${report.type === "work-log-report" ? "" : `<div><span>Invoice</span>${html(report.invoice.number || "Not provided")}</div><div><span>Invoice date</span>${report.invoice.invoiceDate}</div><div><span>Due date</span>${report.invoice.dueDate || "Not provided"}</div><div><span>Terms</span>${html(report.invoice.paymentTerms || "Not provided")}</div>`}</section>`;
  if (report.type !== "work-log-report") {
    const sessionTable = report.type === "detailed-invoice" ? `<section><h2>Billable sessions</h2><table><thead><tr><th>Date / time</th><th>Project &amp; description</th><th>Duration</th><th>Amount</th></tr></thead><tbody>${report.sessions.filter((session) => session.billable).map((session) => `<tr><td>${session.date}<br><small>${session.startTime}–${session.endTime}</small></td><td><strong>${html(session.projectName)}</strong><br>${html(session.description)}</td><td>${formatMinutes(session.exactMinutes)}</td><td>${formatMoney(session.amount)}</td></tr>`).join("")}</tbody></table></section>` : "";
    const dailyTable = report.type === "detailed-invoice" ? `<section><h2>Daily subtotals</h2><table><thead><tr><th>Date</th><th>Time</th><th>Amount</th></tr></thead><tbody>${subtotalRows(report.dailyTotals.filter((row) => row.amount > 0))}</tbody></table></section>` : "";
    return `${identity}<section><h2>Summary</h2><p>${html(report.summary)}</p></section>${sessionTable}${dailyTable}<section><h2>Project totals</h2><table><thead><tr><th>Project</th><th>Time</th><th>Amount</th></tr></thead><tbody>${subtotalRows(report.projectTotals.filter((row) => row.amount > 0))}</tbody></table></section><section class="total"><span>Amount due</span><strong>${formatMoney(report.totals.amountDue)}</strong><small>${formatMinutes(report.totals.billableMinutes)} billable</small></section>${report.invoice.notes ? `<section><h2>Notes</h2><p>${html(report.invoice.notes)}</p></section>` : ""}`;
  }
  const work = report.workItems.map((item) => `<article><div class="eyebrow">${item.date} · ${html(item.projectName)}</div><h3>${html(item.title)}</h3><p>${html(item.description)}</p>${item.deliverables.length ? `<h4>Deliverables completed</h4><ul>${item.deliverables.map((entry) => `<li>${html(entry)}</li>`).join("")}</ul>` : ""}${item.testingPerformed.length ? `<h4>Testing and verification</h4><ul>${item.testingPerformed.map((entry) => `<li>${html(entry)}</li>`).join("")}</ul>` : ""}${item.blockers.length ? `<h4>Blockers</h4><ul>${item.blockers.map((entry) => `<li>${html(entry)}</li>`).join("")}</ul>` : ""}${item.followUpItems.length ? `<h4>Follow-up items</h4><ul>${item.followUpItems.map((entry) => `<li>${html(entry)}</li>`).join("")}</ul>` : ""}${item.evidenceLinks.length ? `<h4>Evidence</h4><ul>${item.evidenceLinks.map((entry) => `<li>${html(entry)}</li>`).join("")}</ul>` : ""}<small>${formatMinutes(item.relatedHoursMinutes)} related time</small></article>`).join("");
  const knowledge = report.knowledgeItems.length ? `<section><h2>Related knowledge</h2>${report.knowledgeItems.map((item) => `<article><h3>${html(item.title)}</h3><p>${html(item.summary)}</p>${item.sourcePage ? `<small>${html(item.sourcePage)}</small>` : ""}</article>`).join("")}</section>` : "";
  return `${identity}<section><h2>Executive summary</h2><p>${html(report.summary)}</p></section><section><h2>Daily work breakdown</h2>${work || "<p>No approved client-visible work entries.</p>"}</section>${knowledge}<section><h2>Hours by day</h2><table><thead><tr><th>Date</th><th>Time</th><th>Billable value</th></tr></thead><tbody>${subtotalRows(report.dailyTotals)}</tbody></table></section><section><h2>Hours by project</h2><table><thead><tr><th>Project</th><th>Time</th><th>Billable value</th></tr></thead><tbody>${subtotalRows(report.projectTotals)}</tbody></table></section><section class="total"><span>Total time</span><strong>${formatMinutes(report.totals.billableMinutes + report.totals.nonBillableMinutes)}</strong><small>${formatMinutes(report.totals.billableMinutes)} billable · ${formatMinutes(report.totals.nonBillableMinutes)} non-billable</small></section>`;
}

export function serializeReportHtml(report: ReportDocument): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${html(report.title)}</title><style>@page{size:letter;margin:.65in .65in .7in}@media print{.no-print{display:none}thead{display:table-header-group}tr,article{break-inside:avoid}body{print-color-adjust:exact;-webkit-print-color-adjust:exact}}*{box-sizing:border-box}body{margin:0;color:#172033;background:#f3f5f7;font:14px/1.5 Arial,sans-serif}.page{width:8.5in;min-height:11in;margin:24px auto;padding:.65in;background:white;box-shadow:0 8px 32px #18233a20}header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #173d5e;padding-bottom:20px;margin-bottom:24px}h1{font:700 28px/1.1 Georgia,serif;margin:0;color:#173d5e}header p{margin:6px 0 0;color:#667085}.source{font-size:11px;color:#667085}.meta{display:grid;grid-template-columns:repeat(2,1fr);gap:10px 28px;padding:16px;background:#f7f9fb;border:1px solid #dfe5eb;border-radius:8px}.meta div{font-weight:600}.meta span{display:block;text-transform:uppercase;letter-spacing:.08em;font-size:9px;color:#667085}section{margin:24px 0}h2{font:700 18px Georgia,serif;color:#173d5e;border-bottom:1px solid #dfe5eb;padding-bottom:6px}h3{margin:4px 0 6px;color:#173d5e}h4{margin:12px 0 3px;font-size:12px;text-transform:uppercase;letter-spacing:.05em;color:#52606d}p{white-space:pre-wrap}table{width:100%;border-collapse:collapse;font-size:12px}th{text-align:left;background:#eef3f7;color:#344054}th,td{padding:9px 8px;border-bottom:1px solid #dfe5eb;vertical-align:top}th:nth-last-child(-n+2),td:nth-last-child(-n+2){text-align:right}.total{margin-left:auto;width:50%;padding:18px;background:#173d5e;color:white;border-radius:8px}.total span,.total small{display:block}.total strong{display:block;font:700 28px Georgia,serif;margin:3px 0}.eyebrow{font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:#667085}article{border-left:3px solid #8ca8bf;padding:2px 0 2px 16px;margin:18px 0}ul{margin:4px 0 10px;padding-left:20px}footer{position:fixed;bottom:.2in;left:.65in;right:.65in;font-size:9px;color:#87909b;border-top:1px solid #dfe5eb;padding-top:5px}.print-button{position:fixed;top:18px;right:18px;border:0;border-radius:6px;background:#173d5e;color:white;padding:10px 14px;cursor:pointer}@media(max-width:900px){.page{width:100%;margin:0;padding:24px;box-shadow:none}.meta{grid-template-columns:1fr}.total{width:100%}}</style></head><body><button class="print-button no-print" onclick="window.print()">Print / save PDF</button><main class="page"><header><div><h1>${html(report.title)}</h1><p>${html(report.client.name)}</p></div><div class="source">Source: ${html(report.source.label)}</div></header>${reportBodyHtml(report)}<footer>${html(report.title)} · ${html(report.client.name)}</footer></main></body></html>`;
}
