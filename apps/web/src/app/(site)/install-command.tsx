import { Button } from "@lunarscribe/components/ui/button";
import { tryCatch } from "@lunarscribe/utils/try-catch";
import { Check, Copy } from "lucide-react";
import { useEffect, useState } from "react";

/** The installer command split into shell tokens, colored like the editor's code blocks. */
const INSTALL_TOKENS = [
  { text: "curl", className: "text-syntax-function" },
  { text: "-fsSL", className: "text-syntax-number" },
  {
    text: "https://lunarscribe.doctorthe113.com/install",
    className: "text-syntax-string",
  },
  { text: "|", className: "text-syntax-operator" },
  { text: "bash", className: "text-syntax-function" },
];

const INSTALL_COMMAND = INSTALL_TOKENS.map((token) => token.text).join(" ");

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
    <div className="bg-background border-primary ring-foreground/10 flex w-full items-center gap-2 rounded-lg border py-2 pr-2 pl-4 ring-1">
      <code className="flex-1 overflow-x-auto text-left text-sm whitespace-nowrap">
        {INSTALL_TOKENS.map((token, index) => (
          <span key={token.text} className={token.className}>
            {index > 0 && " "}
            {token.text}
          </span>
        ))}
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
