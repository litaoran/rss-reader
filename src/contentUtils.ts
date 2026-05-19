/**
 * Heuristic: does this article body look like it was truncated by the feed
 * publisher? Many RSS feeds (e.g. Medium-based sites like Towards Data Science)
 * only emit the first paragraph or two followed by a "Continue reading…" link.
 * When this returns true we re-scrape the article URL to get the full body.
 */
export function isPartialContent(html: string | null | undefined): boolean {
  if (!html) return false;
  // Truncation markers almost always appear near the end of the partial body.
  const tail = html.slice(-600);
  return /continue reading|read (the )?(full|rest|original) (article|post|story)|\[…\]|\[\.\.\.\]/i.test(tail);
}
