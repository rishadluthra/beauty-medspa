/**
 * Estimates the pixel width a numeric/category axis needs to show its
 * longest tick label without clipping, from the actual labels the data
 * will produce -- not a fixed guess.
 *
 * A fixed guess is exactly what caused real Y-axis labels to get clipped
 * in production across nearly every chart on the Analytics page: a
 * hand-picked width of 72px for Revenue's currency axis still clipped the
 * "$" off "$600,000" once real data pushed past the guessed range; 40px
 * for the Demographics gender/age counts still clipped the leading digit
 * off "2,800"; and a shared 140px category-label width still clipped the
 * leading "R" off "RF Skin Tightening" in the Top Services chart. Every
 * one of those was a plausible-looking number that simply wasn't checked
 * against the actual longest real value. Computing it from the real
 * labels instead makes this correct by construction and automatically
 * right-sized if the underlying data changes.
 */
export function estimateAxisWidth(labels: string[], charWidthPx = 7.5, paddingPx = 24): number {
  const longest = labels.reduce((max, label) => Math.max(max, label.length), 0);
  return Math.round(longest * charWidthPx + paddingPx);
}
