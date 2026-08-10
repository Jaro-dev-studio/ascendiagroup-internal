"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, MoreHorizontal, Edit, Trash2, Eye, FileText, ExternalLink, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { deleteCaseStudy } from "@/lib/actions";
import { CaseStudy } from "@prisma/client";

interface CaseStudyWithClient extends CaseStudy {
  clientCompany: {
    id: string;
    name: string;
  } | null;
}

interface CaseStudiesClientProps {
  caseStudies: CaseStudyWithClient[];
}

const technologyLabels: Record<string, string> = {
  NEXTJS_APP_ROUTER: "Next.js App Router",
  JAVASCRIPT: "JavaScript",
  TYPESCRIPT: "TypeScript",
  REACT: "React",
  TAILWIND_CSS: "Tailwind CSS",
  PLANETSCALE: "Planetscale",
  VERCEL: "Vercel",
  PRISMA: "Prisma",
  GOOGLE_CLOUD_FUNCTIONS: "Google Cloud Functions",
  UNIT_TESTING: "Unit Testing",
  PLAYWRIGHT: "Playwright",
  PUPPETEER: "Puppeteer",
  MONGODB: "MongoDB",
  NEON_POSTGRES: "Neon Postgres",
  CHATGPT: "ChatGPT",
  CLAUDE: "Claude",
};

const serviceLabels: Record<string, string> = {
  SCRAPING: "Scraping",
  INTERNAL_WEB_APPLICATION: "Internal Web Application",
  SAAS: "SaaS",
  PWA: "PWA",
  ARCHITECTURE_CONSULTING: "Architecture Consulting",
  ETL: "ETL",
  AUTOMATION: "Automation",
  AI_INTEGRATION: "AI Integration",
  UI_UX_DESIGN: "UI/UX Design",
  CI_CD_INFRASTRUCTURE_SETUP: "CI/CD & Infrastructure Setup",
};

export function CaseStudiesClient({ caseStudies: initialCaseStudies }: CaseStudiesClientProps) {
  const [caseStudies, setCaseStudies] = useState<CaseStudyWithClient[]>(initialCaseStudies);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  const handleDeleteCaseStudy = async (caseStudyId: string) => {
    if (!confirm("Are you sure you want to delete this case study? This action cannot be undone.")) {
      return;
    }

    setIsDeleting(caseStudyId);
    try {
      const result = await deleteCaseStudy(caseStudyId);
      if (result.error) {
        console.error(result.error);
        return;
      }

      setCaseStudies(caseStudies.filter(cs => cs.id !== caseStudyId));
    } catch (error) {
      console.error("Error deleting case study:", error);
    } finally {
      setIsDeleting(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-secondary-900">Case Studies</h1>
          <p className="text-secondary-600">Showcase your completed projects and success stories</p>
        </div>
        <Link href="/dashboard/case-studies/new">
          <Button size="sm" className="sm:size-default">
            <Plus className="mr-2 size-4" />
            New Case Study
          </Button>
        </Link>
      </div>

      {caseStudies.length === 0 ? (
        <Card className="p-8 text-center">
          <FileText className="mx-auto size-12 text-secondary-400" />
          <h3 className="mt-4 text-lg font-medium text-secondary-900">No case studies yet</h3>
          <p className="mt-2 text-secondary-600">Get started by creating your first case study</p>
          <Link href="/dashboard/case-studies/new">
            <Button className="mt-4">
              <Plus className="mr-2 size-4" />
              Create Case Study
            </Button>
          </Link>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {caseStudies.map((caseStudy) => (
            <Card key={caseStudy.id} className="p-6">
              <div className="flex items-start justify-between">
                <div className="min-w-0 flex-1">
                  <h3 className="truncate font-semibold text-secondary-900">
                    {caseStudy.name}
                  </h3>
                  {caseStudy.companyName && (
                    <p className="truncate text-sm text-secondary-600">
                      {caseStudy.companyName}
                    </p>
                  )}
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="size-8">
                      <MoreHorizontal className="size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem asChild>
                      <Link href={`/dashboard/case-studies/${caseStudy.id}`}>
                        <Eye className="mr-2 size-4" />
                        View Details
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href={`/dashboard/case-studies/${caseStudy.id}`}>
                        <Edit className="mr-2 size-4" />
                        Edit
                      </Link>
                    </DropdownMenuItem>
                    {caseStudy.publicUrl && (
                      <DropdownMenuItem asChild>
                        <a href={caseStudy.publicUrl} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="mr-2 size-4" />
                          Visit Site
                        </a>
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem 
                      onClick={() => handleDeleteCaseStudy(caseStudy.id)}
                      disabled={isDeleting === caseStudy.id}
                      className="text-danger-600 focus:text-danger-600"
                    >
                      <Trash2 className="mr-2 size-4" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <div className="mt-4 space-y-3">
                {/* Technologies */}
                {caseStudy.technologies.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {caseStudy.technologies.slice(0, 3).map((tech) => (
                      <Badge key={tech} variant="secondary" className="text-xs">
                        {technologyLabels[tech] || tech}
                      </Badge>
                    ))}
                    {caseStudy.technologies.length > 3 && (
                      <Badge variant="outline" className="text-xs">
                        +{caseStudy.technologies.length - 3} more
                      </Badge>
                    )}
                  </div>
                )}

                {/* Services */}
                {caseStudy.services.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {caseStudy.services.slice(0, 2).map((service) => (
                      <Badge key={service} className="bg-primary-100 text-xs text-primary-800">
                        {serviceLabels[service] || service}
                      </Badge>
                    ))}
                    {caseStudy.services.length > 2 && (
                      <Badge variant="outline" className="text-xs">
                        +{caseStudy.services.length - 2} more
                      </Badge>
                    )}
                  </div>
                )}
              </div>

              <div className="mt-4 border-t border-secondary-200 pt-4">
                <p className="text-xs text-secondary-500">
                  Created {new Date(caseStudy.createdAt).toLocaleDateString()}
                </p>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
