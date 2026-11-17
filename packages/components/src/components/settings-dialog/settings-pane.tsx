import { Label } from "@lunarscribe/components/ui/label";
import type { ReactNode } from "react";

/**
 * Frame for one settings section: its groups keep a single readable width and
 * sit centered in the space beside the settings sidebar.
 */
export function SettingsPane({ children }: { children: ReactNode }) {
  return (
    <div className="h-full overflow-auto select-none">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-6 pt-2 pb-10">
        {children}
      </div>
    </div>
  );
}

/**
 * A titled group of settings: a heading, an optional line about the group and
 * an optional action beside it, then its rows in one card divided by lines.
 */
export function SettingsGroup({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <header className="flex items-end justify-between gap-6 px-1">
        <div className="flex min-w-0 flex-col gap-1">
          <h3 className="text-base font-medium text-balance">{title}</h3>
          {description && (
            <p className="text-muted-foreground text-sm text-pretty">
              {description}
            </p>
          )}
        </div>
        {action}
      </header>
      <div className="bg-card text-card-foreground divide-border flex flex-col divide-y rounded-xl border">
        {children}
      </div>
    </section>
  );
}

/**
 * One setting: its name and what it does on the left, its control on the
 * right. `htmlFor` ties the name to a control that has that id.
 */
export function SettingsRow({
  title,
  description,
  htmlFor,
  children,
}: {
  title: ReactNode;
  description?: ReactNode;
  htmlFor?: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-6 px-4 py-3">
      <div className="flex min-w-0 flex-col gap-0.5">
        {htmlFor ? (
          <Label htmlFor={htmlFor}>{title}</Label>
        ) : (
          <span className="text-sm font-medium">{title}</span>
        )}
        {description && (
          <p className="text-muted-foreground text-xs text-pretty">
            {description}
          </p>
        )}
      </div>
      {children && (
        <div className="flex shrink-0 items-center gap-2">{children}</div>
      )}
    </div>
  );
}

/** A row for content that is not one setting, such as a list or a note, with the rows' padding. */
export function SettingsBlock({ children }: { children: ReactNode }) {
  return <div className="flex flex-col gap-3 px-4 py-3">{children}</div>;
}
