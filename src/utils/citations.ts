export interface CitationRef {
  id?: string;
  label?: string;
  author?: string;
  year?: number | string;
}

/**
 * Generates an alphanumeric citation label (e.g., Agg24, Cor09, ISO24)
 * following classic BibTeX-alpha style.
 */
export function generateCitationLabel(ref: CitationRef): string {
  if (ref.label && ref.label.trim()) {
    return ref.label.trim();
  }

  const yearStr = ref.year ? String(ref.year).slice(-2) : '';
  const authorStr = ref.author || '';

  // Check known institutions/organizations first
  if (/^iso\b/i.test(authorStr)) return 'ISO' + yearStr;
  if (/^w3c\b/i.test(authorStr)) return 'W3C' + yearStr;
  if (/^din\b/i.test(authorStr)) return 'DIN' + yearStr;
  if (/^anthropic\b/i.test(authorStr)) return 'Anth' + yearStr;
  if (/^google\b/i.test(authorStr)) return 'Goo' + yearStr;
  if (/^plausible\b/i.test(authorStr)) return 'Plau' + yearStr;
  if (/^plattform\b/i.test(authorStr)) return 'PI40' + yearStr;
  if (/^forrester\b/i.test(authorStr)) return 'Forr' + yearStr;
  if (/^sparktoro\b/i.test(authorStr)) return 'ST' + yearStr;
  if (/^opentelemetry\b/i.test(authorStr)) return 'OTel' + yearStr;
  if (/^schema\.org\b/i.test(authorStr)) return 'Sch' + yearStr;
  if (/^khronos\b/i.test(authorStr)) return 'Khr' + yearStr;

  // Clean author string into distinct author names
  const cleanAuthors = authorStr
    .split(/[,;&]|\band\b/i)
    .map((s) => s.trim().replace(/^(von|van|de|der|the)\s+/i, ''))
    .filter((s) => s.length > 0 && !/^(et\s*al\.?|team|group|working\s*group|authors?|core\s*team)$/i.test(s));

  if (cleanAuthors.length === 0) {
    if (ref.id) {
      const cleanId = ref.id.replace(/[^a-zA-Z0-9]/g, '');
      return cleanId.slice(0, 5) + (yearStr ? yearStr : '');
    }
    return 'Ref' + yearStr;
  }

  // Extract surname from "Surname, First" or "First Surname"
  const getSurname = (str: string): string => {
    if (str.includes(',')) {
      return str.split(',')[0].trim();
    }
    const parts = str.trim().split(/\s+/);
    return parts[parts.length - 1];
  };

  const surnames = cleanAuthors.map(getSurname).filter((s) => s.length > 0);

  if (surnames.length === 1) {
    const s = surnames[0].replace(/[^A-Za-z]/g, '');
    const prefix = s.length >= 3 ? s.slice(0, 3) : s;
    return (prefix.charAt(0).toUpperCase() + prefix.slice(1).toLowerCase()) + yearStr;
  }

  if (surnames.length >= 2 && surnames.length <= 4) {
    const letters = surnames
      .map((s) => s.replace(/[^A-Za-z]/g, '').charAt(0).toUpperCase())
      .join('');
    return letters + yearStr;
  }

  // > 4 authors: First author 3 letters + year
  const firstSurname = surnames[0].replace(/[^A-Za-z]/g, '');
  const prefix = firstSurname.length >= 3 ? firstSurname.slice(0, 3) : firstSurname;
  return (prefix.charAt(0).toUpperCase() + prefix.slice(1).toLowerCase()) + yearStr;
}
