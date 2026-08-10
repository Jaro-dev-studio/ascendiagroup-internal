/**
 * Dashboard URLs for internal records, so tool results can carry the link the
 * assistant should hyperlink a record's name with. Mirrors the routes the
 * command palette navigates to in lib/actions.ts.
 *
 * Kinds without a detail page fall back to their list route: the user still
 * lands somewhere they can find the record.
 */
export type EntityKind =
  | "person"
  | "company"
  | "client"
  | "deal"
  | "sequence"
  | "task"
  | "actionItem"
  | "request"
  | "recurringTask"
  | "meeting"
  | "calendarEvent"
  | "formSubmission"
  | "caseStudy"
  | "offer"
  | "demo"
  | "presentation"
  | "workflow"
  | "salesCallMap"
  | "mvpCallMap"
  | "calculation"
  | "govContract"
  | "knowledgeBaseDocument"
  | "user";

const DETAIL_ROUTES: Partial<Record<EntityKind, (id: string) => string>> = {
  person: (id) => `/dashboard/crm/people/${id}`,
  company: (id) => `/dashboard/crm/companies/${id}`,
  client: (id) => `/dashboard/clients/${id}`,
  deal: (id) => `/dashboard/crm/deals/${id}`,
  sequence: (id) => `/dashboard/crm/sequences/${id}`,
  task: (id) => `/dashboard/tasks?highlight=${id}`,
  actionItem: (id) => `/dashboard/action-items?highlight=${id}`,
  caseStudy: (id) => `/dashboard/case-studies/${id}`,
  presentation: (id) => `/dashboard/presentations/${id}`,
  workflow: (id) => `/dashboard/workflow-maps/${id}`,
  salesCallMap: (id) => `/dashboard/sales-call-maps/${id}`,
  mvpCallMap: (id) => `/dashboard/mvp-call-maps/${id}`,
  calculation: (id) => `/dashboard/calculation/${id}`,
  govContract: (id) => `/dashboard/sam-gov/${id}`,
};

const LIST_ROUTES: Record<EntityKind, string> = {
  person: "/dashboard/crm/people",
  company: "/dashboard/crm/companies",
  client: "/dashboard/clients",
  deal: "/dashboard/crm/deals",
  sequence: "/dashboard/crm/sequences",
  task: "/dashboard/tasks",
  actionItem: "/dashboard/action-items",
  request: "/dashboard/feature-requests",
  recurringTask: "/dashboard/recurring-tasks",
  meeting: "/dashboard/calls",
  calendarEvent: "/dashboard/crm/recording-rules",
  formSubmission: "/dashboard/submissions",
  caseStudy: "/dashboard/case-studies",
  offer: "/dashboard/offers",
  demo: "/dashboard/demos",
  presentation: "/dashboard/presentations",
  workflow: "/dashboard/workflow-maps",
  salesCallMap: "/dashboard/sales-call-maps",
  mvpCallMap: "/dashboard/mvp-call-maps",
  calculation: "/dashboard/calculation",
  govContract: "/dashboard/sam-gov",
  knowledgeBaseDocument: "/dashboard/knowledge-base",
  user: "/dashboard/users",
};

export function getEntityHref(kind: EntityKind, id?: string | null): string {
  const detail = id ? DETAIL_ROUTES[kind] : undefined;
  return detail && id ? detail(id) : LIST_ROUTES[kind];
}

/**
 * Form submissions have no detail page, so the contact record they created is
 * the most useful destination when it exists.
 */
export function getFormSubmissionHref(personId?: string | null): string {
  return personId
    ? getEntityHref("person", personId)
    : getEntityHref("formSubmission");
}

/** Feature and bug requests live on separate pages. */
export function getRequestHref(type: string | null | undefined): string {
  return type === "BUG" ? "/dashboard/bug-requests" : "/dashboard/feature-requests";
}
