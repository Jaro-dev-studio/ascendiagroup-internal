"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Save, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { createCaseStudy } from "@/lib/actions";

const technologies = [
  { value: "NEXTJS_APP_ROUTER", label: "Next.js App Router" },
  { value: "JAVASCRIPT", label: "JavaScript" },
  { value: "TYPESCRIPT", label: "TypeScript" },
  { value: "REACT", label: "React" },
  { value: "TAILWIND_CSS", label: "Tailwind CSS" },
  { value: "PLANETSCALE", label: "Planetscale" },
  { value: "VERCEL", label: "Vercel" },
  { value: "PRISMA", label: "Prisma" },
  { value: "GOOGLE_CLOUD_FUNCTIONS", label: "Google Cloud Functions" },
  { value: "UNIT_TESTING", label: "Unit Testing" },
  { value: "PLAYWRIGHT", label: "Playwright" },
  { value: "PUPPETEER", label: "Puppeteer" },
  { value: "MONGODB", label: "MongoDB" },
  { value: "NEON_POSTGRES", label: "Neon Postgres" },
  { value: "CHATGPT", label: "ChatGPT" },
  { value: "CLAUDE", label: "Claude" },
];

const services = [
  { value: "SCRAPING", label: "Scraping" },
  { value: "INTERNAL_WEB_APPLICATION", label: "Internal Web Application" },
  { value: "SAAS", label: "SaaS" },
  { value: "PWA", label: "PWA" },
  { value: "ARCHITECTURE_CONSULTING", label: "Architecture Consulting" },
  { value: "ETL", label: "ETL" },
  { value: "AUTOMATION", label: "Automation" },
  { value: "AI_INTEGRATION", label: "AI Integration" },
  { value: "UI_UX_DESIGN", label: "UI/UX Design" },
  { value: "CI_CD_INFRASTRUCTURE_SETUP", label: "CI/CD & Infrastructure Setup" },
];

export function NewCaseStudyClient() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    companyName: "",
    body: "",
    technologies: [] as string[],
    services: [] as string[],
    publicUrl: "",
  });

  const handleTechnologyChange = (techValue: string, checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      technologies: checked
        ? [...prev.technologies, techValue]
        : prev.technologies.filter(t => t !== techValue)
    }));
  };

  const handleServiceChange = (serviceValue: string, checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      services: checked
        ? [...prev.services, serviceValue]
        : prev.services.filter(s => s !== serviceValue)
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim() || !formData.body.trim()) {
      alert("Please fill in the required fields (Name and Body)");
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await createCaseStudy({
        name: formData.name.trim(),
        companyName: formData.companyName.trim() || undefined,
        body: formData.body.trim(),
        technologies: formData.technologies,
        services: formData.services,
        publicUrl: formData.publicUrl.trim() || undefined,
      });

      if (result.error) {
        alert(result.error);
        return;
      }

      router.push("/dashboard/case-studies");
    } catch (error) {
      console.error("Error creating case study:", error);
      alert("Failed to create case study");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/dashboard/case-studies">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="size-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-secondary-900">New Case Study</h1>
          <p className="text-secondary-600">Create a new case study to showcase your work</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Information */}
        <Card className="p-6">
          <h2 className="mb-4 text-lg font-semibold text-secondary-900">Basic Information</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">Case Study Name *</Label>
              <Input
                id="name"
                placeholder="e.g., E-commerce Platform Redesign"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="companyName">Company Name</Label>
              <Input
                id="companyName"
                placeholder="e.g., Acme Corp"
                value={formData.companyName}
                onChange={(e) => setFormData(prev => ({ ...prev, companyName: e.target.value }))}
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="publicUrl">Public URL</Label>
              <Input
                id="publicUrl"
                type="url"
                placeholder="https://example.com"
                value={formData.publicUrl}
                onChange={(e) => setFormData(prev => ({ ...prev, publicUrl: e.target.value }))}
              />
            </div>
          </div>
        </Card>

        {/* Case Study Body */}
        <Card className="p-6">
          <h2 className="mb-4 text-lg font-semibold text-secondary-900">Case Study Description *</h2>
          <Textarea
            placeholder="Describe the project, challenges, solutions, and outcomes..."
            className="min-h-[200px]"
            value={formData.body}
            onChange={(e) => setFormData(prev => ({ ...prev, body: e.target.value }))}
            required
          />
        </Card>

        {/* Technologies */}
        <Card className="p-6">
          <h2 className="mb-4 text-lg font-semibold text-secondary-900">Technologies Used</h2>
          <p className="mb-4 text-sm text-secondary-600">Select all technologies that were used in this project</p>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
            {technologies.map((tech) => (
              <label
                key={tech.value}
                className={`flex cursor-pointer items-center gap-2 rounded-md border p-2 transition-colors ${
                  formData.technologies.includes(tech.value)
                    ? "border-primary-500 bg-primary-50 text-primary-700"
                    : "border-secondary-200 text-secondary-700 hover:border-secondary-300 hover:bg-secondary-100"
                }`}
              >
                <input
                  type="checkbox"
                  className="size-4 rounded border-secondary-300 text-primary-600 focus:ring-primary-500"
                  checked={formData.technologies.includes(tech.value)}
                  onChange={(e) => handleTechnologyChange(tech.value, e.target.checked)}
                />
                <span className="text-sm">{tech.label}</span>
              </label>
            ))}
          </div>
        </Card>

        {/* Services Provided */}
        <Card className="p-6">
          <h2 className="mb-4 text-lg font-semibold text-secondary-900">Services Provided</h2>
          <p className="mb-4 text-sm text-secondary-600">Select all services that were provided for this project</p>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
            {services.map((service) => (
              <label
                key={service.value}
                className={`flex cursor-pointer items-center gap-2 rounded-md border p-2 transition-colors ${
                  formData.services.includes(service.value)
                    ? "border-primary-500 bg-primary-50 text-primary-700"
                    : "border-secondary-200 text-secondary-700 hover:border-secondary-300 hover:bg-secondary-100"
                }`}
              >
                <input
                  type="checkbox"
                  className="size-4 rounded border-secondary-300 text-primary-600 focus:ring-primary-500"
                  checked={formData.services.includes(service.value)}
                  onChange={(e) => handleServiceChange(service.value, e.target.checked)}
                />
                <span className="text-sm">{service.label}</span>
              </label>
            ))}
          </div>
        </Card>

        {/* Submit Button */}
        <div className="flex items-center justify-end gap-3">
          <Link href="/dashboard/case-studies">
            <Button type="button" variant="outline">
              Cancel
            </Button>
          </Link>
          <Button type="submit" disabled={isSubmitting} className="relative">
            <span className={isSubmitting ? "opacity-0" : "flex items-center"}>
              <Save className="mr-2 size-4" />
              Create Case Study
            </span>
            {isSubmitting && (
              <span className="absolute inset-0 flex items-center justify-center">
                <Loader2 className="size-4 animate-spin" />
              </span>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
