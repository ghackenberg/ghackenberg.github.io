import type { CSSProperties } from 'react';

export const EMAIL_BUTTON_INLINE_STYLE =
  'background-color:#2563eb;border-radius:10px;color:#ffffff;display:inline-block;font-size:14px;font-weight:700;padding:12px 24px;text-decoration:none';

export const emailStyles = {
  // Layout & Shell
  body: {
    backgroundColor: '#f8fafc',
    color: '#334155',
    fontFamily:
      "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
    margin: '0',
    padding: '32px 16px',
  },
  container: {
    maxWidth: '640px',
    margin: '0 auto',
    backgroundColor: '#ffffff',
    border: '1px solid #e2e8f0',
    borderRadius: '16px',
    padding: '32px',
  },
  containerCompact: {
    maxWidth: '600px',
    margin: '0 auto',
    backgroundColor: '#ffffff',
    border: '1px solid #e2e8f0',
    borderRadius: '16px',
    padding: '32px',
  },
  headerSection: {
    paddingBottom: '20px',
    borderBottom: '1px solid #e2e8f0',
    marginBottom: '24px',
  },
  headerBadgeCell: {
    verticalAlign: 'middle',
    paddingRight: '12px',
  },
  headerTextCell: {
    verticalAlign: 'middle',
  },
  brandBadge: {
    width: '40px',
    height: '40px',
    lineHeight: '40px',
    textAlign: 'center',
    backgroundColor: '#eff6ff',
    border: '1px solid #bfdbfe',
    borderRadius: '8px',
    color: '#2563eb',
    fontWeight: 800,
    fontSize: '15px',
    display: 'inline-block',
  },
  brandTitle: {
    color: '#0f172a',
    fontWeight: 700,
    fontSize: '15px',
    lineHeight: '1.25',
    margin: '0',
    textDecoration: 'none',
  },
  brandSubtitle: {
    color: '#64748b',
    fontSize: '12px',
    lineHeight: '1.35',
    margin: '2px 0 0 0',
  },
  hr: {
    borderColor: '#e2e8f0',
    margin: '28px 0 20px 0',
  },
  footerText: {
    color: '#64748b',
    fontSize: '12px',
    lineHeight: '1.6',
    margin: '0 0 6px 0',
  },
  footerLink: {
    color: '#2563eb',
    textDecoration: 'underline',
  },

  // Issue Editorial Content
  topBar: {
    marginBottom: '14px',
  },
  topBarLeftCell: {
    verticalAlign: 'middle',
    textAlign: 'left',
  },
  topBarRightCell: {
    verticalAlign: 'middle',
    textAlign: 'right',
  },
  topBarDate: {
    color: '#2563eb',
    fontSize: '13px',
    fontWeight: 600,
  },
  topBarSeparator: {
    color: '#cbd5e1',
    fontSize: '13px',
    margin: '0 8px',
  },
  topBarIssue: {
    color: '#64748b',
    fontSize: '13px',
    fontWeight: 500,
  },
  webPillLink: {
    display: 'inline-block',
    backgroundColor: '#f8fafc',
    border: '1px solid #e2e8f0',
    borderRadius: '9999px',
    padding: '5px 12px',
    color: '#475569',
    fontSize: '12px',
    fontWeight: 600,
    lineHeight: '1.2',
    textDecoration: 'none',
  },
  title: {
    color: '#0f172a',
    fontSize: '26px',
    fontWeight: 800,
    lineHeight: '1.25',
    letterSpacing: '-0.02em',
    margin: '0 0 10px 0',
  },
  subtitle: {
    color: '#64748b',
    fontSize: '16px',
    lineHeight: '1.5',
    margin: '0 0 24px 0',
  },
  heroImage: {
    width: '100%',
    maxWidth: '576px',
    height: 'auto',
    borderRadius: '12px',
    border: '1px solid #e2e8f0',
    display: 'block',
    margin: '0 0 24px 0',
  },
  sectionHeading: {
    color: '#0f172a',
    fontSize: '18px',
    fontWeight: 800,
    letterSpacing: '-0.01em',
    margin: '28px 0 16px 0',
  },
  card: {
    backgroundColor: '#f8fafc',
    border: '1px solid #e2e8f0',
    borderRadius: '12px',
    padding: '20px',
    marginBottom: '16px',
  },
  cardDomain: {
    color: '#7c3aed',
    fontSize: '11px',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    margin: '0 0 6px 0',
  },
  cardTitle: {
    color: '#0f172a',
    fontSize: '17px',
    fontWeight: 700,
    lineHeight: '1.35',
    margin: '0 0 8px 0',
  },
  cardDesc: {
    color: '#334155',
    fontSize: '14px',
    lineHeight: '1.6',
    margin: '0 0 14px 0',
  },
  cardButton: {
    backgroundColor: '#2563eb',
    borderRadius: '8px',
    color: '#ffffff',
    display: 'inline-block',
    fontSize: '13px',
    fontWeight: 600,
    padding: '8px 16px',
    textDecoration: 'none',
  },

  // Transactional Content & Tables
  heading: {
    color: '#0f172a',
    fontSize: '22px',
    fontWeight: 800,
    letterSpacing: '-0.02em',
    margin: '0 0 16px 0',
  },
  paragraph: {
    color: '#334155',
    fontSize: '15px',
    lineHeight: '1.65',
    margin: '0 0 16px 0',
  },
  inlineLink: {
    color: '#2563eb',
    textDecoration: 'underline',
  },
  buttonContainer: {
    margin: '28px 0',
  },
  button: {
    backgroundColor: '#2563eb',
    borderRadius: '10px',
    color: '#ffffff',
    display: 'inline-block',
    fontSize: '14px',
    fontWeight: 700,
    padding: '12px 24px',
    textDecoration: 'none',
  },
  mutedText: {
    color: '#64748b',
    fontSize: '13px',
    lineHeight: '1.6',
    margin: '0 0 12px 0',
  },
  codeUrl: {
    color: '#2563eb',
    fontSize: '12px',
    wordBreak: 'break-all',
    textDecoration: 'underline',
  },
  list: {
    margin: '0 0 20px 0',
    paddingLeft: '20px',
    color: '#334155',
    fontSize: '15px',
    lineHeight: '1.65',
  },
  listItem: {
    marginBottom: '6px',
  },
  statusTable: {
    borderCollapse: 'collapse',
    backgroundColor: '#f8fafc',
    border: '1px solid #e2e8f0',
    borderRadius: '12px',
    margin: '16px 0 8px 0',
    fontSize: '14px',
    color: '#334155',
    width: '100%',
  },
  statusLabelCell: {
    padding: '12px 16px',
    borderBottom: '1px solid #e2e8f0',
    fontWeight: 600,
    color: '#64748b',
    width: '32%',
  },
  statusValueCell: {
    padding: '12px 16px',
    borderBottom: '1px solid #e2e8f0',
  },
  statusValueBoldCell: {
    padding: '12px 16px',
    borderBottom: '1px solid #e2e8f0',
    fontWeight: 600,
    color: '#0f172a',
  },
  statusLabelLastCell: {
    padding: '12px 16px',
    fontWeight: 600,
    color: '#64748b',
    width: '32%',
  },
  statusValueLastCell: {
    padding: '12px 16px',
  },
  statusErrorValueCell: {
    padding: '12px 16px',
    color: '#dc2626',
  },
} satisfies Record<string, CSSProperties>;

export const emailMarkdownStyles = {
  p: {
    color: '#334155',
    fontSize: '15px',
    lineHeight: '1.7',
    margin: '0 0 16px 0',
  },
  h2: {
    color: '#0f172a',
    fontSize: '19px',
    fontWeight: 700,
    margin: '24px 0 10px 0',
  },
  h3: {
    color: '#0f172a',
    fontSize: '16px',
    fontWeight: 700,
    margin: '20px 0 8px 0',
  },
  li: {
    color: '#334155',
    fontSize: '15px',
    lineHeight: '1.65',
    marginBottom: '6px',
  },
  link: {
    color: '#2563eb',
    textDecoration: 'underline',
  },
} satisfies Record<string, CSSProperties>;
