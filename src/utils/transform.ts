import { WPPost, WPMedia, WPUser, WPTerm } from "../types/wordpress";

export interface ArticleImage {
  src: string;
  alt: string;
  caption?: string;
  width?: number;
  height?: number;
}

export interface ArticleContentBlock {
  type: "paragraph" | "image";
  text?: string;
  image?: ArticleImage;
}

// ── Normalised article model used by React UI components ──────────────────────
export interface Article {
  id: number;
  slug: string;
  title: string;
  subtitle: string;  // WP excerpt, stripped of HTML
  category: string;
  author: string;
  authorAvailable: boolean;
  date: string;       // Formatted display date
  publishedAt: string;
  modifiedAt: string;
  timeAgo: string;
  readTime: string;   // Estimated from word count
  image: string;      // Best available featured image URL
  imageAlt: string;
  images: ArticleImage[];
  content: ArticleContentBlock[];
  body: string[];     // Paragraphs split from rendered content
  pullQuote?: string;
  link: string;       // Canonical WP permalink
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function stripHtml(html: string): string {
  let rawText = html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .trim();

  if (typeof DOMParser !== "undefined") {
    for (let pass = 0; pass < 2; pass += 1) {
      const decoded = new DOMParser().parseFromString(rawText, "text/html").documentElement.textContent ?? rawText;
      if (decoded === rawText) break;
      rawText = decoded;
    }
  } else {
    const entities: Record<string, string> = {
      amp: "&", apos: "'", gt: ">", lt: "<", mdash: "—", nbsp: " ", ndash: "–", quot: '"',
    };
    for (let pass = 0; pass < 2; pass += 1) {
      const decoded = rawText.replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (entity, code: string) => {
        if (code[0] === "#") {
          const value = code[1].toLowerCase() === "x"
            ? Number.parseInt(code.slice(2), 16)
            : Number.parseInt(code.slice(1), 10);
          return Number.isInteger(value) && value >= 0 && value <= 0x10ffff
            ? String.fromCodePoint(value)
            : entity;
        }
        return entities[code.toLowerCase()] ?? entity;
      });
      if (decoded === rawText) break;
      rawText = decoded;
    }
  }

