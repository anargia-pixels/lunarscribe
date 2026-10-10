import { Badge } from "@lunarscribe/components/ui/badge";
import { Button } from "@lunarscribe/components/ui/button";
import { Checkbox } from "@lunarscribe/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@lunarscribe/components/ui/dropdown-menu";
import { Input } from "@lunarscribe/components/ui/input";
import { Textarea } from "@lunarscribe/components/ui/textarea";
import {
  Check,
  Hash,
  List,
  type LucideIcon,
  Plus,
  Type,
  X,
} from "lucide-react";
import { useState } from "react";

import {
  type FrontmatterEntry,
  type FrontmatterValue,
  isCheckboxValue,
  isListValue,
  isNumberValue,
  isTextValue,
} from "./frontmatter";

type RawEntry = Extract<FrontmatterEntry, { kind: "raw" }>;

/**
 * Frontmatter shown above the markdown editor, one row per key and value pair.
 * The panel is state-agnostic: it receives the active buffer's entries and
 * reports every edit, and the caller joins the serialized block back onto the
 * body.
 */
export function FrontmatterPanel({
  entries,
  onChange,
}: {
  entries: FrontmatterEntry[];
  onChange: (entries: FrontmatterEntry[]) => void;
}) {
  const addProperty = () =>
    onChange([...entries, { kind: "property", key: "", value: "" }]);

  return (
    <section className="flex flex-col gap-2 pb-6">
      <div className="flex items-center gap-1">
        <div className="text-muted-foreground font-ui text-xs font-medium select-none">
          Frontmatter
        </div>
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label="Add frontmatter"
          onClick={addProperty}
        >
          <Plus />
        </Button>
      </div>
      {entries.map((entry, index) => (
        <FrontmatterRow
          key={index}
          entry={entry}
          isKeyTaken={(key) => isKeyTakenBy(entries, index, key)}
          onChange={(next) =>
            onChange(
              entries.map((other, otherIndex) =>
                otherIndex === index ? next : other,
              ),
            )
          }
          onRemove={() =>
            onChange(entries.filter((_, otherIndex) => otherIndex !== index))
          }
        />
      ))}
    </section>
  );
}

function isKeyTakenBy(
  entries: FrontmatterEntry[],
  index: number,
  key: string,
): boolean {
  return entries.some(
    (entry, otherIndex) =>
      otherIndex !== index && entry.kind === "property" && entry.key === key,
  );
}

function FrontmatterRow({
  entry,
  isKeyTaken,
  onChange,
  onRemove,
}: {
  entry: FrontmatterEntry;
  isKeyTaken: (key: string) => boolean;
  onChange: (entry: FrontmatterEntry) => void;
  onRemove: () => void;
}) {
  if (entry.kind === "raw") {
    return <RawRow entry={entry} onRemove={onRemove} />;
  }

  const rename = (key: string) => {
    // A repeated key would make the markdown ambiguous and drop a row.
    if (key !== "" && isKeyTaken(key)) {
      return;
    }

    onChange({ kind: "property", key, value: entry.value });
  };

  const setValue = (value: FrontmatterValue) =>
    onChange({ kind: "property", key: entry.key, value });

  return (
    <div className="flex items-center gap-2">
      <Input
        aria-label="Frontmatter key name"
        placeholder="Name"
        className="w-36 shrink-0"
        value={entry.key}
        onChange={(event) => rename(event.target.value)}
      />
      <PropertyValue value={entry.value} onChange={setValue} />
      <PropertyTypeMenu value={entry.value} onChange={setValue} />
      <Button
        variant="ghost"
        size="icon-xs"
        aria-label={`Remove ${entry.key || "frontmatter row"}`}
        onClick={onRemove}
      >
        <X />
      </Button>
    </div>
  );
}

/** Raw entries hold YAML the panel cannot edit, such as nested mappings. */
function RawRow({
  entry,
  onRemove,
}: {
  entry: RawEntry;
  onRemove: () => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <div
        title="This frontmatter is kept as written"
        className="border-input text-muted-foreground font-ui min-h-8 flex-1 rounded-lg border px-2.5 py-1 text-sm whitespace-pre-wrap"
      >
        {entry.text}
      </div>
      <Button
        variant="ghost"
        size="icon-xs"
        aria-label="Remove frontmatter text"
        onClick={onRemove}
      >
        <X />
      </Button>
    </div>
  );
}

