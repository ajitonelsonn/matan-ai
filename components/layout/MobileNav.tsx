"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu as MenuIcon } from "lucide-react";
import { Drawer } from "@/components/ui/Drawer";
import { IconButton } from "@/components/ui/IconButton";
import { BrandMark, SidebarContent } from "./Sidebar";
import { NotificationsButton, ProfileMenu } from "./Topbar";

/** Sticky header for < lg screens. Opens the sidebar as a slide-over drawer. */
export function MobileNav() {
  const [open, setOpen] = React.useState(false);
  const pathname = usePathname();

  React.useEffect(() => setOpen(false), [pathname]);

  return (
    <>
      <div className="sticky top-0 z-50 flex h-16 items-center justify-between border-b border-border bg-surface/85 px-4 backdrop-blur-xl lg:hidden">
        <div className="flex items-center gap-2">
          <IconButton label="Open navigation" variant="outline" onClick={() => setOpen(true)} aria-expanded={open} aria-controls="mobile-nav">
            <MenuIcon />
          </IconButton>
          <Link href="/" className="flex items-center gap-2">
            <BrandMark size={36} />
            <span className="text-base font-extrabold tracking-[0.06em] text-text">MATAN AI</span>
          </Link>
        </div>
        <div className="flex items-center gap-1.5">
          <NotificationsButton />
          <ProfileMenu compact />
        </div>
      </div>
      <Drawer open={open} onClose={() => setOpen(false)} side="left" width="max-w-[17rem]" className="p-0 [&>div]:p-0">
        <div id="mobile-nav" className="h-full">
          <SidebarContent onNavigate={() => setOpen(false)} />
        </div>
      </Drawer>
    </>
  );
}
