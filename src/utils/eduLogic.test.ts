import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeFeeSummary,
  evaluateGrade,
  formatCode,
  formatCurrency,
  hasTimeOverlap,
  isAllowedImageUpload,
  renderTemplatePlaceholders,
  sanitizeSlug,
  validateTimetableSlot,
  type GradingRule,
  type TimetableSlot,
} from './eduLogic';

test('hasTimeOverlap detects overlapping and non-overlapping intervals accurately', () => {
  assert.equal(hasTimeOverlap('08:00', '09:30', '09:00', '10:30'), true);
  assert.equal(hasTimeOverlap('08:00', '09:00', '09:00', '10:00'), false); // adjacent edge allowed
  assert.equal(hasTimeOverlap('10:00', '11:30', '08:00', '09:30'), false);
});

test('validateTimetableSlot prevents invalid ranges, class overlap, and teacher overlap', () => {
  const existing: TimetableSlot[] = [
    { id: 1, class_id: 10, teacher_id: 5, subject_id: 2, day_of_week: 'Monday', start_time: '09:00', end_time: '10:30' },
  ];

  assert.equal(
    validateTimetableSlot({ class_id: 10, teacher_id: 6, subject_id: 3, day_of_week: 'Monday', start_time: '11:00', end_time: '10:00' }, existing).errorCode,
    'invalid_time_range'
  );
  assert.equal(
    validateTimetableSlot({ class_id: 10, teacher_id: 6, subject_id: 3, day_of_week: 'Monday', start_time: '10:00', end_time: '11:00' }, existing).errorCode,
    'class_conflict'
  );
  assert.equal(
    validateTimetableSlot({ class_id: 11, teacher_id: 5, subject_id: 3, day_of_week: 'Monday', start_time: '09:30', end_time: '11:00' }, existing).errorCode,
    'teacher_conflict'
  );
  assert.equal(
    validateTimetableSlot({ class_id: 11, teacher_id: 5, subject_id: 3, day_of_week: 'Tuesday', start_time: '09:30', end_time: '11:00' }, existing).valid,
    true
  );
  // Updating same slot ID should not conflict with itself
  assert.equal(
    validateTimetableSlot({ id: 1, class_id: 10, teacher_id: 5, subject_id: 2, day_of_week: 'Monday', start_time: '09:00', end_time: '10:30' }, existing).valid,
    true
  );
});

test('computeFeeSummary computes net balance and payment status accurately', () => {
  assert.deepEqual(computeFeeSummary(500, 50, 0), { netTotal: 450, remaining: 450, status: 'unpaid' });
  assert.deepEqual(computeFeeSummary(500, 50, 200), { netTotal: 450, remaining: 250, status: 'partial' });
  assert.deepEqual(computeFeeSummary(500, 50, 450), { netTotal: 450, remaining: 0, status: 'paid' });
  assert.deepEqual(computeFeeSummary(500, 50, 500), { netTotal: 450, remaining: 0, status: 'paid' });
});

test('evaluateGrade applies configurable grading rules without hardcoded thresholds', () => {
  const rules: GradingRule[] = [
    { grade_letter: 'A', min_percent: 90, max_percent: 100, gpa_points: 4.0, description: 'Excellent', is_passing: 1 },
    { grade_letter: 'B', min_percent: 75, max_percent: 89.99, gpa_points: 3.0, description: 'Good', is_passing: 1 },
    { grade_letter: 'C', min_percent: 60, max_percent: 74.99, gpa_points: 2.0, description: 'Pass', is_passing: 1 },
    { grade_letter: 'F', min_percent: 0, max_percent: 59.99, gpa_points: 0.0, description: 'Fail', is_passing: 0 },
  ];

  assert.deepEqual(evaluateGrade(95, 100, rules), { percent: 95, gradeLetter: 'A', gpaPoints: 4.0, isPassing: true });
  assert.deepEqual(evaluateGrade(30, 50, rules), { percent: 60, gradeLetter: 'C', gpaPoints: 2.0, isPassing: true });
  assert.deepEqual(evaluateGrade(25, 50, rules), { percent: 50, gradeLetter: 'F', gpaPoints: 0.0, isPassing: false });
});

test('renderTemplatePlaceholders, sanitizeSlug, formatCode, formatCurrency, and isAllowedImageUpload work reliably', () => {
  const rendered = renderTemplatePlaceholders('Awarded to {{student_name}} for {{course_title}} ({{certificate_number}})', {
    student_name: 'Ahmadullah Rahimi',
    course_title: 'Full-Stack Web Engineering',
    certificate_number: 'CERT-2026-0001',
  });
  assert.equal(rendered, 'Awarded to Ahmadullah Rahimi for Full-Stack Web Engineering (CERT-2026-0001)');
  assert.equal(sanitizeSlug('Academic Calendar 2026!'), 'academic-calendar-2026');
  assert.equal(formatCode('STU', 42), 'STU-0042');
  assert.equal(formatCurrency(1500), '1,500 AFN');
  assert.equal(formatCurrency(1250.5), '1,250.5 AFN');
  assert.equal(formatCurrency(0), '0 AFN');
  assert.equal(formatCurrency(300, '$'), '300 AFN');
  assert.equal(formatCurrency(300, 'USD'), '300 AFN');
  assert.equal(isAllowedImageUpload('logo.png', 'image/png'), true);
  assert.equal(isAllowedImageUpload('avatar.WEBP', 'image/webp'), true);
  assert.equal(isAllowedImageUpload('script.svg', 'image/svg+xml'), false);
  assert.equal(isAllowedImageUpload('malicious.exe', 'application/octet-stream'), false);
});

