// MVP Call Maps Pricing Configuration
// Pricing matrix for the MVP offer product builder

export interface MVPPricingItem {
  code: string;
  name: string;
  basePrice: number;
  perUnit?: number;
  unitLabel?: string;
  description?: string;
  autoCalculated?: boolean;
}

// Always-included base items
export const mvpBaseItems: MVPPricingItem[] = [
  {
    code: "BASE_BUILD",
    name: "Base Build",
    basePrice: 3500,
    description: "Core application infrastructure and architecture",
  },
  {
    code: "MAIN_DASHBOARD",
    name: "Main Dashboard with Sidebar & Navigation",
    basePrice: 1500,
    description: "Primary dashboard layout with navigation system",
  },
  {
    code: "ORG_SETTINGS",
    name: "Organization Settings Page",
    basePrice: 500,
    description: "Settings page for organization configuration",
  },
  {
    code: "USER_SETTINGS",
    name: "User Settings Page",
    basePrice: 500,
    description: "Settings page for user profile and preferences",
  },
  {
    code: "DEV_ENV",
    name: "Dev Environment Setup",
    basePrice: 500,
    description: "Development environment and deployment configuration",
  },
];

// Per-unit items (auto-calculated from diagram/configurator)
export const mvpPerUnitItems: MVPPricingItem[] = [
  {
    code: "ADDITIONAL_PAGE",
    name: "Additional Page",
    basePrice: 0,
    perUnit: 1000,
    unitLabel: "page",
    description: "Additional application pages beyond the main dashboard",
    autoCalculated: true,
  },
  {
    code: "EXTERNAL_API",
    name: "External API Integrations",
    basePrice: 0,
    perUnit: 750,
    unitLabel: "integration",
    description: "Integration with third-party APIs",
    autoCalculated: true,
  },
  {
    code: "CUSTOM_LOGIC",
    name: "Unique Functionalities (Non-CRUD)",
    basePrice: 0,
    perUnit: 1250,
    unitLabel: "functionality",
    description: "Custom business logic beyond standard CRUD operations",
    autoCalculated: true,
  },
  {
    code: "ADMIN_EMAIL",
    name: "Admin Email on Event",
    basePrice: 0,
    perUnit: 250,
    unitLabel: "event",
    description: "Email notification to admin on specific events",
    autoCalculated: true,
  },
];

// Toggle items (user selects yes/no)
export const mvpToggleItems: MVPPricingItem[] = [
  {
    code: "AUTH_PROVIDERS",
    name: "Authentication Providers",
    basePrice: 600,
    perUnit: 600,
    unitLabel: "provider",
    description: "User authentication with selected providers ($600 each)",
  },
  {
    code: "USER_ROLES",
    name: "User Roles",
    basePrice: 1000,
    description: "Role-based access control for team members",
  },
  {
    code: "LANDING_PAGE",
    name: "Landing Page",
    basePrice: 1500,
    description: "Marketing landing page for the application",
  },
  {
    code: "RESPONSIVE_DESIGN",
    name: "Responsive Design Mobile + Desktop",
    basePrice: 500,
    description: "Fully responsive design across all devices",
  },
  {
    code: "FIGMA_BRAND",
    name: "Figma / Brand Kit Provided",
    basePrice: 500,
    description: "Integration of provided Figma designs or brand kit",
  },
  {
    code: "CUSTOM_UI",
    name: "Custom UI Color Palette + Typography Provided",
    basePrice: 1500,
    description: "Custom styling based on provided color palette and typography",
  },
  {
    code: "STRIPE",
    name: "Stripe Integration",
    basePrice: 900,
    description: "Payment processing with Stripe",
  },
  {
    code: "UI_ANIMATIONS",
    name: "Beautiful UI Animations",
    basePrice: 200,
    perUnit: 200,
    unitLabel: "page",
    description: "Polished animations and micro-interactions ($200/page)",
  },
  {
    code: "DARK_MODE",
    name: "Dark Mode Support",
    basePrice: 350,
    perUnit: 350,
    unitLabel: "page",
    description: "Dark mode theme support ($350/page)",
  },
];

// Entity definition
export interface EntityDefinition {
  id: string;
  name: string;
  description?: string;
}

// End-user type definition (different dashboard experiences)
export interface EndUserType {
  id: string;
  name: string;
  description?: string;
}

