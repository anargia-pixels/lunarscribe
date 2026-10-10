import { Button } from "@lunarscribe/components/ui/button";
import { tryCatch } from "@lunarscribe/utils/try-catch";
import { Check, Copy } from "lucide-react";
import { useEffect, useState } from "react";

const INSTALL_COMMAND =
  "curl -fsSL https://lunarscribe.doctorthe113.com/install | bash";

/** The installer command with a copy button that confirms for two seconds. */
export function InstallCommand() {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) {
      return;
    }

    const timeout = setTimeout(() => setCopied(false), 2000);

    return () => clearTimeout(timeout);
  }, [copied]);

  const copy = async () => {
    const { error } = await tryCatch(
      navigator.clipboard.writeText(INSTALL_COMMAND),
    );

    setCopied(error === null);
  };

  return (
    <div className="bg-muted ring-foreground/10 flex w-full items-center gap-2 rounded-lg py-2 pr-2 pl-4 ring-1">
      <code className="flex-1 overflow-x-auto text-left text-sm whitespace-nowrap">
        {INSTALL_COMMAND}
      </code>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Copy install command"
        onClick={() => void copy()}
      >
        {copied ? <Check /> : <Copy />}
      </Button>
    </div>
  );
}
