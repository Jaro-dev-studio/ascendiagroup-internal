import { NextResponse } from "next/server";
import OpenAI from "openai";
import { z } from "zod";
import prisma from "@/lib/prisma";

export const maxDuration = 60;

const openai = new OpenAI();

const RequestSchema = z.object({
  contractId: z.string(),
  documentType: z.enum([
    "FIT_ANALYSIS",
    "CALL_SCRIPT",
    "SOURCES_SOUGHT_RESPONSE",
    "CAPABILITY_STATEMENT",
    "TECHNICAL_PROPOSAL",
    "PAST_PERFORMANCE",
    "MANAGEMENT_APPROACH",
    "COVER_LETTER",
  ]),
  additionalContext: z.string().optional(),
});

const JARO_DEV_KNOWLEDGE = `
# About Jaro.dev

## Company Overview
Jaro.dev is a software development agency specializing in rapid MVP (Minimum Viable Product) development. We help founders, startups, and companies go from idea to production-ready product in a fraction of the normal time, with guarantees that reduce risk for the client.

## Core Services
- **Full-Stack Web Application Development**: End-to-end development of modern web applications
- **MVP Development**: Rapid prototyping and MVP delivery in 2-4 weeks
- **Internal Web Applications**: Custom internal tools and dashboards
- **AI/ML Integration**: Building AI-powered features and chatbots into applications
- **API Development & Integration**: Third-party API integrations and custom API development
- **Web Scraping & Automation**: Data extraction and workflow automation solutions
- **Database Design & Architecture**: Scalable database solutions with PostgreSQL
- **Cloud Infrastructure**: Deployment on Vercel, AWS, and modern cloud platforms

## Technology Stack
- **Frontend**: React, Next.js (App Router), TypeScript, Tailwind CSS
- **Backend**: Node.js, Next.js Server Actions, REST APIs
- **Database**: PostgreSQL, Prisma ORM
- **AI/ML**: OpenAI GPT integration, custom AI workflows
- **Infrastructure**: Vercel, AWS, Docker
- **Authentication**: NextAuth.js, OAuth
- **Real-time**: WebSockets, Server-Sent Events
- **Payment Processing**: Stripe integration
- **Communication**: Slack API integration, email automation

## Key Differentiators
1. **Speed**: MVP delivery in 2-4 weeks vs industry standard of 3-6 months
2. **Fixed-Price Guarantees**: Transparent pricing with no hidden costs
3. **Risk Reduction**: Iterative delivery with regular demos and feedback cycles
4. **Senior Engineers Only**: All development done by experienced full-stack engineers
5. **Modern Tech Stack**: Exclusively using cutting-edge, production-proven technologies
6. **End-to-End Delivery**: From design to deployment, including CI/CD setup

## Past Performance Areas
- SaaS platform development for startups
- Internal tools and dashboards for enterprises
- AI-powered web applications
- Data pipeline and automation solutions
- E-commerce and marketplace platforms
- Customer-facing portals and dashboards
- Real-time collaboration tools
- Form builders and workflow automation

## Team & Management
- Small, elite team of senior full-stack engineers
- Direct communication with developers (no middlemen)
- Agile methodology with weekly sprints and demos
- Dedicated project management and QA processes
- 24/7 support during critical phases

## Quality Assurance
- Comprehensive testing (unit, integration, E2E)
- Code review processes
- Performance optimization
- Security best practices (OWASP compliance)
- Accessibility standards (WCAG 2.1)
- Mobile-responsive design

## NAICS Codes Relevant to Jaro.dev
- 541512: Computer Systems Design Services
- 541511: Custom Computer Programming Services
- 541519: Other Computer Related Services
- 518210: Data Processing, Hosting, and Related Services
- 541513: Computer Facilities Management Services
`;

