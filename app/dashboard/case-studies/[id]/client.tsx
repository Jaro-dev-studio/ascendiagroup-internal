"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Save, Loader2, Trash2, ExternalLink, Edit, X, Sparkles, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { updateCaseStudy, deleteCaseStudy, generateCaseStudyText, saveCaseStudyGeneratedText } from "@/lib/actions";
import { CaseStudy } from "@prisma/client";
import ReactMarkdown from "react-markdown";

interface CaseStudyDetailsClientProps {
  caseStudy: CaseStudy;
}

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

const technologyLabels: Record<string, string> = Object.fromEntries(
  technologies.map(t => [t.value, t.label])
);

const serviceLabels: Record<string, string> = Object.fromEntries(
  services.map(s => [s.value, s.label])
);

export function CaseStudyDetailsClient({ caseStudy }: CaseStudyDetailsClientProps) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSavingGenerated, setIsSavingGenerated] = useState(false);
  const [formData, setFormData] = useState({
    name: caseStudy.name,
    companyName: caseStudy.companyName || "",
    body: caseStudy.body,
    technologies: caseStudy.technologies as string[],
    services: caseStudy.services as string[],
    publicUrl: caseStudy.publicUrl || "",
  });
  const [generatedText, setGeneratedText] = useState(caseStudy.generatedText || "");
  const [showGeneratedPreview, setShowGeneratedPreview] = useState(true);

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

  const handleGenerate = async () => {
    if (generatedText && !confirm("This will overwrite the existing generated text. Continue?")) {
      return;
    }

    if (!formData.name.trim() || !formData.body.trim()) {
      alert("Please fill in the Name and Description first before generating");
      return;
    }

    setIsGenerating(true);
    try {
      const result = await generateCaseStudyText({
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

      if (result.data) {
        setGeneratedText(result.data);
        setShowGeneratedPreview(true);
      }
    } catch (error) {
      console.error("Error generating case study text:", error);
      alert("Failed to generate case study text");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSaveGeneratedText = async () => {
    setIsSavingGenerated(true);
    try {
      const result = await saveCaseStudyGeneratedText(caseStudy.id, generatedText);
      if (result.error) {
        alert(result.error);
        return;
      }
      alert("Generated text saved successfully!");
    } catch (error) {
      console.error("Error saving generated text:", error);
      alert("Failed to save generated text");
    } finally {
      setIsSavingGenerated(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim() || !formData.body.trim()) {
      alert("Please fill in the required fields (Name and Body)");
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await updateCaseStudy(caseStudy.id, {
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

      // Also save generated text if it was modified
      if (generatedText !== caseStudy.generatedText) {
        await saveCaseStudyGeneratedText(caseStudy.id, generatedText);
      }

      setIsEditing(false);
      router.refresh();
    } catch (error) {
      console.error("Error updating case study:", error);
      alert("Failed to update case study");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this case study? This action cannot be undone.")) {
      return;
    }

    setIsDeleting(true);
    try {
      const result = await deleteCaseStudy(caseStudy.id);
      if (result.error) {
        alert(result.error);
        return;
      }

      router.push("/dashboard/case-studies");
    } catch (error) {
      console.error("Error deleting case study:", error);
      alert("Failed to delete case study");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCancel = () => {
    setFormData({
      name: caseStudy.name,
      companyName: caseStudy.companyName || "",
      body: caseStudy.body,
      technologies: caseStudy.technologies as string[],
      services: caseStudy.services as string[],
      publicUrl: caseStudy.publicUrl || "",
    });
    setGeneratedText(caseStudy.generatedText || "");
    setIsEditing(false);
  };

  // View Mode
  if (!isEditing) {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/dashboard/case-studies">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="size-4" />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-secondary-900">{caseStudy.name}</h1>
              {caseStudy.companyName && (
                <p className="text-secondary-600">{caseStudy.companyName}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {caseStudy.publicUrl && (
              <a href={caseStudy.publicUrl} target="_blank" rel="noopener noreferrer">
                <Button variant="outline">
                  <ExternalLink className="mr-2 size-4" />
                  Visit Site
                </Button>
              </a>
            )}
            <Button variant="outline" onClick={() => setIsEditing(true)}>
              <Edit className="mr-2 size-4" />
              Edit
            </Button>
            <Button 
              variant="outline" 
              onClick={handleDelete}
              disabled={isDeleting}
              className="text-danger-600 hover:bg-danger-50 hover:text-danger-700"
            >
              {isDeleting ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <Trash2 className="mr-2 size-4" />
              )}
              Delete
            </Button>
          </div>
        </div>

        {/* Generated Text - Show prominently if it exists */}
        {caseStudy.generatedText && (
          <Card className="p-6">
            <h2 className="mb-4 text-lg font-semibold text-secondary-900">Generated Case Study</h2>
            <div className="prose prose-sm max-w-none text-secondary-700">
              <ReactMarkdown>{caseStudy.generatedText}</ReactMarkdown>
            </div>
          </Card>
        )}

        {/* Details */}
        <Card className="p-6">
          <h2 className="mb-4 text-lg font-semibold text-secondary-900">Description</h2>
          <div className="prose max-w-none whitespace-pre-wrap text-secondary-700">
            {caseStudy.body}
          </div>
        </Card>

        {/* Technologies */}
        {caseStudy.technologies.length > 0 && (
          <Card className="p-6">
            <h2 className="mb-4 text-lg font-semibold text-secondary-900">Technologies Used</h2>
            <div className="flex flex-wrap gap-2">
              {caseStudy.technologies.map((tech) => (
                <Badge key={tech} variant="secondary">
                  {technologyLabels[tech] || tech}
                </Badge>
              ))}
            </div>
          </Card>
        )}

        {/* Services */}
        {caseStudy.services.length > 0 && (
          <Card className="p-6">
            <h2 className="mb-4 text-lg font-semibold text-secondary-900">Services Provided</h2>
            <div className="flex flex-wrap gap-2">
              {caseStudy.services.map((service) => (
                <Badge key={service} className="bg-primary-100 text-primary-800">
                  {serviceLabels[service] || service}
                </Badge>
              ))}
            </div>
          </Card>
        )}

        {/* Metadata */}
        <Card className="p-6">
          <h2 className="mb-4 text-lg font-semibold text-secondary-900">Details</h2>
          <div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
            <div>
              <p className="text-secondary-500">Created</p>
              <p className="font-medium text-secondary-900">
                {new Date(caseStudy.createdAt).toLocaleDateString()}
              </p>
            </div>
            <div>
              <p className="text-secondary-500">Last Updated</p>
              <p className="font-medium text-secondary-900">
                {new Date(caseStudy.updatedAt).toLocaleDateString()}
              </p>
            </div>
            {caseStudy.publicUrl && (
              <div className="col-span-2">
                <p className="text-secondary-500">Public URL</p>
                <a 
                  href={caseStudy.publicUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="font-medium text-primary-600 hover:underline"
                >
                  {caseStudy.publicUrl}
                </a>
              </div>
            )}
          </div>
        </Card>
      </div>
    );
  }

  // Edit Mode
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={handleCancel}>
          <ArrowLeft className="size-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-secondary-900">Edit Case Study</h1>
          <p className="text-secondary-600">Update the case study details</p>
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

        {/* AI Generated Case Study */}
        <Card className="p-6">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-secondary-900">AI Generated Case Study</h2>
              <p className="text-sm text-secondary-600">Generate marketing copy using AI based on the information above</p>
            </div>
            <div className="flex items-center gap-2">
              {generatedText && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowGeneratedPreview(!showGeneratedPreview)}
                >
                  {showGeneratedPreview ? "Edit Raw" : "Preview"}
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                onClick={handleGenerate}
                disabled={isGenerating}
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" />
                    Generating...
                  </>
                ) : generatedText ? (
                  <>
                    <RefreshCw className="mr-2 size-4" />
                    Regenerate
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 size-4" />
                    Generate Case Study
                  </>
                )}
              </Button>
            </div>
          </div>

          {generatedText ? (
            <div className="space-y-4">
              {showGeneratedPreview ? (
                <div className="rounded-lg border border-secondary-200 bg-secondary-50 p-4">
                  <div className="prose prose-sm max-w-none text-secondary-700">
                    <ReactMarkdown>{generatedText}</ReactMarkdown>
                  </div>
                </div>
              ) : (
                <Textarea
                  value={generatedText}
                  onChange={(e) => setGeneratedText(e.target.value)}
                  className="min-h-[400px] font-mono text-sm"
                  placeholder="Generated case study text will appear here..."
                />
              )}
              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleSaveGeneratedText}
                  disabled={isSavingGenerated || generatedText === caseStudy.generatedText}
                >
                  {isSavingGenerated ? (
                    <>
                      <Loader2 className="mr-2 size-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 size-4" />
                      Save Generated Text
                    </>
                  )}
                </Button>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border-2 border-dashed border-secondary-200 p-8 text-center">
              <Sparkles className="mx-auto size-12 text-secondary-400" />
              <p className="mt-4 text-secondary-600">
                Click &quot;Generate Case Study&quot; to create marketing copy using AI.
              </p>
              <p className="mt-2 text-sm text-secondary-500">
                Make sure to fill in the name, description, technologies, and services first.
              </p>
            </div>
          )}
        </Card>

        {/* Submit Buttons */}
        <div className="flex items-center justify-end gap-3">
          <Button type="button" variant="outline" onClick={handleCancel}>
            <X className="mr-2 size-4" />
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting} className="relative">
            <span className={isSubmitting ? "opacity-0" : "flex items-center"}>
              <Save className="mr-2 size-4" />
              Save Changes
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
