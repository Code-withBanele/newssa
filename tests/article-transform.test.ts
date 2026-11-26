import { strict as assert } from "node:assert";
import { transformPost } from "../src/utils/transform.ts";
import { groupAdjacentArticleImages } from "../src/utils/articleDisplay.ts";
import { categorySlug } from "../src/utils/categorySlug.ts";

assert.equal(categorySlug("Lifestyle"), "life-style");
assert.equal(categorySlug("Life Style"), "life-style");
assert.equal(categorySlug("Books"), "books");
assert.equal(categorySlug("Leadership & Ideas"), "leadership-and-ideas");

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
    author: [{ name: "Jane Reporter", avatar_urls: { "96": "https://example.com/jane-96.jpg" } }],
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
assert.equal(article.author, "Jane Reporter");
assert.equal(article.authorAvatar, "https://example.com/jane-96.jpg");
assert.equal(article.subtitleHtml, "Short introduction");
assert.deepEqual(article.content.map(block => block.type), [
  "paragraph", "image", "paragraph", "image", "paragraph",
]);
assert.deepEqual(article.content.filter(block => block.type === "paragraph").map(block => block.text), [
  "Opening paragraph.",
  "Middle paragraph.",
  "Closing paragraph.",
]);
assert.deepEqual(article.body, [
  "Opening paragraph.",
  "Middle paragraph.",
  "Closing paragraph.",
]);

const galleryImages = Array.from({ length: 4 }, (_, index) => ({
  type: "image" as const,
  image: { src: `https://example.com/gallery-${index + 1}.jpg`, alt: `Gallery image ${index + 1}` },
}));
const groupedArticleBlocks = groupAdjacentArticleImages([
  { type: "paragraph", text: "Before gallery." },
  ...galleryImages,
  { type: "paragraph", text: "After gallery." },
  ...galleryImages.slice(0, 2),
]);
assert.deepEqual(groupedArticleBlocks.map(block => block.type), [
  "paragraph", "gallery", "paragraph", "image", "image",
]);
assert.equal(groupedArticleBlocks[1].type === "gallery" ? groupedArticleBlocks[1].images.length : 0, 4);

const explicitBylinePost = {
  ...post,
  content: {
    rendered: "<p><strong>BY RORISANG RAMPHETENG:</strong></p><p>Article body.</p>",
  },
  _embedded: {
    ...post._embedded,
    author: [{ name: "News South Africa" }],
  },
};

const explicitBylineArticle = transformPost(explicitBylinePost as any);
assert.equal(explicitBylineArticle.author, "RORISANG RAMPHETENG");
assert.equal(explicitBylineArticle.authorAvailable, true);
assert.doesNotMatch(explicitBylineArticle.author, /<\/?strong|&lt;|&gt;/i);
assert.deepEqual(explicitBylineArticle.content.map(block => block.text), ["Article body."]);

const mixedCaseBylinePost = {
  ...post,
  content: {
    rendered: "<p>By Arassy ep Razafindratovolahy Sarah :</p><p>Article body starts here.</p>",
  },
  _embedded: {
    ...post._embedded,
    author: [{ name: "News South Africa" }],
  },
};

const mixedCaseBylineArticle = transformPost(mixedCaseBylinePost as any);
assert.equal(mixedCaseBylineArticle.author, "Arassy ep Razafindratovolahy Sarah");
assert.equal(mixedCaseBylineArticle.authorAvailable, true);
assert.deepEqual(mixedCaseBylineArticle.content.map(block => block.text), ["Article body starts here."]);
assert.deepEqual(mixedCaseBylineArticle.body, ["Article body starts here."]);

const wrappedBylinePost = {
  ...mixedCaseBylinePost,
  content: {
    rendered: "<div><strong>By Arassy ep Razafindratovolahy Sarah :</strong></div><p>Article text.</p>",
  },
};

const wrappedBylineArticle = transformPost(wrappedBylinePost as any);
assert.deepEqual(wrappedBylineArticle.content.map(block => block.text), ["Article text."]);

const encodedAuthorPost = {
  ...post,
  _embedded: {
    ...post._embedded,
    author: [{ name: "RORISANG RAMPHETENG&lt;/strong&gt;&lt;/strong&gt;" }],
  },
};

const encodedAuthorArticle = transformPost(encodedAuthorPost as any);
assert.equal(encodedAuthorArticle.author, "RORISANG RAMPHETENG");
assert.equal(encodedAuthorArticle.authorAvailable, true);

const publicationAuthorPost = {
  ...post,
  content: { rendered: "<p>Article body without a byline.</p>" },
  _embedded: {
    ...post._embedded,
    author: [{ name: "News South Africa" }],
  },
};

const publicationAuthorArticle = transformPost(publicationAuthorPost as any);
assert.equal(publicationAuthorArticle.author, "");
assert.equal(publicationAuthorArticle.authorAvailable, false);

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

const repeatedFeaturedPost = {
  ...post,
  content: {
    rendered: `
      <figure class="wp-block-image size-large">
        <img src="https://example.com/cover-large.jpg" alt="Cover image alt" />
        <figcaption>Featured caption</figcaption>
      </figure>
      <p>Body paragraph after the cover image.</p>
    `,
  },
};

const repeatedFeaturedArticle = transformPost(repeatedFeaturedPost as any);
assert.equal(repeatedFeaturedArticle.image, "https://example.com/cover-large.jpg");
assert.equal(repeatedFeaturedArticle.images[0].caption, "Featured caption");
assert.deepEqual(repeatedFeaturedArticle.content.map(item => item.type), ["paragraph"]);
assert.equal(repeatedFeaturedArticle.content[0].text, "Body paragraph after the cover image.");

