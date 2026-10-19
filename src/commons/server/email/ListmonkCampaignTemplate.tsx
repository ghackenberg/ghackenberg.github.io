import { render } from '@react-email/render';
import { EmailShell } from './EmailShell';

const CAMPAIGN_CONTENT_TOKEN = '__LISTMONK_CAMPAIGN_CONTENT__';
const UNSUBSCRIBE_URL_TOKEN = 'https://hackenberg.tech/__LISTMONK_UNSUBSCRIBE_URL__';
const TRACK_HOME_URL_TOKEN = 'https://hackenberg.tech/__LISTMONK_TRACK_HOME_URL__';

export function ListmonkCampaignWrapper() {
  return (
    <EmailShell
      variant="campaign"
      brandHref={TRACK_HOME_URL_TOKEN}
      unsubscribeHref={UNSUBSCRIBE_URL_TOKEN}
    >
      {CAMPAIGN_CONTENT_TOKEN}
    </EmailShell>
  );
}

/**
 * Renders Listmonk's default campaign wrapper template containing `{{ template "content" . }}`,
 * `{{ UnsubscribeURL }}`, and `{{ TrackLink "https://hackenberg.tech" }}`.
 */
export async function renderListmonkCampaignTemplate(): Promise<string> {
  const rawHtml = await render(<ListmonkCampaignWrapper />);
  return rawHtml
    .replace(CAMPAIGN_CONTENT_TOKEN, '{{ template "content" . }}')
    .replaceAll(UNSUBSCRIBE_URL_TOKEN, '{{ UnsubscribeURL }}')
    .replaceAll(TRACK_HOME_URL_TOKEN, '{{ TrackLink "https://hackenberg.tech" }}');
}
