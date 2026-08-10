"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { updateCompanyCrmFields } from "@/lib/actions/crm";

const NONE = "__none__";

const companySchema = z.object({
  name: z.string().min(1, "Company name is required"),
  domain: z.string().optional(),
  website: z.string().optional(),
  industry: z.string().optional(),
  employeeCount: z.string().optional(),
  linkedinUrl: z.string().optional(),
  description: z.string().optional(),
  ownerId: z.string().optional(),
});

type CompanyFormData = z.infer<typeof companySchema>;

export interface CompanyModalRecord {
  id: string;
  name: string;
  domain: string | null;
  website: string | null;
  industry: string | null;
  employeeCount: number | null;
  linkedinUrl: string | null;
  description: string | null;
  ownerId: string | null;
}

interface CrmCompanyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  owners: Array<{
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
  }>;
  company: CompanyModalRecord;
}

function ownerLabel(owner: {
  email: string;
  firstName: string | null;
  lastName: string | null;
}): string {
  const name = [owner.firstName, owner.lastName].filter(Boolean).join(" ");
  return name || owner.email;
}

export function CrmCompanyModal({
  isOpen,
  onClose,
  onSuccess,
  owners,
  company,
}: CrmCompanyModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<CompanyFormData>({
    resolver: zodResolver(companySchema),
    defaultValues: {
      name: company.name,
      domain: company.domain ?? "",
      website: company.website ?? "",
      industry: company.industry ?? "",
      employeeCount:
        company.employeeCount === null ? "" : String(company.employeeCount),
      linkedinUrl: company.linkedinUrl ?? "",
      description: company.description ?? "",
      ownerId: company.ownerId ?? NONE,
    },
  });

  useEffect(() => {
    if (!isOpen) return;

    form.reset({
      name: company.name,
      domain: company.domain ?? "",
      website: company.website ?? "",
      industry: company.industry ?? "",
      employeeCount:
        company.employeeCount === null ? "" : String(company.employeeCount),
      linkedinUrl: company.linkedinUrl ?? "",
      description: company.description ?? "",
      ownerId: company.ownerId ?? NONE,
    });
    setError(null);
  }, [isOpen, company, form]);

  const onSubmit = async (data: CompanyFormData) => {
    setIsLoading(true);
    setError(null);

    const employeeCount = data.employeeCount ? Number(data.employeeCount) : null;
    if (employeeCount !== null && Number.isNaN(employeeCount)) {
      setIsLoading(false);
      setError("Employee count must be a number");
      return;
    }

    const result = await updateCompanyCrmFields(company.id, {
      name: data.name,
      domain: data.domain || null,
      website: data.website || null,
      industry: data.industry || null,
      employeeCount,
      linkedinUrl: data.linkedinUrl || null,
      description: data.description || null,
      ownerId: data.ownerId === NONE ? null : (data.ownerId ?? null),
    });

    setIsLoading(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    onSuccess();
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit company</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex flex-col gap-4"
          >
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Acme Inc" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="domain"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Primary domain</FormLabel>
                    <FormControl>
                      <Input placeholder="acme.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="website"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Website</FormLabel>
                    <FormControl>
                      <Input placeholder="https://acme.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="industry"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Industry</FormLabel>
                    <FormControl>
                      <Input placeholder="Fintech" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="employeeCount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Employees</FormLabel>
                    <FormControl>
                      <Input type="number" min="0" placeholder="25" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="linkedinUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>LinkedIn</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="https://linkedin.com/company/acme"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="ownerId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Owner</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Unassigned" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value={NONE}>Unassigned</SelectItem>
                      {owners.map((owner) => (
                        <SelectItem key={owner.id} value={owner.id}>
                          {ownerLabel(owner)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      rows={3}
                      placeholder="What this company does..."
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {error && <p className="text-sm text-text-danger">{error}</p>}

            <DialogFooter>
              <Button type="submit" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 size-4 animate-spin" />}
                Save changes
              </Button>
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
