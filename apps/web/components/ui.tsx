import clsx from "clsx";
import type { ReactNode } from "react";

export function Panel({
  title,
  actions,
  children,
  className,
  bodyClassName,
}: {
  title?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={clsx("panel flex min-h-0 flex-col", className)}>
      {(title || actions) && (
        <header className="panel-header">
          {typeof title === "string" ? (
            <h2 className="text-xs font-semibold uppercase tracking-wide text-fg-1">
              {title}
            </h2>
          ) : (
            title
          )}
          {actions}
        </header>
      )}
      <div className={clsx("min-h-0 flex-1", bodyClassName)}>{children}</div>
    </section>
  );
}

/** Colors a value by sign using the semantic up/down accents. */
export function signClass(value: number): string {
  if (value > 0) return "text-up";
  if (value < 0) return "text-down";
  return "text-fg-1";
}

export function Stat({
  label,
  value,
  hint,
  valueClassName,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  valueClassName?: string;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-2xs uppercase tracking-wide text-fg-2">{label}</span>
      <span className={clsx("tabular text-sm text-fg-0", valueClassName)}>
        {value}
      </span>
      {hint && <span className="text-2xs text-fg-2">{hint}</span>}
    </div>
  );
}

export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "up" | "down" | "warn";
}) {
  const tones = {
    neutral: "border-line text-fg-1",
    up: "border-up/40 text-up",
    down: "border-down/40 text-down",
    warn: "border-warn/40 text-warn",
  };
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded border px-1.5 py-0.5 text-2xs uppercase tracking-wide",
        tones[tone],
      )}
    >
      {children}
    </span>
  );
}

export function EmptyState({
  title,
  body,
  icon,
}: {
  title: string;
  body?: string;
  icon?: ReactNode;
}) {
  return (
    <div className="grid place-items-center p-10 text-center">
      <div className="flex max-w-xs flex-col items-center gap-2">
        {icon && <div className="text-fg-2">{icon}</div>}
        <p className="text-sm font-medium text-fg-0">{title}</p>
        {body && <p className="text-sm text-fg-1">{body}</p>}
      </div>
    </div>
  );
}
