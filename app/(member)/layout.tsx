"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { MemberHeader } from "../components/MemberHeader";
import { RequireAuth } from "../components/RequireAuth";

export default function MemberLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const active = pathname === "/treats" ? "treats" : pathname === "/tip" ? "tip" : pathname === "/dms" ? "dms" : "home";

  useEffect(() => {
    const protectVideos = () => {
      document.querySelectorAll("video").forEach((video) => {
        video.setAttribute("controlsList", "nodownload noplaybackrate noremoteplayback");
        video.setAttribute("disablePictureInPicture", "true");
        (video as HTMLVideoElement).disablePictureInPicture = true;
      });
    };

    const onContextMenu = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest("img, video")) {
        event.preventDefault();
      }
    };

    const onDragStart = (event: DragEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest("img, video")) {
        event.preventDefault();
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      const isSavePrintHotkey =
        (event.ctrlKey || event.metaKey) &&
        (key === "s" || key === "p" || key === "u");
      if (isSavePrintHotkey || key === "printscreen") {
        event.preventDefault();
        if (key === "printscreen" && navigator.clipboard?.writeText) {
          navigator.clipboard.writeText("").catch(() => {});
        }
      }
    };

    protectVideos();
    document.addEventListener("contextmenu", onContextMenu);
    document.addEventListener("dragstart", onDragStart);
    document.addEventListener("keydown", onKeyDown);
    const observer = new MutationObserver(() => protectVideos());
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      document.removeEventListener("contextmenu", onContextMenu);
      document.removeEventListener("dragstart", onDragStart);
      document.removeEventListener("keydown", onKeyDown);
      observer.disconnect();
    };
  }, []);

  return (
    <RequireAuth>
      <MemberHeader active={active} />
      <div className="member-protected-media">{children}</div>
    </RequireAuth>
  );
}
