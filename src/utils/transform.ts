import { WPPost, WPMedia, WPUser, WPTerm } from "../types/wordpress";

export interface ArticleImage {
  src: string;
  alt: string;
  caption?: string;
  width?: number;
  height?: number;
  srcSet?: string;
  sizes?: string;
  alignment?: "left" | "center" | "right" | "wide" | "full";
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
  hasFeaturedImage: boolean;
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

function extractImageCaption(html: string): string | undefined {
  const caption =
    html.match(/<figcaption\b[^>]*>([\s\S]*?)<\/figcaption>/i)?.[1]
    ?? html.match(/<p\b[^>]*\b(?:wp-caption-text|wp-element-caption)\b[^>]*>([\s\S]*?)<\/p>/i)?.[1]
    ?? html.match(/<div\b[^>]*\b(?:wp-caption-text|wp-element-caption)\b[^>]*>([\s\S]*?)<\/div>/i)?.[1];
  return safeText(caption) || undefined;
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

function positiveDimension(value: string): number | undefined {
  const dimension = Number.parseInt(value, 10);
  return Number.isFinite(dimension) && dimension > 0 ? dimension : undefined;
}

function getStyleDimension(style: string, property: "width" | "height"): number | undefined {
  const value = style.match(new RegExp(`(?:^|;)\\s*${property}\\s*:\\s*(\\d+(?:\\.\\d+)?)px`, "i"))?.[1];
  return value ? positiveDimension(value) : undefined;
}

function normalizeSrcSet(value: string): string | undefined {
  const sources = value.split(",").flatMap(candidate => {
    const [url, descriptor] = candidate.trim().split(/\s+/, 2);
    const normalizedUrl = normalizeImageUrl(url);
    if (!normalizedUrl || (descriptor && !/^\d+(?:\.\d+)?[wx]$/i.test(descriptor))) return [];
    return [`${normalizedUrl}${descriptor ? ` ${descriptor}` : ""}`];
  });
  return sources.length ? sources.join(", ") : undefined;
}

function getImageAlignment(...metadata: string[]): ArticleImage["alignment"] {
  const value = metadata.join(" ").toLowerCase();
  const classMatch = value.match(/(?:^|\s)align(left|center|right|wide|full)(?=\s|$)/);
  if (classMatch) return classMatch[1] as ArticleImage["alignment"];

  const styleMatch = value.match(/(?:text-align|float)\s*:\s*(left|center|right)\b/);
  if (styleMatch) return styleMatch[1] as ArticleImage["alignment"];

  const explicitAlignment = metadata.find(item => /^(left|center|right|wide|full)$/i.test(item.trim()));
  if (explicitAlignment) return explicitAlignment.toLowerCase() as ArticleImage["alignment"];

  return undefined;
}

function imageFromTag(tag: string, fallbackAlt = "", figureTag = ""): ArticleImage | null {
  const src = normalizeImageUrl(getAttribute(tag, "src") || getAttribute(tag, "data-src") || getAttribute(tag, "data-lazy-src"));
  if (!src) return null;

  const style = getAttribute(tag, "style");
  const figureStyle = getAttribute(figureTag, "style");
  const width = positiveDimension(getAttribute(tag, "width"))
    ?? getStyleDimension(style, "width")
    ?? getStyleDimension(figureStyle, "width");
  const height = positiveDimension(getAttribute(tag, "height"))
    ?? getStyleDimension(style, "height")
    ?? getStyleDimension(figureStyle, "height");
  const alignment = getImageAlignment(
    getAttribute(figureTag, "class"),
    getAttribute(figureTag, "align"),
    getAttribute(figureTag, "data-align"),
    getAttribute(figureTag, "style"),
    getAttribute(tag, "class"),
    getAttribute(tag, "align"),
    getAttribute(tag, "data-align"),
    style,
  );
  const srcSet = normalizeSrcSet(getAttribute(tag, "srcset"));
  const sizes = getAttribute(tag, "sizes") || undefined;
  return {
    src,
    alt: safeText(getAttribute(tag, "alt") || fallbackAlt),
    ...(width ? { width } : {}),
    ...(height ? { height } : {}),
    ...(srcSet ? { srcSet } : {}),
    ...(sizes ? { sizes } : {}),
    ...(alignment ? { alignment } : {}),
  };
}

function collectArticleImages(post: WPPost): ArticleImage[] {
  const featured = post._embedded?.["wp:featuredmedia"]?.[0] as WPMedia | undefined;
  const featuredSizes = featured?.media_details?.sizes;
  const featuredSize = featuredSizes?.["medium_large"] ?? featuredSizes?.["large"] ?? featuredSizes?.["medium"] ?? featuredSizes?.["thumbnail"];
  const featuredUrl = featuredSize?.source_url ?? featured?.source_url ?? "";
  const featuredSrcSet = normalizeSrcSet(Object.values(featuredSizes ?? {})
    .filter(size => size.source_url && size.width)
    .map(size => `${size.source_url} ${size.width}w`)
    .join(", "));

  const images: ArticleImage[] = [];
  const seen = new Set<string>();

  const addImage = (image: ArticleImage | null) => {
    if (!image || !image.src) return;
    const normalized = canonicalImageKey(image.src);
    if (!normalized) return;
    if (seen.has(normalized)) {
      const existing = images.find(item => canonicalImageKey(item.src) === normalized);
      if (existing && image.caption) {
        existing.caption = image.caption;
      }
      if (existing) {
        existing.width ??= image.width;
        existing.height ??= image.height;
        existing.alignment ??= image.alignment;
      }
      return;
    }
    seen.add(normalized);
    images.push({ ...image, alt: image.alt || "Article image" });
  };

  const contentHtml = post.content?.rendered ?? "";
  const fallbackAlt = featured?.alt_text || stripHtml(post.title.rendered);
  const imageMatches = [...contentHtml.matchAll(/<(?:figure\b[^>]*>[\s\S]*?<\/figure>|div\b[^>]*\bwp-caption\b[^>]*>[\s\S]*?<\/div>|dl\b[^>]*\bwp-caption\b[^>]*>[\s\S]*?<\/dl>|img\b[^>]*>)/gi)];

  addImage(featured ? {
    src: featuredUrl,
    alt: featured.alt_text || stripHtml(post.title.rendered),
    caption: safeText(featured.caption?.rendered) || undefined,
    width: featuredSize?.width ?? featured.media_details?.width,
    height: featuredSize?.height ?? featured.media_details?.height,
    srcSet: featuredSrcSet,
    sizes: featuredSrcSet ? "(min-width: 1024px) 65vw, 100vw" : undefined,
  } : null);

  for (const match of imageMatches) {
    const matchedHtml = match[0];
    const figureTag = matchedHtml.match(/^<figure\b[^>]*>/i)?.[0] ?? "";
    const imageTag = matchedHtml.match(/<img\b[^>]*>/i)?.[0] ?? "";
    if (!imageTag) continue;

    const caption = extractImageCaption(matchedHtml);
    addImage({
      ...imageFromTag(imageTag, fallbackAlt, figureTag),
      caption: caption || undefined,
    });
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

function buildContentBlocks(html: string, images: ArticleImage[], featuredImageUrl: string): ArticleContentBlock[] {
  const blocks: ArticleContentBlock[] = [];
  const contentHtml = html ?? "";
  const imageMatches = [...contentHtml.matchAll(/<(?:figure\b[^>]*>[\s\S]*?<\/figure>|div\b[^>]*\bwp-caption\b[^>]*>[\s\S]*?<\/div>|dl\b[^>]*\bwp-caption\b[^>]*>[\s\S]*?<\/dl>|img\b[^>]*>)/gi)];
  const featuredImageKey = canonicalImageKey(featuredImageUrl);
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
      const figureTag = figureHtml.match(/^<figure\b[^>]*>/i)?.[0] ?? "";
      const imgTag = figureHtml.match(/<img\b[^>]*>/i)?.[0];
      const caption = extractImageCaption(figureHtml);
      imageDef = imgTag
        ? { ...imageFromTag(imgTag, "", figureTag)!, caption: caption || undefined }
        : null;
    } else {
      const standaloneImage = imageFromTag(matchedHtml);
      imageDef = standaloneImage
        ? { ...standaloneImage, caption: extractImageCaption(matchedHtml) }
        : null;
    }

    if (imageDef) {
      const key = canonicalImageKey(imageDef.src);
      if (!key || (featuredImageKey && key === featuredImageKey) || seenImageKeys.has(key)) {
        lastIndex = index + matchedHtml.length;
        continue;
      }

      seenImageKeys.add(key);
      const collectedImage = images.find(item => canonicalImageKey(item.src) === key);
      const image = collectedImage
        ? { ...collectedImage, ...imageDef, caption: imageDef.caption || collectedImage.caption }
        : imageDef;
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
  const featuredImageUrl = getFeaturedImageUrl(post);
  const hasFeaturedImage = Boolean(canonicalImageKey(featuredImageUrl));
  const content = buildContentBlocks(articleHtml, images, featuredImageUrl)
    .filter(block => block.type !== "paragraph" || !isAuthorByline(block.text ?? ""));
  const paragraphs = content
    .filter(block => block.type === "paragraph" && block.text)
    .map(block => block.text!)
    .filter(text => !isAuthorByline(text));
  const body = paragraphs.length > 0 ? paragraphs : splitIntoParagraphs(articleHtml);
  const plainBody = body.join(" ");
  const author = getAuthorName(post);
  const featuredImage = featuredImageUrl || images[0]?.src || "";

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
    imageAlt: hasFeaturedImage ? getFeaturedImageAlt(post) : images[0]?.alt || stripHtml(post.title.rendered),
    hasFeaturedImage,
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
