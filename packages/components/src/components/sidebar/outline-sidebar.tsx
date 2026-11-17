import { ArrowDown01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button } from "@lunarscribe/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
} from "@lunarscribe/components/ui/sidebar";
import { cn } from "@lunarscribe/utils/cn";
import type { NodeKey } from "lexical";
import { type CSSProperties, useState } from "react";

import type { HeadingAnchor } from "../editor/heading-anchors";
import { SidebarResizeRail } from "./sidebar-resize-rail";

/** The markdown editor's h1 to h3 colors; h4 to h6 keep the foreground there too. */
const HEADING_COLORS = [
  "text-heading-1",
  "text-heading-2",
  "text-heading-3",
] as const;

/** A heading and the headings nested under it. */
type OutlineNode = {
  heading: HeadingAnchor;
  children: OutlineNode[];
};

/** Nests each heading under the closest shallower heading above it. */
function buildTree(headings: HeadingAnchor[]) {
  const roots: OutlineNode[] = [];
  const open: OutlineNode[] = [];

  for (const heading of headings) {
    while ((open.at(-1)?.heading.level ?? 0) >= heading.level) {
      open.pop();
    }

    const node: OutlineNode = { heading, children: [] };

    (open.at(-1)?.children ?? roots).push(node);
    open.push(node);
  }

  return roots;
}

/** Keys from a top-level heading down to `key`; empty when no heading has it. */
function pathTo(nodes: OutlineNode[], key: NodeKey | null): NodeKey[] {
  for (const node of nodes) {
    if (node.heading.key === key) {
      return [key];
    }

    const below = pathTo(node.children, key);

    if (below.length) {
      return [node.heading.key, ...below];
    }
  }

  return [];
}

type BranchProps = {
  nodes: OutlineNode[];
  path: ReadonlySet<NodeKey>;
  activeKey: NodeKey | null;
  folded: ReadonlySet<NodeKey>;
  onToggle: (key: NodeKey) => void;
  onSelect: (key: NodeKey) => void;
};

/** One heading's row: the heading itself and, when it has sub-headings, its fold toggle. */
function OutlineRow({
  node,
  isActive,
  isFolded,
  onToggle,
  onSelect,
}: {
  node: OutlineNode;
  isActive: boolean;
  isFolded: boolean;
  onToggle: (key: NodeKey) => void;
  onSelect: (key: NodeKey) => void;
}) {
  const { heading } = node;

  return (
    <div className="flex items-center">
      <SidebarMenuButton
        size="sm"
        title={heading.text}
        aria-current={isActive ? "location" : undefined}
        className="min-w-0 flex-1"
        onClick={() => onSelect(heading.key)}
      >
        <span
          className={cn(
            HEADING_COLORS[heading.level - 1],
            isActive && "font-semibold",
          )}
        >
          {heading.text}
        </span>
      </SidebarMenuButton>
      {node.children.length > 0 && (
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label={`${isFolded ? "Unfold" : "Fold"} ${heading.text}`}
          aria-expanded={!isFolded}
          onClick={() => onToggle(heading.key)}
        >
          <HugeiconsIcon
            icon={ArrowDown01Icon}
            strokeWidth={2}
            className={cn(
              "transition-transform motion-reduce:transition-none",
              isFolded && "-rotate-90",
            )}
          />
        </Button>
      )}
    </div>
  );
}

/**
 * A heading's sub-headings, each branching off a trunk under it. The lines on
 * the way to the caret's section turn the primary color; folding slides the
 * branch shut.
 */
function OutlineBranches({
  parentLabel,
  isFolded,
  ...props
}: BranchProps & { parentLabel: string; isFolded: boolean }) {
  const { nodes, path } = props;
  const onPath = nodes.findIndex((node) => path.has(node.heading.key));

  return (
    <div className="branch-fold" data-folded={isFolded || undefined}>
      <ul
        aria-label={`Under ${parentLabel}`}
        className="branch-list"
        inert={isFolded}
      >
        {nodes.map((node, index) => (
          <li
            key={node.heading.key}
            className="branch-item"
            data-path={
              index === onPath ? "to" : index < onPath ? "through" : undefined
            }
          >
            <span aria-hidden className="branch-elbow" />
            <OutlineNodeItem node={node} {...props} />
          </li>
        ))}
      </ul>
    </div>
  );
}

