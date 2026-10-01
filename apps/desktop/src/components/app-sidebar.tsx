import { FluidHighlight } from "@lunarscribe/components/fluid-motion/fluid-motion";
import { Hint } from "@lunarscribe/components/hint/hint";
import { Button } from "@lunarscribe/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@lunarscribe/components/ui/sidebar";
import { TooltipProvider } from "@lunarscribe/components/ui/tooltip";
import { FilePlus, FileText, PenTool, Settings, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";

import {
  kindOf,
  stemOf,
  useActiveBuffer,
  useBufferStore,
} from "@/stores/buffer-store";

/** App sidebar listing the markdown files and drawings in Documents/lunarscribe; clicking one opens it. */
export function AppSidebar() {
  const [files, setFiles] = useState<string[]>([]);
  const openFile = useBufferStore((state) => state.openFile);
  const createBuffer = useBufferStore((state) => state.createBuffer);
  const deleteFile = useBufferStore((state) => state.deleteFile);
  const activeFileName = useActiveBuffer()?.fileName;

  useEffect(() => {
    void window.lunarscribe.listFiles().then(setFiles);

    return window.lunarscribe.onFilesChanged(setFiles);
  }, []);

  return (
    <Sidebar>
      {/* Hover waits 800ms; moving to a neighbour within 300ms opens it instantly. */}
      <TooltipProvider delay={800} timeout={300}>
        <SidebarHeader className="relative flex-row justify-center">
          <FluidHighlight rows="button" className="bg-muted rounded-lg" />
          <Hint label="New note" side="bottom">
            <Button
              variant="fluid"
              size="icon-sm"
              aria-label="New note"
              onClick={() => createBuffer("markdown", files)}
            >
              <FilePlus />
            </Button>
          </Hint>
          <Hint label="New drawing" side="bottom">
            <Button
              variant="fluid"
              size="icon-sm"
              aria-label="New drawing"
              onClick={() => createBuffer("drawing", files)}
            >
              <PenTool />
            </Button>
          </Hint>
          {/* TODO: open the settings window. */}
          <Hint label="Settings" side="bottom">
            <Button variant="fluid" size="icon-sm" aria-label="Settings">
              <Settings />
            </Button>
          </Hint>
        </SidebarHeader>
      </TooltipProvider>
      <SidebarContent>
        <SidebarGroup>
          <SidebarMenu>
            {files.map((name) => (
              <SidebarMenuItem key={name} className="overflow-clip">
                <SidebarMenuButton
                  isActive={name === activeFileName}
                  onClick={() => void openFile(name)}
                >
                  {kindOf(name) === "drawing" ? <PenTool /> : <FileText />}
                  <span>{stemOf(name)}</span>
                </SidebarMenuButton>
                <SidebarMenuAction
                  render={<Button variant="destructive" size="icon-xs" />}
                  showOnHover
                  aria-label={`Delete ${name}`}
                  onClick={() => void deleteFile(name)}
                >
                  <Trash2 />
                </SidebarMenuAction>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
