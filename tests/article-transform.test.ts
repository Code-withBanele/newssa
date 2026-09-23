import { strict as assert } from "node:assert";
import { transformPost } from "../src/utils/transform.ts";

const post = {
  id: 12,
  slug: "test-article",
  date: "2025-01-01T12:00:00Z",
  modified: "2025-01-02T12:00:00Z",
  status: "publish",
  type: "post",
  link: "https://example.com/test-article",
  title: { rendered: "<h1>Test Article</h1>" },
  excerpt: { rendered: "<p>Short introduction</p>" },
  content: {
    rendered: `
      <p>Opening paragraph.</p>
      <figure class="wp-block-image size-large">
        <img src="https://example.com/inline-1.jpg" alt="Inline image one" />
        <figcaption>Inline caption one</figcaption>
      </figure>
      <p>Middle paragraph.</p>
      <img src="https://example.com/inline-2.jpg" alt="Inline image two" />
      <p>Closing paragraph.</p>
    `,
  },
  author: 7,
  featured_media: 88,
  categories: [3],
  tags: [],
  _embedded: {
    author: [{ name: "Jane Reporter" }],
    "wp:featuredmedia": [{
      source_url: "https://example.com/cover.jpg",
      alt_text: "Cover image alt",
      media_details: {
        sizes: {
          large: { source_url: "https://example.com/cover-large.jpg" },
        },
      },
    }],
    "wp:term": [[{ taxonomy: "category", name: "News", slug: "news" }]],
  },
};

const article = transformPost(post as any);

assert.equal(article.image, "https://example.com/cover-large.jpg");
assert.deepEqual(article.images.map(item => item.src), [
  "https://example.com/cover-large.jpg",
  "https://example.com/inline-1.jpg",
  "https://example.com/inline-2.jpg",
]);
assert.equal(article.images[1].alt, "Inline image one");
assert.equal(article.images[1].caption, "Inline caption one");
assert.equal(article.images[2].alt, "Inline image two");

const dangerousPost = {
  ...post,
  content: {
    rendered: `
      <figure>
        <img src="javascript:alert(1)" alt="Bad script" />
      </figure>
      <img src="https://example.com/clean.jpg" alt="Clean" />
      <img src="data:text/html;base64,PHNjcmlwdD4=" alt="Inline data" />
    `,
  },
  _embedded: {
    ...post._embedded,
    "wp:featuredmedia": [{
      source_url: "https://example.com/cover.jpg",
      alt_text: "Cover image alt",
      media_details: {
        sizes: {
          large: { source_url: "https://example.com/cover-large.jpg" },
        },
      },
    }],
  },
};

const dangerousArticle = transformPost(dangerousPost as any);
assert.deepEqual(dangerousArticle.images.map(item => item.src), [
  "https://example.com/cover-large.jpg",
  "https://example.com/clean.jpg",
]);
assert.equal(dangerousArticle.images[1].alt, "Clean");
