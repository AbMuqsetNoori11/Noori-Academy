export interface TimetableSlot {
  id?: number;
  class_id: number;
  teacher_id: number;
  subject_id: number;
  day_of_week: string;
  start_time: string; // HH:MM
  end_time: string;   // HH:MM
}

export interface GradingRule {
  id?: number;
  grade_letter: string;
  min_percent: number;
  max_percent: number;
  gpa_points: number;
  description: string;
  is_passing: number | boolean;
}

export function timeToMinutes(hhmm: string): number {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(hhmm.trim());
  if (!match) return -1;
  return Number(match[1]) * 60 + Number(match[2]);
}

export function hasTimeOverlap(
  startA: string,
  endA: string,
  startB: string,
  endB: string
): boolean {
  const a1 = timeToMinutes(startA);
  const a2 = timeToMinutes(endA);
  const b1 = timeToMinutes(startB);
  const b2 = timeToMinutes(endB);
  if (a1 < 0 || a2 < 0 || b1 < 0 || b2 < 0) return false;
  return a1 < b2 && b1 < a2;
}

export function validateTimetableSlot(
  candidate: TimetableSlot,
  existingSlots: TimetableSlot[]
): { valid: boolean; errorCode?: 'invalid_time_range' | 'teacher_conflict' | 'class_conflict'; conflictSlotId?: number } {
  const startMin = timeToMinutes(candidate.start_time);
  const endMin = timeToMinutes(candidate.end_time);
  if (startMin < 0 || endMin < 0 || startMin >= endMin) {
    return { valid: false, errorCode: 'invalid_time_range' };
  }

  for (const slot of existingSlots) {
    if (candidate.id !== undefined && slot.id === candidate.id) continue;
    if (slot.day_of_week !== candidate.day_of_week) continue;

    if (hasTimeOverlap(candidate.start_time, candidate.end_time, slot.start_time, slot.end_time)) {
      if (slot.class_id === candidate.class_id) {
        return { valid: false, errorCode: 'class_conflict', conflictSlotId: slot.id };
      }
      if (slot.teacher_id === candidate.teacher_id) {
        return { valid: false, errorCode: 'teacher_conflict', conflictSlotId: slot.id };
      }
    }
  }
  return { valid: true };
}

export function computeFeeSummary(
  totalAmount: number,
  discountAmount: number,
  paidAmount: number
): { netTotal: number; remaining: number; status: 'paid' | 'partial' | 'unpaid' } {
  const netTotal = Math.max(0, Math.round((totalAmount - discountAmount) * 100) / 100);
  const safePaid = Math.max(0, Math.round(paidAmount * 100) / 100);
  const remaining = Math.max(0, Math.round((netTotal - safePaid) * 100) / 100);

  let status: 'paid' | 'partial' | 'unpaid' = 'unpaid';
  if (remaining === 0 && netTotal >= 0) {
    status = 'paid';
  } else if (safePaid > 0) {
    status = 'partial';
  }
  return { netTotal, remaining, status };
}

export function evaluateGrade(
  score: number,
  maxScore: number,
  rules: GradingRule[]
): { percent: number; gradeLetter: string; gpaPoints: number; isPassing: boolean } {
  if (maxScore <= 0) {
    return { percent: 0, gradeLetter: 'N/A', gpaPoints: 0, isPassing: false };
  }
  const percent = Math.max(0, Math.min(100, Math.round((score / maxScore) * 10000) / 100));
  const sorted = [...rules].sort((a, b) => b.min_percent - a.min_percent);
  for (const rule of sorted) {
    if (percent >= rule.min_percent && percent <= rule.max_percent) {
      return {
        percent,
        gradeLetter: rule.grade_letter,
        gpaPoints: rule.gpa_points,
        isPassing: Boolean(rule.is_passing),
      };
    }
  }
  const fallback = sorted[sorted.length - 1];
  return {
    percent,
    gradeLetter: fallback ? fallback.grade_letter : 'F',
    gpaPoints: fallback ? fallback.gpa_points : 0,
    isPassing: false,
  };
}

export function renderTemplatePlaceholders(
  template: string,
  values: Record<string, string | number | null | undefined>
): string {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key: string) => {
    const val = values[key];
    return val === undefined || val === null ? '' : String(val);
  });
}

export function sanitizeSlug(raw: string): string {
  return raw
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

export function formatCode(prefix: string, num: number, pad = 4): string {
  return `${prefix}-${String(num).padStart(pad, '0')}`;
}

export function formatCurrency(
  amount: number | string | null | undefined,
  currency: string = 'AFN'
): string {
  const num = Number(amount ?? 0);
  const safeNum = Number.isFinite(num) ? Math.round(num * 100) / 100 : 0;
  const formatted = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(safeNum);
  const code = (currency && currency !== '$' && currency.toUpperCase() !== 'USD') ? currency : 'AFN';
  return `${formatted} ${code}`;
}

export const ALLOWED_IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.gif'] as const;

export function isAllowedImageUpload(filename: string, mimeType?: string): boolean {
  const lower = filename.trim().toLowerCase();
  const hasValidExt = ALLOWED_IMAGE_EXTENSIONS.some((ext) => lower.endsWith(ext));
  if (!hasValidExt) return false;
  if (mimeType !== undefined && !mimeType.toLowerCase().startsWith('image/')) return false;
  return true;
}

