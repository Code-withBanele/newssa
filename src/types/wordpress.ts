// WordPress REST API response types

export interface WPRendered {
  rendered: string;
  protected?: boolean;
}

export interface WPPost {
  id: number;
  date: string;
  date_gmt: string;
  modified: string;
  slug: string;
  status: string;
  type: string;
  link: string;
  title: WPRendered;
  content: WPRendered;
  excerpt: WPRendered;
  author: number;
  featured_media: number;
  categories: number[];
  tags: number[];
  // Embedded data when using _embed
  _embedded?: {
    author?: WPUser[];
    "wp:featuredmedia"?: WPMedia[];
    "wp:term"?: WPTerm[][];
  };
}

export interface WPUser {
  id: number;
  name: string;
  slug: string;
  avatar_urls?: Record<string, string>;
}

export interface WPMedia {
  id: number;
  source_url: string;
  alt_text: string;
  media_details?: {
    width: number;
    height: number;
    sizes?: Record<string, { source_url: string }>;
  };
}

export interface WPCategory {
  id: number;
  name: string;
  slug: string;
  count: number;
  parent: number;
}

export interface WPTag {
  id: number;
  name: string;
  slug: string;
  count: number;
}

export interface WPTerm {
  id: number;
  name: string;
  slug: string;
  taxonomy: string;
}

export interface WPSearchResult {
  id: number;
  title: string;
  url: string;
  type: string;
  subtype: string;
}

// Paginated collection headers
export interface WPPaginationMeta {
  total: number;
  totalPages: number;
}

// Query params for /wp/v2/posts
export interface WPPostsQuery {
  page?: number;
  per_page?: number;
  search?: string;
  categories?: number[];
  tags?: number[];
  author?: number;
  slug?: string;
  status?: string;
  orderby?: "date" | "relevance" | "id" | "title" | "modified";
  order?: "asc" | "desc";
  _embed?: boolean | string;
}
