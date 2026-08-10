"use client";

import { useState } from "react";
import { Plus, MoreHorizontal, Edit, Trash2, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { createOffer, updateOffer, deleteOffer } from "@/lib/actions";
import { Offer } from "@prisma/client";

interface OffersClientProps {
  offers: Offer[];
}

export function OffersClient({ offers: initialOffers }: OffersClientProps) {
  const [offers, setOffers] = useState(initialOffers);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingOffer, setEditingOffer] = useState<Offer | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    title: "",
    description: "",
  });

  const handleOpenDialog = (offer?: Offer) => {
    if (offer) {
      setEditingOffer(offer);
      setFormData({
        title: offer.title,
        description: offer.description || "",
      });
    } else {
      setEditingOffer(null);
      setFormData({
        title: "",
        description: "",
      });
    }
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingOffer(null);
    setFormData({
      title: "",
      description: "",
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) return;

    setIsSubmitting(true);
    try {
      if (editingOffer) {
        const result = await updateOffer(editingOffer.id, {
          title: formData.title,
          description: formData.description || undefined,
        });
        if (result.error) {
          console.error(result.error);
          return;
        }
        setOffers(
          offers.map((o) =>
            o.id === editingOffer.id ? { ...o, ...result.data } : o
          )
        );
      } else {
        const result = await createOffer({
          title: formData.title,
          description: formData.description || undefined,
        });
        if (result.error) {
          console.error(result.error);
          return;
        }
        if (result.data) {
          setOffers([result.data, ...offers]);
        }
      }
      handleCloseDialog();
    } catch (error) {
      console.error("Error saving offer:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteOffer = async (offerId: string) => {
    if (
      !confirm(
        "Are you sure you want to delete this offer? This action cannot be undone."
      )
    ) {
      return;
    }

    setIsDeleting(offerId);
    try {
      const result = await deleteOffer(offerId);
      if (result.error) {
        console.error(result.error);
        return;
      }

      setOffers(offers.filter((o) => o.id !== offerId));
    } catch (error) {
      console.error("Error deleting offer:", error);
    } finally {
      setIsDeleting(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-secondary-900">Offers</h1>
          <p className="text-secondary-600">
            Manage your offers and proposals
          </p>
        </div>
        <Button onClick={() => handleOpenDialog()} size="sm" className="sm:size-default">
          <Plus className="mr-2 size-4" />
          New Offer
        </Button>
      </div>

      {offers.length === 0 ? (
        <Card className="p-8 text-center">
          <FileText className="mx-auto size-12 text-secondary-400" />
          <h3 className="mt-4 text-lg font-medium text-secondary-900">
            No offers yet
          </h3>
          <p className="mt-2 text-secondary-600">
            Get started by creating your first offer
          </p>
          <Button className="mt-4" onClick={() => handleOpenDialog()}>
            <Plus className="mr-2 size-4" />
            Create Offer
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {offers.map((offer) => (
            <Card key={offer.id} className="p-6">
              <div className="flex items-start justify-between">
                <div className="min-w-0 flex-1">
                  <h3 className="truncate font-semibold text-secondary-900">
                    {offer.title}
                  </h3>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="size-8">
                      <MoreHorizontal className="size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => handleOpenDialog(offer)}>
                      <Edit className="mr-2 size-4" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => handleDeleteOffer(offer.id)}
                      disabled={isDeleting === offer.id}
                      className="text-danger-600 focus:text-danger-600"
                    >
                      <Trash2 className="mr-2 size-4" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {offer.description && (
                <p className="mt-2 line-clamp-3 text-sm text-secondary-600">
                  {offer.description}
                </p>
              )}

              <div className="mt-4 border-t border-secondary-200 pt-4">
                <p className="text-xs text-secondary-500">
                  Created {new Date(offer.createdAt).toLocaleDateString()}
                </p>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingOffer ? "Edit Offer" : "Create New Offer"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) =>
                  setFormData({ ...formData, title: e.target.value })
                }
                placeholder="Enter offer title"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                placeholder="Enter offer description (optional)"
                rows={4}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="submit"
                disabled={isSubmitting || !formData.title.trim()}
              >
                {isSubmitting
                  ? "Saving..."
                  : editingOffer
                    ? "Save Changes"
                    : "Create Offer"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={handleCloseDialog}
              >
                Cancel
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
