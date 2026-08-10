import {
  createCaseStudy,
  updateCaseStudy,
  deleteCaseStudy,
  generateCaseStudyText,
  saveCaseStudyGeneratedText,
  createOffer,
  updateOffer,
  deleteOffer,
  createPresentation,
  updatePresentation,
  deletePresentation,
  deleteFormSubmission,
} from "@/lib/actions";
import { defineTool, type AITool } from "../types";
import { lookupEntityLabel } from "../preview";
import { changeSummary, deletePreview, unwrapAction } from "./helpers";

export const contentWriteTools: AITool[] = [
  defineTool({
    name: "createCaseStudy",
    label: "Create Case Study",
    risk: "additive",
    description:
      "Create a case study. Technologies and services must use the enum values already stored on existing case studies; check queryCaseStudies for valid values.",
    parameters: {
      properties: {
        name: { type: "string", description: "Case study name" },
        companyName: { type: "string", description: "Client company name shown publicly" },
        body: { type: "string", description: "Raw project notes the case study is built from" },
        technologies: {
          type: "array",
          items: { type: "string" },
          description: "Technology enum values",
        },
        services: {
          type: "array",
          items: { type: "string" },
          description: "Service enum values",
        },
        publicUrl: { type: "string", description: "Public URL of the live project" },
        clientCompanyId: { type: "string", description: "Linked client company ID" },
      },
      required: ["name", "body"],
    },
    preview: async (args) => ({
      title: "Create case study",
      summary: `"${args.name}"${args.companyName ? ` for ${args.companyName}` : ""}`,
      details: {
        Technologies: (args.technologies as string[])?.join(", ") ?? "—",
        Services: (args.services as string[])?.join(", ") ?? "—",
      },
    }),
    execute: async (args) =>
      unwrapAction(
        createCaseStudy({
          name: args.name as string,
          companyName: args.companyName as string | undefined,
          body: args.body as string,
          technologies: (args.technologies as string[]) ?? [],
          services: (args.services as string[]) ?? [],
          publicUrl: args.publicUrl as string | undefined,
          clientCompanyId: args.clientCompanyId as string | undefined,
        })
      ),
  }),

  defineTool({
    name: "updateCaseStudy",
    label: "Update Case Study",
    risk: "additive",
    description: "Update a case study. Only the fields you provide are changed.",
    parameters: {
      properties: {
        caseStudyId: { type: "string", description: "The case study ID" },
        name: { type: "string", description: "New name" },
        companyName: { type: "string", description: "New company name" },
        body: { type: "string", description: "New body notes" },
        technologies: { type: "array", items: { type: "string" }, description: "Replace technologies" },
        services: { type: "array", items: { type: "string" }, description: "Replace services" },
        publicUrl: { type: "string", description: "New public URL" },
      },
      required: ["caseStudyId"],
    },
    preview: async (args) => {
      const label = await lookupEntityLabel("caseStudy", String(args.caseStudyId));
      return {
        title: "Update case study",
        summary: `${label ? `"${label}"` : String(args.caseStudyId)} — ${changeSummary(args, ["caseStudyId", "body"])}`,
      };
    },
    execute: async (args) =>
      unwrapAction(
        updateCaseStudy(args.caseStudyId as string, {
          name: args.name as string | undefined,
          companyName: args.companyName as string | undefined,
          body: args.body as string | undefined,
          technologies: args.technologies as string[] | undefined,
          services: args.services as string[] | undefined,
          publicUrl: args.publicUrl as string | undefined,
        })
      ),
  }),

  defineTool({
    name: "generateCaseStudyText",
    label: "Generate Case Study Copy",
    risk: "read",
    adminOnly: true,
    description:
      "Generate marketing copy for a case study from project details without saving it. Use saveCaseStudyText to persist the result.",
    parameters: {
      properties: {
        name: { type: "string", description: "Case study name" },
        companyName: { type: "string", description: "Client company name" },
        body: { type: "string", description: "Raw project notes" },
        technologies: { type: "array", items: { type: "string" }, description: "Technology values" },
        services: { type: "array", items: { type: "string" }, description: "Service values" },
        publicUrl: { type: "string", description: "Public project URL" },
      },
      required: ["name", "body"],
    },
    execute: async (args) =>
      unwrapAction(
        generateCaseStudyText({
          name: args.name as string,
          companyName: args.companyName as string | undefined,
          body: args.body as string,
          technologies: (args.technologies as string[]) ?? [],
          services: (args.services as string[]) ?? [],
          publicUrl: args.publicUrl as string | undefined,
        })
      ),
  }),

  defineTool({
    name: "saveCaseStudyText",
    label: "Save Case Study Copy",
    risk: "additive",
    description: "Save generated marketing copy onto a case study, replacing any existing copy.",
    parameters: {
      properties: {
        caseStudyId: { type: "string", description: "The case study ID" },
        generatedText: { type: "string", description: "The markdown copy to store" },
      },
      required: ["caseStudyId", "generatedText"],
    },
    preview: async (args) => {
      const label = await lookupEntityLabel("caseStudy", String(args.caseStudyId));
      const text = String(args.generatedText);
      return {
        title: "Save case study copy",
        summary: `Replace the stored copy on ${label ? `"${label}"` : String(args.caseStudyId)} with ${text.length} characters of markdown.`,
        details: { Preview: `${text.slice(0, 300)}${text.length > 300 ? "..." : ""}` },
      };
    },
    execute: async (args) =>
      unwrapAction(
        saveCaseStudyGeneratedText(args.caseStudyId as string, args.generatedText as string)
      ),
  }),

  defineTool({
    name: "deleteCaseStudy",
    label: "Delete Case Study",
    risk: "destructive",
    description: "Permanently delete a case study.",
    parameters: {
      properties: { caseStudyId: { type: "string", description: "The case study ID" } },
      required: ["caseStudyId"],
    },
    preview: deletePreview("caseStudy", "caseStudyId", "case study"),
    execute: async (args) => unwrapAction(deleteCaseStudy(args.caseStudyId as string)),
  }),

  defineTool({
    name: "createOffer",
    label: "Create Offer",
    risk: "additive",
    description: "Create an entry in the offer catalog.",
    parameters: {
      properties: {
        title: { type: "string", description: "Offer title" },
        description: { type: "string", description: "Offer description" },
      },
      required: ["title"],
    },
    preview: async (args) => ({
      title: "Create offer",
      summary: `"${args.title}"`,
      details: { Description: (args.description as string) ?? "—" },
    }),
    execute: async (args) =>
      unwrapAction(
        createOffer({
          title: args.title as string,
          description: args.description as string | undefined,
        })
      ),
  }),

  defineTool({
    name: "updateOffer",
    label: "Update Offer",
    risk: "additive",
    description: "Update an offer's title or description.",
    parameters: {
      properties: {
        offerId: { type: "string", description: "The offer ID" },
        title: { type: "string", description: "New title" },
        description: { type: "string", description: "New description" },
      },
      required: ["offerId"],
    },
    preview: async (args) => {
      const label = await lookupEntityLabel("offer", String(args.offerId));
      return {
        title: "Update offer",
        summary: `${label ? `"${label}"` : String(args.offerId)} — ${changeSummary(args, ["offerId"])}`,
      };
    },
    execute: async (args) =>
      unwrapAction(
        updateOffer(args.offerId as string, {
          title: args.title as string | undefined,
          description: args.description as string | undefined,
        })
      ),
  }),

  defineTool({
    name: "deleteOffer",
    label: "Delete Offer",
    risk: "destructive",
    description: "Permanently delete an offer.",
    parameters: {
      properties: { offerId: { type: "string", description: "The offer ID" } },
      required: ["offerId"],
    },
    preview: deletePreview("offer", "offerId", "offer"),
    execute: async (args) => unwrapAction(deleteOffer(args.offerId as string)),
  }),

  defineTool({
    name: "createPresentation",
    label: "Create Presentation",
    risk: "additive",
    description: "Create a presentation with an array of slide objects.",
    parameters: {
      properties: {
        title: { type: "string", description: "Presentation title" },
        slides: {
          type: "array",
          items: { type: "object" },
          description: "Slide objects in presentation order",
        },
      },
      required: ["title", "slides"],
    },
    preview: async (args) => ({
      title: "Create presentation",
      summary: `"${args.title}" with ${(args.slides as unknown[])?.length ?? 0} slides`,
    }),
    execute: async (args) =>
      unwrapAction(
        createPresentation({
          title: args.title as string,
          slides: (args.slides as unknown[]) ?? [],
        })
      ),
  }),

  defineTool({
    name: "updatePresentation",
    label: "Update Presentation",
    risk: "additive",
    description:
      "Replace a presentation's title and slides. The slides array overwrites the existing deck entirely.",
    parameters: {
      properties: {
        presentationId: { type: "string", description: "The presentation ID" },
        title: { type: "string", description: "New title" },
        slides: {
          type: "array",
          items: { type: "object" },
          description: "The complete new slide array",
        },
      },
      required: ["presentationId", "title", "slides"],
    },
    preview: async (args) => {
      const label = await lookupEntityLabel("presentation", String(args.presentationId));
      return {
        title: "Update presentation",
        summary: `${label ? `"${label}"` : String(args.presentationId)} will be replaced with "${args.title}" (${(args.slides as unknown[])?.length ?? 0} slides).`,
      };
    },
    execute: async (args) =>
      unwrapAction(
        updatePresentation(args.presentationId as string, {
          title: args.title as string,
          slides: (args.slides as unknown[]) ?? [],
        })
      ),
  }),

  defineTool({
    name: "deletePresentation",
    label: "Delete Presentation",
    risk: "destructive",
    description: "Permanently delete a presentation.",
    parameters: {
      properties: { presentationId: { type: "string", description: "The presentation ID" } },
      required: ["presentationId"],
    },
    preview: deletePreview("presentation", "presentationId", "presentation"),
    execute: async (args) =>
      unwrapAction(deletePresentation(args.presentationId as string)),
  }),

  defineTool({
    name: "deleteFormSubmission",
    label: "Delete Form Submission",
    risk: "destructive",
    description: "Permanently delete a marketing form submission (lead).",
    parameters: {
      properties: { submissionId: { type: "string", description: "The submission ID" } },
      required: ["submissionId"],
    },
    preview: async (args) => ({
      title: "Delete form submission",
      summary: `Lead ${args.submissionId} will be permanently deleted. This cannot be undone.`,
    }),
    execute: async (args) =>
      unwrapAction(deleteFormSubmission(args.submissionId as string)),
  }),
];
