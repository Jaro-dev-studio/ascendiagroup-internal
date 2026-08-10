import { Badge } from "@/components/ui/badge";
import { DEAL_PRICING_TYPE_LABELS } from "@/constants/crm";
import { dealPricingTypes, type DealPricingLine } from "@/lib/crm/deal-pricing";
import { cn } from "@/lib/utils";

interface PricingTypeBadgesProps {
  items: DealPricingLine[];
  className?: string;
  /** Renders nothing instead of a placeholder when the deal has no pricing. */
  hideWhenEmpty?: boolean;
}

/**
 * The pricing types a deal mixes, e.g. Project + Retainer. A deal created
 * before pricing items existed has none, so it falls back to a dash.
 */
export function PricingTypeBadges({
  items,
  className,
  hideWhenEmpty = false,
}: PricingTypeBadgesProps) {
  const types = dealPricingTypes(items);

  if (types.length === 0) {
    if (hideWhenEmpty) return null;
    return <span className="text-sm text-text-tertiary">—</span>;
  }

  return (
    <div className={cn("flex flex-row flex-wrap gap-1", className)}>
      {types.map((type) => (
        <Badge key={type} variant="secondary" className="text-xs">
          {DEAL_PRICING_TYPE_LABELS[type]}
        </Badge>
      ))}
    </div>
  );
}
