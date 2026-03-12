import axios, { AxiosInstance, AxiosError } from "axios";

function getEnvOrThrow(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function createClient(): AxiosInstance {
  const jiraUrl = getEnvOrThrow("JIRA_URL").replace(/\/+$/, "");
  const username = getEnvOrThrow("JIRA_USERNAME");
  const apiToken = getEnvOrThrow("JIRA_API_TOKEN");

  const auth = Buffer.from(`${username}:${apiToken}`).toString("base64");

  return axios.create({
    baseURL: `${jiraUrl}/rest/api/3`,
    timeout: 15000,
    headers: {
      Authorization: `Basic ${auth}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
  });
}

function handleApiError(error: unknown, context: string): never {
  if (error instanceof AxiosError) {
    const status = error.response?.status;
    const body = error.response?.data;

    switch (status) {
      case 401:
        throw new Error(
          `Authentication failed (HTTP 401): Check JIRA_USERNAME and JIRA_API_TOKEN. Context: ${context}`
        );
      case 404:
        throw new Error(
          `Not found (HTTP 404): ${context} does not exist.`
        );
      case 429:
        throw new Error(
          `Rate limited (HTTP 429): JIRA API rate limit exceeded. Context: ${context}`
        );
      default:
        throw new Error(
          `JIRA API error (HTTP ${status ?? "unknown"}): ${JSON.stringify(body).slice(0, 300)}. Context: ${context}`
        );
    }
  }
  throw error;
}

let client: AxiosInstance | null = null;

function getClient(): AxiosInstance {
  if (!client) {
    client = createClient();
  }
  return client;
}

export async function fetchIssue(issueKey: string): Promise<unknown> {
  try {
    const response = await getClient().get(`/issue/${issueKey}?fields=summary,description,labels,components,issuetype,status,priority,assignee,reporter,created,updated,attachment,issuelinks`);
    return response.data;
  } catch (error: unknown) {
    handleApiError(error, `issue/${issueKey}`);
  }
}

export async function searchIssues(
  jql: string,
  startAt: number,
  maxResults: number
): Promise<unknown> {
  try {
    const response = await getClient().post("/search", {
      jql,
      startAt,
      maxResults,
      fields: [
        "summary",
        "description",
        "labels",
        "components",
        "issuetype",
        "status",
        "priority",
        "assignee",
        "reporter",
        "created",
        "updated",
      ],
    });
    return response.data;
  } catch (error: unknown) {
    handleApiError(error, `search(jql="${jql}")`);
  }
}

export async function fetchComments(
  issueKey: string,
  startAt: number,
  maxResults: number
): Promise<unknown> {
  try {
    const response = await getClient().get(`/issue/${issueKey}/comment`, {
      params: { startAt, maxResults, orderBy: "created" },
    });
    return response.data;
  } catch (error: unknown) {
    handleApiError(error, `issue/${issueKey}/comment`);
  }
}

export function getJiraBaseUrl(): string {
  return getEnvOrThrow("JIRA_URL").replace(/\/+$/, "");
}
