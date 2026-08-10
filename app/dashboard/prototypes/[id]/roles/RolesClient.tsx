"use client";

import { useState } from "react";
import { Plus, Edit2, Trash2, Loader2 } from "lucide-react";
import {Button} from "@/components/ui/button";
import { createRole, updateRole, deleteRole, revalidatePathClient } from "@/lib/actions";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function RolesClient({ prototype }: { prototype: any }) {
  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const RoleForm = ({ role, onSubmit, onCancel }: any) => {
    const [name, setName] = useState(role?.name || "");
    const [description, setDescription] = useState(role?.description || "");

    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      setLoading(true);
      try {
        if (role) {
          await updateRole(role.id, { name, description });
        } else {
          await createRole(prototype.id, { name, description });
        }
        onSubmit();
      } finally {
        setLoading(false);
        revalidatePathClient("/dashboard/prototype");
      }
    };

    return (
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Role name"
            className="w-full rounded border border-border px-3 py-2"
            required
          />
        </div>
        <div>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Role description"
            className="w-full rounded border border-border px-3 py-2"
            rows={3}
          />
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" disabled={loading} className="relative">
            <span className={loading ? "opacity-0" : ""}>
              Save
            </span>
            {loading && (
              <span className="absolute inset-0 flex items-center justify-center">
                <Loader2 className="size-4 animate-spin" />
              </span>
            )}
          </Button>
        </div>
      </form>
    );
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this role?")) return;
    setLoading(true);
    try {
      await deleteRole(id);
      revalidatePathClient("/dashboard/prototypes");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 p-6">
      <Link href={`/dashboard/prototypes/${prototype.id}`} className="text-text-link mb-4 inline-block hover:underline">
        ← Back to prototype
      </Link>
      
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Roles for {prototype.name}</h1>
        <Button onClick={() => setIsCreating(true)} disabled={isCreating}>
          <Plus className="mr-2 size-4" />
          Add Role
        </Button>
      </div>

      <div className="space-y-4">
        {isCreating && (
          <div className="rounded-lg border border-border p-4">
            <RoleForm
              onSubmit={() => setIsCreating(false)}
              onCancel={() => setIsCreating(false)}
            />
          </div>
        )}

        {prototype.roles.map((role: any) => (
          <div
            key={role.id}
            className="rounded-lg border border-border p-4"
          >
            {editingId === role.id ? (
              <RoleForm
                role={role}
                onSubmit={() => setEditingId(null)}
                onCancel={() => setEditingId(null)}
              />
            ) : (
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-medium text-text">{role.name}</h3>
                  <p className="mt-1 text-sm text-text-secondary">{role.description}</p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    onClick={() => setEditingId(role.id)}
                  >
                    <Edit2 className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => handleDelete(role.id)}
                    className="text-danger hover:text-danger-dark"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}