/** A heading's row and, under it, its sub-headings. */
function OutlineNodeItem({
  node,
  ...props
}: Omit<BranchProps, "nodes"> & { node: OutlineNode }) {
  const { activeKey, folded, onToggle, onSelect } = props;
  const isFolded = folded.has(node.heading.key);

  return (
    <>
      <OutlineRow
        node={node}
        isActive={node.heading.key === activeKey}
        isFolded={isFolded}
        onToggle={onToggle}
        onSelect={onSelect}
      />
      {node.children.length > 0 && (
        <OutlineBranches
          {...props}
          nodes={node.children}
          parentLabel={node.heading.text}
          isFolded={isFolded}
        />
      )}
    </>
  );
}

/**
 * The headings as a branched menu: each heading's sub-headings branch off a
 * trunk under it, the lines to the caret's section turn the primary color,
 * and a chevron folds a heading's branch. Colored like the editor's headings.
 * Needs a sidebar provider, as every sidebar menu does.
 */
export function OutlineMenu({
  headings,
  activeKey,
  onSelect,
}: {
  headings: HeadingAnchor[];
  activeKey: NodeKey | null;
  onSelect: (key: NodeKey) => void;
}) {
  const [folded, setFolded] = useState<ReadonlySet<NodeKey>>(new Set());

  if (!headings.length) {
    return (
      <p className="text-muted-foreground px-2 py-1 text-xs">
        Headings in this note appear here.
      </p>
    );
  }

  const tree = buildTree(headings);
  const path = new Set(pathTo(tree, activeKey));

  const toggle = (key: NodeKey) =>
    setFolded((previous) => {
      const next = new Set(previous);

      if (!next.delete(key)) {
        next.add(key);
      }

      return next;
    });

  return (
    <div className="branch-tree">
      <SidebarMenu aria-label="Outline">
        {tree.map((node) => (
          <SidebarMenuItem key={node.heading.key}>
            <OutlineNodeItem
              node={node}
              path={path}
              activeKey={activeKey}
              folded={folded}
              onToggle={toggle}
              onSelect={onSelect}
            />
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
    </div>
  );
}

/**
 * Outline of a markdown buffer's headings on the right of the window, as a
 * branched menu colored like the editor's headings. It has
 * its own sidebar provider, so it opens independently of the left sidebar;
 * the app owns `open`, `width` (in CSS pixels) and the shortcut that toggles it.
 */
export function OutlineSidebar({
  open,
  onOpenChange,
  width,
  onWidthChange,
  headings,
  activeKey,
  onSelect,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  width: number;
  onWidthChange: (width: number) => void;
  headings: HeadingAnchor[];
  activeKey: NodeKey | null;
  onSelect: (key: NodeKey) => void;
}) {
  const sidebarStyle: CSSProperties & Record<"--sidebar-width", string> = {
    "--sidebar-width": `${width}px`,
  };

  return (
    <SidebarProvider
      open={open}
      onOpenChange={onOpenChange}
      keyboardShortcut={null}
      data-nested-sidebar
      style={sidebarStyle}
      className="min-h-0 w-auto flex-none"
    >
      <Sidebar side="right">
        <div
          className="flex h-10 shrink-0 items-center px-4 text-xs font-medium"
          data-outline-header
        >
          Outline
        </div>
        <SidebarContent>
          <div className="p-2">
            <OutlineMenu
              headings={headings}
              activeKey={activeKey}
              onSelect={onSelect}
            />
          </div>
        </SidebarContent>
        <SidebarResizeRail
          width={width}
          onWidthChange={onWidthChange}
          side="right"
        />
      </Sidebar>
    </SidebarProvider>
  );
}
