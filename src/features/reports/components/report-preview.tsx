import type { ReportDocument } from "@/lib/reports/types";
import { formatMinutes, formatMoney } from "@/lib/reports/serializers";
import { Badge } from "@/components/ui/badge";

function Identity({ report }: { report: ReportDocument }) {
  return (
    <>
      <header className="flex flex-col justify-between gap-5 border-b-2 border-slate-700 pb-6 sm:flex-row">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{report.type === "work-log-report" ? "Client report" : "Invoice"}</div>
          <h2 className="mt-1 font-serif text-3xl font-semibold text-slate-900">{report.title}</h2>
          <p className="mt-1 text-sm text-slate-500">{report.invoice.periodStart} to {report.invoice.periodEnd}</p>
        </div>
        <div className="text-left text-sm sm:text-right">
          <strong className="block text-slate-900">{report.contractor.businessName || report.contractor.name}</strong>
          {report.contractor.businessName && <span className="block">{report.contractor.name}</span>}
          {report.contractor.email && <span className="block">{report.contractor.email}</span>}
          {report.contractor.phone && <span className="block">{report.contractor.phone}</span>}
        </div>
      </header>
      <div className="mt-6 grid gap-4 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm sm:grid-cols-2">
        <div><span className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500">Client</span><strong>{report.client.name}</strong>{report.client.billingContact && <span className="block">Attn: {report.client.billingContact}</span>}{report.client.billingEmail && <span className="block">{report.client.billingEmail}</span>}</div>
        {report.type !== "work-log-report" && <div className="grid grid-cols-2 gap-3">
          <div><span className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500">Invoice no.</span>{report.invoice.number || "Not provided"}</div>
          <div><span className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500">Invoice date</span>{report.invoice.invoiceDate || "Not provided"}</div>
          <div><span className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500">Due date</span>{report.invoice.dueDate || "Not provided"}</div>
          <div><span className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500">Terms</span>{report.invoice.paymentTerms || "Not provided"}</div>
        </div>}
      </div>
    </>
  );
}

function ProjectTotals({ report }: { report: ReportDocument }) {
  return (
    <section className="mt-8">
      <h3 className="border-b border-slate-200 pb-2 font-serif text-lg font-semibold text-slate-800">{report.type === "work-log-report" ? "Hours by project" : "Project totals"}</h3>
      <table className="mt-2 w-full text-sm">
        <thead><tr className="text-left text-[10px] uppercase tracking-wider text-slate-500"><th className="py-2">Project</th><th className="py-2 text-right">Time</th><th className="py-2 text-right">Billable value</th></tr></thead>
        <tbody>{report.projectTotals.map((row) => <tr className="border-t border-slate-100" key={row.key}><td className="py-2.5">{row.label}</td><td className="py-2.5 text-right tabular-nums">{formatMinutes(row.exactMinutes)}</td><td className="py-2.5 text-right tabular-nums">{formatMoney(row.amount)}</td></tr>)}</tbody>
      </table>
    </section>
  );
}

function DailyTotals({ report }: { report: ReportDocument }) {
  return (
    <section className="mt-8">
      <h3 className="border-b border-slate-200 pb-2 font-serif text-lg font-semibold text-slate-800">{report.type === "work-log-report" ? "Hours by day" : "Daily subtotals"}</h3>
      <table className="mt-2 w-full text-sm">
        <thead><tr className="text-left text-[10px] uppercase tracking-wider text-slate-500"><th className="py-2">Date</th><th className="py-2 text-right">Time</th><th className="py-2 text-right">Billable value</th></tr></thead>
        <tbody>{report.dailyTotals.map((row) => <tr className="border-t border-slate-100" key={row.key}><td className="py-2.5">{row.label}</td><td className="py-2.5 text-right tabular-nums">{formatMinutes(row.exactMinutes)}</td><td className="py-2.5 text-right tabular-nums">{formatMoney(row.amount)}</td></tr>)}</tbody>
      </table>
    </section>
  );
}

