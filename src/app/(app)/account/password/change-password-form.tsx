"use client";

import { useActionState } from "react";
import { Loader2 } from "lucide-react";

import { changePasswordAction, type AuthActionState } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const INITIAL: AuthActionState = { ok: true };

export function ChangePasswordForm({ required }: { required: boolean }) {
  const [state, formAction, pending] = useActionState(
    changePasswordAction,
    INITIAL
  );

  return (
    <form action={formAction} className="space-y-4" noValidate>
      {!state.ok && state.error ? (
        <div
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
        >
          {state.error}
        </div>
      ) : null}

      {!required ? (
        <div className="space-y-2">
          <Label htmlFor="current">Current password</Label>
          <Input
            id="current"
            name="current"
            type="password"
            autoComplete="current-password"
            required
            autoFocus
          />
        </div>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="password">New password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          autoFocus={required}
          minLength={12}
        />
        <p className="text-xs text-slate-500">
          At least 12 characters. Other sessions are signed out.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirm">Confirm new password</Label>
        <Input
          id="confirm"
          name="confirm"
          type="password"
          autoComplete="new-password"
          required
          minLength={12}
        />
      </div>

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        {required ? "Set password and continue" : "Change password"}
      </Button>
    </form>
  );
}
