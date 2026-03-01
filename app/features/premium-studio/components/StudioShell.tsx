"use client";

import React from "react";

interface StudioShellProps {
  title?: string;
  children: React.ReactNode;
  className?: string;
}

export function StudioShell({ title, children, className = "" }: StudioShellProps) {
  return (
    <div className={`admin-main premium-studio-shell ${className}`.trim()} role="main">
      <div className="admin-main-inner">
        {title ? (
          <header className="premium-studio-header">
            <h1 className="admin-header-title" style={{ color: "var(--text)", margin: 0 }}>
              {title}
            </h1>
          </header>
        ) : null}
        <div className="premium-studio-content">
          {children}
        </div>
      </div>
    </div>
  );
}
