interface JsonLdProps {
  data: Record<string, unknown>;
}

export function JsonLd({ data }: JsonLdProps) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://clair.vote';

export function OrganizationJsonLd() {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'CLAIR.vote',
    alternateName: 'Citoyen Libre, Analyse, Information, République',
    url: BASE_URL,
    logo: `${BASE_URL}/icon.png`,
    description: 'Plateforme citoyenne de transparence politique en France. Analysez les votes des parlementaires, le lobbying et les activités politiques.',
    foundingDate: '2025',
    sameAs: [],
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'customer service',
      url: `${BASE_URL}/soutenir`,
    },
  };

  return <JsonLd data={data} />;
}

export function WebSiteJsonLd() {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'CLAIR.vote',
    alternateName: 'Citoyen Libre, Analyse, Information, République',
    url: BASE_URL,
    description: 'CLAIR.vote : analysez les votes des députés et sénateurs, suivez le lobbying et la transparence politique en France.',
    inLanguage: 'fr-FR',
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${BASE_URL}/recherche?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  };

  return <JsonLd data={data} />;
}

interface BreadcrumbItem {
  name: string;
  url: string;
}

export function BreadcrumbJsonLd({ items }: { items: BreadcrumbItem[] }) {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };

  return <JsonLd data={data} />;
}

interface PersonJsonLdProps {
  name: string;
  givenName: string;
  familyName: string;
  jobTitle: string;
  image?: string;
  url: string;
  worksFor?: {
    name: string;
    url?: string;
  };
  description?: string;
  birthDate?: string;
  email?: string;
  sameAs?: string[];
}

export function PersonJsonLd({
  name,
  givenName,
  familyName,
  jobTitle,
  image,
  url,
  worksFor,
  description,
  birthDate,
  email,
  sameAs,
}: PersonJsonLdProps) {
  const data: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name,
    givenName,
    familyName,
    jobTitle,
    url,
  };

  if (image) data.image = image;
  if (description) data.description = description;
  if (birthDate) data.birthDate = birthDate;
  if (email) data.email = email;
  if (sameAs && sameAs.length > 0) data.sameAs = sameAs;
  if (worksFor) {
    data.worksFor = {
      '@type': 'Organization',
      name: worksFor.name,
      ...(worksFor.url && { url: worksFor.url }),
    };
  }

  return <JsonLd data={data} />;
}

interface OrganizationDetailJsonLdProps {
  name: string;
  alternateName?: string;
  url: string;
  logo?: string;
  description?: string;
  memberOf?: string;
}

export function PoliticalGroupJsonLd({
  name,
  alternateName,
  url,
  logo,
  description,
  memberOf,
}: OrganizationDetailJsonLdProps) {
  const data: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': url,
    name,
    url,
  };

  if (alternateName) data.alternateName = alternateName;
  if (logo) data.logo = logo;
  if (description) data.description = description;
  if (memberOf) {
    data.memberOf = {
      '@type': 'Organization',
      name: memberOf,
    };
  }

  return <JsonLd data={data} />;
}

interface VoteEventJsonLdProps {
  name: string;
  description?: string;
  url: string;
  dateCreated: string;
  result: 'adopted' | 'rejected';
  votesFor: number;
  votesAgainst: number;
  abstentions: number;
}

export function VoteEventJsonLd({
  name,
  description,
  url,
  dateCreated,
  result,
  votesFor,
  votesAgainst,
  abstentions,
}: VoteEventJsonLdProps) {
  const data: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name,
    url,
    startDate: dateCreated,
    endDate: dateCreated,
    eventStatus: 'https://schema.org/EventScheduled',
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    location: {
      '@type': 'Place',
      name: 'Assemblée nationale',
      address: {
        '@type': 'PostalAddress',
        streetAddress: '126 Rue de l\'Université',
        addressLocality: 'Paris',
        postalCode: '75007',
        addressCountry: 'FR',
      },
    },
    organizer: {
      '@type': 'Organization',
      name: 'Assemblée nationale',
      url: 'https://www.assemblee-nationale.fr',
    },
  };

  if (description) data.description = description;

  // Add custom properties for vote results
  data.additionalProperty = [
    {
      '@type': 'PropertyValue',
      name: 'result',
      value: result === 'adopted' ? 'Adopté' : 'Rejeté',
    },
    {
      '@type': 'PropertyValue',
      name: 'votesFor',
      value: votesFor,
    },
    {
      '@type': 'PropertyValue',
      name: 'votesAgainst',
      value: votesAgainst,
    },
    {
      '@type': 'PropertyValue',
      name: 'abstentions',
      value: abstentions,
    },
  ];

  return <JsonLd data={data} />;
}

interface LobbyistJsonLdProps {
  name: string;
  url: string;
  description?: string;
  address?: {
    streetAddress?: string;
    addressLocality?: string;
    postalCode?: string;
    addressCountry?: string;
  };
  numberOfEmployees?: number;
  foundingDate?: string;
}

export function LobbyistJsonLd({
  name,
  url,
  description,
  address,
  numberOfEmployees,
  foundingDate,
}: LobbyistJsonLdProps) {
  const data: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name,
    url,
  };

  if (description) data.description = description;
  if (foundingDate) data.foundingDate = foundingDate;
  if (numberOfEmployees) {
    data.numberOfEmployees = {
      '@type': 'QuantitativeValue',
      value: numberOfEmployees,
    };
  }
  if (address) {
    data.address = {
      '@type': 'PostalAddress',
      ...address,
    };
  }

  return <JsonLd data={data} />;
}

interface FAQJsonLdProps {
  questions: Array<{
    question: string;
    answer: string;
  }>;
}

export function FAQJsonLd({ questions }: FAQJsonLdProps) {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: questions.map((q) => ({
      '@type': 'Question',
      name: q.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: q.answer,
      },
    })),
  };

  return <JsonLd data={data} />;
}
