export const PROPOSED_NOTION_REPORT_FIELDS = {
  workDone: [
    { name: "Client Visible", type: "checkbox" },
    { name: "Include in Invoice", type: "checkbox" },
    { name: "Include in Work Report", type: "checkbox" },
    { name: "Detailed Work Description", type: "rich_text" },
    { name: "Internal Notes", type: "rich_text" },
    { name: "Evidence Links", type: "rich_text_or_url" },
    { name: "Related Hours", type: "relation_to_hours_worked" },
  ],
  knowledge: [
    { name: "Client Visible", type: "checkbox" },
    { name: "Include in Work Report", type: "checkbox" },
    { name: "Report Summary", type: "rich_text" },
    { name: "Project", type: "relation_to_projects" },
    { name: "Source Page", type: "url" },
  ],
} as const;

export const REPORT_PRIVACY_RULES = [
  "Client-facing records require Client Visible = true.",
  "Invoice work records also require Include in Invoice = true.",
  "Work report records also require Include in Work Report = true.",
  "Internal Notes are excluded from every client export serializer.",
] as const;

