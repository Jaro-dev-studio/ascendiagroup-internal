"use client";

import { useEffect, useState, useTransition } from "react";
import { Loader2, Search, UserPlus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  enrollContacts,
  searchEnrollableContacts,
} from "@/lib/actions/sequences";

interface Contact {
  id: string;
  name: string;
  email: string;
  companyName: string | null;
}

interface SequenceEnrollModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (summary: string) => void;
  sequenceId: string;
  initialContacts: Contact[];
}

export function SequenceEnrollModal({
  isOpen,
  onClose,
  onSuccess,
  sequenceId,
  initialContacts,
}: SequenceEnrollModalProps) {
  const [contacts, setContacts] = useState<Contact[]>(initialContacts);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [isEnrolling, setIsEnrolling] = useState(false);
  const [isSearching, startSearch] = useTransition();

  useEffect(() => {
    if (!isOpen) return;
    setContacts(initialContacts);
    setSelected(new Set());
    setSearch("");
    setError(null);
  }, [isOpen, initialContacts]);

  const handleSearch = (value: string) => {
    setSearch(value);
    startSearch(async () => {
      const result = await searchEnrollableContacts(sequenceId, value);
      if (result.data) setContacts(result.data);
    });
  };

  const toggle = (id: string) => {
    setSelected((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleEnroll = async () => {
    if (selected.size === 0) return;

    setIsEnrolling(true);
    setError(null);

    const result = await enrollContacts(sequenceId, Array.from(selected));
    setIsEnrolling(false);

    if (result.error || !result.data) {
      setError(result.error ?? "Failed to enroll contacts");
      return;
    }

    onSuccess(
      `${result.data.enrolled} enrolled, ${result.data.alreadyEnrolled} already in the sequence, ${result.data.skipped} skipped`
    );
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-hidden sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Enroll contacts</DialogTitle>
          <DialogDescription>
            Suppressed and do-not-contact people are hidden, and anyone already
            in this sequence is left out.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-secondary-400" />
            <Input
              value={search}
              onChange={(event) => handleSearch(event.target.value)}
              placeholder="Search by name or email"
              className="pl-9"
            />
          </div>

          <div className="max-h-72 overflow-y-auto rounded-lg border border-border">
            {isSearching ? (
              <div className="flex flex-row items-center justify-center gap-2 p-6 text-sm text-secondary-500">
                <Loader2 className="size-4 animate-spin" />
                Searching
              </div>
            ) : contacts.length === 0 ? (
              <p className="p-6 text-center text-sm text-secondary-500">
                No eligible contacts found.
              </p>
            ) : (
              <ul className="flex flex-col divide-y divide-border">
                {contacts.map((contact) => (
                  <li key={contact.id}>
                    <label className="flex cursor-pointer flex-row items-center gap-3 p-3">
                      <Checkbox
                        checked={selected.has(contact.id)}
                        onCheckedChange={() => toggle(contact.id)}
                      />
                      <span className="flex min-w-0 flex-col">
                        <span className="truncate text-sm font-medium text-secondary-900">
                          {contact.name}
                        </span>
                        <span className="truncate text-xs text-secondary-500">
                          {contact.email}
                          {contact.companyName ? ` · ${contact.companyName}` : ""}
                        </span>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {error && <p className="text-sm text-text-danger">{error}</p>}
        </div>

        <DialogFooter>
          <Button
            onClick={handleEnroll}
            disabled={selected.size === 0 || isEnrolling}
            className="gap-2"
          >
            {isEnrolling ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <UserPlus className="size-4" />
            )}
            Enroll {selected.size > 0 ? selected.size : ""}
          </Button>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
