import {
  Button,
  Heading,
  Img,
  Link,
  Markdown,
  Section,
  Text,
} from '@react-email/components';
import { render } from '@react-email/render';
import { EmailShell } from './EmailShell';
import { emailMarkdownStyles, emailStyles } from './email-theme';

export interface NewsletterFeaturedItem {
  domain: 'Post' | 'Presentation' | 'Publication' | 'Course' | 'Project' | 'Visualization';
  title: string;
  description: string;
  url: string;
  dateFormatted?: string;
}

export interface NewsletterIssueEmailProps {
  slug: string;
  issueNumber: number;
  title: string;
  subtitle?: string;
  description: string;
  dateFormatted: string;
  markdownBody: string;
  featuredItems: NewsletterFeaturedItem[];
  heroImageSrc: string;
  heroImageAlt: string;
  heroImageTitle: string;
}

const UNSUBSCRIBE_URL_TOKEN = 'https://hackenberg.tech/__LISTMONK_UNSUBSCRIBE_URL__';

const FEATURED_SECTIONS: ReadonlyArray<{
  domain: NewsletterFeaturedItem['domain'];
  heading: string;
}> = [
  { domain: 'Post', heading: 'Featured Posts' },
  { domain: 'Presentation', heading: 'Featured Presentations' },
  { domain: 'Publication', heading: 'Featured Publications' },
  { domain: 'Course', heading: 'Featured Courses' },
  { domain: 'Project', heading: 'Featured Projects' },
  { domain: 'Visualization', heading: 'Featured Visualizations' },
];

/**
 * Renders only the inner newsletter issue content fragment (without outer <html>/<body>/<Container>,
 * brand header, or footer) so it can be injected directly into `{{ template "content" . }}`
 * of `ListmonkCampaignTemplate.tsx` without duplicating document wrappers or footers.
 */
export function NewsletterIssueContent({
  slug,
  issueNumber,
  title,
  subtitle,
  dateFormatted,
  markdownBody,
  featuredItems,
  heroImageSrc,
  heroImageAlt,
  heroImageTitle,
}: NewsletterIssueEmailProps) {
  const webUrl = `https://hackenberg.tech/newsletters/${slug}/`;

  return (
    <>
      <Section style={emailStyles.topBar}>
        <table role="presentation" width="100%" cellPadding="0" cellSpacing="0" border={0}>
          <tbody>
            <tr>
              <td style={emailStyles.topBarLeftCell}>
                <span style={emailStyles.topBarDate}>{dateFormatted}</span>
                <span style={emailStyles.topBarSeparator}>•</span>
                <span style={emailStyles.topBarIssue}>Issue #{issueNumber}</span>
              </td>
              <td style={emailStyles.topBarRightCell}>
                <Link href={webUrl} style={emailStyles.webPillLink}>
                  View in browser ↗
                </Link>
              </td>
            </tr>
          </tbody>
        </table>
      </Section>

      <Section>
        <Heading as="h1" style={emailStyles.title}>
          {title}
        </Heading>
        {subtitle && <Text style={emailStyles.subtitle}>{subtitle}</Text>}
      </Section>

      <Section>
        <Img
          src={heroImageSrc}
          alt={heroImageAlt}
          title={heroImageTitle}
          width="576"
          style={emailStyles.heroImage}
        />
      </Section>

      <Section>
        <Markdown markdownCustomStyles={emailMarkdownStyles}>{markdownBody}</Markdown>
      </Section>

      {FEATURED_SECTIONS.map((section) => {
        const sectionItems = featuredItems.filter(
          (item) => item.domain === section.domain
        );
        if (sectionItems.length === 0) return null;
        return (
          <Section key={section.domain}>
            <Heading as="h2" style={emailStyles.sectionHeading}>
              {section.heading}
            </Heading>
            {sectionItems.map((item) => (
              <Section key={item.url} style={emailStyles.card}>
                <Text style={emailStyles.cardDomain}>
                  {item.domain}
                  {item.dateFormatted ? ` · ${item.dateFormatted}` : ''}
                </Text>
                <Heading as="h3" style={emailStyles.cardTitle}>
                  {item.title}
                </Heading>
                <Text style={emailStyles.cardDesc}>{item.description}</Text>
                <Button href={item.url} style={emailStyles.cardButton}>
                  Read on hackenberg.tech →
                </Button>
              </Section>
            ))}
          </Section>
        );
      })}
    </>
  );
}

/**
 * Full standalone HTML email document wrapping `NewsletterIssueContent` inside the shared
 * `EmailShell` for standalone preview and plain-text generation.
 */
export function NewsletterIssueEmail(props: NewsletterIssueEmailProps) {
  return (
    <EmailShell
      variant="campaign"
      preview={props.description}
      brandHref="https://hackenberg.tech"
      unsubscribeHref={UNSUBSCRIBE_URL_TOKEN}
    >
      <NewsletterIssueContent {...props} />
    </EmailShell>
  );
}

function stripOuterDocumentWrapper(rawHtml: string): string {
  return rawHtml
    .replace(/<!DOCTYPE[^>]*>/gi, '')
    .replace(/<html[^>]*>/gi, '')
    .replace(/<\/html>/gi, '')
    .replace(/<head[^>]*>[\s\S]*?<\/head>/gi, '')
    .replace(/<body[^>]*>/gi, '')
    .replace(/<\/body>/gi, '')
    .trim();
}

/**
 * Renders a newsletter issue into:
 * - `html`: Full standalone HTML email document
 * - `campaignBodyHtml`: Clean inner HTML fragment (for Listmonk `{{ template "content" . }}`)
 * - `plainText`: Plain-text `altbody` version
 */
export async function renderNewsletterIssueEmail(
  props: NewsletterIssueEmailProps
): Promise<{ html: string; campaignBodyHtml: string; plainText: string }> {
  const [rawHtml, rawCampaignBody, rawPlainText] = await Promise.all([
    render(<NewsletterIssueEmail {...props} />),
    render(<NewsletterIssueContent {...props} />),
    render(<NewsletterIssueEmail {...props} />, { plainText: true }),
  ]);

  return {
    html: rawHtml.replaceAll(UNSUBSCRIBE_URL_TOKEN, '{{ UnsubscribeURL }}'),
    campaignBodyHtml: stripOuterDocumentWrapper(rawCampaignBody).replaceAll(
      UNSUBSCRIBE_URL_TOKEN,
      '{{ UnsubscribeURL }}'
    ),
    plainText: rawPlainText.replaceAll(UNSUBSCRIBE_URL_TOKEN, '{{ UnsubscribeURL }}'),
  };
}
