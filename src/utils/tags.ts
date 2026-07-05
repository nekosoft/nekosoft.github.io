/** Normalise a human-readable tag into a URL-safe slug.
 *  Used on both the about page (chip links) and the blog filter buttons
 *  so a link like /blog?tag=llm-agentic-ai always matches its button. */
export function slugifyTag(tag: string): string {
  return tag
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
