"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { MoreHorizontal } from "lucide-react";
import { toast } from "sonner";

import { setProductStatusAction } from "@/lib/actions/products";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function ProductRowActions({ id }: { id: string }) {
  const router = useRouter();

  async function setStatus(status: "active" | "archived") {
    const toastId = toast.loading(
      status === "archived" ? "Archiving item..." : "Restoring item..."
    );

    try {
      const res = await setProductStatusAction(id, status);
      if (res.ok) {
        toast.success(status === "archived" ? "Item archived" : "Item restored", {
          id: toastId,
        });
        router.refresh();
      } else {
        toast.error(res.error ?? "Could not update item", { id: toastId });
      }
    } catch (error) {
      console.error("[products/status] failed", {
        message: error instanceof Error ? error.message : String(error),
      });
      toast.error("Could not update item", { id: toastId });
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="ghost" size="icon" aria-label="Item actions" />}
      >
        <MoreHorizontal className="h-4 w-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem render={<Link href={`/products/${id}/edit`} />}>Edit</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => setStatus("archived")}>Archive</DropdownMenuItem>
        <DropdownMenuItem onClick={() => setStatus("active")}>Restore</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
