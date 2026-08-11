import { requireStaff } from "@/lib/auth-helpers";
import { listClientOptions, listStaffUsers } from "@/lib/fetchers/clients";
import { listTasks } from "@/lib/fetchers/projects";

import { TasksClient } from "./client";

export const metadata = { title: "Tasks" };

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; assigneeId?: string; clientId?: string }>;
}) {
  const user = await requireStaff();
  const { status, assigneeId, clientId } = await searchParams;

  const [{ data: tasks, error }, { data: clients }, { data: users }] =
    await Promise.all([
      listTasks({ status, assigneeId, clientId }),
      listClientOptions(),
      listStaffUsers(),
    ]);

  return (
    <TasksClient
      tasks={tasks ?? []}
      clients={clients ?? []}
      users={users ?? []}
      error={error}
      currentUserId={user.id}
      filters={{
        status: status ?? "",
        assigneeId: assigneeId ?? "",
        clientId: clientId ?? "",
      }}
    />
  );
}