  return rawText
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeImageUrl(input: string | null | undefined): string {
  if (!input) return "";

  const trimmed = input.trim().replace(/&amp;/g, "&");
  if (!trimmed) return "";

  const decoded = (() => {
    try {
      return decodeURIComponent(trimmed);
    } catch {
      return trimmed;
    }
  })();

  const candidate = decoded.replace(/[?#].*$/, "");
  const lower = candidate.toLowerCase();
  const isRelative = /^\.{0,2}\//.test(candidate) || candidate.startsWith("/") || candidate.startsWith("//");
  const isHttpUrl = /^https?:\/\//i.test(candidate);

  if (!isRelative && !isHttpUrl) {
    return "";
  }

  if (lower.startsWith("javascript:") || lower.startsWith("data:") || lower.startsWith("vbscript:")) {
    return "";
  }

  return candidate;
}

function canonicalImageKey(src: string | null | undefined): string {
  const normalized = normalizeImageUrl(src);
  if (!normalized) return "";

  const withoutSizeVariant = normalized.replace(/-(\d+)x(\d+)(?=\.[a-z0-9]+$)/i, "");
  return withoutSizeVariant.toLowerCase();
}

function safeText(value: string | null | undefined): string {
  return stripHtml(value ?? "");
}

export function isAuthorByline(text: string): boolean {
  return /^by\s+[^:]{1,100}\s*:\s*$/iu.test(text.trim());
}

function removeAuthorBylineBlocks(html: string): string {
  return html.replace(/<(p|div|h[1-6]|li)\b[^>]*>([\s\S]*?)<\/\1>/gi, (block, _tag: string, content: string) =>
    isAuthorByline(stripHtml(content)) ? "" : block
  );
}

function getAttribute(tag: string, name: string): string {
  const regex = new RegExp(`${name}\\s*=\\s*(?:\"([^\"]*)\"|'([^']*)'|([^\\s>]+))`, "i");
  const match = tag.match(regex);
  if (!match) return "";
  return (match[1] ?? match[2] ?? match[3] ?? "").trim();
}

function imageFromTag(tag: string, fallbackAlt = ""): ArticleImage | null {
  const src = normalizeImageUrl(getAttribute(tag, "src") || getAttribute(tag, "data-src") || getAttribute(tag, "data-lazy-src"));
  if (!src) return null;

  return {
    src,
    alt: safeText(getAttribute(tag, "alt") || fallbackAlt),
  };
}

function collectArticleImages(post: WPPost): ArticleImage[] {
  const featured = post._embedded?.["wp:featuredmedia"]?.[0] as WPMedia | undefined;
  const featuredUrl = featured ? (() => {
    const sizes = featured.media_details?.sizes;
    if (sizes) {
      const selected = sizes["medium_large"] ?? sizes["large"] ?? sizes["medium"] ?? sizes["thumbnail"];
      if (selected?.source_url) return selected.source_url;
    }
    return featured.source_url ?? "";
  })() : "";

  const images: ArticleImage[] = [];
  const seen = new Set<string>();

  const addImage = (image: ArticleImage | null) => {
    if (!image || !image.src) return;
    const normalized = canonicalImageKey(image.src);
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    images.push({ ...image, alt: image.alt || "Article image" });
  };

  addImage(featured ? { src: featuredUrl, alt: featured.alt_text || stripHtml(post.title.rendered), caption: safeText(featured.caption?.rendered) } : null);

  const contentHtml = post.content?.rendered ?? "";
  const figureMatches = [...contentHtml.matchAll(/<figure\b[^>]*>([\s\S]*?)<\/figure>/gi)];
  for (const match of figureMatches) {
    const figureHtml = match[0];
    const imgMatch = figureHtml.match(/<img\b[^>]*>/i);
    if (!imgMatch) continue;
    const imgTag = imgMatch[0];
    const caption = safeText((figureHtml.match(/<figcaption\b[^>]*>([\s\S]*?)<\/figcaption>/i)?.[1] ?? ""));
    addImage({
      ...imageFromTag(imgTag, featured?.alt_text || stripHtml(post.title.rendered)),
      caption: caption || undefined,
    });
  }

  const standaloneMatches = [...contentHtml.matchAll(/<img\b[^>]*>/gi)];
  for (const match of standaloneMatches) {
    const tag = match[0];
    const isWithinFigure = figureMatches.some(figure => {
      const start = figure.index ?? 0;
      const end = start + figure[0].length;
      return (match.index ?? 0) >= start && (match.index ?? 0) < end;
    });
    if (isWithinFigure) continue;
    addImage(imageFromTag(tag, featured?.alt_text || stripHtml(post.title.rendered)));
  }

  return images;
}

function splitIntoParagraphs(html: string): string[] {
  const pMatches = [...html.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)];
  if (pMatches.length > 0) {
    return pMatches
      .map(match => stripHtml(match[1]))
      .filter(piece => piece.length > 0 && !isAuthorByline(piece));
  }
  return stripHtml(html)
    .split(/\n\n+/)
    .map(piece => piece.trim())
    .filter(piece => piece.length > 0 && !isAuthorByline(piece));
}

function appendParagraphBlocks(blocks: ArticleContentBlock[], html: string): void {
  const paragraphMatches = [...html.matchAll(/<p\b[^>]*>[\s\S]*?<\/p>/gi)];
  if (paragraphMatches.length === 0) {
    const text = stripHtml(html);
    if (text) blocks.push({ type: "paragraph", text });
    return;
  }

  let lastIndex = 0;
  for (const match of paragraphMatches) {
    const index = match.index ?? 0;
    const precedingText = stripHtml(html.slice(lastIndex, index));
    if (precedingText) blocks.push({ type: "paragraph", text: precedingText });

    const text = stripHtml(match[0]);
    if (text) blocks.push({ type: "paragraph", text });
    lastIndex = index + match[0].length;
  }

  const trailingText = stripHtml(html.slice(lastIndex));
  if (trailingText) blocks.push({ type: "paragraph", text: trailingText });
}

function buildContentBlocks(html: string, images: ArticleImage[]): ArticleContentBlock[] {
  const blocks: ArticleContentBlock[] = [];
  const contentHtml = html ?? "";
  const imageMatches = [...contentHtml.matchAll(/<figure\b[^>]*>[\s\S]*?<\/figure>|<img\b[^>]*>/gi)];
  const featuredImageKey = canonicalImageKey(images[0]?.src ?? "");
  const seenImageKeys = new Set<string>();
  let lastIndex = 0;

  for (const match of imageMatches) {
    const index = match.index ?? 0;
    const before = contentHtml.slice(lastIndex, index);
    appendParagraphBlocks(blocks, before);

    const matchedHtml = match[0];
    const figureMatch = matchedHtml.match(/<figure\b[^>]*>([\s\S]*?)<\/figure>/i);
    let imageDef: ArticleImage | null = null;
    if (figureMatch) {
      const figureHtml = figureMatch[0];
      const imgTag = figureHtml.match(/<img\b[^>]*>/i)?.[0];
      const caption = safeText(figureHtml.match(/<figcaption\b[^>]*>([\s\S]*?)<\/figcaption>/i)?.[1] ?? "");
      imageDef = imgTag ? { ...imageFromTag(imgTag)!, caption: caption || undefined } : null;
    } else {
      imageDef = imageFromTag(matchedHtml);
    }

    if (imageDef) {
      const key = canonicalImageKey(imageDef.src);
      if (!key || (featuredImageKey && key === featuredImageKey) || seenImageKeys.has(key)) {
        lastIndex = index + matchedHtml.length;
        continue;
      }

      seenImageKeys.add(key);
      const image = images.find(item => canonicalImageKey(item.src) === key) ?? imageDef;
      blocks.push({ type: "image", image });
    }

    lastIndex = index + matchedHtml.length;
  }

  appendParagraphBlocks(blocks, contentHtml.slice(lastIndex));

  return blocks.filter(block => block.type === "paragraph" ? Boolean(block.text) : Boolean(block.image?.src));
}

function estimateReadTime(text: string): string {
  const words = text.trim().split(/\s+/).length;
  const minutes = Math.max(1, Math.round(words / 200));
  return `${minutes} min read`;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" });
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-ZA", {
    day: "numeric", month: "long", year: "numeric",
  });
}

