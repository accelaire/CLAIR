'use client';

interface HelloAssoWidgetProps {
  organizationSlug: string;
  campaignSlug: string;
}

export function HelloAssoWidget({
  organizationSlug,
  campaignSlug
}: HelloAssoWidgetProps) {
  const widgetUrl = `https://www.helloasso.com/associations/${organizationSlug}/formulaires/${campaignSlug}/widget`;

  return (
    <iframe
      id="haWidget"
      src={widgetUrl}
      style={{
        width: '100%',
        height: '750px',
        border: 'none',
      }}
      allow="payment"
      title="Formulaire de don HelloAsso"
    />
  );
}
