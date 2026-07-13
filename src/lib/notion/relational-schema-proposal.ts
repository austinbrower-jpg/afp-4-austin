/**
 * Phase 11 additive Notion schema proposal for explicit relations.
 * Design only — no apply implementation.
 */

export type RelationTarget =
  | "Clients"
  | "Projects"
  | "Hours Worked"
  | "Work Done"
  | "Invoice Reports";

export interface ProposedSelectOption {
  name: string;
}

export interface ProposedRelationProperty {
  name: string;
  type: "relation";
  target: RelationTarget;
  /** Expected reciprocal property name on the target database, when known. */
  reciprocal?: string;
  reciprocalBehavior?: string;
}

export interface ProposedSelectProperty {
  name: string;
  type: "select";
  options: ProposedSelectOption[];
}

export interface ProposedRichTextProperty {
  name: string;
  type: "rich_text";
}

export interface ProposedDateProperty {
  name: string;
  type: "date";
}

export interface ProposedUrlProperty {
  name: string;
  type: "url";
}

export type ProposedProperty =
  | ProposedRelationProperty
  | ProposedSelectProperty
  | ProposedRichTextProperty
  | ProposedDateProperty
  | ProposedUrlProperty;

export interface ProposedDatabaseSchema {
  database: string;
  additiveOnly: true;
  properties: ProposedProperty[];
}

export const PHASE11_RELATIONAL_SCHEMA_PROPOSAL: ProposedDatabaseSchema[] = [
  {
    database: "Hours Worked",
    additiveOnly: true,
    properties: [
      { name: "Session ID", type: "rich_text" },
      {
        name: "Client",
        type: "relation",
        target: "Clients",
        reciprocal: "Hours Worked",
        reciprocalBehavior: "Single Client owns many Hours sessions; Hours.Client points to one Client.",
      },
      {
        name: "Related Work Done",
        type: "relation",
        target: "Work Done",
        reciprocal: "Related Hours",
        reciprocalBehavior: "Hours may link to one or more Work Done rows; Work Done.Related Hours links back.",
      },
      {
        name: "Invoice Report",
        type: "relation",
        target: "Invoice Reports",
        reciprocal: "Included Hours",
        reciprocalBehavior: "When invoiced, Hours.Invoice Report points to the invoice; invoice lists Included Hours.",
      },
      {
        name: "Billing Status",
        type: "select",
        options: [
          { name: "Draft" },
          { name: "Reviewed" },
          { name: "Ready to Invoice" },
          { name: "Invoiced" },
          { name: "Paid" },
          { name: "Superseded" },
        ],
      },
    ],
  },
  {
    database: "Work Done",
    additiveOnly: true,
    properties: [
      { name: "Work Log ID", type: "rich_text" },
      {
        name: "Client",
        type: "relation",
        target: "Clients",
        reciprocal: "Work Done",
        reciprocalBehavior: "Work Done belongs to one Client.",
      },
      {
        name: "Related Hours",
        type: "relation",
        target: "Hours Worked",
        reciprocal: "Related Work Done",
        reciprocalBehavior: "Bidirectional link between daily work log and its sessions.",
      },
      {
        name: "Invoice Report",
        type: "relation",
        target: "Invoice Reports",
        reciprocal: "Included Work Done",
        reciprocalBehavior: "Work Done included on an invoice references that Invoice Report.",
      },
      {
        name: "Approval Status",
        type: "select",
        options: [
          { name: "Draft" },
          { name: "Needs Review" },
          { name: "Approved" },
          { name: "Sent to Client" },
          { name: "Archived" },
        ],
      },
    ],
  },
  {
    database: "Invoice Reports",
    additiveOnly: true,
    properties: [
      {
        name: "Client",
        type: "relation",
        target: "Clients",
        reciprocal: "Invoice Reports",
        reciprocalBehavior: "Each invoice belongs to one Client.",
      },
      {
        name: "Included Hours",
        type: "relation",
        target: "Hours Worked",
        reciprocal: "Invoice Report",
        reciprocalBehavior: "Invoice lists all billed Hours sessions.",
      },
      {
        name: "Included Work Done",
        type: "relation",
        target: "Work Done",
        reciprocal: "Invoice Report",
        reciprocalBehavior: "Invoice lists Work Done rows included in the export.",
      },
      { name: "Invoice Date", type: "date" },
      { name: "Due Date", type: "date" },
      { name: "Payment Terms", type: "rich_text" },
      { name: "Sent Date", type: "date" },
      { name: "Paid Date", type: "date" },
      { name: "PDF URL", type: "url" },
      {
        name: "Status",
        type: "select",
        options: [
          { name: "Draft" },
          { name: "Generated" },
          { name: "Sent" },
          { name: "Paid" },
          { name: "Overdue" },
          { name: "Cancelled" },
        ],
      },
    ],
  },
  {
    database: "Projects",
    additiveOnly: true,
    properties: [
      {
        name: "Client",
        type: "relation",
        target: "Clients",
        reciprocal: "Projects",
        reciprocalBehavior: "Each Project belongs to one Client.",
      },
    ],
  },
];

export function validateSchemaProposal(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const namesByDb = new Map<string, Set<string>>();
  for (const db of PHASE11_RELATIONAL_SCHEMA_PROPOSAL) {
    const names = namesByDb.get(db.database) ?? new Set();
    for (const prop of db.properties) {
      if (names.has(prop.name)) {
        errors.push(`Duplicate property "${prop.name}" in ${db.database}`);
      }
      names.add(prop.name);
      if (prop.type === "select" && prop.options.length === 0) {
        errors.push(`Select "${prop.name}" in ${db.database} has no options`);
      }
      if (prop.type === "relation" && !prop.target) {
        errors.push(`Relation "${prop.name}" in ${db.database} missing target`);
      }
    }
    namesByDb.set(db.database, names);
  }
  return { valid: errors.length === 0, errors };
}
