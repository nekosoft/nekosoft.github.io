import { getCollection, type CollectionEntry } from 'astro:content';

export type DocEntry = CollectionEntry<'docs'>;

export const SECTIONS: Record<DocEntry['data']['section'], string> = {
  'web-recon': 'Web Reconnaissance',
  iot: 'IoT Research',
};

/** All non-draft docs, grouped per section and sorted by `order`. */
export async function getDocsNav() {
  const docs = await getCollection('docs', ({ data }) => !data.draft);

  const sections = (Object.keys(SECTIONS) as DocEntry['data']['section'][]).map(
    (section) => ({
      section,
      label: SECTIONS[section],
      entries: docs
        .filter((doc) => doc.data.section === section)
        .sort((a, b) => a.data.order - b.data.order),
    }),
  );

  // flat list in reading order, for prev/next links
  const flat = sections.flatMap((s) => s.entries);

  return { sections, flat };
}

/** URL slug for a doc — `index` files resolve to their directory. */
export function docSlug(doc: DocEntry) {
  return doc.id.replace(/\/?index$/, '');
}

export function docHref(doc: DocEntry) {
  return `/docs/${docSlug(doc)}`;
}
