/**
 * Stormijxo Premium Studio — semantic theme tokens.
 * Use CSS variables from styles.css :root (no EchoFlux blue).
 */
export const stormijxoStudioTokens = {
  brand: "var(--brand, var(--accent))",
  brandHover: "var(--brand-hover, var(--accent-hover))",
  bg: "var(--bg)",
  surface: "var(--surface)",
  surface2: "var(--surface-2)",
  bgCard: "var(--bg-card)",
  text: "var(--text)",
  textMuted: "var(--text-muted)",
  border: "var(--border)",
  success: "var(--success)",
  warning: "var(--warning)",
  danger: "var(--danger)",
  accentSoft: "var(--accent-soft)",
  serif: "var(--serif)",
  sans: "var(--sans)",
} as const;

export type StormijxoStudioTokens = typeof stormijxoStudioTokens;

/** Class names for common studio UI (use with global Stormijxo CSS) */
export const studioClasses = {
  panel: "admin-main panel",
  card: "stat-card",
  input: "admin-posts-caption-input",
  btnPrimary: "btn btn-primary",
  btnSecondary: "btn btn-secondary",
  label: "admin-posts-card-heading",
  muted: "admin-posts-hint",
} as const;