// Configurator option types
export interface ConfiguratorData {
  // Authentication providers
  authProviders: string[];
  
  // Team functionality
  teamFeatures: {
    inviteMembers: boolean;
    predefinedRoles: boolean;
    customRoles: boolean;
    bulkInvite: boolean;
  };
  
  // Predefined roles (when predefinedRoles is enabled)
  predefinedRolesList: Array<{ id: string; name: string; description: string }>;
  
  // Custom role actions (when customRoles is enabled)
  customRoleActions: Array<{ id: string; name: string }>;
  
  // DNS setup
  dnsSetup: {
    customSubdomains: boolean;
    additionalDomainConfig: boolean;
  };
  
  // Transactional email
  emailSetup: {
    transactionalEmails: boolean;
    welcomeEmail: boolean;
    adminEmails: Array<{ name: string; event: string }>;
  };
  
  // Optional toggles
  toggles: {
    landingPage: boolean;
    responsiveDesign: boolean;
    figmaBrand: boolean;
    customUI: boolean;
    stripeIntegration: boolean;
    uiAnimations: boolean;
    uiAnimationsScope: "all" | "selected"; // "all" = all pages (current + future), "selected" = specific pages
    uiAnimationsPages: string[]; // page node IDs when "selected"
    darkMode: boolean;
  };

  // Entities (data models)
  entities: EntityDefinition[];

  // End-user types (different dashboard experiences, e.g., suppliers, vendors)
  endUserTypes: EndUserType[];
}

// Success criteria for a block
export interface SuccessCriterion {
  id: string;
  text: string;
}

// Flow data types (from xyflow diagram)
export interface FlowNodeData {
  id: string;
  type: "page" | "externalApi" | "customLogic";
  data: {
    name: string;
    description?: string;
    isAuthenticated?: boolean;
    apiUrl?: string;
    isIncluded?: boolean;
    isAutoGenerated?: boolean;
    entityId?: string;
    successCriteria?: SuccessCriterion[];
  };
  position: { x: number; y: number };
}

export interface FlowData {
  nodes: FlowNodeData[];
  edges: Array<{
    id: string;
    source: string;
    target: string;
  }>;
}

// Quote line item
export interface MVPQuoteLineItem {
  code: string;
  name: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  description?: string;
}

// Full quote
export interface MVPQuote {
  lineItems: MVPQuoteLineItem[];
  subtotal: number;
  total: number;
  deposit: number; // 20%
  balance: number; // 80%
}

// Default configurator data
export const defaultConfiguratorData: ConfiguratorData = {
  authProviders: [],
  teamFeatures: {
    inviteMembers: false,
    predefinedRoles: false,
    customRoles: false,
    bulkInvite: false,
  },
  predefinedRolesList: [],
  customRoleActions: [],
  dnsSetup: {
    customSubdomains: false,
    additionalDomainConfig: false,
  },
  emailSetup: {
    transactionalEmails: false,
    welcomeEmail: false,
    adminEmails: [],
  },
  toggles: {
    landingPage: false,
    responsiveDesign: true, // Default to true
    figmaBrand: false,
    customUI: false,
    stripeIntegration: false,
    uiAnimations: false,
    uiAnimationsScope: "all",
    uiAnimationsPages: [],
    darkMode: false,
  },
  entities: [],
  endUserTypes: [
    { id: "default-user", name: "User", description: "Primary end-user of the platform" },
  ],
};

// Default flow data - includes the main dashboard and settings pages which are always included in the price
export const defaultFlowData: FlowData = {
  nodes: [
    {
      id: "dashboard-included",
      type: "page",
      position: { x: 100, y: 100 },
      data: {
        name: "Dashboard",
        description: "Main dashboard with sidebar & navigation (included)",
        isAuthenticated: true,
        isIncluded: true,
      },
    },
    {
      id: "org-settings-included",
      type: "page",
      position: { x: 100, y: 250 },
      data: {
        name: "Organization Settings",
        description: "Settings page for organization configuration (included)",
        isAuthenticated: true,
        isAutoGenerated: true,
      },
    },
    {
      id: "user-settings-included",
      type: "page",
      position: { x: 100, y: 400 },
      data: {
        name: "User Settings",
        description: "Settings page for user profile and preferences (included)",
        isAuthenticated: true,
        isAutoGenerated: true,
      },
    },
  ],
  edges: [],
};

