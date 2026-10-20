import {
  Body,
  Container,
  Head,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components';
import type { ReactNode } from 'react';
import { emailStyles } from './email-theme';

export interface EmailShellProps {
  children: ReactNode;
  preview?: string;
  variant?: 'campaign' | 'transactional';
  brandHref?: string;
  unsubscribeHref?: string;
}

export function EmailShell({
  children,
  preview,
  variant = 'campaign',
  brandHref,
  unsubscribeHref = 'https://hackenberg.tech/newsletters/',
}: EmailShellProps) {
  const containerStyle =
    variant === 'transactional' ? emailStyles.containerCompact : emailStyles.container;

  return (
    <Html lang="en">
      <Head />
      {preview && <Preview>{preview}</Preview>}
      <Body style={emailStyles.body}>
        <Container style={containerStyle}>
          <Section style={emailStyles.headerSection}>
            <table role="presentation" cellPadding="0" cellSpacing="0" border={0}>
              <tbody>
                <tr>
                  <td style={emailStyles.headerBadgeCell}>
                    <div style={emailStyles.brandBadge}>GH</div>
                  </td>
                  <td style={emailStyles.headerTextCell}>
                    <div style={emailStyles.brandTitle}>
                      {brandHref ? (
                        <Link href={brandHref} style={emailStyles.brandTitle}>
                          Dr. Georg Hackenberg
                        </Link>
                      ) : (
                        'Dr. Georg Hackenberg'
                      )}
                    </div>
                    <div style={emailStyles.brandSubtitle}>
                      Professor for Industrial Informatics @ UAP
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </Section>

          <Section>{children}</Section>

          <Hr style={emailStyles.hr} />

          {variant === 'campaign' ? (
            <Section>
              <Text style={emailStyles.footerText}>
                You are receiving this email because you subscribed to updates on{' '}
                <Link href="https://hackenberg.tech" style={emailStyles.footerLink}>
                  hackenberg.tech
                </Link>
                .
              </Text>
              <Text style={emailStyles.footerText}>
                <Link href={unsubscribeHref} style={emailStyles.footerLink}>
                  Unsubscribe
                </Link>
                {' · '}
                <Link
                  href="https://hackenberg.tech/newsletters/"
                  style={emailStyles.footerLink}
                >
                  Newsletter Archive
                </Link>
                {' · '}
                <Link
                  href="https://hackenberg.tech/datenschutz/#newsletter"
                  style={emailStyles.footerLink}
                >
                  Privacy Policy
                </Link>
              </Text>
              <Text style={emailStyles.footerText}>
                Dr. Georg Hackenberg · Stelzhamerstrasse 23, 4600 Wels, Austria
              </Text>
            </Section>
          ) : (
            <Section>
              <Text style={emailStyles.footerText}>
                Dr. Georg Hackenberg · Stelzhamerstrasse 23, 4600 Wels, Austria
              </Text>
              <Text style={emailStyles.footerText}>
                <Link href="https://hackenberg.tech" style={emailStyles.footerLink}>
                  hackenberg.tech
                </Link>
                {' · '}
                <Link
                  href="https://hackenberg.tech/datenschutz/#newsletter"
                  style={emailStyles.footerLink}
                >
                  Privacy Policy
                </Link>
                {' · '}
                <Link
                  href="https://hackenberg.tech/impressum/"
                  style={emailStyles.footerLink}
                >
                  Imprint
                </Link>
              </Text>
            </Section>
          )}
        </Container>
      </Body>
    </Html>
  );
}
