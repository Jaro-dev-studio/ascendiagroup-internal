"use client";

import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
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
import { createUser } from "@/lib/actions";
import { Loader2 } from "lucide-react";
import { UserRole } from "@prisma/client";

interface Company {
  id: string;
  name: string;
}

const userSchema = z.object({
  email: z.string().email("Invalid email address"),
  role: z.enum(["ADMIN", "DEVELOPER", "CLIENT"]),
  clientCompanyId: z.string().optional(),
}).refine((data) => {
  // CLIENT role must have clientCompanyId
  if (data.role === "CLIENT" && !data.clientCompanyId) {
    return false;
  }
  return true;
}, {
  message: "Client users must be linked to a client company",
  path: ["clientCompanyId"],
});

type UserFormData = z.infer<typeof userSchema>;

interface UserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (data: { user: any; generatedPassword: string }) => void;
  clientCompanies: Company[];
}

export function UserModal({ isOpen, onClose, onSuccess, clientCompanies }: UserModalProps) {
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<UserFormData>({
    resolver: zodResolver(userSchema),
    defaultValues: {
      email: "",
      role: "ADMIN",
      clientCompanyId: undefined,
    },
  });

  const selectedRole = useWatch({
    control: form.control,
    name: "role",
  });

  const onSubmit = async (data: UserFormData) => {
    setIsLoading(true);
    try {
      const result = await createUser({
        email: data.email,
        role: data.role as UserRole,
        clientCompanyId: data.role === "CLIENT" ? data.clientCompanyId : undefined,
      });

      if (result.error) {
        form.setError("email", { message: result.error });
        return;
      }

      if (result.data) {
        onSuccess(result.data);
        form.reset();
        onClose();
      }
    } catch (error) {
      console.error("Error creating user:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    form.reset();
    onClose();
  };

  // Reset clientCompanyId when role changes away from CLIENT
  const handleRoleChange = (value: string) => {
    form.setValue("role", value as "ADMIN" | "DEVELOPER" | "CLIENT");
    if (value !== "CLIENT") {
      form.setValue("clientCompanyId", undefined);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Create New User</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email *</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      placeholder="user@example.com"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Role *</FormLabel>
                  <Select onValueChange={handleRoleChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select role" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="ADMIN">Admin - Full access to all pages</SelectItem>
                      <SelectItem value="DEVELOPER">Developer - Development access</SelectItem>
                      <SelectItem value="CLIENT">Client - Limited access</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {selectedRole === "CLIENT" && (
              <FormField
                control={form.control}
                name="clientCompanyId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Client Company *</FormLabel>
                    {clientCompanies.length === 0 ? (
                      <p className="text-sm text-warning-600">
                        No client companies available. Create a client company first before adding client users.
                      </p>
                    ) : (
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select client company" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {clientCompanies.map((company) => (
                            <SelectItem key={company.id} value={company.id}>
                              {company.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <p className="text-sm text-secondary-500">
              A password will be automatically generated for this user.
            </p>

            <div className="flex gap-2 pt-4">
              <Button 
                type="submit" 
                disabled={isLoading || (selectedRole === "CLIENT" && clientCompanies.length === 0)} 
                className="relative flex-1"
              >
                <span className={isLoading ? "opacity-0" : ""}>
                  Create User
                </span>
                {isLoading && (
                  <span className="absolute inset-0 flex items-center justify-center">
                    <Loader2 className="size-4 animate-spin" />
                  </span>
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={isLoading}
                className="flex-1"
              >
                Cancel
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
