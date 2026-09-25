/**
 * Chart palette. Single-series charts use INK; the previous-period comparison uses COMPARE.
 * Multi-series identity uses SERIES in this fixed order (validated for CVD separation on light
 * surfaces with the dataviz validator). Status colors are reserved for state, never for series.
 */
export const CHART = {
  ink: '#1C2127',
  compare: '#B4B8BF',
  grid: '#EEF0F2',
  axis: '#8B9099',
  series: ['#3553A8', '#6E9A12', '#8A4FB8', '#C26A1B'] as const,
  status: { good: '#16A34A', warning: '#D97706', critical: '#DC2626' },
  font: 11,
} as const;

export const axisProps = {
  tick: { fontSize: CHART.font, fill: CHART.axis },
  tickLine: false,
  axisLine: false,
} as const;
