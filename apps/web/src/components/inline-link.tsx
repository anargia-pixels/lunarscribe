import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

/** A primary-colored text link for running copy; takes routes and external URLs. */
export function InlineLink({
  to,
  children,
}: {
  to: string;
  children: ReactNode;
}) {
  return (
    <Link to={to} className="text-primary underline-offset-4 hover:underline">
      {children}
    </Link>
  );
}
