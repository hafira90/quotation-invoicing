"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { MoreHorizontal } from "lucide-react";
import { toast } from "sonner";

import { setCustomerStatusAction } from "@/lib/actions/customers";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function CustomerRowActions({ id }: { id: string }) {
  const router = useRouter();

  async function setStatus(status: "active" | "archived") {
    const res = await setCustomerStatusAction(id, status);
    if (res.ok) {
      toast.success(status === "archived" ? "Customer archived" : "Customer restored");
      router.refresh();
    } else {
      toast.error(res.error ?? "Could not update customer");
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="ghost" size="icon" aria-label="Customer actions" />}
      >
        <MoreHorizontal className="h-4 w-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem render={<Link href={`/customers/${id}`} />}>View</DropdownMenuItem>
        <DropdownMenuItem render={<Link href={`/customers/${id}/edit`} />}>Edit</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => setStatus("archived")}>Archive</DropdownMenuItem>
        <DropdownMenuItem onClick={() => setStatus("active")}>Restore</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
