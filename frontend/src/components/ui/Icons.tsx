/**
 * Minimalist SVG icon library.
 * Stroke-based, 24×24 viewBox, currentColor.
 */

import React from "react";

interface IconProps {
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

const icon = (path: React.ReactNode, viewBox = "0 0 24 24") =>
  React.memo(({ size = 20, className, style }: IconProps) => (
    <svg
      width={size}
      height={size}
      viewBox={viewBox}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
    >
      {path}
    </svg>
  ));

// ── Navigation ──────────────────────────────────────────────
export const CameraIcon = icon(
  <>
    <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
    <circle cx="12" cy="13" r="4" />
  </>
);

export const BarChartIcon = icon(
  <>
    <line x1="18" y1="20" x2="18" y2="10" />
    <line x1="12" y1="20" x2="12" y2="4" />
    <line x1="6" y1="20" x2="6" y2="14" />
  </>
);

export const TrendingUpIcon = icon(
  <>
    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
    <polyline points="17 6 23 6 23 12" />
  </>
);

export const MessageCircleIcon = icon(
  <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" />
);

export const UserIcon = icon(
  <>
    <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </>
);

// ── Branding ────────────────────────────────────────────────
export const ActivityIcon = icon(
  <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
);

// ── Actions & States ────────────────────────────────────────
export const UploadIcon = icon(
  <>
    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
    <polyline points="17 8 12 3 7 8" />
    <line x1="12" y1="3" x2="12" y2="15" />
  </>
);

export const ScanIcon = icon(
  <>
    <path d="M3 7V5a2 2 0 012-2h2" />
    <path d="M17 3h2a2 2 0 012 2v2" />
    <path d="M21 17v2a2 2 0 01-2 2h-2" />
    <path d="M7 21H5a2 2 0 01-2-2v-2" />
    <line x1="7" y1="12" x2="17" y2="12" />
  </>
);

export const RulerIcon = icon(
  <>
    <path d="M21.3 9.5a2.5 2.5 0 0 0 0-3.53l-2.77-2.77a2.5 2.5 0 0 0-3.53 0L3 15.3a2.5 2.5 0 0 0 0 3.53l2.77 2.77a2.5 2.5 0 0 0 3.53 0z" />
    <line x1="8.5" y1="8.5" x2="13.5" y2="13.5" />
    <line x1="10.5" y1="6.5" x2="12.5" y2="8.5" />
    <line x1="14.5" y1="10.5" x2="16.5" y2="12.5" />
    <line x1="18.5" y1="14.5" x2="20.5" y2="16.5" />
  </>
);

export const ScaleIcon = icon(
  <>
    <rect x="3" y="3" width="18" height="18" rx="4" />
    <path d="M9 12a3 3 0 0 1 6 0" />
    <path d="M12 12v-3" />
    <line x1="6" y1="17" x2="18" y2="17" />
  </>
);

export const PercentIcon = icon(
  <>
    <line x1="19" y1="5" x2="5" y2="19" />
    <circle cx="6.5" cy="6.5" r="2.5" />
    <circle cx="17.5" cy="17.5" r="2.5" />
  </>
);

export const CompassIcon = icon(
  <>
    <circle cx="12" cy="12" r="10" />
    <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" fill="currentColor" stroke="none" />
  </>
);

export const DumbbellIcon = icon(
  <>
    <path d="M6.5 6.5h11" strokeWidth="3" />
    <path d="M3 9.5V4.5a1 1 0 011-1h1a1 1 0 011 1v14a1 1 0 01-1 1H4a1 1 0 01-1-1v-5" />
    <path d="M18 9.5V4.5a1 1 0 011-1h1a1 1 0 011 1v14a1 1 0 01-1 1h-1a1 1 0 01-1-1v-5" />
    <path d="M6.5 17.5h11" strokeWidth="3" />
  </>
);

export const AlertTriangleIcon = icon(
  <>
    <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
    <line x1="12" y1="9" x2="12" y2="13" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </>
);

export const ZapIcon = icon(
  <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
);

export const CheckIcon = icon(
  <polyline points="20 6 9 17 4 12" />
);

export const XCircleIcon = icon(
  <>
    <circle cx="12" cy="12" r="10" />
    <line x1="15" y1="9" x2="9" y2="15" />
    <line x1="9" y1="9" x2="15" y2="15" />
  </>
);

export const EditIcon = icon(
  <>
    <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
  </>
);

export const SaveIcon = icon(
  <>
    <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" />
    <polyline points="17 21 17 13 7 13 7 21" />
    <polyline points="7 3 7 8 15 8" />
  </>
);

export const SearchIcon = icon(
  <>
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </>
);

// ── Muscle Groups ───────────────────────────────────────────
export const ShoulderIcon = icon(
  <>
    <path d="M12 4a3 3 0 100 6 3 3 0 000-6z" />
    <path d="M4 20v-2a6 6 0 013-5.2" />
    <path d="M20 20v-2a6 6 0 00-3-5.2" />
  </>
);

export const ShieldIcon = icon(
  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
);

export const DnaIcon = icon(
  <>
    <path d="M2 15c6.667-6 13.333 0 20-6" />
    <path d="M9 22c1.8-4 6.2-4 8 0" />
    <path d="M15 2c-1.8 4-6.2 4-8 0" />
    <path d="M2 9c6.667 6 13.333 0 20 6" />
  </>
);

export const FlameIcon = icon(
  <path d="M8.5 14.5A2.5 2.5 0 0011 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 11-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 002.5 2.5z" />
);

export const LegIcon = icon(
  <>
    <path d="M16 4v6a4 4 0 01-2.5 3.7L12 14.5" />
    <path d="M12 14.5L10.5 20H8" />
    <path d="M12 14.5L13.5 20H16" />
    <circle cx="12" cy="3" r="1.5" />
  </>
);

export const FileTextIcon = icon(
  <>
    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
  </>
);

export const BodyIcon = icon(
  <>
    <circle cx="12" cy="4" r="2" />
    <path d="M12 6v6" />
    <path d="M8 8l4 2 4-2" />
    <path d="M10 18l2-6 2 6" />
  </>
);

export const TargetIcon = icon(
  <>
    <circle cx="12" cy="12" r="10" />
    <circle cx="12" cy="12" r="6" />
    <circle cx="12" cy="12" r="2" />
  </>
);