function PropertyValue({
  value,
  onChange,
}: {
  value: FrontmatterValue;
  onChange: (value: FrontmatterValue) => void;
}) {
  if (isListValue(value)) {
    return <ListValue items={value} onChange={onChange} />;
  }

  if (isCheckboxValue(value)) {
    return (
      <div className="flex flex-1 items-center">
        <Checkbox
          checked={value}
          onCheckedChange={(checked) => onChange(checked)}
        />
      </div>
    );
  }

  if (isNumberValue(value)) {
    return (
      <Input
        type="number"
        aria-label="Frontmatter value"
        className="flex-1"
        value={value}
        onChange={(event) => onChange(readNumber(event.target.value, value))}
      />
    );
  }

  if (isTextValue(value) && value.includes("\n")) {
    return (
      <Textarea
        aria-label="Frontmatter value"
        className="min-h-8 flex-1 resize-none"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    );
  }

  return (
    <Input
      aria-label="Frontmatter value"
      placeholder="Value"
      className="flex-1"
      value={value ?? ""}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}

function readNumber(
  text: string,
  fallback: FrontmatterValue,
): FrontmatterValue {
  if (text === "") {
    return null;
  }

  const parsed = Number(text);

  return Number.isFinite(parsed) ? parsed : fallback;
}

function ListValue({
  items,
  onChange,
}: {
  items: string[];
  onChange: (items: string[]) => void;
}) {
  const [draft, setDraft] = useState("");

  const add = (text: string) => {
    const value = text.trim();

    if (value !== "" && !items.includes(value)) {
      onChange([...items, value]);
    }
  };

  const commit = () => {
    add(draft);
    setDraft("");
  };

  return (
    <div className="flex flex-1 flex-wrap items-center gap-1.5">
      {items.map((item, index) => (
        <Badge key={item} variant="secondary">
          {item}
          <Button
            variant="ghost"
            size="icon-xs"
            className="size-4"
            aria-label={`Remove ${item}`}
            onClick={() =>
              onChange(items.filter((_, itemIndex) => itemIndex !== index))
            }
          >
            <X />
          </Button>
        </Badge>
      ))}
      <Input
        aria-label="Add list item"
        placeholder="Add item"
        density="compact"
        className="h-6 min-w-24 flex-1"
        value={draft}
        onChange={(event) => {
          const text = event.target.value;

          if (text.endsWith(",")) {
            add(text.slice(0, -1));
            setDraft("");

            return;
          }

          setDraft(text);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            commit();
          }
        }}
        onBlur={commit}
      />
    </div>
  );
}

const PROPERTY_TYPES: {
  label: string;
  icon: LucideIcon;
  applies: (value: FrontmatterValue) => boolean;
  convert: (value: FrontmatterValue) => FrontmatterValue;
}[] = [
  { label: "Text", icon: Type, applies: isTextValue, convert: toText },
  { label: "List", icon: List, applies: isListValue, convert: toList },
  { label: "Number", icon: Hash, applies: isNumberValue, convert: toNumber },
  {
    label: "Checkbox",
    icon: Check,
    applies: isCheckboxValue,
    convert: toCheckbox,
  },
];

function PropertyTypeMenu({
  value,
  onChange,
}: {
  value: FrontmatterValue;
  onChange: (value: FrontmatterValue) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label="Frontmatter value type"
          />
        }
      >
        <Type />
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        {PROPERTY_TYPES.map((type) => (
          <DropdownMenuItem
            key={type.label}
            onClick={() => onChange(type.convert(value))}
          >
            <type.icon />
            {type.label}
            {type.applies(value) ? <Check /> : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function toText(value: FrontmatterValue): FrontmatterValue {
  if (value === null) {
    return "";
  }

  if (isListValue(value)) {
    return value.join(", ");
  }

  return String(value);
}

function toList(value: FrontmatterValue): FrontmatterValue {
  if (value === null) {
    return [];
  }

  if (isListValue(value)) {
    return value;
  }

  return [String(value)];
}

function toNumber(value: FrontmatterValue): FrontmatterValue {
  if (value === null) {
    return 0;
  }

  if (isListValue(value)) {
    return value;
  }

  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : value;
}

function toCheckbox(value: FrontmatterValue): FrontmatterValue {
  if (isCheckboxValue(value) || isListValue(value)) {
    return value;
  }

  if (value === null) {
    return false;
  }

  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  return value;
}
