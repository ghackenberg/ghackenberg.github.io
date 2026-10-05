---
name: legal-compliance
description: Audit and maintain Austrian and EU legal compliance, Impressum disclosures (ECG, UGB, GewO, MedienG), and GDPR/DSGVO privacy settings.
---

# Legal Compliance (Austrian E-Commerce & GDPR Governance)

This skill governs the statutory disclosures, privacy policies, and GDPR compliance of the website under Austrian and European Union law.

## 1. Statutory Scope & Legal Frameworks
The website operates from Austria and is strictly subject to:
- **§ 5 ECG (E-Commerce-Gesetz)**: General provider identification.
- **§ 14 UGB (Unternehmensgesetzbuch)**: Company register and business details.
- **§ 345 GewO (Gewerbeordnung)**: Trade license details.
- **§ 25 Mediengesetz**: Media owner disclosure and editorial policy (*Blattlinie*).
- **DSGVO / GDPR**: Privacy, processing records, and data subject rights.
- **§ 165 TKG 2021 (Telekommunikationsgesetz)**: Cookie and client storage consent.

## 2. Core Implementation Files
- **Impressum**: `src/pages/impressum.astro` (Anbieterkennzeichnung, WKO-Zugehörigkeit, Aufsichtsbehörde, anwendbare berufsrechtliche Vorschriften).
- **Privacy Modal & Policy**: `src/components/PrivacyModal.astro` (Datenschutzerklärung, Rechte der Betroffenen, Auskunft, Löschung).

## 3. Statutory Invariants (Dr. Georg Hackenberg)
- **Identity**: Dr. Georg Hackenberg (IT-Dienstleistungen).
- **Location**: Wels, Oberösterreich, Austria.
- **Kammer / Berufsverband**: Wirtschaftskammer Oberösterreich (WKO), Fachgruppe UBIT (Unternehmensberatung, Buchhaltung und Informationstechnologie).
- **Gewerbebehörde**: Magistrat der Stadt Wels.
- **Blattlinie**: Information über Dienstleistungen, Lehre, Forschungsprojekte und Fachbeiträge in den Bereichen Software Engineering, Künstliche Intelligenz und Webtechnologien.

## 4. Privacy-by-Design & Zero-Leakage Policy
To ensure complete compliance without intrusive cookie banners:
- **Plausible Analytics**: Cookieless, privacy-friendly telemetry without storing personal data or tracking across devices.
- **No External CDNs / Fonts**: All web fonts are strictly self-hosted via `@fontsource/*` (zero IP transfers to Google Fonts).
- **Third-Party Embeds**: Interactive third-party embeds (YouTube, Vimeo, external frames) must provide a click-to-load placeholder or opt-in barrier before contacting external servers.

## 5. Verification Gate
Verify legal compliance and disclosures through the master release verification gate (see `build-engineering`).
