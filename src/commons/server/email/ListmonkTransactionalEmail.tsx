import {
  Button,
  Heading,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components';
import { render } from '@react-email/render';
import { EmailShell } from './EmailShell';
import { EMAIL_BUTTON_INLINE_STYLE, emailStyles } from './email-theme';

const BASE_CONTENT_TOKEN = '__LISTMONK_TEMPLATE_CONTENT__';
const OPTIN_URL_TOKEN = 'https://hackenberg.tech/__LISTMONK_OPTIN_URL__';
const RESET_URL_TOKEN = 'https://hackenberg.tech/__LISTMONK_RESET_URL__';
const ROOT_URL_TOKEN = 'https://hackenberg.tech/__LISTMONK_ROOT_URL__';
const OPTIN_CAMPAIGN_RANGE_START_TOKEN = '__LISTMONK_OPTIN_RANGE_START__';
const OPTIN_CAMPAIGN_RANGE_ELSE_TOKEN = '__LISTMONK_OPTIN_RANGE_ELSE__';
const OPTIN_CAMPAIGN_RANGE_END_TOKEN = '__LISTMONK_OPTIN_RANGE_END__';
const OPTIN_CAMPAIGN_BUTTON_TOKEN = '__LISTMONK_OPTIN_CAMPAIGN_BUTTON__';

export const LISTMONK_STATIC_TEMPLATE_FILENAMES = [
  'base.html',
  'subscriber-optin.html',
  'subscriber-optin-campaign.html',
  'subscriber-data.html',
  'campaign-status.html',
  'import-status.html',
  'forgot-password.html',
  'smtp-test.html',
] as const;

export type ListmonkStaticTemplateFilename =
  (typeof LISTMONK_STATIC_TEMPLATE_FILENAMES)[number];

function extractInnerFragment(rawHtml: string): string {
  const withoutDoctype = rawHtml.replace(/<!DOCTYPE[^>]*>/i, '');
  const bodyMatch = withoutDoctype.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  const fragment = (bodyMatch ? bodyMatch[1] : withoutDoctype)
    .replace(/<html[^>]*>/gi, '')
    .replace(/<\/html>/gi, '')
    .replace(/<head[^>]*>[\s\S]*?<\/head>/gi, '')
    .trim();

  return fragment.replace(/\{\{[\s\S]*?\}\}/g, (match) =>
    match
      .replaceAll('&quot;', '"')
      .replaceAll('&#x27;', "'")
      .replaceAll('&#39;', "'")
      .replaceAll('&amp;', '&')
  );
}

function wrapInTransactionalBase(defineName: string, innerHtml: string): string {
  return [
    `{{ define "${defineName}" }}`,
    '{{ template "header" . }}',
    innerHtml,
    '{{ template "footer" . }}',
    '{{ end }}',
    '',
  ].join('\n');
}

export function ListmonkBaseEmail() {
  return <EmailShell variant="transactional">{BASE_CONTENT_TOKEN}</EmailShell>;
}

export function ListmonkOptinContent() {
  return (
    <Section>
      <Preview>Confirm your subscription to updates from Dr. Georg Hackenberg</Preview>
      <Heading as="h1" style={emailStyles.heading}>
        Confirm your subscription
      </Heading>
      <Text style={emailStyles.paragraph}>Hello,</Text>
      <Text style={emailStyles.paragraph}>
        You recently requested to subscribe to email updates from{' '}
        <strong>Dr. Georg Hackenberg</strong> (
        <Link href="https://hackenberg.tech" style={emailStyles.inlineLink}>
          hackenberg.tech
        </Link>
        ) covering new blog posts, presentations, courses, and publications.
      </Text>
      <Text style={emailStyles.paragraph}>
        Please click the button below to confirm your email address and activate your
        subscription:
      </Text>
      <Section style={emailStyles.buttonContainer}>
        <Button href={OPTIN_URL_TOKEN} style={emailStyles.button}>
          Confirm Subscription
        </Button>
      </Section>
      <Text style={emailStyles.mutedText}>
        Or copy and paste this confirmation link into your browser:
        <br />
        <Link href={OPTIN_URL_TOKEN} style={emailStyles.codeUrl}>
          {OPTIN_URL_TOKEN}
        </Link>
      </Text>
      <Text style={emailStyles.mutedText}>
        If you did not request this subscription, you can safely ignore this email. No
        further messages will be sent.
      </Text>
    </Section>
  );
}

export function ListmonkOptinCampaignContent() {
  return (
    <Section>
      <Heading as="h1" style={emailStyles.heading}>
        {'{{ L.Ts "email.optin.title" }}'}
      </Heading>
      <Text style={emailStyles.paragraph}>Hello,</Text>
      <Text style={emailStyles.paragraph}>
        {'{{ L.Ts "email.optin.confirmSubTitle" }}'}
      </Text>
      <Section>
        <ul style={emailStyles.list}>
          {OPTIN_CAMPAIGN_RANGE_START_TOKEN}
          <li style={emailStyles.listItem}>{'{{ .Name }}'}</li>
          {OPTIN_CAMPAIGN_RANGE_ELSE_TOKEN}
          <li style={emailStyles.listItem}>{'{{ L.Ts "public.subPrivateList" }}'}</li>
          {OPTIN_CAMPAIGN_RANGE_END_TOKEN}
        </ul>
      </Section>
      <Text style={emailStyles.paragraph}>
        {'{{ L.Ts "email.optin.confirmSubHelp" }}'}
      </Text>
      <Section style={emailStyles.buttonContainer}>
        {OPTIN_CAMPAIGN_BUTTON_TOKEN}
      </Section>
      <Text style={emailStyles.mutedText}>
        {'{{ L.Ts "email.optin.confirmSubInfo" }}'}
      </Text>
    </Section>
  );
}

export function ListmonkSubscriberDataContent() {
  return (
    <Section>
      <Heading as="h1" style={emailStyles.heading}>
        {'{{ L.Ts "email.data.title" }}'}
      </Heading>
      <Text style={emailStyles.paragraph}>{'{{ L.Ts "email.data.info" }}'}</Text>
      <Text style={emailStyles.mutedText}>
        Your exported subscriber profile, list memberships, and campaign telemetry are
        attached to this email as a JSON file.
      </Text>
    </Section>
  );
}

export function ListmonkCampaignStatusContent() {
  return (
    <Section>
      <Heading as="h1" style={emailStyles.heading}>
        {'{{ L.Ts "email.status.campaignUpdateTitle" }}'}
      </Heading>
      <Text style={emailStyles.paragraph}>
        {'{{ L.Ts "email.status.campaignUpdateInfo" }}'}
      </Text>
      <Section>
        <table
          role="presentation"
          width="100%"
          cellPadding="0"
          cellSpacing="0"
          style={emailStyles.statusTable}
        >
          <tbody>
            <tr>
              <td style={emailStyles.statusLabelCell}>
                {'{{ L.Ts "globals.terms.campaign" }}'}
              </td>
              <td style={emailStyles.statusValueCell}>
                <Link
                  href={`${ROOT_URL_TOKEN}/admin/campaigns/{{ index . "ID" }}`}
                  style={emailStyles.inlineLink}
                >
                  {'{{ index . "Name" }}'}
                </Link>
              </td>
            </tr>
            <tr>
              <td style={emailStyles.statusLabelCell}>
                {'{{ L.Ts "campaigns.status" }}'}
              </td>
              <td style={emailStyles.statusValueBoldCell}>
                {'{{ index . "Status" }}'}
              </td>
            </tr>
            <tr>
              <td style={emailStyles.statusLabelCell}>
                {'{{ L.Ts "campaigns.sent" }}'}
              </td>
              <td style={emailStyles.statusValueCell}>
                {'{{ index . "Sent" }} / {{ index . "ToSend" }}'}
              </td>
            </tr>
            <tr data-reason-row="true">
              <td style={emailStyles.statusLabelLastCell}>Details</td>
              <td style={emailStyles.statusErrorValueCell}>
                {'{{ index . "Reason" }}'}
              </td>
            </tr>
          </tbody>
        </table>
      </Section>
    </Section>
  );
}

export function ListmonkImportStatusContent() {
  return (
    <Section>
      <Heading as="h1" style={emailStyles.heading}>
        {'{{ L.Ts "email.status.importTitle" }}'}
      </Heading>
      <Text style={emailStyles.paragraph}>
        {'{{ L.Ts "email.status.importInfo" }}'}
      </Text>
      <Section>
        <table
          role="presentation"
          width="100%"
          cellPadding="0"
          cellSpacing="0"
          style={emailStyles.statusTable}
        >
          <tbody>
            <tr>
              <td style={emailStyles.statusLabelCell}>File</td>
              <td style={emailStyles.statusValueCell}>
                <Link
                  href={`${ROOT_URL_TOKEN}/admin/subscribers/import`}
                  style={emailStyles.inlineLink}
                >
                  {'{{ .Name }}'}
                </Link>
              </td>
            </tr>
            <tr>
              <td style={emailStyles.statusLabelCell}>Status</td>
              <td style={emailStyles.statusValueBoldCell}>{'{{ .Status }}'}</td>
            </tr>
            <tr>
              <td style={emailStyles.statusLabelLastCell}>Records</td>
              <td style={emailStyles.statusValueLastCell}>
                {'{{ .Imported }} / {{ .Total }}'}
              </td>
            </tr>
          </tbody>
        </table>
      </Section>
    </Section>
  );
}

export function ListmonkForgotPasswordContent() {
  return (
    <Section>
      <Heading as="h1" style={emailStyles.heading}>
        {'{{ L.T "email.forgotPassword.subject" }}'}
      </Heading>
      <Text style={emailStyles.paragraph}>
        {'{{ L.T "email.forgotPassword.help" }}'}
      </Text>
      <Section style={emailStyles.buttonContainer}>
        <Button href={RESET_URL_TOKEN} style={emailStyles.button}>
          {'{{ L.T "users.resetPassword" }}'}
        </Button>
      </Section>
      <Text style={emailStyles.mutedText}>
        Or copy and paste this password reset link into your browser:
        <br />
        <Link href={RESET_URL_TOKEN} style={emailStyles.codeUrl}>
          {RESET_URL_TOKEN}
        </Link>
      </Text>
      <Text style={emailStyles.mutedText}>
        {'{{ L.T "email.forgotPassword.info" }}'}
      </Text>
    </Section>
  );
}

export function ListmonkSmtpTestContent() {
  return (
    <Section>
      <Heading as="h1" style={emailStyles.heading}>
        {'{{ L.Ts "globals.buttons.testConnection" }}'}
      </Heading>
      <Text style={emailStyles.paragraph}>
        The SMTP connection from your self-hosted Listmonk instance (
        <strong>hackenberg.tech</strong>) is configured and delivering messages properly.
      </Text>
    </Section>
  );
}

/**
 * Renders Listmonk's `base.html` transactional wrapper containing `header`, `footer`,
 * and `base` (`{{ template "content" . }}`) definitions.
 */
export async function renderListmonkBaseTemplate(): Promise<string> {
  const rawHtml = await render(<ListmonkBaseEmail />);
  const [headerPart, footerPart = ''] = rawHtml.split(BASE_CONTENT_TOKEN);

  return [
    '{{ define "header" }}',
    headerPart,
    '{{ end }}',
    '',
    '{{ define "footer" }}',
    footerPart,
    '{{ end }}',
    '',
    '{{ define "base" }}',
    '{{ template "header" . }}',
    '{{ template "content" . }}',
    '{{ template "footer" . }}',
    '{{ end }}',
    '',
  ].join('\n');
}

/**
 * Renders Listmonk's `subscriber-optin.html` transactional template in English
 * without exposing email prefixes as subscriber names.
 */
export async function renderListmonkOptinTemplate(): Promise<string> {
  const rawHtml = await render(<ListmonkOptinContent />);
  const innerHtml = extractInnerFragment(rawHtml).replaceAll(
    OPTIN_URL_TOKEN,
    '{{ .OptinURL }}'
  );

  return wrapInTransactionalBase('subscriber-optin', innerHtml);
}

export async function renderListmonkOptinCampaignTemplate(): Promise<string> {
  const rawHtml = await render(<ListmonkOptinCampaignContent />);
  const buttonMarkup = `<a {{ .OptinURLAttr }} style="${EMAIL_BUTTON_INLINE_STYLE}">{{ L.Ts "globals.buttons.confirmSubscription" }}</a>`;

  const innerHtml = extractInnerFragment(rawHtml)
    .replace(
      OPTIN_CAMPAIGN_RANGE_START_TOKEN,
      '{{ range $i, $l := .Lists }}{{ if eq .Type "public" }}'
    )
    .replace(OPTIN_CAMPAIGN_RANGE_ELSE_TOKEN, '{{ else }}')
    .replace(OPTIN_CAMPAIGN_RANGE_END_TOKEN, '{{ end }}{{ end }}')
    .replace(OPTIN_CAMPAIGN_BUTTON_TOKEN, buttonMarkup);

  return ['{{ define "optin-campaign" }}', innerHtml, '{{ end }}', ''].join('\n');
}

export async function renderListmonkSubscriberDataTemplate(): Promise<string> {
  const rawHtml = await render(<ListmonkSubscriberDataContent />);
  return wrapInTransactionalBase('subscriber-data', extractInnerFragment(rawHtml));
}

export async function renderListmonkCampaignStatusTemplate(): Promise<string> {
  const rawHtml = await render(<ListmonkCampaignStatusContent />);
  const innerHtml = extractInnerFragment(rawHtml)
    .replaceAll(ROOT_URL_TOKEN, '{{ RootURL }}')
    .replace(
      /<tr data-reason-row="true">([\s\S]*?)<\/tr>/,
      '{{ if ne (index . "Reason") "" }}<tr>$1</tr>{{ end }}'
    );
  return wrapInTransactionalBase('campaign-status', innerHtml);
}

export async function renderListmonkImportStatusTemplate(): Promise<string> {
  const rawHtml = await render(<ListmonkImportStatusContent />);
  const innerHtml = extractInnerFragment(rawHtml).replaceAll(
    ROOT_URL_TOKEN,
    '{{ RootURL }}'
  );
  return wrapInTransactionalBase('import-status', innerHtml);
}

export async function renderListmonkForgotPasswordTemplate(): Promise<string> {
  const rawHtml = await render(<ListmonkForgotPasswordContent />);
  const innerHtml = extractInnerFragment(rawHtml).replaceAll(
    RESET_URL_TOKEN,
    '{{ .ResetURL }}'
  );
  return wrapInTransactionalBase('forgot-password', innerHtml);
}

export async function renderListmonkSmtpTestTemplate(): Promise<string> {
  const rawHtml = await render(<ListmonkSmtpTestContent />);
  return wrapInTransactionalBase('smtp-test', extractInnerFragment(rawHtml));
}

/**
 * Compiles all 8 static Listmonk HTML email templates in `static/email-templates/`
 * and returns a map of `filename -> compiledContent`.
 */
export async function renderAllListmonkStaticTemplates(): Promise<
  Record<ListmonkStaticTemplateFilename, string>
> {
  const [
    baseHtml,
    optinHtml,
    optinCampaignHtml,
    subscriberDataHtml,
    campaignStatusHtml,
    importStatusHtml,
    forgotPasswordHtml,
    smtpTestHtml,
  ] = await Promise.all([
    renderListmonkBaseTemplate(),
    renderListmonkOptinTemplate(),
    renderListmonkOptinCampaignTemplate(),
    renderListmonkSubscriberDataTemplate(),
    renderListmonkCampaignStatusTemplate(),
    renderListmonkImportStatusTemplate(),
    renderListmonkForgotPasswordTemplate(),
    renderListmonkSmtpTestTemplate(),
  ]);

  return {
    'base.html': baseHtml,
    'subscriber-optin.html': optinHtml,
    'subscriber-optin-campaign.html': optinCampaignHtml,
    'subscriber-data.html': subscriberDataHtml,
    'campaign-status.html': campaignStatusHtml,
    'import-status.html': importStatusHtml,
    'forgot-password.html': forgotPasswordHtml,
    'smtp-test.html': smtpTestHtml,
  };
}
