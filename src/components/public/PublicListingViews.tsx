import React, { useEffect, useMemo, useState } from 'react';
import { BookOpen, Play, Search, UserCheck } from 'lucide-react';
import { useI18n } from '../../i18n';
import { resolveMediaUrl } from '../../utils/mediaAssets';
import { formatCurrency } from '../../utils/eduLogic';

// ─── INDEPENDENT PUBLIC COURSES DIRECTORY ────────────────────────────────────
export const CoursesListingView: React.FC = () => {
  const { t, tStatus } = useI18n();
  const [courses, setCourses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'upcoming'>('all');

  const load = () => {
    setLoading(true);
    setError('');
    fetch('/api/public/courses')
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((d) => setCourses(d.courses || []))
      .catch(() => setError(t('loadFailed')))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return courses.filter((c) => {
      if (statusFilter !== 'all' && c.status !== statusFilter) return false;
      if (!q) return true;
      return `${c.title || ''} ${c.course_code || ''} ${c.description || ''} ${c.subject_names || ''}`
        .toLowerCase()
        .includes(q);
    });
  }, [courses, search, statusFilter]);

  return (
    <main className="flex-1 bg-slate-50">
      <section className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
          <h1 className="font-display text-3xl sm:text-4xl font-bold text-slate-950 tracking-tight">
            {t('allCoursesTitle')}
          </h1>
          <p className="mt-2.5 text-slate-600 max-w-2xl text-sm sm:text-base leading-relaxed">
            {t('allCoursesSub')}
          </p>

          <div className="mt-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute top-1/2 -translate-y-1/2 start-3.5" aria-hidden="true" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('searchCoursesPlaceholder')}
                className="w-full ps-10 pe-4 py-2.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700/20 focus:border-blue-700"
              />
            </div>

            <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-lg self-start sm:self-auto">
              {(['all', 'active', 'upcoming'] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStatusFilter(st)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                    statusFilter === st ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {st === 'all' ? t('all') : tStatus(st)}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
        {loading ? (
          <div className="py-12 text-center text-sm text-slate-600">{t('loading')}</div>
        ) : error ? (
          <div className="rounded-xl border border-red-200 bg-white p-8 text-center space-y-3">
            <div className="text-sm text-red-700">{error}</div>
            <button
              type="button"
              onClick={load}
              className="px-4 py-2 text-xs font-semibold text-white bg-blue-700 rounded-lg hover:bg-blue-800"
            >
              {t('retry')}
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
            {t('noRecords')}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((c) => (
              <article key={c.id} className="rounded-xl border border-slate-200 bg-white overflow-hidden flex flex-col">
                <div className="aspect-[16/10] bg-slate-100 overflow-hidden">
                  {c.image_url ? (
                    <img
                      src={resolveMediaUrl(c.image_url)}
                      alt={c.title}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-400">
                      <BookOpen className="w-8 h-8" />
                    </div>
                  )}
                </div>
                <div className="p-5 flex-1 flex flex-col">
                  <div className="text-xs font-mono text-slate-500 mb-1.5 flex flex-wrap items-center gap-1.5 tabular-nums">
                    <span>{c.course_code}</span>
                    <span aria-hidden="true">·</span>
                    <span>{c.duration_weeks} {t('durationWeeks')}</span>
                    <span aria-hidden="true">·</span>
                    <span>{t('capacity')}: {c.capacity}</span>
                    <span aria-hidden="true">·</span>
                    <span className={c.status === 'active' ? 'text-emerald-700 font-semibold' : 'text-amber-700 font-semibold'}>
                      {tStatus(c.status)}
                    </span>
                    {Boolean(c.featured) && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="text-blue-700 font-semibold">{t('featuredBadge')}</span>
                      </>
                    )}
                  </div>
                  <h2 className="font-display text-lg font-bold text-slate-950">{c.title}</h2>
                  <p className="mt-2 text-sm text-slate-600 leading-relaxed flex-1">{c.description}</p>
                  {c.subject_names && (
                    <p className="mt-3 pt-3 border-t border-slate-100 text-xs text-slate-500">
                      <span className="font-semibold text-slate-700">{t('subjectsLabel')}:</span> {c.subject_names}
                    </p>
                  )}
                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-sm font-semibold text-slate-900 tabular-nums">
                    <span>{t('tuitionFee')}</span>
                    <span className="text-blue-700" dir="ltr">{formatCurrency(c.fee_amount)}</span>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
};

// ─── INDEPENDENT PUBLIC TEACHERS DIRECTORY ───────────────────────────────────
export const TeachersListingView: React.FC = () => {
  const { t } = useI18n();
  const [teachers, setTeachers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const load = () => {
    setLoading(true);
    setError('');
    fetch('/api/public/teachers')
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((d) => setTeachers(d.teachers || []))
      .catch(() => setError(t('loadFailed')))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return teachers;
    return teachers.filter((tch) =>
      `${tch.first_name || ''} ${tch.last_name || ''} ${tch.specialization || ''} ${tch.qualification || ''} ${tch.subjects_taught || ''}`
        .toLowerCase()
        .includes(q)
    );
  }, [teachers, search]);

  return (
    <main className="flex-1 bg-slate-50">
      <section className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
          <h1 className="font-display text-3xl sm:text-4xl font-bold text-slate-950 tracking-tight">
            {t('allTeachersTitle')}
          </h1>
          <p className="mt-2.5 text-slate-600 max-w-2xl text-sm sm:text-base leading-relaxed">
            {t('allTeachersSub')}
          </p>

          <div className="mt-8 max-w-md relative">
            <Search className="w-4 h-4 text-slate-400 absolute top-1/2 -translate-y-1/2 start-3.5" aria-hidden="true" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('searchTeachersPlaceholder')}
              className="w-full ps-10 pe-4 py-2.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700/20 focus:border-blue-700"
            />
          </div>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
        {loading ? (
          <div className="py-12 text-center text-sm text-slate-600">{t('loading')}</div>
        ) : error ? (
          <div className="rounded-xl border border-red-200 bg-white p-8 text-center space-y-3">
            <div className="text-sm text-red-700">{error}</div>
            <button
              type="button"
              onClick={load}
              className="px-4 py-2 text-xs font-semibold text-white bg-blue-700 rounded-lg hover:bg-blue-800"
            >
              {t('retry')}
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
            {t('noRecords')}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {filtered.map((tch) => (
              <article
                key={tch.id}
                className="rounded-xl border border-slate-200 bg-white p-6 flex flex-col sm:flex-row gap-5 items-start"
              >
                <div className="w-24 h-24 rounded-xl overflow-hidden bg-slate-100 shrink-0 border border-slate-200 flex items-center justify-center">
                  {tch.photo_url ? (
                    <img
                      src={resolveMediaUrl(tch.photo_url)}
                      alt={`${tch.first_name} ${tch.last_name}`}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center font-display font-bold text-slate-500 text-xl">
                      {tch.first_name?.[0] || <UserCheck className="w-6 h-6" />}
                      {tch.last_name?.[0] || ''}
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-slate-500 font-medium flex flex-wrap items-center gap-1.5">
                    <span>{tch.specialization}</span>
                    {tch.qualification && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span>{tch.qualification}</span>
                      </>
                    )}
                    {Boolean(tch.featured_on_home) && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="text-blue-700 font-semibold">{t('featuredBadge')}</span>
                      </>
                    )}
                  </div>
                  <h2 className="font-display text-lg font-bold text-slate-950 mt-0.5">
                    {tch.first_name} {tch.last_name}
                  </h2>
                  {tch.bio && <p className="mt-2 text-sm text-slate-600 leading-relaxed">{tch.bio}</p>}
                  {tch.subjects_taught && (
                    <p className="mt-2.5 text-xs text-blue-700 font-medium">
                      {t('subjectsLabel')}: {tch.subjects_taught}
                    </p>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
};

// ─── INDEPENDENT PUBLIC GALLERY PAGE ─────────────────────────────────────────
export const GalleryListingView: React.FC<{ onOpenLightbox: (item: any) => void }> = ({ onOpenLightbox }) => {
  const { t } = useI18n();
  const [categories, setCategories] = useState<any[]>([]);
  const [media, setMedia] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedCat, setSelectedCat] = useState<string>('all');

  const load = () => {
    setLoading(true);
    setError('');
    fetch('/api/public/gallery')
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((d) => {
        setCategories(d.galleryCategories || []);
        setMedia(d.galleryMedia || []);
      })
      .catch(() => setError(t('loadFailed')))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = selectedCat === 'all' ? media : media.filter((m) => m.category_slug === selectedCat);

  return (
    <main className="flex-1 bg-slate-50">
      <section className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12 flex flex-col lg:flex-row lg:items-end justify-between gap-6">
          <div>
            <h1 className="font-display text-3xl sm:text-4xl font-bold text-slate-950 tracking-tight">
              {t('allGalleryTitle')}
            </h1>
            <p className="mt-2.5 text-slate-600 max-w-2xl text-sm sm:text-base leading-relaxed">
              {t('allGallerySub')}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg self-start lg:self-auto">
            <button
              type="button"
              onClick={() => setSelectedCat('all')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                selectedCat === 'all' ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {t('all')}
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCat(cat.slug)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  selectedCat === cat.slug ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
        {loading ? (
          <div className="py-12 text-center text-sm text-slate-600">{t('loading')}</div>
        ) : error ? (
          <div className="rounded-xl border border-red-200 bg-white p-8 text-center space-y-3">
            <div className="text-sm text-red-700">{error}</div>
            <button
              type="button"
              onClick={load}
              className="px-4 py-2 text-xs font-semibold text-white bg-blue-700 rounded-lg hover:bg-blue-800"
            >
              {t('retry')}
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
            {t('noGalleryItems')}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => onOpenLightbox(item)}
                className="text-start group rounded-xl border border-slate-200 bg-white overflow-hidden hover:border-blue-700/40 transition-colors flex flex-col"
              >
                <div className="relative aspect-[4/3] bg-slate-100 overflow-hidden w-full">
                  {item.media_type === 'video' ? (
                    <div className="w-full h-full flex flex-col items-center justify-center bg-slate-900 text-white gap-2">
                      <Play className="w-10 h-10" />
                      <span className="text-xs text-slate-300">{t('videoMediaLabel')}</span>
                    </div>
                  ) : (
                    <img
                      src={resolveMediaUrl(item.file_url)}
                      alt={item.title}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300"
                    />
                  )}
                </div>
                <div className="p-4 flex-1">
                  <div className="text-xs text-slate-500">
                    {item.category_name}
                    {item.media_type === 'video' ? ` · ${t('videoMediaLabel')}` : ''}
                  </div>
                  <h2 className="font-display text-base font-bold text-slate-900 mt-0.5">{item.title}</h2>
                  {item.description && (
                    <p className="mt-1 text-xs text-slate-600 line-clamp-2">{item.description}</p>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </section>
    </main>
  );
};
