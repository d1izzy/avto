import { defineTheme } from "@astryxdesign/core/theme";
import { neutralTheme } from "@astryxdesign/theme-neutral";

export function studioTheme(accent = "#D7FF3F", name = "studio") {
  return defineTheme({
    name, extends: neutralTheme,
    tokens: {
      "--color-background-body": "#090a0c",
      "--color-background-surface": "#101114",
      "--color-background-card": "#141519",
      "--color-background-popover": "#17181d",
      "--color-background-muted": "#1d1f24",
      "--color-text-primary": "#f4f4f5",
      "--color-text-secondary": "#a7a9b2",
      "--color-border": "#292b32",
      "--color-accent": accent,
      "--color-text-accent": accent,
      "--color-on-accent": "#10120a",
      "--radius-container": "16px",
      "--radius-page": "20px",
      "--radius-element": "12px",
    },
    components: {
      button: { base: { borderRadius: "var(--radius-element)", minHeight: "var(--size-element-lg)" }, "variant:primary": { backgroundColor: "var(--color-accent)", color: "var(--color-on-accent)" } },
      card: { base: { borderRadius: "var(--radius-container)" } },
    },
  });
}
export const defaultTheme = studioTheme();