const duplicateCaptionPost = {
  ...repeatedFeaturedPost,
  _embedded: {
    ...repeatedFeaturedPost._embedded,
    "wp:featuredmedia": [{
      ...repeatedFeaturedPost._embedded["wp:featuredmedia"][0],
      caption: { rendered: "News SA Correspondent" },
    }],
  },
};
const duplicateCaptionArticle = transformPost(duplicateCaptionPost as any);
assert.equal(duplicateCaptionArticle.images[0].caption, "Featured caption");

const alignedImagePost = {
  ...post,
  content: {
    rendered: `
      <p>Paragraph before the image.</p>
      <figure class="wp-block-image alignright size-large">
        <img
          src="https://example.com/aligned.jpg"
          srcset="https://example.com/aligned-small.jpg 320w, https://example.com/aligned.jpg 640w"
          sizes="(max-width: 640px) 100vw, 640px"
          alt="Aligned image"
          width="640"
          height="360"
        />
        <figcaption>Actual inline caption</figcaption>
      </figure>
      <p>Paragraph after the image.</p>
    `,
  },
};
const alignedImageArticle = transformPost(alignedImagePost as any);
assert.deepEqual(alignedImageArticle.content.map(item => item.type), ["paragraph", "image", "paragraph"]);
assert.equal(alignedImageArticle.content[1].image?.alignment, "right");
assert.equal(alignedImageArticle.content[1].image?.width, 640);
assert.equal(alignedImageArticle.content[1].image?.height, 360);
assert.equal(alignedImageArticle.content[1].image?.caption, "Actual inline caption");
assert.equal(
  alignedImageArticle.content[1].image?.srcSet,
  "https://example.com/aligned-small.jpg 320w, https://example.com/aligned.jpg 640w",
);
assert.equal(alignedImageArticle.content[1].image?.sizes, "(max-width: 640px) 100vw, 640px");

const classicCaptionPost = {
  ...post,
  content: {
    rendered: `
      <p>Before captioned image.</p>
      <div class="wp-caption alignnone">
        <img src="https://example.com/classic-caption.jpg" alt="Classic image" width="640" height="360" />
        <p class="wp-caption-text">Classic WordPress caption</p>
      </div>
      <p>After captioned image.</p>
    `,
  },
};
const classicCaptionArticle = transformPost(classicCaptionPost as any);
assert.deepEqual(classicCaptionArticle.content.map(item => item.type), ["paragraph", "image", "paragraph"]);
assert.equal(classicCaptionArticle.content[1].image?.caption, "Classic WordPress caption");

const inlineOnlyPost = {
  ...post,
  featured_media: 0,
  _embedded: {
    ...post._embedded,
    "wp:featuredmedia": [],
  },
  content: {
    rendered: `
      <p>Opening paragraph.</p>
      <img src="https://example.com/inline-only.jpg" alt="Inline-only image" width="500" height="300" />
      <p>Closing paragraph.</p>
    `,
  },
};
const inlineOnlyArticle = transformPost(inlineOnlyPost as any);
assert.equal(inlineOnlyArticle.hasFeaturedImage, false);
assert.equal(inlineOnlyArticle.image, "https://example.com/inline-only.jpg");
assert.deepEqual(inlineOnlyArticle.content.map(item => item.type), ["paragraph", "image", "paragraph"]);

const sizeVariantFeaturedPost = {
  ...post,
  _embedded: {
    ...post._embedded,
    "wp:featuredmedia": [{
      source_url: "https://example.com/cover.jpg",
      alt_text: "Cover image alt",
      media_details: {
        sizes: {
          large: { source_url: "https://example.com/cover-1024x768.jpg" },
        },
      },
    }],
  },
  content: {
    rendered: `
      <figure class="wp-block-image size-large">
        <img src="https://example.com/cover-719x1024.jpg" alt="Cover image alt" />
        <figcaption>Featured caption</figcaption>
      </figure>
      <p>Body paragraph after the resized cover image.</p>
    `,
  },
};

const sizeVariantFeaturedArticle = transformPost(sizeVariantFeaturedPost as any);
assert.equal(sizeVariantFeaturedArticle.image, "https://example.com/cover-1024x768.jpg");
assert.deepEqual(sizeVariantFeaturedArticle.images.map(item => item.src), [
  "https://example.com/cover-1024x768.jpg",
]);
assert.deepEqual(sizeVariantFeaturedArticle.content.map(item => item.type), ["paragraph"]);
assert.equal(sizeVariantFeaturedArticle.content[0].text, "Body paragraph after the resized cover image.");

const formattedPost = {
  ...post,
  excerpt: { rendered: "<p>A <em>carefully</em> <strong>formatted</strong> introduction.</p>" },
  content: {
    rendered: '<p>Keep <em>italics</em> and <a href="https://example.com/story">safe links</a>, but <script>alert(1)</script> must not render.</p>',
  },
};
const formattedArticle = transformPost(formattedPost as any);
assert.equal(
  formattedArticle.subtitleHtml,
  "A <em>carefully</em> <strong>formatted</strong> introduction.",
);
assert.equal(
  formattedArticle.content[0].html,
  'Keep <em>italics</em> and <a href="https://example.com/story" target="_blank" rel="noopener noreferrer">safe links</a>, but  must not render.',
);
assert.doesNotMatch(formattedArticle.content[0].html ?? "", /<script|onerror|javascript:/i);