function InvoicePreview({ report }: { report: ReportDocument }) {
  return (
    <>
      <section className="mt-8"><h3 className="font-serif text-lg font-semibold text-slate-800">Summary</h3><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{report.summary}</p></section>
      {report.type === "detailed-invoice" && <section className="mt-8 overflow-x-auto"><h3 className="border-b border-slate-200 pb-2 font-serif text-lg font-semibold text-slate-800">Billable sessions</h3><table className="mt-2 min-w-[700px] w-full text-xs"><thead><tr className="text-left text-[10px] uppercase tracking-wider text-slate-500"><th className="py-2">Date / time</th><th className="py-2">Project & description</th><th className="py-2 text-right">Duration</th><th className="py-2 text-right">Amount</th></tr></thead><tbody>{report.sessions.filter((session) => session.billable).map((line) => <tr className="border-t border-slate-100 align-top" key={line.id}><td className="w-32 py-3">{line.date}<span className="block text-slate-500">{line.startTime}–{line.endTime}</span></td><td className="py-3 pr-4"><strong className="block">{line.projectName}</strong><span className="leading-5 text-slate-600">{line.description}</span></td><td className="py-3 text-right tabular-nums">{formatMinutes(line.exactMinutes)}</td><td className="py-3 text-right tabular-nums">{formatMoney(line.amount)}</td></tr>)}</tbody></table></section>}
      {report.type === "detailed-invoice" && <DailyTotals report={report} />}
      <ProjectTotals report={report} />
      <section className="mt-8 ml-auto w-full rounded-lg bg-slate-800 p-5 text-white sm:w-80"><span className="block text-xs uppercase tracking-wider text-slate-300">Amount due</span><strong className="mt-1 block font-serif text-3xl">{formatMoney(report.totals.amountDue)}</strong><span className="mt-1 block text-xs text-slate-300">{formatMinutes(report.totals.billableMinutes)} billable · {report.totals.hourlyRates.map((rate) => `${formatMoney(rate)}/hr`).join(", ") || "No rate"}</span></section>
      {report.invoice.notes && <section className="mt-8"><h3 className="font-serif text-lg font-semibold text-slate-800">Notes</h3><p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{report.invoice.notes}</p></section>}
    </>
  );
}

function WorkLogPreview({ report }: { report: ReportDocument }) {
  return (
    <>
      <section className="mt-8"><h3 className="font-serif text-lg font-semibold text-slate-800">Executive summary</h3><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{report.summary}</p></section>
      <section className="mt-8"><h3 className="border-b border-slate-200 pb-2 font-serif text-lg font-semibold text-slate-800">Daily work breakdown</h3>{report.workItems.length === 0 ? <p className="mt-4 text-sm text-slate-500">No approved client-visible work entries.</p> : report.workItems.map((item) => <article className="mt-5 border-l-2 border-slate-300 pl-4" key={item.id}><div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{item.date} · {item.projectName}</div><h4 className="mt-1 font-semibold text-slate-900">{item.title}</h4><p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-700">{item.description}</p>{([['Deliverables completed', item.deliverables], ['Testing and verification', item.testingPerformed], ['Blockers', item.blockers], ['Follow-up items', item.followUpItems], ['Evidence', item.evidenceLinks]] as const).map(([label, values]) => values.length > 0 && <div className="mt-3" key={label}><h5 className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{label}</h5><ul className="mt-1 list-disc space-y-1 pl-5 text-xs text-slate-700">{values.map((value) => <li className="break-words" key={value}>{value}</li>)}</ul></div>)}<div className="mt-3 text-xs font-medium text-slate-500">Related time: {formatMinutes(item.relatedHoursMinutes)}</div></article>)}</section>
      {report.knowledgeItems.length > 0 && <section className="mt-8"><h3 className="border-b border-slate-200 pb-2 font-serif text-lg font-semibold text-slate-800">Related knowledge</h3>{report.knowledgeItems.map((item) => <article className="mt-4" key={item.id}><h4 className="font-semibold">{item.title}</h4><p className="mt-1 text-sm leading-6 text-slate-700">{item.summary}</p>{item.sourcePage && <p className="mt-1 break-all text-xs text-slate-500">{item.sourcePage}</p>}</article>)}</section>}
      <DailyTotals report={report} />
      <ProjectTotals report={report} />
      <section className="mt-8 grid gap-3 rounded-lg bg-slate-800 p-5 text-white sm:grid-cols-3"><div><span className="block text-[10px] uppercase tracking-wider text-slate-300">Billable</span><strong className="text-lg">{formatMinutes(report.totals.billableMinutes)}</strong></div><div><span className="block text-[10px] uppercase tracking-wider text-slate-300">Non-billable</span><strong className="text-lg">{formatMinutes(report.totals.nonBillableMinutes)}</strong></div><div><span className="block text-[10px] uppercase tracking-wider text-slate-300">Total</span><strong className="text-lg">{formatMinutes(report.totals.billableMinutes + report.totals.nonBillableMinutes)}</strong></div></section>
    </>
  );
}

export function ReportPreview({ report }: { report: ReportDocument }) {
  return (
    <div className="report-preview overflow-hidden rounded-xl border bg-white text-slate-800 shadow-sm">
      <div className="flex items-center justify-between border-b bg-slate-50 px-5 py-3 text-xs text-slate-500"><span>Client-facing preview</span><Badge variant="outline" className="bg-white">{report.source.label}</Badge></div>
      <div className="mx-auto max-w-[8.5in] p-6 sm:p-10">
        <Identity report={report} />
        {report.type === "work-log-report" ? <WorkLogPreview report={report} /> : <InvoicePreview report={report} />}
        <footer className="mt-10 border-t border-slate-200 pt-3 text-center text-[10px] text-slate-400">{report.title} · {report.client.name}</footer>
      </div>
    </div>
  );
}
