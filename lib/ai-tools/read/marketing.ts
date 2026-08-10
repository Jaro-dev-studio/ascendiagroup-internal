import prisma from "@/lib/prisma";
import { fetchMetaAdInsights, type TimePeriod } from "@/lib/integrations/meta";
import { getEntityHref, getFormSubmissionHref } from "../entity-href";
import { defineTool, type AITool } from "../types";

export const marketingReadTools: AITool[] = [
  defineTool({
    name: "queryFormSubmissions",
    label: "Query Form Submissions",
    risk: "read",
    description:
      "Query form submissions (leads) with optional filters. Returns lead information and UTM data.",
    parameters: {
      properties: {
        type: {
          type: "string",
          enum: ["REGULAR", "BUSINESSOS"],
          description: "Filter by form type",
        },
        daysAgo: { type: "number", description: "Get submissions from the last N days" },
        emailValidation: {
          type: "string",
          description: "Filter by email validation status (valid, invalid, etc.)",
        },
        searchQuery: { type: "string", description: "Search by name or email" },
        limit: {
          type: "number",
          description: "Maximum number of submissions to return (default: 20)",
        },
      },
    },
    execute: async (args) => {
      const { type, daysAgo, emailValidation, searchQuery, limit = 20 } = args as {
        type?: string;
        daysAgo?: number;
        emailValidation?: string;
        searchQuery?: string;
        limit?: number;
      };

      const where: Record<string, unknown> = {};

      if (type) where.type = type;
      if (emailValidation) where.emailValidation = emailValidation;
      if (daysAgo) {
        const since = new Date();
        since.setDate(since.getDate() - daysAgo);
        where.createdAt = { gte: since };
      }
      if (searchQuery) {
        where.OR = [
          { name: { contains: searchQuery, mode: "insensitive" } },
          { email: { contains: searchQuery, mode: "insensitive" } },
        ];
      }

      const submissions = await prisma.embedFormSubmission.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: Math.min(limit, 50),
      });

      return {
        count: submissions.length,
        submissions: submissions.map((s) => ({
          id: s.id,
          // Submissions have no page of their own, so link the contact they created
          href: getFormSubmissionHref(s.personId),
          personId: s.personId,
          name: s.name,
          email: s.email,
          type: s.type,
          emailValidation: s.emailValidation,
          timeline: s.timeline,
          budget: s.budget,
          utmSource: s.utmSource,
          utmCampaign: s.utmCampaign,
          createdAt: s.createdAt.toISOString(),
        })),
      };
    },
  }),

  defineTool({
    name: "queryFunnelMetrics",
    label: "Query Funnel Metrics",
    risk: "read",
    description:
      "Get marketing funnel metrics from Meta Ads including spend, impressions, clicks, leads, and scheduled calls.",
    parameters: {
      properties: {
        period: {
          type: "string",
          enum: ["24h", "7d", "30d", "3m", "1y"],
          description: "Time period for metrics (default: 7d)",
        },
      },
    },
    execute: async (args) => {
      const { period = "7d" } = args as { period?: TimePeriod };

      const result = await fetchMetaAdInsights(period);

      if (result.error) return { error: result.error };

      const metrics = result.data;
      if (!metrics) return { error: "No metrics data available" };

      const costPerLead = metrics.leads > 0 ? metrics.spend / metrics.leads : 0;
      const costPerCall = metrics.scheduleCalls > 0 ? metrics.spend / metrics.scheduleCalls : 0;
      const leadToCallRate =
        metrics.leads > 0 ? (metrics.scheduleCalls / metrics.leads) * 100 : 0;
      const clickToLeadRate = metrics.clicks > 0 ? (metrics.leads / metrics.clicks) * 100 : 0;

      return {
        period,
        dateRange: { start: metrics.dateStart, end: metrics.dateEnd },
        metrics: {
          spend: metrics.spend,
          impressions: metrics.impressions,
          reach: metrics.reach,
          clicks: metrics.clicks,
          leads: metrics.leads,
          scheduledCalls: metrics.scheduleCalls,
          cpc: metrics.cpc,
          cpm: metrics.cpm,
          ctr: metrics.ctr,
          costPerLead,
          costPerCall,
          leadToCallRate,
          clickToLeadRate,
        },
      };
    },
  }),

  defineTool({
    name: "queryAdGeneratorEntities",
    label: "Query Ad Generator Entities",
    risk: "read",
    description:
      "List ad generator building blocks: targets, solutions, risk reversals, destinations, and permutations. Use this to resolve their ids before editing them.",
    parameters: {
      properties: {
        entity: {
          type: "string",
          enum: ["targets", "solutions", "riskReversals", "destinations", "permutations", "all"],
          description: "Which entity to list (default: all)",
        },
        limit: { type: "number", description: "Maximum rows per entity (default: 25)" },
      },
    },
    execute: async (args) => {
      const { entity = "all", limit = 25 } = args as { entity?: string; limit?: number };
      const take = Math.min(limit, 50);
      const wants = (name: string) => entity === "all" || entity === name;

      const result: Record<string, unknown> = {};

      if (wants("targets")) {
        const targets = await prisma.adTarget.findMany({ take, orderBy: { createdAt: "desc" } });
        result.targets = targets.map((t) => ({ id: t.id, name: t.name }));
      }
      if (wants("solutions")) {
        const solutions = await prisma.adSolution.findMany({
          take,
          orderBy: { createdAt: "desc" },
          include: { targets: { select: { id: true, name: true } } },
        });
        result.solutions = solutions.map((s) => ({
          id: s.id,
          text: s.text,
          targets: s.targets.map((t) => t.name),
        }));
      }
      if (wants("riskReversals")) {
        const riskReversals = await prisma.adRiskReversal.findMany({
          take,
          orderBy: { createdAt: "desc" },
        });
        result.riskReversals = riskReversals.map((r) => ({ id: r.id, text: r.text }));
      }
      if (wants("destinations")) {
        const destinations = await prisma.adDestination.findMany({
          take,
          orderBy: { createdAt: "desc" },
        });
        result.destinations = destinations.map((d) => ({ id: d.id, label: d.label, url: d.url }));
      }
      if (wants("permutations")) {
        const permutations = await prisma.adPermutation.findMany({
          take,
          orderBy: { createdAt: "desc" },
          include: {
            target: { select: { name: true } },
            solution: { select: { text: true } },
            riskReversal: { select: { text: true } },
          },
        });
        result.permutations = permutations.map((p) => ({
          id: p.id,
          target: p.target.name,
          solution: p.solution.text,
          riskReversal: p.riskReversal.text,
          adHeadline: p.adHeadline,
          metaAdId: p.metaAdId,
        }));
      }

      return result;
    },
  }),

  defineTool({
    name: "queryCaseStudies",
    label: "Query Case Studies",
    risk: "read",
    description:
      "List case studies with their ids, technologies and services. Use this to resolve case study ids before editing or deleting.",
    parameters: {
      properties: {
        searchQuery: { type: "string", description: "Search by case study or company name" },
        limit: { type: "number", description: "Maximum number to return (default: 20)" },
      },
    },
    execute: async (args) => {
      const { searchQuery, limit = 20 } = args as { searchQuery?: string; limit?: number };

      const where: Record<string, unknown> = {};
      if (searchQuery) {
        where.OR = [
          { name: { contains: searchQuery, mode: "insensitive" } },
          { companyName: { contains: searchQuery, mode: "insensitive" } },
        ];
      }

      const caseStudies = await prisma.caseStudy.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: Math.min(limit, 50),
      });

      return {
        count: caseStudies.length,
        caseStudies: caseStudies.map((c) => ({
          id: c.id,
          href: getEntityHref("caseStudy", c.id),
          name: c.name,
          companyName: c.companyName,
          technologies: c.technologies,
          services: c.services,
          publicUrl: c.publicUrl,
          clientCompanyId: c.clientCompanyId,
          createdAt: c.createdAt.toISOString(),
        })),
      };
    },
  }),

  defineTool({
    name: "queryOffers",
    label: "Query Offers",
    risk: "read",
    description: "List offers in the offer catalog with their ids.",
    parameters: {
      properties: {
        limit: { type: "number", description: "Maximum number to return (default: 20)" },
      },
    },
    execute: async (args) => {
      const { limit = 20 } = args as { limit?: number };

      const offers = await prisma.offer.findMany({
        orderBy: { createdAt: "desc" },
        take: Math.min(limit, 50),
      });

      return {
        count: offers.length,
        offers: offers.map((o) => ({
          id: o.id,
          href: getEntityHref("offer", o.id),
          title: o.title,
          description: o.description,
          createdAt: o.createdAt.toISOString(),
        })),
      };
    },
  }),
];
