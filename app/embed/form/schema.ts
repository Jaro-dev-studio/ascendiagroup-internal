import { z } from "zod";

// List of common free email providers to block
export const FREE_EMAIL_PROVIDERS = [
  "gmail.com",
  "googlemail.com",
  "yahoo.com",
  "yahoo.co.uk",
  "yahoo.fr",
  "yahoo.de",
  "hotmail.com",
  "hotmail.co.uk",
  "outlook.com",
  "outlook.co.uk",
  "live.com",
  "live.co.uk",
  "msn.com",
  "icloud.com",
  "me.com",
  "mac.com",
  "aol.com",
  "protonmail.com",
  "proton.me",
  "zoho.com",
  "yandex.com",
  "yandex.ru",
  "mail.com",
  "gmx.com",
  "gmx.de",
  "inbox.com",
  "fastmail.com",
  "tutanota.com",
  "mailinator.com",
  "guerrillamail.com",
  "tempmail.com",
  "10minutemail.com",
  "qq.com",
  "163.com",
  "126.com",
  "sina.com",
  "yeah.net",
  "foxmail.com",
  "mail.ru",
  "bk.ru",
  "list.ru",
  "inbox.ru",
  "rambler.ru",
  "web.de",
  "t-online.de",
  "orange.fr",
  "free.fr",
  "laposte.net",
  "wanadoo.fr",
  "libero.it",
  "virgilio.it",
  "alice.it",
  "rediffmail.com",
];

export const isBusinessEmail = (email: string): boolean => {
  const domain = email.split("@")[1]?.toLowerCase();
  if (!domain) return false;
  return !FREE_EMAIL_PROVIDERS.includes(domain);
};

export const serviceOptionsValues = [
  "custom-software-autopilot",
  "ai-automation",
  "high-volume-scraping",
  "web-to-native-mobile",
  "other",
] as const;

export const embedFormSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z
    .string()
    .email("Please enter a valid email address")
    .refine(isBusinessEmail, "Please use your business email address"),
  hasExistingCodebase: z.boolean().optional(),
  monthlyRevenue: z.enum([
    "under-20k",
    "21-70k",
    "71-150k",
    "150-300k",
    "301-600k",
    "601k+",
  ]),
  productType: z.enum(["internal", "external"]).optional(),
  platform: z.enum(["web", "mobile", "both"]).optional(),
  servicesNeeded: z
    .array(z.enum(serviceOptionsValues))
    .min(1, "Please select at least one service"),
  otherServiceDescription: z.string().optional(),
});

// Extended validation for form submission (includes conditional "other" check)
export const embedFormSchemaWithRefinement = embedFormSchema.refine(
  (data) => {
    if (data.servicesNeeded.includes("other")) {
      return (
        data.otherServiceDescription &&
        data.otherServiceDescription.trim().length > 0
      );
    }
    return true;
  },
  {
    message: "Please describe what you need",
    path: ["otherServiceDescription"],
  }
);

export type EmbedFormData = z.infer<typeof embedFormSchema>;
