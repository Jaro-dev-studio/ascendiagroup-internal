import { Card } from "@/components/ui/card";

interface CompanyBrandProps {
  name: string;
  logoUrl: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  accentColor: string | null;
}

/**
 * The prospect's own logo and palette, scraped from their site during research.
 * Swatches are inline styles because the colours are data, not theme.
 */
export function CompanyBrand({
  name,
  logoUrl,
  primaryColor,
  secondaryColor,
  accentColor,
}: CompanyBrandProps) {
  const swatches = [
    { label: "Primary", value: primaryColor },
    { label: "Secondary", value: secondaryColor },
    { label: "Accent", value: accentColor },
  ].filter((swatch): swatch is { label: string; value: string } => Boolean(swatch.value));

  if (!logoUrl && swatches.length === 0) return null;

  return (
    <Card className="p-4">
      <h2 className="text-text-dark mb-3 text-sm font-semibold">Brand</h2>

      <div className="flex flex-col gap-4">
        {logoUrl && (
          <div className="flex h-16 flex-row items-center justify-center rounded-md border border-border bg-background-secondary p-2">
            <img
              src={logoUrl}
              alt={`${name} logo`}
              className="max-h-12 max-w-full object-contain"
            />
          </div>
        )}

        {swatches.length > 0 && (
          <dl className="flex flex-row flex-wrap gap-3">
            {swatches.map((swatch) => (
              <div key={swatch.label} className="flex min-w-0 flex-row items-center gap-2">
                <span
                  className="size-8 shrink-0 rounded-md border border-border"
                  style={{ backgroundColor: swatch.value }}
                  aria-hidden
                />
                <div className="min-w-0">
                  <dt className="text-xs uppercase tracking-wide text-text-tertiary">
                    {swatch.label}
                  </dt>
                  <dd className="text-text-dark font-mono text-xs">{swatch.value}</dd>
                </div>
              </div>
            ))}
          </dl>
        )}
      </div>
    </Card>
  );
}
