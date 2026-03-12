export interface JiraAttachment {
  id: string;
  filename: string;
  mimeType: string;
  size: number;         // bytes
  created: string;      // ISO date string
  author: string;       // displayName
  content: string;      // download URL (needs auth)
}

export interface JiraIssueLink {
  id: string;
  relationship: string; // e.g. "blocks", "is blocked by", "relates to"
  linked_issue_key: string;
  linked_issue_summary: string;
  linked_issue_status: string;
}

export interface JiraIssue {
  key: string;
  summary: string;
  description: string;
  labels: string[];
  components: string[];
  issue_type: string;
  status: string;
  priority: string;
  assignee: string;
  reporter: string;
  created: string;
  updated: string;
  url: string;
  attachments: JiraAttachment[];
  linked_issues: JiraIssueLink[];
}

export interface JiraComment {
  id: string;
  author: string;
  body: string;
  created: string;
  updated: string;
}

/**
 * Atlassian Document Format (ADF) node — the structured document format
 * used by JIRA REST API v3 for description/comment bodies.
 * Must be recursively traversed to extract plain text.
 */
export interface AdfNode {
  type: string;
  text?: string;
  content?: AdfNode[];
  marks?: AdfMark[];
  attrs?: Record<string, unknown>;
}

export interface AdfMark {
  type: string;
  attrs?: Record<string, unknown>;
}

export interface JiraSearchResult {
  issues: JiraIssue[];
  total: number;
  startAt: number;
  maxResults: number;
}