function getFeaturedImageUrl(post: WPPost): string {
  const media = post._embedded?.["wp:featuredmedia"]?.[0] as WPMedia | undefined;
  if (!media) return "";
  const sizes = media.media_details?.sizes;
  if (sizes) {
    const s = sizes["medium_large"] ?? sizes["large"] ?? sizes["medium"] ?? sizes["thumbnail"];
    if (s) return s.source_url;
  }
  return media.source_url ?? "";
}

function getFeaturedImageAlt(post: WPPost): string {
  const media = post._embedded?.["wp:featuredmedia"]?.[0] as WPMedia | undefined;
  return media?.alt_text ?? stripHtml(post.title.rendered);
}

function getAuthorName(post: WPPost): { name: string; available: boolean } {
  const author = post._embedded?.author?.[0] as WPUser | undefined;
  const contentText = stripHtml(post.content?.rendered ?? "");
  const match = contentText.match(/BY\s+([^:]+):/i);
  const byline = match?.[1]?.trim().replace(/\s+/g, " ") || "";
  const embeddedName = safeText(author?.name);
  const isPublicationName = /^(?:news\s*south\s*africa|newssa)$/i.test(embeddedName);
  const name = byline || (isPublicationName ? "" : embeddedName);
  return { name, available: Boolean(name) };
}

function getPrimaryCategory(post: WPPost): string {
  const terms = post._embedded?.["wp:term"] ?? [];
  const categories = (terms[0] ?? []) as WPTerm[];
  const cat = categories.find(t => t.taxonomy === "category" && t.slug !== "uncategorized");
  return cat?.name ?? categories[0]?.name ?? "News";
}

function extractPullQuote(paragraphs: string[]): string | undefined {
  return paragraphs.find(p => p.length > 60 && p.length < 240);
}

// ── Main transformer ───────────────────────────────────────────────────────────

export function transformPost(post: WPPost): Article {
  const images = collectArticleImages(post);
  const articleHtml = removeAuthorBylineBlocks(post.content.rendered);
  const content = buildContentBlocks(articleHtml, images)
    .filter(block => block.type !== "paragraph" || !isAuthorByline(block.text ?? ""));
  const paragraphs = content
    .filter(block => block.type === "paragraph" && block.text)
    .map(block => block.text!)
    .filter(text => !isAuthorByline(text));
  const body = paragraphs.length > 0 ? paragraphs : splitIntoParagraphs(articleHtml);
  const plainBody = body.join(" ");
  const author = getAuthorName(post);
  const featuredImage = images[0]?.src || getFeaturedImageUrl(post) || "";

  return {
    id: post.id,
    slug: post.slug,
    title: stripHtml(post.title.rendered),
    subtitle: stripHtml(post.excerpt.rendered),
    category: getPrimaryCategory(post),
    author: author.name,
    authorAvailable: author.available,
    date: formatDate(post.date),
    publishedAt: post.date,
    modifiedAt: post.modified,
    timeAgo: timeAgo(post.date),
    readTime: estimateReadTime(plainBody),
    image: featuredImage,
    imageAlt: getFeaturedImageAlt(post),
    images,
    content,
    body,
    pullQuote: extractPullQuote(body),
    link: post.link,
  };
}

export function transformPosts(posts: WPPost[]): Article[] {
  return posts.map(transformPost);
}
