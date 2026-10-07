export type FaqItem = {
  question: string;
  answer: string;
};

export type Crumb = {
  name: string;
  url: string;
};

export function supportingJsonLd(input: {
  name: string;
  description: string;
  url: string;
  crumbs: readonly Crumb[];
  faqs?: readonly FaqItem[];
  dateModified?: string;
}) {
  const blocks: Record<string, unknown>[] = [
    {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: input.name,
      url: input.url,
      description: input.description,
      ...(input.dateModified ? { dateModified: input.dateModified } : {}),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: input.crumbs.map((crumb, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: crumb.name,
        item: crumb.url,
      })),
    },
  ];

  if (input.faqs && input.faqs.length > 0) {
    blocks.push({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: input.faqs.map((item) => ({
        '@type': 'Question',
        name: item.question,
        acceptedAnswer: {
          '@type': 'Answer',
          text: item.answer,
        },
      })),
    });
  }

  return blocks;
}
