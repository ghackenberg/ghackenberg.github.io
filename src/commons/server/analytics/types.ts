export interface GscMetricSummary {
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface SectionDwellMetric {
  id: string;
  visitors: number;
  events?: number;
}

export interface CardCtrMetric {
  id: string;
  views: number;
  clicks: number;
  ctr: number;
}

export interface DevOverlayPageData {
  path: string;
  period: string;
  plausible: {
    visitors: number;
    entries?: number;
    pageviews: number;
    bounceRate: number | null;
    visitDuration: number | null;
  };
  gsc: {
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
    queries: GscQueryMetric[];
  };
  sections: Record<string, SectionDwellMetric>;
  cards: Record<string, CardCtrMetric>;
  pages?: Record<string, { visitors: number; pageviews: number; bounceRate?: number | null; visitDuration?: number | null }>;
}

export interface GscQueryMetric extends GscMetricSummary {
  query: string;
}

export interface GscPagePerformance extends GscMetricSummary {
  page: string;
  queries?: GscQueryMetric[];
}

export interface ScrollFunnelMilestone {
  depth: number; // e.g. 10, 20, 30 ... 90
  visitors: number;
  percentageOfVisitors: number; // % relative to page visitors
  dropOffRateFromPrevious?: number; // % dropped from preceding milestone
}

export interface ScrollRetentionData {
  milestones: ScrollFunnelMilestone[];
  readThroughRate: number | null; // % reaching >= 90%
  medianScrollDepth: number | null; // deepest milestone with >= 50% visitors
}

export interface GoalConversionDetail {
  property: string;
  value: string;
  visitors: number;
}

export interface PlausibleGoalConversion {
  goal: string;
  visitors: number;
  conversionRate?: number | null; // % relative to page visitors
  details?: GoalConversionDetail[];
}

export interface TechDimensionMetric {
  name: string; // e.g. "Desktop", "Mobile", "Chrome", "Windows"
  visitors: number;
  percentage: number;
  bounceRate: number | null;
  visitDuration: number | null;
}

export interface TechBreakdown {
  devices: TechDimensionMetric[];
  operatingSystems: TechDimensionMetric[];
  browsers: TechDimensionMetric[];
  screenBuckets?: TechDimensionMetric[];
  orientations?: TechDimensionMetric[];
}

export interface GeoDimensionMetric {
  country: string; // e.g. "AT", "DE", "US"
  visitors: number;
  percentage: number;
  bounceRate: number | null;
  visitDuration: number | null;
}

export interface UtmCampaignMetric {
  campaign: string;
  source?: string;
  medium?: string;
  visitors: number;
  bounceRate: number | null;
  visitDuration: number | null;
}

export interface PlausiblePageMetrics {
  visitors: number;
  entries?: number;
  pageviews: number;
  bounceRate: number | null; // percentage (0-100)
  visitDuration: number | null; // seconds
  scrollFunnel?: ScrollRetentionData;
  goals?: PlausibleGoalConversion[];
  tech?: TechBreakdown;
  countries?: GeoDimensionMetric[];
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
    anomalies?: {
      browserIssues?: string[];
      deviceDiscrepancies?: string[];
      scrollFatigue?: string[];
    };
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

export interface AioScanSummary {
  totalScanned: number;
  averageScore: number;
  highReadinessCount: number; // score >= 90
  mediumReadinessCount: number; // 70 <= score < 90
  lowReadinessCount: number; // score < 70
  results: Array<{
    target: string;
    sourceFile: string;
    score: number;
    tables: number;
    questionHeadings: number;
    directAnswers: number;
    recommendations: string[];
  }>;
}

export interface InternalLinkItem {
  sourcePath: string;
  targetPath: string;
  anchorText: string;
  isRelative: boolean;
}

export interface InternalLinkAudit {
  totalInternalLinks: number;
  totalUniquePages: number;
  orphanPages: Array<{
    path: string;
    sourceFile: string;
    incomingLinksCount: number;
  }>;
  linkingOpportunities?: Array<{
    targetPath: string;
    donorPath: string;
    donorFile: string;
    matchedKeywords: string[];
    snippetContext: string;
  }>;
}

export interface SerpSnippetIssue {
  field: 'title' | 'description';
  issue: 'too_long' | 'too_short' | 'missing_focus_keyword' | 'empty';
  message: string;
  currentLength: number;
  recommendedRange: string;
}

export interface SerpSnippetPageReport {
  path: string;
  sourceFile: string;
  title: string;
  description: string;
  titleLength: number;
  descriptionLength: number;
  issues: SerpSnippetIssue[];
  topGscQuery?: string;
  hasTopGscQueryInTitle?: boolean;
}

export interface SerpSnippetAudit {
  totalAudited: number;
  issuesCount: number;
  pagesWithIssues: SerpSnippetPageReport[];
}

export interface AioDiffResult {
  target: string;
  baseRef: string;
  scoreBefore: number;
  scoreAfter: number;
  scoreDelta: number;
  directAnswersDelta: number;
  tablesDelta: number;
  questionHeadingsDelta: number;
  listsDelta: number;
  before: AioEvaluationResult;
  after: AioEvaluationResult;
}

export interface SiteOverviewSummary {
  period: string;
  gsc: {
    totalClicks: number;
    totalImpressions: number;
    averageCtr: number;
    averagePosition: number;
  };
  plausible: {
    totalVisitors: number;
    totalPageviews: number;
    averageBounceRate: number | null;
    averageVisitDuration: number | null;
  };
  goalsSummary?: PlausibleGoalConversion[];
  techDistribution?: TechBreakdown;
  topCountries?: GeoDimensionMetric[];
  assessment: {
    summary: string;
    trafficHealth: 'thriving' | 'growing' | 'early_stage' | 'low_traffic';
    keyRecommendations: string[];
  };
}

export interface TrafficSourceMetric {
  source: string;
  visitors: number;
  bounceRate: number | null;
  visitDuration: number | null;
}

export interface TopQueriesReport {
  period: string;
  totalQueries: number;
  queries: GscQueryMetric[];
}

export interface RetentionBottleneck {
  path: string;
  visitors: number;
  pageviews: number;
  bounceRate: number;
  visitDuration: number | null;
  severity: 'critical' | 'high' | 'moderate';
  issue: string;
  recommendation: string;
}