const DOCUMENT_PROMPTS: Record<string, string> = {
  FIT_ANALYSIS: `You are analyzing a government contract opportunity for Jaro.dev to determine if it's a good fit.

Evaluate the opportunity against Jaro.dev's capabilities and provide:
1. **Fit Score** (1-10) with justification
2. **Strengths**: Areas where Jaro.dev is a strong match
3. **Gaps/Risks**: Areas where there may be challenges
4. **Recommendation**: GO or NO-GO with rationale
5. **Key Requirements Match**: Map the opportunity requirements to Jaro.dev's capabilities
6. **Competitive Positioning**: How Jaro.dev would differentiate against larger contractors
7. **Resource Assessment**: Whether current team can support this contract

Be direct, analytical, and honest about gaps.`,

  CALL_SCRIPT: `You are preparing a call script for reaching out to the government point of contact for this opportunity.

Generate a professional, thorough call script that includes:
1. **Introduction**: Professional opening identifying yourself as representing Jaro.dev
2. **Purpose Statement**: Clear reason for the call
3. **Discovery Questions**: 10-15 strategic questions to ask, organized by category:
   - Technical requirements and scope
   - Timeline and milestones
   - Evaluation criteria and priorities
   - Incumbent information
   - Small business goals
   - Budget expectations
   - Past performance requirements
4. **Jaro.dev Talking Points**: Key strengths to mention relevant to this opportunity
5. **Demo Offer**: Offer to demonstrate relevant past work
6. **Follow-up**: Confirm next steps and request for follow-up meeting
7. **Closing**: Professional closing with contact information

Make the script conversational but professional. Include notes on what to listen for.`,

  SOURCES_SOUGHT_RESPONSE: `You are writing a Sources Sought / RFI response for Jaro.dev.

Generate a complete, professional response with these sections:
1. **Cover Page**: Company name, DUNS/UEI, CAGE code placeholder, POC info
2. **Company Overview**: Brief description of Jaro.dev and its capabilities
3. **Relevant Experience**: 3-4 past performance examples (anonymized) demonstrating relevant capabilities
4. **Technical Capability**: Detailed description of technical approach and methodologies
5. **Key Personnel**: Description of team qualifications and experience
6. **Small Business Status**: Size standard, certifications, set-aside eligibility
7. **Interest Statement**: Clear statement of interest and capability
8. **Questions/Recommendations**: Thoughtful questions or suggestions for the solicitation

Format as a professional document ready for submission. Use placeholder brackets [PLACEHOLDER] for information that needs to be filled in.`,

  CAPABILITY_STATEMENT: `You are creating a Capability Statement for Jaro.dev tailored to this specific government opportunity.

Generate a one-page style capability statement with:
1. **Core Competencies**: 4-6 bullet points of key capabilities relevant to this opportunity
2. **Past Performance**: 3 brief project summaries with results/metrics
3. **Differentiators**: What sets Jaro.dev apart for this specific work
4. **Company Data**: NAICS codes, size standard, certifications (use placeholders)
5. **Contact Information**: Placeholder for company contact details

Keep it concise, impactful, and tailored to the specific opportunity requirements.`,

  TECHNICAL_PROPOSAL: `You are writing a Technical Proposal / Technical Approach for Jaro.dev.

Generate a detailed technical proposal with:
1. **Technical Understanding**: Demonstrate understanding of the requirement
2. **Technical Approach**: Detailed methodology and approach
   - Development methodology (Agile/Scrum)
   - Technology stack and justification
   - Architecture overview
   - Integration approach
3. **Work Breakdown Structure**: Major phases and tasks
4. **Schedule/Timeline**: Proposed timeline with milestones
5. **Risk Identification & Mitigation**: Key risks and mitigation strategies
6. **Quality Assurance Plan**: Testing and QA approach
7. **Security Approach**: Security measures and compliance
8. **Transition Plan**: How work would be transitioned at contract end

Be specific, detailed, and demonstrate expertise. Reference relevant technologies and methodologies.`,

  PAST_PERFORMANCE: `You are writing a Past Performance narrative for Jaro.dev.

Generate 3-4 detailed past performance examples (anonymized as needed):
For each project include:
1. **Contract/Project Title**: Descriptive name
2. **Client**: Type of organization (use generic descriptions)
3. **Period of Performance**: Approximate dates
4. **Contract Value**: Approximate range
5. **Description of Work**: What was delivered
6. **Relevance**: How this relates to the current opportunity
7. **Key Outcomes**: Metrics and results achieved
8. **Challenges Overcome**: Technical or programmatic challenges and solutions
9. **Client Satisfaction**: Reference to positive outcomes

Focus on projects most relevant to the specific government opportunity requirements.`,

  MANAGEMENT_APPROACH: `You are writing a Management Approach section for Jaro.dev's proposal.

Generate a comprehensive management approach covering:
1. **Organizational Structure**: Team structure and roles
2. **Key Personnel**: Descriptions of key team members and qualifications
3. **Communication Plan**: How communication with the government will be managed
4. **Project Management Methodology**: Agile approach, sprint cycles, reporting
5. **Staffing Plan**: How the team will be assembled and maintained
6. **Subcontracting Plan**: If applicable
7. **Quality Control**: Quality management processes
8. **Progress Reporting**: Types and frequency of reports
9. **Issue Resolution**: Escalation procedures and problem-solving approach
10. **Continuous Improvement**: How lessons learned will be incorporated

Emphasize Jaro.dev's lean, efficient approach and direct access to senior engineers.`,

  COVER_LETTER: `You are writing a Cover Letter / Executive Summary for Jaro.dev's proposal.

Generate a compelling cover letter that includes:
1. **Attention line**: To the contracting officer
2. **Reference**: Solicitation number and title
3. **Opening**: Strong opening statement of interest and qualification
4. **Value Proposition**: Why Jaro.dev is the best choice (2-3 paragraphs)
5. **Key Highlights**: 3-4 bullet points of most compelling qualifications
6. **Compliance Statement**: Statement of compliance with all requirements
7. **Closing**: Professional closing with enthusiasm and contact information

Keep it to one page, compelling, and tailored to the specific opportunity.`,
};

