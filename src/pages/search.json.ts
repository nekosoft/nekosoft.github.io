import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { docHref, SECTIONS } from '../utils/docsNav';

/** Roughly strip markdown to plain text for the search index. */
function toText(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, ' ') // fenced code
    .replace(/`[^`]*`/g, ' ') // inline code
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ') // images
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1') // links -> text
    .replace(/[#>*_~`]/g, ' ') // stray markdown symbols
    .replace(/\s+/g, ' ')
    .trim();
}

export const GET: APIRoute = async () => {
  const [docs, posts] = await Promise.all([
    getCollection('docs', ({ data }) => !data.draft),
    getCollection('blog', ({ data }) => !data.draft),
  ]);

  const items = [
    ...docs.map((doc) => ({
      kind: 'Docs',
      section: SECTIONS[doc.data.section],
      title: doc.data.title,
      url: docHref(doc),
      tags: doc.data.tags,
      text: toText(doc.body ?? '').slice(0, 6000),
    })),
    ...posts.map((post) => ({
      kind: 'Blog',
      section: 'Blog',
      title: post.data.title,
      url: `/blog/${post.id}`,
      tags: post.data.tags,
      text: toText(post.body ?? '').slice(0, 6000),
    })),
  ];

  return new Response(JSON.stringify(items), {
    headers: { 'Content-Type': 'application/json' },
  });
};
