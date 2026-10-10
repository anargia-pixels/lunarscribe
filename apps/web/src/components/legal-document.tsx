import type { ReactNode } from "react";

/** The body of the privacy policy and terms of service: title, date and sections. */
export function LegalDocument({
  title,
  effectiveDate,
  children,
}: {
  title: string;
  effectiveDate: string;
  children: ReactNode;
}) {
  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-4 px-6 pt-32 pb-24 leading-relaxed">
      <h1 className="text-4xl font-bold tracking-tight">{title}</h1>
      <p className="text-muted-foreground">Effective date: {effectiveDate}</p>
      {children}
    </main>
  );
}

export function LegalHeading({ children }: { children: ReactNode }) {
  return (
    <h2 className="mt-6 text-2xl font-semibold tracking-tight">{children}</h2>
  );
}

export function LegalSubheading({ children }: { children: ReactNode }) {
  return <h3 className="mt-2 text-lg font-semibold">{children}</h3>;
}

export function LegalList({ children }: { children: ReactNode }) {
  return <ul className="flex list-disc flex-col gap-2 pl-6">{children}</ul>;
}

/** A file, folder or permission name. */
export function LegalCode({ children }: { children: ReactNode }) {
  return (
    <code className="bg-muted rounded px-1.5 py-0.5 text-sm">{children}</code>
  );
}
