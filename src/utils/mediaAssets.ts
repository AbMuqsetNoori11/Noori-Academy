import heroCampus from '../assets/images/hero_academy_campus_1794554062936.jpg';
import heroLab from '../assets/images/hero_science_lab_1794554063311.jpg';
import teacherOne from '../assets/images/teacher_portrait_one_1794554063169.jpg';
import teacherTwo from '../assets/images/teacher_portrait_two_1794554063868.jpg';
import galleryGrad from '../assets/images/gallery_graduation_1794554064196.jpg';

const MEDIA_MAP: Record<string, string> = {
  '/src/assets/images/hero_academy_campus_1794554062936.jpg': heroCampus,
  '/src/assets/images/hero_science_lab_1794554063311.jpg': heroLab,
  '/src/assets/images/teacher_portrait_one_1794554063169.jpg': teacherOne,
  '/src/assets/images/teacher_portrait_two_1794554063868.jpg': teacherTwo,
  '/src/assets/images/gallery_graduation_1794554064196.jpg': galleryGrad,
};

export function resolveMediaUrl(url?: string | null): string {
  if (!url) return '';
  return MEDIA_MAP[url] || url;
}

import type { TranslationKey } from '../i18n/en';

export const ASSET_PRESETS: Array<{ labelKey: TranslationKey; url: string }> = [
  { labelKey: 'presetAcademyCampus', url: '/src/assets/images/hero_academy_campus_1794554062936.jpg' },
  { labelKey: 'presetSeminarLab', url: '/src/assets/images/hero_science_lab_1794554063311.jpg' },
  { labelKey: 'presetGraduationHall', url: '/src/assets/images/gallery_graduation_1794554064196.jpg' },
  { labelKey: 'presetFacultyPortrait1', url: '/src/assets/images/teacher_portrait_one_1794554063169.jpg' },
  { labelKey: 'presetFacultyPortrait2', url: '/src/assets/images/teacher_portrait_two_1794554063868.jpg' },
];
