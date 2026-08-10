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
import { createPerson, updatePerson } from "@/lib/actions/crm";
import {
  LIFECYCLE_STAGE_LABELS,
  LIFECYCLE_STAGE_ORDER,
} from "@/constants/crm";
import type { CrmLifecycleStage } from "@prisma/client";

const NONE = "__none__";

const personSchema = z.object({
  email: z.string().email("Enter a valid email address"),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  jobTitle: z.string().optional(),
  phone: z.string().optional(),
  linkedinUrl: z.string().optional(),
  companyId: z.string().optional(),
  ownerId: z.string().optional(),
  lifecycleStage: z.enum([
    "LEAD",
    "QUALIFIED",
    "OPPORTUNITY",
    "CUSTOMER",
    "CHURNED",
    "DISQUALIFIED",
  ]),
});

type PersonFormData = z.infer<typeof personSchema>;

export interface PersonModalRecord {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  jobTitle: string | null;
  phone: string | null;
  linkedinUrl: string | null;
  lifecycleStage: CrmLifecycleStage;
  companyId?: string | null;
  ownerId?: string | null;
}

interface CrmPersonModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  companies: Array<{ id: string; name: string }>;
  owners: Array<{
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
  }>;
  person?: PersonModalRecord | null;
}

function ownerLabel(owner: {
  email: string;
  firstName: string | null;
  lastName: string | null;
}): string {
  const name = [owner.firstName, owner.lastName].filter(Boolean).join(" ");
  return name || owner.email;
}

export function CrmPersonModal({
  isOpen,
  onClose,
  onSuccess,
  companies,
  owners,
  person,
}: CrmPersonModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isEditing = Boolean(person);

  const form = useForm<PersonFormData>({
    resolver: zodResolver(personSchema),
    defaultValues: {
      email: "",
      firstName: "",
      lastName: "",
      jobTitle: "",
      phone: "",
      linkedinUrl: "",
      companyId: NONE,
      ownerId: NONE,
      lifecycleStage: "LEAD",
    },
  });

  useEffect(() => {
    if (!isOpen) return;

    form.reset({
      email: person?.email ?? "",
      firstName: person?.firstName ?? "",
      lastName: person?.lastName ?? "",
      jobTitle: person?.jobTitle ?? "",
      phone: person?.phone ?? "",
      linkedinUrl: person?.linkedinUrl ?? "",
      companyId: person?.companyId ?? NONE,
      ownerId: person?.ownerId ?? NONE,
      lifecycleStage: person?.lifecycleStage ?? "LEAD",
    });
    setError(null);
  }, [isOpen, person, form]);

  const onSubmit = async (data: PersonFormData) => {
    setIsLoading(true);
    setError(null);

    const companyId = data.companyId === NONE ? null : (data.companyId ?? null);
    const ownerId = data.ownerId === NONE ? null : (data.ownerId ?? null);

    const result = person
      ? await updatePerson(person.id, {
        firstName: data.firstName || null,
        lastName: data.lastName || null,
        jobTitle: data.jobTitle || null,
        phone: data.phone || null,
        linkedinUrl: data.linkedinUrl || null,
        companyId,
        ownerId,
        lifecycleStage: data.lifecycleStage,
      })
      : await createPerson({
        email: data.email,
        firstName: data.firstName || undefined,
        lastName: data.lastName || undefined,
        jobTitle: data.jobTitle || undefined,
        phone: data.phone || undefined,
        linkedinUrl: data.linkedinUrl || undefined,
        companyId,
        ownerId,
        lifecycleStage: data.lifecycleStage,
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
          <DialogTitle>{isEditing ? "Edit contact" : "New contact"}</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex flex-col gap-4"
          >
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      placeholder="jane@acme.com"
                      disabled={isEditing}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="firstName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>First name</FormLabel>
                    <FormControl>
                      <Input placeholder="Jane" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="lastName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Last name</FormLabel>
                    <FormControl>
                      <Input placeholder="Doe" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="jobTitle"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Job title</FormLabel>
                    <FormControl>
                      <Input placeholder="Head of Product" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone</FormLabel>
                    <FormControl>
                      <Input placeholder="+1 555 0100" {...field} />
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
                      placeholder="https://linkedin.com/in/janedoe"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="companyId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Company</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="No company" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value={NONE}>No company</SelectItem>
                      {companies.map((company) => (
                        <SelectItem key={company.id} value={company.id}>
                          {company.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
                name="lifecycleStage"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Lifecycle stage</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {LIFECYCLE_STAGE_ORDER.map((stage) => (
                          <SelectItem key={stage} value={stage}>
                            {LIFECYCLE_STAGE_LABELS[stage]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {error && <p className="text-sm text-text-danger">{error}</p>}

            <DialogFooter>
              <Button type="submit" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 size-4 animate-spin" />}
                {isEditing ? "Save changes" : "Create contact"}
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
