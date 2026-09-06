import { useEffect } from "react";
import logoImg from "../imports/Body/23028179d84c8ac263f16970552b2d9e23bb08f9.png";

export const SITE_URL = (import.meta.env.VITE_SITE_URL as string | undefined)?.replace(/\/$/, "") || "https://newssa.co.za";
export const SITE_NAME = "News South Africa";

export interface SeoMetadata {
  title: string;
  description: string;
  path: string;
  type?: "website" | "article";
  image?: string;
  robots?: string;
  keywords?: string[];
  publishedTime?: string;
  modifiedTime?: string;
  author?: string;
  section?: string;
  breadcrumbs?: Array<{ name: string; path: string }>;
}

function absoluteUrl(value: string) {
  if (/^https?:\/\//i.test(value)) return value;
  return new URL(value.startsWith("/") ? value : `/${value}`, SITE_URL).toString();
}

function setMeta(attribute: "name" | "property", key: string, content: string) {
  const elements = [...document.head.querySelectorAll<HTMLMetaElement>(`meta[${attribute}="${key}"]`)];
  elements.slice(1).forEach(item => item.remove());
  let element = elements[0];
  if (!element) {
    element = document.createElement("meta");
    element.setAttribute(attribute, key);
    document.head.appendChild(element);
  }
  element.content = content;
}

function setLink(rel: string, href: string) {
  const elements = [...document.head.querySelectorAll<HTMLLinkElement>(`link[rel="${rel}"]`)];
  const element = elements[0] ?? document.createElement("link");
  elements.slice(1).forEach(item => item.remove());
  if (!element.parentElement) {
    element.rel = rel;
    document.head.appendChild(element);
  }
  element.href = href;
}

function removeMeta(attribute: "name" | "property", key: string) {
  document.head.querySelectorAll(`meta[${attribute}="${key}"]`).forEach(element => element.remove());
}

export function SeoHead(metadata: SeoMetadata) {
  useEffect(() => {
    const canonical = absoluteUrl(metadata.path);
    const image = metadata.image ? absoluteUrl(metadata.image) : absoluteUrl(logoImg);
    const robots = metadata.robots || "index, follow";
    const articleData = metadata.type === "article" ? {
      "@type": "NewsArticle",
      "@id": `${canonical}#article`,
      url: canonical,
      mainEntityOfPage: canonical,
      headline: metadata.title,
      description: metadata.description,
      ...(metadata.image ? { image: [absoluteUrl(metadata.image)] } : {}),
      ...(metadata.publishedTime ? { datePublished: metadata.publishedTime } : {}),
      ...(metadata.modifiedTime ? { dateModified: metadata.modifiedTime } : {}),
      ...(metadata.author ? { author: { "@type": "Person", name: metadata.author } } : {}),
      ...(metadata.section ? { articleSection: metadata.section } : {}),
      publisher: { "@id": `${SITE_URL}/#organization` },
    } : {
      "@type": "WebPage",
      "@id": `${canonical}#webpage`,
      url: canonical,
      name: metadata.title,
      headline: metadata.title,
      description: metadata.description,
      image,
      isPartOf: { "@id": `${SITE_URL}/#website` },
    };
    const schema: Record<string, unknown> = {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "Organization",
          "@id": `${SITE_URL}/#organization`,
          name: SITE_NAME,
          url: SITE_URL,
          logo: { "@type": "ImageObject", url: absoluteUrl(logoImg) },
        },
        articleData,
        ...(metadata.path === "/" ? [{
          "@type": "WebSite",
          "@id": `${SITE_URL}/#website`,
          url: SITE_URL,
          name: SITE_NAME,
          publisher: { "@id": `${SITE_URL}/#organization` },
        }] : []),
        ...(metadata.breadcrumbs ? [{
          "@type": "BreadcrumbList",
          itemListElement: metadata.breadcrumbs.map((item, index) => ({
            "@type": "ListItem",
            position: index + 1,
            name: item.name,
            item: absoluteUrl(item.path),
          })),
        }] : []),
      ],
    };

    document.title = metadata.title;
    setMeta("name", "description", metadata.description);
    setMeta("name", "robots", robots);
    setMeta("property", "og:title", metadata.title);
    setMeta("property", "og:description", metadata.description);
    setMeta("property", "og:type", metadata.type || "website");
    setMeta("property", "og:url", canonical);
    setMeta("property", "og:image", image);
    setMeta("property", "og:site_name", SITE_NAME);
    setMeta("property", "og:locale", "en_ZA");
    setMeta("name", "twitter:card", "summary_large_image");
    setMeta("name", "twitter:title", metadata.title);
    setMeta("name", "twitter:description", metadata.description);
    setMeta("name", "twitter:image", image);
    if (metadata.keywords?.length) setMeta("name", "keywords", metadata.keywords.join(", "));
    else document.head.querySelector('meta[name="keywords"]')?.remove();
    if (metadata.type === "article") {
      setMeta("property", "article:section", metadata.section || "News");
      if (metadata.publishedTime) setMeta("property", "article:published_time", metadata.publishedTime);
      if (metadata.modifiedTime) setMeta("property", "article:modified_time", metadata.modifiedTime);
      if (metadata.author) setMeta("property", "article:author", metadata.author);
    } else {
      ["article:section", "article:published_time", "article:modified_time", "article:author"].forEach(key => removeMeta("property", key));
    }
    setLink("canonical", canonical);
    let jsonLd = document.head.querySelector<HTMLScriptElement>('script[data-seo-jsonld="true"]');
    if (!jsonLd) {
      jsonLd = document.createElement("script");
      jsonLd.type = "application/ld+json";
      jsonLd.dataset.seoJsonld = "true";
      document.head.appendChild(jsonLd);
    }
    jsonLd.textContent = JSON.stringify(schema);
  }, [metadata]);

  return null;
}