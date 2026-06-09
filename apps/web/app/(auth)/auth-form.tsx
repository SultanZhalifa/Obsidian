"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { IconWarning } from "@/components/icons";
import {
  loginAction,
  registerAction,
  type AuthFormState,
} from "./actions";

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn btn-primary w-full" disabled={pending}>
      {pending ? "Please wait…" : label}
    </button>
  );
}

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const action = mode === "login" ? loginAction : registerAction;
  const [state, formAction] = useActionState<AuthFormState, FormData>(action, {});

  return (
    <div className="panel p-6">
      <h2 className="mb-1 text-base font-semibold text-fg-0">
        {mode === "login" ? "Sign in" : "Create account"}
      </h2>
      <p className="mb-5 text-sm text-fg-1">
        {mode === "login"
          ? "Access your terminal and paper-trading account."
          : "The first account created becomes the administrator."}
      </p>

      <form action={formAction} className="flex flex-col gap-4">
        {mode === "register" && (
          <div>
            <label className="label" htmlFor="displayName">
              Display name (optional)
            </label>
            <input
              id="displayName"
              name="displayName"
              type="text"
              autoComplete="name"
              className="input"
              placeholder="Ada Lovelace"
            />
          </div>
        )}

        <div>
          <label className="label" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            className="input"
            placeholder="you@example.com"
          />
        </div>

        <div>
          <label className="label" htmlFor="password">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            minLength={mode === "register" ? 10 : undefined}
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            className="input"
            placeholder={mode === "register" ? "At least 10 characters" : "••••••••"}
          />
        </div>

        {state.error && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded border border-down/40 bg-down-bg px-3 py-2 text-sm text-down"
          >
            <IconWarning size={16} className="mt-0.5 shrink-0" />
            <span>{state.error}</span>
          </div>
        )}

        <SubmitButton label={mode === "login" ? "Sign in" : "Create account"} />
      </form>

      <p className="mt-5 text-center text-sm text-fg-1">
        {mode === "login" ? (
          <>
            No account?{" "}
            <Link href="/register" className="text-fg-0 underline-offset-2 hover:underline">
              Create one
            </Link>
          </>
        ) : (
          <>
            Already have an account?{" "}
            <Link href="/login" className="text-fg-0 underline-offset-2 hover:underline">
              Sign in
            </Link>
          </>
        )}
      </p>
    </div>
  );
}
