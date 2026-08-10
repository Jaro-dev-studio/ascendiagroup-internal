import { z } from "zod";
import {
  FREE_EMAIL_PROVIDERS,
  isBusinessEmail,
  serviceOptionsValues,
} from "../form/schema";

export { FREE_EMAIL_PROVIDERS, isBusinessEmail };

export const revenueOptions = [
  "under-20k",
  "21-70k",
  "71-150k",
  "150-300k",
  "301-600k",
  "601k+",
] as const;

export const businessOSFormSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z
    .string()
    .email("Please enter a valid email address")
    .refine(isBusinessEmail, "Please use your business email address"),
  monthlyRevenue: z.enum(revenueOptions),
  servicesNeeded: z
    .array(z.enum(serviceOptionsValues))
    .min(1, "Please select at least one service"),
  otherServiceDescription: z.string().optional(),
});

export type BusinessOSFormData = z.infer<typeof businessOSFormSchema>;