export async function POST(req: Request) {
  try {
    console.log("[Gov Docs] Received document generation request");

    const body = await req.json();
    const parsed = RequestSchema.safeParse(body);

    if (!parsed.success) {
      console.log("[Gov Docs] Invalid request:", parsed.error);
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { contractId, documentType, additionalContext } = parsed.data;

    console.log("[Gov Docs] Fetching contract details:", contractId);

    const contract = await prisma.govContract.findUnique({
      where: { id: contractId },
      include: { contacts: true },
    });

    if (!contract) {
      console.log("[Gov Docs] Contract not found:", contractId);
      return NextResponse.json({ error: "Contract not found" }, { status: 404 });
    }

    console.log("[Gov Docs] Generating document type:", documentType);

    const contractContext = `
## Contract Details
- **Title**: ${contract.title}
- **Agency**: ${contract.agency}${contract.subAgency ? ` / ${contract.subAgency}` : ""}
- **Solicitation Number**: ${contract.solicitationNumber || "N/A"}
- **NAICS Code**: ${contract.naicsCode || "N/A"}
- **Set-Aside Type**: ${contract.setAsideType || "N/A"}
- **Estimated Value**: ${contract.estimatedValue ? `$${contract.estimatedValue.toLocaleString()}` : "N/A"}
- **Response Deadline**: ${contract.responseDeadline ? new Date(contract.responseDeadline).toLocaleDateString() : "N/A"}
- **Place of Performance**: ${contract.placeOfPerformance || "N/A"}
- **Description**: ${contract.description || "N/A"}
- **Current Status**: ${contract.status}

## Points of Contact
${contract.contacts.length > 0
      ? contract.contacts.map((c) => `- ${c.name} (${c.role})${c.email ? ` - ${c.email}` : ""}${c.phone ? ` - ${c.phone}` : ""}${c.organization ? ` - ${c.organization}` : ""}`).join("\n")
      : "No contacts added yet"}
`;

    const documentPrompt = DOCUMENT_PROMPTS[documentType];

    const systemPrompt = `${JARO_DEV_KNOWLEDGE}\n\n${documentPrompt}\n\n${contractContext}`;

    const userMessage = additionalContext
      ? `Generate the ${documentType.replace(/_/g, " ").toLowerCase()} for this opportunity. Additional context/requirements: ${additionalContext}`
      : `Generate the ${documentType.replace(/_/g, " ").toLowerCase()} for this opportunity.`;

    console.log("[Gov Docs] Calling OpenAI API...");

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      temperature: 0.7,
      max_tokens: 4096,
    });

    const content = response.choices[0]?.message?.content;

    if (!content) {
      console.error("[Gov Docs] No content in OpenAI response");
      return NextResponse.json({ error: "No content generated" }, { status: 500 });
    }

    console.log("[Gov Docs] Document generated successfully, length:", content.length);

    return NextResponse.json({ content });
  } catch (error) {
    console.error("[Gov Docs] Error generating document:", error);
    return NextResponse.json(
      { error: "Failed to generate document" },
      { status: 500 }
    );
  }
}
