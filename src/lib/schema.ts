import { absoluteUrl, LOGO_PATH, SITE_NAME } from '../config/site';

export type FaqItem = {
  question: string;
  answer: string;
};

export type Crumb = {
  name: string;
  url: string;
};

export function siteJsonLd() {
  const url = absoluteUrl('/');
  return [
    {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: SITE_NAME,
      url,
      logo: absoluteUrl(LOGO_PATH),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: SITE_NAME,
      url,
    },
  ];
}

export function supportingJsonLd(input: {
  name: string;
  description: string;
  url: string;
  crumbs?: readonly Crumb[];
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
  ];

  if (input.crumbs && input.crumbs.length > 0) {
    blocks.push({
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: input.crumbs.map((crumb, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: crumb.name,
        item: crumb.url,
      })),
    });
  }

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
