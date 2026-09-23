// Chrome Extension — Types & Interfaces for Brand Muse Live Brand Auditor

export interface BrandColor {
  id?: string;
  hex: string;
  role?: string | null;
  name?: string | null;
  position?: number;
  contrastWhite?: number | null;
  contrastBlack?: number | null;
}

export interface BrandFont {
  id?: string;
  family: string;
  role?: string | null;
  weights?: string[] | null;
  googleFont?: boolean | null;
}

export interface BrandKitData {
  id: string;
  name: string;
  isPublic?: boolean;
  shareToken?: string | null;
  colors: BrandColor[];
  fonts: BrandFont[];
  tokens?: any[];
  updatedAt?: string;
}

export type ViolationType = "off_brand_color" | "unapproved_font" | "wcag_contrast_failure";

export interface AuditViolation {
  id: string;
  type: ViolationType;
  selector: string;
  elementTag: string;
  property: "color" | "background-color" | "border-color" | "fill" | "stroke" | "font-family";
  actualValue: string;
  suggestedReplacement: string;
  suggestedRole?: string;
  deltaE?: number;
  contrastRatio?: number;
  requiredContrast?: number;
  message: string;
  originalStyle?: string;
  boundingBox?: {
    top: number;
    left: number;
    width: number;
    height: number;
  };
}

export interface AuditSummary {
  url: string;
  title: string;
  kitId: string;
  kitName: string;
  scannedAt: string;
  totalElementsScanned: number;
  totalViolations: number;
  offBrandColorCount: number;
  unapprovedFontCount: number;
  contrastFailureCount: number;
  overallScore: number; // 0 - 100
  colorScore: number; // 0 - 100
  typographyScore: number; // 0 - 100
  contrastScore: number; // 0 - 100
  violations: AuditViolation[];
}

export type ExtensionMessageType =
  | "AUDIT_REQUEST"
  | "AUDIT_RESPONSE"
  | "TOGGLE_HIGHLIGHTS"
  | "CLEAR_HIGHLIGHTS"
  | "GET_STATUS"
  | "STATUS_RESPONSE"
  | "PREVIEW_FIX"
  | "REVERT_FIX";

export interface ExtensionMessage {
  type: ExtensionMessageType;
  payload?: any;
}
