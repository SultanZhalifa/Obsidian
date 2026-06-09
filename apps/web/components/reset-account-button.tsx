"use client";

import { useState, useTransition } from "react";
import { resetAccountAction } from "@/app/(app)/trade/actions";
import { useToast } from "./toast";
import { IconWarning } from "./icons";

/**
 * Resets the paper-trading account to its starting cash. Destructive, so it
 * requires an inline confirmation before firing the server action.
 */
export function ResetAccountButton() {
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();
  const { push } = useToast();

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="btn btn-ghost px-2.5 py-1 text-2xs"
      >
        Reset account
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="flex items-center gap-1 text-2xs text-warn">
        <IconWarning size={13} />
        Wipe all trades &amp; positions?
      </span>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            await resetAccountAction();
            push({ kind: "success", title: "Account reset", body: "Balance restored to starting cash." });
            setConfirming(false);
          })
        }
        className="btn border-down/50 bg-down/10 px-2.5 py-1 text-2xs text-down hover:bg-down/20"
      >
        {pending ? "Resetting…" : "Confirm reset"}
      </button>
      <button
        type="button"
        onClick={() => setConfirming(false)}
        className="btn btn-ghost px-2.5 py-1 text-2xs"
      >
        Cancel
      </button>
    </div>
  );
}
