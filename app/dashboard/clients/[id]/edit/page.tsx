import { notFound } from "next/navigation";

import { ClientForm } from "@/components/forms/client-form";
import { PageHeader } from "@/components/shared/page-header";
import { requireStaff } from "@/lib/auth-helpers";
import { listStaffUsers } from "@/lib/fetchers/clients";
import prisma from "@/lib/prisma";
import type { ClientStatus, ServiceLine } from "@prisma/client";

export const metadata = { title: "Edit client" };

export default async function EditClientPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireStaff();
  const { id } = await params;

  const [client, { data: managers }] = await Promise.all([
    prisma.client.findUnique({ where: { id }, include: { services: true } }),
    listStaffUsers(),
  ]);

  if (!client) notFound();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={`Edit ${client.name}`}
        description="Update practice details, contracted services and the account owner."
      />
      <div className="max-w-3xl">
        <ClientForm
          clientId={client.id}
          managers={managers ?? []}
          defaultValues={{
            name: client.name,
            practiceType: client.practiceType ?? "",
            website: client.website ?? "",
            contactName: client.contactName ?? "",
            contactEmail: client.contactEmail ?? "",
            contactPhone: client.contactPhone ?? "",
            whatsappNumber: client.whatsappNumber ?? "",
            addressLine: client.addressLine ?? "",
            city: client.city ?? "",
            country: client.country ?? "",
            packageTier: client.packageTier ?? "",
            status: client.status as ClientStatus,
            monthlyRetainer: client.monthlyRetainer?.toString() ?? "",
            startDate: client.startDate
              ? client.startDate.toISOString().slice(0, 10)
              : "",
            notes: client.notes ?? "",
            accountManagerId: client.accountManagerId ?? "",
            services: client.services.map(
              (service) => service.service as ServiceLine
            ),
          }}
        />
      </div>
    </div>
  );
}
