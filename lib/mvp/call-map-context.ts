import {
  authProviderOptions,
  calculateMVPQuote,
  type ConfiguratorData,
  type FlowData,
  type FlowNodeData,
} from "@/config/mvp-pricing";

export interface MVPCallMapForContext {
  name: string;
  notes: string | null;
  flowData: unknown;
  configuratorData: unknown;
}

/**
 * The flow/configurator columns are untyped Json, so narrow them defensively
 * before reading nested fields.
 */
function parseFlowData(value: unknown): FlowData | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<FlowData>;
  if (!Array.isArray(candidate.nodes)) return null;
  return {
    nodes: candidate.nodes as FlowNodeData[],
    edges: Array.isArray(candidate.edges) ? candidate.edges : [],
  };
}

function parseConfiguratorData(value: unknown): ConfiguratorData | null {
  if (!value || typeof value !== "object") return null;
  return value as ConfiguratorData;
}

function formatNode(node: FlowNodeData): string {
  const details: string[] = [];
  if (node.data.description) details.push(node.data.description);
  if (node.data.apiUrl) details.push(`URL: ${node.data.apiUrl}`);
  if (node.type === "page") {
    details.push(node.data.isAuthenticated ? "Requires authentication" : "Public");
  }

  let line = `- **${node.data.name}**${details.length > 0 ? `: ${details.join(" — ")}` : ""}`;

  const criteria = node.data.successCriteria || [];
  if (criteria.length > 0) {
    line += `\n${criteria.map((criterion) => `  - Success criteria: ${criterion.text}`).join("\n")}`;
  }

  return line;
}

function formatNodeSection(title: string, nodes: FlowNodeData[], emptyLabel: string): string {
  return `### ${title}
${nodes.length > 0 ? nodes.map(formatNode).join("\n") : emptyLabel}
`;
}

function formatConfigurator(config: ConfiguratorData): string {
  const sections: string[] = [];

  const authProviders = (config.authProviders || []).map(
    (id) => authProviderOptions.find((option) => option.id === id)?.label || id
  );
  if (authProviders.length > 0) {
    sections.push(`**Authentication providers:** ${authProviders.join(", ")}`);
  }

  const entities = config.entities || [];
  if (entities.length > 0) {
    sections.push(
      `**Data entities:**\n${entities
        .map((entity) => `- **${entity.name}**${entity.description ? `: ${entity.description}` : ""}`)
        .join("\n")}`
    );
  }

  const endUserTypes = config.endUserTypes || [];
  if (endUserTypes.length > 0) {
    sections.push(
      `**End-user types (each needs its own dashboard experience):**\n${endUserTypes
        .map((userType) => `- **${userType.name}**${userType.description ? `: ${userType.description}` : ""}`)
        .join("\n")}`
    );
  }

  const teamFeatures = config.teamFeatures;
  if (teamFeatures) {
    const enabledTeamFeatures = [
      teamFeatures.inviteMembers ? "Invite team members" : null,
      teamFeatures.bulkInvite ? "Bulk invites" : null,
      teamFeatures.predefinedRoles ? "Predefined roles" : null,
      teamFeatures.customRoles ? "Custom roles with per-action permissions" : null,
    ].filter(Boolean);
    if (enabledTeamFeatures.length > 0) {
      sections.push(`**Team features:** ${enabledTeamFeatures.join(", ")}`);
    }
  }

  const predefinedRoles = config.predefinedRolesList || [];
  if (predefinedRoles.length > 0) {
    sections.push(
      `**Roles:**\n${predefinedRoles
        .map((role) => `- **${role.name}**${role.description ? `: ${role.description}` : ""}`)
        .join("\n")}`
    );
  }

  const customRoleActions = config.customRoleActions || [];
  if (customRoleActions.length > 0) {
    sections.push(
      `**Permission actions:** ${customRoleActions.map((action) => action.name).join(", ")}`
    );
  }

  const emailSetup = config.emailSetup;
  if (emailSetup) {
    const emailFeatures = [
      emailSetup.transactionalEmails ? "Transactional emails" : null,
      emailSetup.welcomeEmail ? "Welcome email" : null,
    ].filter(Boolean);
    const adminEmails = emailSetup.adminEmails || [];
    if (adminEmails.length > 0) {
      emailFeatures.push(
        `Admin notifications: ${adminEmails.map((email) => `${email.name} (on ${email.event})`).join(", ")}`
      );
    }
    if (emailFeatures.length > 0) {
      sections.push(`**Email setup:** ${emailFeatures.join(", ")}`);
    }
  }

  const dnsSetup = config.dnsSetup;
  if (dnsSetup) {
    const dnsFeatures = [
      dnsSetup.customSubdomains ? "Custom subdomains per organisation" : null,
      dnsSetup.additionalDomainConfig ? "Additional domain configuration" : null,
    ].filter(Boolean);
    if (dnsFeatures.length > 0) {
      sections.push(`**Domains:** ${dnsFeatures.join(", ")}`);
    }
  }

  const toggles = config.toggles;
  if (toggles) {
    const enabledToggles = [
      toggles.landingPage ? "Marketing landing page" : null,
      toggles.responsiveDesign ? "Responsive mobile + desktop design" : null,
      toggles.figmaBrand ? "Figma / brand kit provided by client" : null,
      toggles.customUI ? "Custom colour palette and typography provided" : null,
      toggles.stripeIntegration ? "Stripe payments" : null,
      toggles.uiAnimations ? "UI animations" : null,
      toggles.darkMode ? "Dark mode" : null,
    ].filter(Boolean);
    if (enabledToggles.length > 0) {
      sections.push(`**Included features:** ${enabledToggles.join(", ")}`);
    }
  }

  if (sections.length === 0) {
    return "";
  }

  return `### Configuration
${sections.join("\n\n")}
`;
}

/**
 * Turn an MVP call map into a markdown spec section for the Cursor agent prompt.
 * Returns an empty string when the map has no usable scope data.
 */
export function buildMVPCallMapContext(callMap: MVPCallMapForContext): string {
  const flowData = parseFlowData(callMap.flowData);
  const configuratorData = parseConfiguratorData(callMap.configuratorData);

  const nodes = flowData?.nodes || [];
  const pages = nodes.filter((node) => node.type === "page");
  const apis = nodes.filter((node) => node.type === "externalApi");
  const customLogic = nodes.filter((node) => node.type === "customLogic");
  const configuratorSection = configuratorData ? formatConfigurator(configuratorData) : "";

  if (nodes.length === 0 && !configuratorSection && !callMap.notes?.trim()) {
    return "";
  }

  const quote = calculateMVPQuote(flowData, configuratorData);

  let section = `
## MVP Call Map: ${callMap.name} (Scoped Product Specification)

This scope was agreed with the client during the MVP scoping call. It is the source of truth for what to build — where it conflicts with the call transcript, follow this specification.

Scoped build value: $${quote.total.toLocaleString()}

${formatNodeSection("Pages to Build", pages, "No specific pages defined")}
${formatNodeSection("External API Integrations", apis, "No external APIs")}
${formatNodeSection("Custom Logic / Unique Functionality", customLogic, "No custom logic defined")}`;

  if (configuratorSection) {
    section += `
${configuratorSection}`;
  }

  const notes = callMap.notes?.trim();
  if (notes) {
    section += `
### Scoping Notes
${notes}
`;
  }

  return section;
}