// Calculate quote from flow data and configurator data
export function calculateMVPQuote(
  flowData: FlowData | null,
  configuratorData: ConfiguratorData | null
): MVPQuote {
  const lineItems: MVPQuoteLineItem[] = [];
  const config = configuratorData || defaultConfiguratorData;
  const flow = flowData || defaultFlowData;

  // Always add base items
  mvpBaseItems.forEach((item) => {
    lineItems.push({
      code: item.code,
      name: item.name,
      quantity: 1,
      unitPrice: item.basePrice,
      lineTotal: item.basePrice,
      description: item.description,
    });
  });

  // Get nodes by type from flow data
  const pageNodes = flow.nodes.filter((n) => n.type === "page");
  const apiNodes = flow.nodes.filter((n) => n.type === "externalApi");
  const customLogicNodes = flow.nodes.filter((n) => n.type === "customLogic");

  // Additional pages (first page / dashboard is included in base)
  // Filter out the included dashboard and settings pages from additional pages
  const additionalPageNodes = pageNodes.filter(
    (n) => n.id !== "dashboard-included" && n.id !== "org-settings-included" && n.id !== "user-settings-included"
  );
  // Create individual line items for each additional page
  additionalPageNodes.forEach((node) => {
    lineItems.push({
      code: `PAGE_${node.id}`,
      name: `Page: ${node.data.name}`,
      quantity: 1,
      unitPrice: 1000,
      lineTotal: 1000,
      description: node.data.description || "",
    });
  });

  // External API integrations - individual line items
  apiNodes.forEach((node) => {
    lineItems.push({
      code: `API_${node.id}`,
      name: `API: ${node.data.name}`,
      quantity: 1,
      unitPrice: 750,
      lineTotal: 750,
      description: node.data.description || "",
    });
  });

  // Custom logic / unique functionalities - individual line items
  customLogicNodes.forEach((node) => {
    lineItems.push({
      code: `LOGIC_${node.id}`,
      name: `Logic: ${node.data.name}`,
      quantity: 1,
      unitPrice: 1250,
      lineTotal: 1250,
      description: node.data.description || "",
    });
  });

  // Auth providers ($600 each)
  if (config.authProviders.length > 0) {
    const authProviderLabels = config.authProviders
      .map((id) => {
        const option = authProviderOptions.find((o) => o.id === id);
        return option?.label || id;
      })
      .join(", ");
    lineItems.push({
      code: "AUTH_PROVIDERS",
      name: "Authentication Providers",
      quantity: config.authProviders.length,
      unitPrice: 600,
      lineTotal: config.authProviders.length * 600,
      description: authProviderLabels,
    });
  }

  // Predefined user roles ($1000 per role)
  const predefinedRolesList = config.predefinedRolesList || [];
  if (config.teamFeatures.predefinedRoles && predefinedRolesList.length > 0) {
    const roleCount = predefinedRolesList.length;
    const roleNames = predefinedRolesList.map(r => r.name).join(", ");
    lineItems.push({
      code: "PREDEFINED_ROLES",
      name: "User Roles",
      quantity: roleCount,
      unitPrice: 1000,
      lineTotal: roleCount * 1000,
      description: `Predefined roles: ${roleNames}`,
    });
  }

  // Custom roles functionality ($500 flat + $250 per action)
  const customRoleActions = config.customRoleActions || [];
  if (config.teamFeatures.customRoles) {
    // Flat fee for checkbox roles functionality
    lineItems.push({
      code: "CUSTOM_ROLES_BASE",
      name: "Custom Roles System",
      quantity: 1,
      unitPrice: 500,
      lineTotal: 500,
      description: "Checkbox-based permission assignment system",
    });

    // Per-action pricing
    if (customRoleActions.length > 0) {
      const actionCount = customRoleActions.length;
      const actionNames = customRoleActions.map(a => a.name).join(", ");
      lineItems.push({
        code: "CUSTOM_ROLE_ACTIONS",
        name: "Permission Actions",
        quantity: actionCount,
        unitPrice: 250,
        lineTotal: actionCount * 250,
        description: `Actions: ${actionNames}`,
      });
    }
  }

  // End-user types ($1000 each)
  const endUserTypes = config.endUserTypes || [];
  if (endUserTypes.length > 0) {
    const userTypeNames = endUserTypes.map(u => u.name).join(", ");
    lineItems.push({
      code: "END_USER_TYPES",
      name: "End-User Types",
      quantity: endUserTypes.length,
      unitPrice: 1000,
      lineTotal: endUserTypes.length * 1000,
      description: `Distinct user experiences: ${userTypeNames}`,
    });
  }

  // Admin emails
  const adminEmailCount = config.emailSetup.adminEmails.length;
  if (adminEmailCount > 0) {
    lineItems.push({
      code: "ADMIN_EMAIL",
      name: "Admin Email on Event",
      quantity: adminEmailCount,
      unitPrice: 250,
      lineTotal: adminEmailCount * 250,
      description: `${adminEmailCount} admin notification event(s)`,
    });
  }

  // Toggle items
  if (config.toggles.landingPage) {
    lineItems.push({
      code: "LANDING_PAGE",
      name: "Landing Page",
      quantity: 1,
      unitPrice: 1500,
      lineTotal: 1500,
    });
  }

  if (config.toggles.responsiveDesign) {
    lineItems.push({
      code: "RESPONSIVE_DESIGN",
      name: "Responsive Design Mobile + Desktop",
      quantity: 1,
      unitPrice: 500,
      lineTotal: 500,
    });
  }

  if (config.toggles.figmaBrand) {
    lineItems.push({
      code: "FIGMA_BRAND",
      name: "Figma / Brand Kit Provided",
      quantity: 1,
      unitPrice: 500,
      lineTotal: 500,
    });
  }

  if (config.toggles.customUI) {
    lineItems.push({
      code: "CUSTOM_UI",
      name: "Custom UI Color Palette + Typography Provided",
      quantity: 1,
      unitPrice: 1500,
      lineTotal: 1500,
    });
  }

  if (config.toggles.stripeIntegration) {
    lineItems.push({
      code: "STRIPE",
      name: "Stripe Integration",
      quantity: 1,
      unitPrice: 900,
      lineTotal: 900,
    });
  }

  // UI Animations - $200 per page
  if (config.toggles.uiAnimations) {
    const uiAnimationsScope = config.toggles.uiAnimationsScope || "all";
    const uiAnimationsPages = config.toggles.uiAnimationsPages || [];
    
    // All pages = all current pages in the diagram (including dashboard)
    const totalPageCount = pageNodes.length;
    
    if (uiAnimationsScope === "all") {
      // All pages (current + future - charges for all current pages including dashboard)
      const pageNames = pageNodes.map((n) => n.data.name).join(", ");
      lineItems.push({
        code: "UI_ANIMATIONS",
        name: "Beautiful UI Animations (All Pages)",
        quantity: totalPageCount,
        unitPrice: 200,
        lineTotal: totalPageCount * 200,
        description: pageNames,
      });
    } else if (uiAnimationsPages.length > 0) {
      // Selected pages only
      const selectedNodes = pageNodes.filter((n) => uiAnimationsPages.includes(n.id));
      if (selectedNodes.length > 0) {
        const pageNames = selectedNodes.map((n) => n.data.name).join(", ");
        lineItems.push({
          code: "UI_ANIMATIONS",
          name: "Beautiful UI Animations",
          quantity: selectedNodes.length,
          unitPrice: 200,
          lineTotal: selectedNodes.length * 200,
          description: pageNames,
        });
      }
    }
  }

  // Dark Mode - $350 per page (applies to all pages including dashboard)
  if (config.toggles.darkMode) {
    const totalPageCount = pageNodes.length;
    const pageNames = pageNodes.map((n) => n.data.name).join(", ");
    lineItems.push({
      code: "DARK_MODE",
      name: "Dark Mode Support",
      quantity: totalPageCount,
      unitPrice: 350,
      lineTotal: totalPageCount * 350,
      description: pageNames,
    });
  }

  // Calculate totals
  const subtotal = lineItems.reduce((sum, item) => sum + item.lineTotal, 0);
  const total = subtotal;
  const deposit = Math.round(total * 0.2); // 20% deposit
  const balance = total - deposit; // 80% balance

  return {
    lineItems,
    subtotal,
    total,
    deposit,
    balance,
  };
}

// Auth provider options
export const authProviderOptions = [
  { id: "email_password", label: "Email + Password" },
  { id: "google", label: "Google" },
  { id: "microsoft", label: "Microsoft" },
  { id: "github", label: "GitHub" },
  { id: "sso", label: "SSO" },
  { id: "other", label: "Other Auth (E.g. Discord)" },
];
