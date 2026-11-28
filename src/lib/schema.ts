import {
  absoluteUrl,
  PUBLISHER_LOGO,
  PUBLISHER_NAME,
  PUBLISHER_SAME_AS,
  PUBLISHER_URL,
  SITE_NAME,
  SITE_URL,
} from '../config/site';

export function organizationId(): string {
  return `${SITE_URL}/#organization`;
}

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
  const orgId = organizationId();
  return [
    {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      '@id': orgId,
      name: PUBLISHER_NAME,
      url: PUBLISHER_URL,
      logo: absoluteUrl(PUBLISHER_LOGO),
      sameAs: [...PUBLISHER_SAME_AS],
    },
    {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: SITE_NAME,
      url,
      publisher: { '@id': orgId },
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
