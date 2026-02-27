"use client";

import { useRef, useState, useCallback } from "react";
import dynamic from "next/dynamic";
import type { EmojiClickData } from "emoji-picker-react";

const EmojiPicker = dynamic(() => import("emoji-picker-react"), { ssr: false });

const inputStyle = {
  width: "100%",
  padding: "0.5rem 2.25rem 0.5rem 0.75rem",
  borderRadius: 8,
  border: "1px solid var(--border)",
  boxSizing: "border-box",
};
const textareaStyle = {
  ...inputStyle,
  padding: "0.5rem 2.25rem 0.5rem 0.75rem",
  resize: "vertical" as const,
  minHeight: 60,
};

function insertAtCursor(
  el: HTMLInputElement | HTMLTextAreaElement,
  value: string,
  newChar: string
): string {
  const start = el.selectionStart ?? value.length;
  const end = el.selectionEnd ?? value.length;
  const before = value.slice(0, start);
  const after = value.slice(end);
  return before + newChar + after;
}

type EmojiFieldProps = {
  value: string;
  onChange: (value: string) => void;
  type: "input" | "textarea";
  placeholder?: string;
  rows?: number;
  id?: string;
  className?: string;
  style?: React.CSSProperties;
};

export function EmojiField({
  value,
  onChange,
  type,
  placeholder,
  rows = 2,
  id,
  className,
  style,
}: EmojiFieldProps) {
  const ref = useRef<HTMLInputElement | HTMLTextAreaElement>(null);
  const [showPicker, setShowPicker] = useState(false);

  const handleEmojiClick = useCallback(
    (data: EmojiClickData) => {
      const emoji = data.emoji;
      if (!ref.current || !emoji) return;
      const next = insertAtCursor(ref.current, value, emoji);
      onChange(next);
      ref.current.focus();
    },
    [value, onChange]
  );

  const baseStyle = type === "textarea" ? textareaStyle : inputStyle;
  const mergedStyle = style ? { ...baseStyle, ...style } : baseStyle;

  return (
    <div style={{ position: "relative", display: "block", width: "100%", boxSizing: "border-box" }} className={className}>
      {type === "input" ? (
        <input
          ref={ref as React.RefObject<HTMLInputElement>}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          id={id}
          style={mergedStyle}
        />
      ) : (
        <textarea
          ref={ref as React.RefObject<HTMLTextAreaElement>}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={rows}
          id={id}
          style={mergedStyle}
        />
      )}
      <button
        type="button"
        onClick={() => setShowPicker((p) => !p)}
        title="Add emoji"
        aria-label="Add emoji"
        style={{
          position: "absolute",
          top: type === "textarea" ? "0.5rem" : "0.4rem",
          right: "0.5rem",
          width: 24,
          height: 24,
          borderRadius: 6,
          border: "1px solid var(--border)",
          background: "var(--bg-card)",
          cursor: "pointer",
          fontSize: "0.9rem",
          lineHeight: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          opacity: showPicker ? 1 : 0.85,
        }}
      >
        😀
      </button>
      {showPicker && (
        <>
          <div
            role="button"
            tabIndex={0}
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 999,
            }}
            onClick={() => setShowPicker(false)}
            onKeyDown={(e) => e.key === "Escape" && setShowPicker(false)}
            aria-label="Close emoji picker"
          />
          <div
            style={{
              position: "absolute",
              top: "100%",
              right: 0,
              marginTop: 4,
              zIndex: 1000,
              borderRadius: 12,
              overflow: "hidden",
              boxShadow: "0 8px 32px rgba(0,0,0,0.15)",
            }}
          >
            <EmojiPicker
              onEmojiClick={handleEmojiClick}
              open={true}
              width="100%"
              height={360}
              theme="light"
              previewConfig={{ showPreview: false }}
            />
          </div>
        </>
      )}
    </div>
  );
}
