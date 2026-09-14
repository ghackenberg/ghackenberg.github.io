export interface GscMetricSummary {
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface GscQueryMetric extends GscMetricSummary {
  query: string;
}

export interface GscPagePerformance extends GscMetricSummary {
  page: string;
  queries?: GscQueryMetric[];
}

export interface PlausiblePageMetrics {
  visitors: number;
  pageviews: number;
  bounceRate: number | null; // percentage (0-100)
  visitDuration: number | null; // seconds
}

export interface UnifiedPageAudit {
  path: string;
  fullUrl: string;
  period: string;
  gsc: GscMetricSummary & {
    topQueries: GscQueryMetric[];
  };
  plausible: PlausiblePageMetrics;
  assessment: {
    status: 'healthy' | 'needs_attention' | 'underperforming' | 'no_data';
    notes: string[];
  };
}

export type OpportunityType =
  | 'striking_distance'
  | 'high_bounce_performer'
  | 'hidden_champion'
  | 'low_ctr_high_impression';

export interface SeoOpportunity {
  path: string;
  type: OpportunityType;
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  gsc: GscMetricSummary;
  plausible: PlausiblePageMetrics;
  suggestedAction: string;
}

export interface UrlInspectionDetails {
  url: string;
  inspectionVerdict?: string;
  coverageState?: string;
  indexingState?: string;
  robotsTxtState?: string;
  pageFetchState?: string;
  googleCanonical?: string;
  userCanonical?: string;
  sitemap?: string[];
  referringUrls?: string[];
  lastCrawlTime?: string;
  mobileUsabilityVerdict?: string;
  rawIssues?: string[];
}

export interface AioEvaluationResult {
  target: string;
  sourceFile?: string;
  score: number; // 0 - 100
  breakdown: {
    directAnswerParagraphs: {
      count: number;
      passed: boolean;
      examples: string[];
    };
    tables: {
      count: number;
      passed: boolean;
    };
    structuredLists: {
      count: number;
      passed: boolean;
    };
    questionHeadings: {
      count: number;
      passed: boolean;
      headings: string[];
    };
    schemaStructuredData: {
      detected: boolean;
      types: string[];
    };
    conciseSummaryLength: {
      avgWordsPerFirstParagraph: number;
      passed: boolean;
    };
  };
  keyFindings: string[];
  concreteRecommendations: string[];
}
