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
    const res = await setProductStatusAction(id, status);
    if (res.ok) {
      toast.success(status === "archived" ? "Item archived" : "Item restored");
      router.refresh();
    } else {
      toast.error(res.error ?? "Could not update item");
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
