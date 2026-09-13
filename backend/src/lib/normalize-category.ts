/**
 * Asset `category` is free text, not a fixed enum — normalizes to a
 * consistent SCREAMING_SNAKE_CASE form so the same category typed as
 * "Network Gear", "network gear", or "network-gear" all match, and to
 * match the existing display convention (`category.replace(/_/g, " ")`)
 * used throughout the asset UI.
 */
export function normalizeCategory(raw: string): string {
  return raw.trim().toUpperCase().replace(/[\s-]+/g, "_");
}
