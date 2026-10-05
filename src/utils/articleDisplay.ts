import { ArticleContentBlock, ArticleImage } from "./transform";

export type ArticleDisplayBlock = ArticleContentBlock | { type: "gallery"; images: ArticleImage[] };

export function groupAdjacentArticleImages(blocks: ArticleContentBlock[]): ArticleDisplayBlock[] {
  const grouped: ArticleDisplayBlock[] = [];

  for (let index = 0; index < blocks.length;) {
    const block = blocks[index];
    if (block.type !== "image" || !block.image) {
      grouped.push(block);
      index += 1;
      continue;
    }

    const imageRun: ArticleImage[] = [];
    while (index < blocks.length) {
      const nextBlock = blocks[index];
      if (nextBlock.type !== "image" || !nextBlock.image) break;
      imageRun.push(nextBlock.image);
      index += 1;
    }

    if (imageRun.length >= 3) grouped.push({ type: "gallery", images: imageRun });
    else imageRun.forEach(image => grouped.push({ type: "image", image }));
  }

  return grouped;
}
