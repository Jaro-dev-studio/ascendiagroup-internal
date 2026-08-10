"use client";

import { Card } from "@/components/ui/card";
import { Calculation } from "@prisma/client";
import Link from "next/link";
import { useState } from "react";
import { deleteCalculation } from "@/lib/actions";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { MoreVertical, Trash2 } from "lucide-react";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";

dayjs.extend(relativeTime);

export function CalculationCard({ calculation }: { calculation: Calculation }) {
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (isDeleting) return;
    setIsDeleting(true);
    try {
      await deleteCalculation(calculation.id);
    } catch (error) {
      console.error("Failed to delete calculation:", error);
    }
    setIsDeleting(false);
  };

  return (
    <Card variant="interactive" className="relative w-full overflow-hidden p-4">
      <Link href={`/dashboard/calculation/${calculation.id}`}>
        <div>
          <h2 className="font-medium text-secondary-900">{calculation.name}</h2>
          {calculation.description && (
            <p className="mt-1 line-clamp-1 min-h-6 text-sm text-secondary-500">
              {calculation.description}
            </p>
          )}
          <p className="mt-2 text-xs text-secondary-500">
            Last updated{" "}
            {dayjs(calculation.updatedAt).fromNow()}
          </p>
        </div>
      </Link>

      <div className="absolute right-2 top-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <MoreVertical className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem
              className="text-destructive"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              <Trash2 className="mr-2 size-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </Card>
  );
} 