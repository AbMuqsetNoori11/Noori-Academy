import React, { useEffect, useState } from 'react';
import {
  BellRing,
  Bold,
  DatabaseBackup,
  Download,
  Globe,
  History,
  Image as ImageIcon,
  Italic,
  List,
  Pencil,
  Plus,
  RotateCcw,
  Save,
  Settings,
  ShieldAlert,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useI18n, type LangCode } from '../../i18n';
import { apiRequest, downloadAuthenticatedFile } from '../../utils/api';
import { ASSET_PRESETS, resolveMediaUrl } from '../../utils/mediaAssets';
import { useFeedback } from '../ui/ToastAndConfirm';
import { BrandLogo } from '../ui/BrandLogo';
import { DataTable } from '../ui/DataTable';
import { FileUploader } from '../ui/FileUploader';

// ─── WEBSITE CMS MANAGEMENT MODULE ───────────────────────────────────────────
export const WebsiteCmsModule: React.FC = () => {
  const { branding, refreshUser, setBranding } = useAuth();
  const { t, tStatus, translateServerError } = useI18n();
  const { toast, confirm } = useFeedback();

  const [tab, setTab] = useState<'logo' | 'sliders' | 'homeFeatured' | 'sections' | 'pages' | 'menus' | 'gallery' | 'top' | 'contact'>('logo');
  const [cms, setCms] = useState<any>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [students, setStudents] = useState<any[]>([]);

  // Form states
  const [sliderForm, setSliderForm] = useState({ title: '', subtitle: '', button_label: '', button_url: '#courses', image_url: ASSET_PRESETS[0].url, sort_order: 1 });
  const [aboutEdit, setAboutEdit] = useState({ title: '', subtitle: '', content_html: '', history: '', mission: '', vision: '', objectives: '', valuesJson: '[]' });
  const [whyEdit, setWhyEdit] = useState({ title: '', subtitle: '', cardsJson: '[]' });
  const [pageForm, setPageForm] = useState({ id: 0, title: '', slug: '', content_html: '', is_published: true });
  const [menuForm, setMenuForm] = useState({ label: '', url: '', target_page_slug: '', sort_order: 10 });
  const [galleryForm, setGalleryForm] = useState({ category_id: '', title: '', description: '', media_type: 'image', file_url: ASSET_PRESETS[2].url });
  const [topForm, setTopForm] = useState({ student_id: '', achievement_title: '', achievement_detail: '', display_photo_url: '' });
  const [settingsForm, setSettingsForm] = useState<Record<string, string>>({});

  // Edit modals state
  const [editSlider, setEditSlider] = useState<any | null>(null);
  const [editMenu, setEditMenu] = useState<any | null>(null);
  const [editGallery, setEditGallery] = useState<any | null>(null);
  const [editTopStudent, setEditTopStudent] = useState<any | null>(null);

  const load = async () => {
    setLoadError(null);
    try {
      const [res, sRes] = await Promise.all([
        apiRequest<any>('/api/admin/cms/all'),
        apiRequest<{ students: any[] }>('/api/academics/students'),
      ]);
      setCms(res);
      setStudents(sRes.students || []);
      setSettingsForm(res.settings || {});

      const about = (res.sections || []).find((s: any) => s.section_key === 'about');
      if (about) {
        let meta: any = {};
        try { meta = about.meta_json ? JSON.parse(about.meta_json) : {}; } catch { meta = {}; }
        setAboutEdit({
          title: about.title || '',
          subtitle: about.subtitle || '',
          content_html: about.content_html || '',
          history: meta.history || '',
          mission: meta.mission || '',
          vision: meta.vision || '',
          objectives: meta.objectives || '',
          valuesJson: JSON.stringify(Array.isArray(meta.values) ? meta.values : [], null, 2),
        });
      }

      const why = (res.sections || []).find((s: any) => s.section_key === 'why_choose_us');
      if (why) {
        let cards = [];
        try { cards = why.meta_json ? JSON.parse(why.meta_json).cards || [] : []; } catch { cards = []; }
        setWhyEdit({ title: why.title || '', subtitle: why.subtitle || '', cardsJson: JSON.stringify(cards, null, 2) });
      }

      if (res.galleryCategories?.length && !galleryForm.category_id) {
        setGalleryForm((prev) => ({ ...prev, category_id: String(res.galleryCategories[0].id) }));
      }
    } catch (err: any) {
      setLoadError(translateServerError(err.message));
    }
  };

  useEffect(() => {
    void load();
  }, []);

  if (loadError) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 flex items-center justify-between gap-4">
        <span className="text-sm text-red-700">{loadError}</span>
        <button type="button" onClick={() => void load()} className="px-4 py-2 text-xs font-semibold text-white bg-red-700 rounded-lg">
          {t('retry')}
        </button>
      </div>
    );
  }

  if (!cms) return <div className="p-8 text-sm text-slate-500">{t('loading')}</div>;

  const createSlider = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest('/api/admin/cms/sliders', { method: 'POST', body: JSON.stringify({ ...sliderForm, button_label: sliderForm.button_label || t('heroCta') }) });
      toast(t('slideAddedMsg'));
      setSliderForm({ title: '', subtitle: '', button_label: '', button_url: '#courses', image_url: ASSET_PRESETS[0].url, sort_order: 1 });
      void load();
    } catch (err: any) {
      toast(translateServerError(err.message), 'error');
    }
  };

  const toggleSlider = async (sl: any) => {
    try {
      await apiRequest(`/api/admin/cms/sliders/${sl.id}`, {
        method: 'PUT',
        body: JSON.stringify({ ...sl, is_active: !sl.is_active }),
      });
      void load();
    } catch (err: any) {
      toast(translateServerError(err.message), 'error');
    }
  };

  const deleteSlider = async (id: number) => {
    if (!(await confirm({ title: t('confirmTitle'), message: t('confirmDelete'), danger: true }))) return;
    try {
      await apiRequest(`/api/admin/cms/sliders/${id}`, { method: 'DELETE' });
      toast(t('slideRemovedMsg'));
      void load();
    } catch (err: any) {
      toast(translateServerError(err.message), 'error');
    }
  };

  const saveAboutSection = async (e: React.FormEvent) => {
    e.preventDefault();
    let parsedValues: any[] = [];
    try {
      parsedValues = JSON.parse(aboutEdit.valuesJson || '[]');
      if (!Array.isArray(parsedValues)) throw new Error('Not an array');
    } catch {
      toast(t('aboutValuesJsonInvalidError'), 'error');
      return;
    }
    try {
      await apiRequest('/api/admin/cms/sections/about', {
        method: 'PUT',
        body: JSON.stringify({
          title: aboutEdit.title,
          subtitle: aboutEdit.subtitle,
          content_html: aboutEdit.content_html,
          meta_json: {
            history: aboutEdit.history,
            mission: aboutEdit.mission,
            vision: aboutEdit.vision,
            objectives: aboutEdit.objectives,
            values: parsedValues,
          },
        }),
      });
      toast(t('aboutSectionUpdatedMsg'));
      void load();
    } catch (err: any) {
      toast(translateServerError(err.message), 'error');
    }
  };

  const toggleFeaturedCourse = async (c: any) => {
    try {
      await apiRequest(`/api/admin/cms/featured-courses/${c.id}`, {
        method: 'PUT',
        body: JSON.stringify({ featured: !c.featured }),
      });
      toast(t('successSaved'));
      void load();
    } catch (err: any) {
      toast(translateServerError(err.message), 'error');
    }
  };

  const updateTeacherVisibility = async (tch: any, patch: { featured_on_home?: boolean; show_on_website?: boolean }) => {
    try {
      await apiRequest(`/api/admin/cms/featured-teachers/${tch.id}`, {
        method: 'PUT',
        body: JSON.stringify(patch),
      });
      toast(t('successSaved'));
      void load();
    } catch (err: any) {
      toast(translateServerError(err.message), 'error');
    }
  };

  const toggleTopStudentPublished = async (row: any) => {
    try {
      await apiRequest(`/api/admin/cms/featured-students/${row.id}/toggle`, {
        method: 'PUT',
        body: JSON.stringify({ is_published: !row.is_published }),
      });
      toast(t('successSaved'));
      void load();
    } catch (err: any) {
      toast(translateServerError(err.message), 'error');
    }
  };

  const saveWhySection = async (e: React.FormEvent) => {
    e.preventDefault();
    let parsed: any[] = [];
    try {
      parsed = JSON.parse(whyEdit.cardsJson);
    } catch {
      toast(t('cardsJsonInvalidError'), 'error');
      return;
    }
    try {
      await apiRequest('/api/admin/cms/sections/why_choose_us', {
        method: 'PUT',
        body: JSON.stringify({
          title: whyEdit.title,
          subtitle: whyEdit.subtitle,
          content_html: '',
          meta_json: { cards: parsed },
        }),
      });
      toast(t('whySectionUpdatedMsg'));
      void load();
    } catch (err: any) {
      toast(translateServerError(err.message), 'error');
    }
  };

  const appendHtmlSnippet = (snippet: string) => {
    setPageForm((prev) => ({ ...prev, content_html: `${prev.content_html}${prev.content_html ? '\n' : ''}${snippet}` }));
  };

  const savePage = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (pageForm.id) {
        await apiRequest(`/api/admin/cms/pages/${pageForm.id}`, { method: 'PUT', body: JSON.stringify(pageForm) });
        toast(t('pageUpdatedMsg'));
      } else {
        await apiRequest('/api/admin/cms/pages', { method: 'POST', body: JSON.stringify(pageForm) });
        toast(t('pageCreatedMsg'));
      }
      setPageForm({ id: 0, title: '', slug: '', content_html: '', is_published: true });
      void load();
    } catch (err: any) {
      toast(translateServerError(err.message), 'error');
    }
  };

  const deletePage = async (p: any) => {
    if (p.is_system) {
      toast(t('systemPageCannotDelete'), 'warning');
      return;
    }
    if (!(await confirm({ title: t('confirmTitle'), message: t('confirmDelete'), danger: true }))) return;
    try {
      await apiRequest(`/api/admin/cms/pages/${p.id}`, { method: 'DELETE' });
      void load();
    } catch (err: any) {
      toast(translateServerError(err.message), 'error');
    }
  };

  const saveLogo = async (m: { url: string }) => {
    try {
      await apiRequest('/api/admin/cms/logo', {
        method: 'PUT',
        body: JSON.stringify({ site_logo_url: m.url }),
      });
      setSettingsForm((prev) => ({ ...prev, site_logo_url: m.url }));
      setBranding((prev) => ({ ...prev, site_logo_url: m.url }));
      await refreshUser();
      toast(t('logoUpdatedMsg'));
      void load();
    } catch (err: any) {
      toast(translateServerError(err.message), 'error');
    }
  };

  const removeLogo = async () => {
    try {
      await apiRequest('/api/admin/cms/logo', { method: 'DELETE' });
      setSettingsForm((prev) => ({ ...prev, site_logo_url: '' }));
      setBranding((prev) => ({ ...prev, site_logo_url: '' }));
      await refreshUser();
      toast(t('logoRemovedMsg'));
      void load();
    } catch (err: any) {
      toast(translateServerError(err.message), 'error');
    }
  };

  const saveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest('/api/admin/cms/settings', { method: 'PUT', body: JSON.stringify(settingsForm) });
      setBranding((prev) => ({
        ...prev,
        site_name: settingsForm.site_name || prev.site_name,
        site_logo_url: settingsForm.site_logo_url ?? prev.site_logo_url,
      }));
      await refreshUser();
      toast(t('websiteSettingsSavedMsg'));
      void load();
    } catch (err: any) {
      toast(translateServerError(err.message), 'error');
    }
  };

  const currentLogoUrl = settingsForm.site_logo_url ?? branding.site_logo_url ?? '';

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-3">
        {[
          ['logo', t('systemLogoTitle')],
          ['sliders', t('cmsTabSliders')],
          ['homeFeatured', t('cmsTabHomepageSelection')],
          ['sections', t('cmsTabSections')],
          ['pages', t('cmsTabPages')],
          ['menus', t('cmsTabMenus')],
          ['gallery', t('cmsTabGallery')],
          ['top', t('cmsTabTopStudents')],
          ['contact', t('cmsTabContact')],
        ].map(([k, label]) => (
          <button
            key={k}
            type="button"
            onClick={() => setTab(k as any)}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold ${
              tab === k ? 'bg-blue-700 text-white' : 'bg-white border border-slate-200 text-slate-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'logo' && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-5">
          <div>
            <h3 className="font-display font-bold text-slate-950 text-base flex items-center gap-2">
              <ImageIcon className="w-4 h-4 text-blue-700" />
              <span>{t('systemLogoTitle')}</span>
            </h3>
            <p className="text-xs text-slate-600 mt-1">{t('systemLogoSubtitle')}</p>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-5 p-4 rounded-xl border border-slate-200 bg-slate-50/70">
            <div className="flex flex-col items-center gap-2 shrink-0">
              <BrandLogo logoUrl={currentLogoUrl} alt={settingsForm.site_name || branding.site_name} sizeClass="w-20 h-20" iconClass="w-10 h-10" />
            </div>
            <div className="flex-1 space-y-3 text-xs">
              <div className="font-semibold text-slate-800">
                {currentLogoUrl ? t('currentLogoPreview') : t('noLogoFallbackNote')}
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <div className="min-w-[220px] flex-1 max-w-sm">
                  <FileUploader
                    imageOnly
                    accept="image/*"
                    label={currentLogoUrl ? t('replaceLogoBtn') : t('uploadLogoBtn')}
                    onUploaded={(m) => void saveLogo(m)}
                  />
                </div>
                {currentLogoUrl && (
                  <button
                    type="button"
                    onClick={() => void removeLogo()}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-red-700 border border-red-200 bg-red-50 rounded-lg hover:bg-red-100"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>{t('removeLogoBtn')}</span>
                  </button>
                )}
              </div>
              <p className="text-[11px] text-slate-500">{t('logoAllowedHint')}</p>
            </div>
          </div>
        </div>
      )}

      {tab === 'homeFeatured' && (
        <div className="space-y-6">
          <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
            <div>
              <h3 className="font-display font-bold text-slate-950 text-sm">{t('cmsFeaturedCoursesTitle')}</h3>
              <p className="text-xs text-slate-600 mt-1">{t('cmsFeaturedCoursesDesc')}</p>
            </div>
            <DataTable
              rows={(cms.courses || []).filter((c: any) => ['active', 'upcoming'].includes(c.status))}
              pageSize={10}
              columns={[
                { key: 'code', header: t('codeLabel'), render: (r) => <span className="font-mono text-xs font-semibold">{r.course_code}</span> },
                { key: 'title', header: t('courseCol'), render: (r) => <span className="font-semibold text-xs">{r.title}</span> },
                { key: 'status', header: t('status'), render: (r) => <span className="text-xs">{tStatus(r.status)}</span> },
                {
                  key: 'feat',
                  header: t('showOnHomepageLabel'),
                  render: (r) => (
                    <button
                      type="button"
                      onClick={() => void toggleFeaturedCourse(r)}
                      className={`px-3 py-1 text-xs font-semibold rounded-lg border ${
                        r.featured
                          ? 'bg-blue-700 text-white border-blue-700'
                          : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      {r.featured ? t('publishedLabel') : t('hiddenFromHomeLabel')}
                    </button>
                  ),
                },
              ]}
            />
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
            <div>
              <h3 className="font-display font-bold text-slate-950 text-sm">{t('cmsFeaturedTeachersTitle')}</h3>
              <p className="text-xs text-slate-600 mt-1">{t('cmsFeaturedTeachersDesc')}</p>
            </div>
            <DataTable
              rows={(cms.teachers || []).filter((tch: any) => tch.status === 'active')}
              pageSize={10}
              columns={[
                { key: 'code', header: t('codeLabel'), render: (r) => <span className="font-mono text-xs font-semibold">{r.teacher_code}</span> },
                { key: 'name', header: t('instructorCol'), render: (r) => <span className="font-semibold text-xs">{r.first_name} {r.last_name}</span> },
                { key: 'spec', header: t('specialization'), render: (r) => <span className="text-xs text-slate-600">{r.specialization}</span> },
                {
                  key: 'pub',
                  header: t('showOnTeachersPageLabel'),
                  render: (r) => (
                    <label className="inline-flex items-center gap-2 text-xs cursor-pointer">
                      <input
                        type="checkbox"
                        checked={Boolean(r.show_on_website)}
                        onChange={(e) => void updateTeacherVisibility(r, { show_on_website: e.target.checked })}
                      />
                      <span>{r.show_on_website ? t('active') : t('statusHidden')}</span>
                    </label>
                  ),
                },
                {
                  key: 'home',
                  header: t('showOnHomepageLabel'),
                  render: (r) => (
                    <button
                      type="button"
                      onClick={() => void updateTeacherVisibility(r, { featured_on_home: !r.featured_on_home })}
                      className={`px-3 py-1 text-xs font-semibold rounded-lg border ${
                        r.featured_on_home
                          ? 'bg-blue-700 text-white border-blue-700'
                          : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      {r.featured_on_home ? t('publishedLabel') : t('hiddenFromHomeLabel')}
                    </button>
                  ),
                },
              ]}
            />
          </div>
        </div>
      )}

      {tab === 'sliders' && (
        <div className="space-y-5">
          <form onSubmit={createSlider} className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
            <h3 className="font-display font-bold text-slate-950 text-sm">{t('addHeroSlider')}</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <input required placeholder={t('headlinePlaceholder')} value={sliderForm.title} onChange={(e) => setSliderForm({ ...sliderForm, title: e.target.value })} className="px-3 py-2 border border-slate-300 rounded-lg" />
              <input placeholder={t('subtitlePlaceholder')} value={sliderForm.subtitle} onChange={(e) => setSliderForm({ ...sliderForm, subtitle: e.target.value })} className="px-3 py-2 border border-slate-300 rounded-lg" />
              <input placeholder={t('buttonLabelPlaceholder')} value={sliderForm.button_label} onChange={(e) => setSliderForm({ ...sliderForm, button_label: e.target.value })} className="px-3 py-2 border border-slate-300 rounded-lg" />
              <input placeholder={t('buttonUrlPlaceholder')} value={sliderForm.button_url} onChange={(e) => setSliderForm({ ...sliderForm, button_url: e.target.value })} className="px-3 py-2 border border-slate-300 rounded-lg" dir="ltr" />
              <select value={sliderForm.image_url} onChange={(e) => setSliderForm({ ...sliderForm, image_url: e.target.value })} className="px-3 py-2 border border-slate-300 rounded-lg bg-white">
                {ASSET_PRESETS.map((a) => <option key={a.url} value={a.url}>{t(a.labelKey)}</option>)}
              </select>
              <FileUploader imageOnly accept="image/*" label={t('uploadCustomSlideImage')} onUploaded={(m) => setSliderForm({ ...sliderForm, image_url: m.url })} />
            </div>
            <button type="submit" className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-700 rounded-lg">
              <Plus className="w-3.5 h-3.5" />
              <span>{t('addSlideBtn')}</span>
            </button>
          </form>

          <DataTable
            rows={cms.sliders || []}
            columns={[
              { key: 'img', header: t('previewCol'), render: (r) => <img src={resolveMediaUrl(r.image_url)} alt={r.title} className="w-20 h-11 object-cover rounded" /> },
              { key: 'title', header: t('headlineCol'), render: (r) => <span className="font-semibold">{r.title}</span> },
              { key: 'sub', header: t('subtitleCol'), render: (r) => <span className="text-xs text-slate-600">{r.subtitle}</span> },
              {
                key: 'act',
                header: t('actions'),
                render: (r) => (
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => setEditSlider({ ...r, is_active: Boolean(r.is_active) })} className="p-1 text-blue-700 hover:bg-blue-50 rounded" aria-label={t('edit')}>
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button type="button" onClick={() => void toggleSlider(r)} className="px-2.5 py-1 text-xs border border-slate-300 rounded">
                      {r.is_active ? t('active') : t('statusHidden')}
                    </button>
                    <button type="button" onClick={() => void deleteSlider(r.id)} className="p-1 text-red-600 hover:bg-red-50 rounded" aria-label={t('delete')}>
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ),
              },
            ]}
          />
        </div>
      )}

      {tab === 'sections' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <form onSubmit={saveAboutSection} className="rounded-xl border border-slate-200 bg-white p-5 space-y-3 text-xs">
            <h3 className="font-display font-bold text-slate-950 text-sm">{t('aboutUsContent')}</h3>
            <input value={aboutEdit.title} onChange={(e) => setAboutEdit({ ...aboutEdit, title: e.target.value })} placeholder={t('sectionTitlePlaceholder')} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
            <input value={aboutEdit.subtitle} onChange={(e) => setAboutEdit({ ...aboutEdit, subtitle: e.target.value })} placeholder={t('subtitlePlaceholder')} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
            <textarea rows={2} value={aboutEdit.content_html} onChange={(e) => setAboutEdit({ ...aboutEdit, content_html: e.target.value })} placeholder={t('introHtmlPlaceholder')} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
            <textarea rows={2} value={aboutEdit.history} onChange={(e) => setAboutEdit({ ...aboutEdit, history: e.target.value })} placeholder={t('aboutHistory')} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
            <textarea rows={2} value={aboutEdit.mission} onChange={(e) => setAboutEdit({ ...aboutEdit, mission: e.target.value })} placeholder={t('aboutMission')} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
            <textarea rows={2} value={aboutEdit.vision} onChange={(e) => setAboutEdit({ ...aboutEdit, vision: e.target.value })} placeholder={t('aboutVision')} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
            <textarea rows={2} value={aboutEdit.objectives} onChange={(e) => setAboutEdit({ ...aboutEdit, objectives: e.target.value })} placeholder={t('aboutObjectives')} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
            <label className="block font-semibold text-slate-700">{t('aboutValuesJsonLabel')}</label>
            <textarea rows={4} value={aboutEdit.valuesJson} onChange={(e) => setAboutEdit({ ...aboutEdit, valuesJson: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono" dir="ltr" />
            <button type="submit" className="px-4 py-2 font-semibold text-white bg-blue-700 rounded-lg">{t('saveAboutSection')}</button>
          </form>

          <form onSubmit={saveWhySection} className="rounded-xl border border-slate-200 bg-white p-5 space-y-3 text-xs">
            <h3 className="font-display font-bold text-slate-950 text-sm">{t('whyChooseUsPillars')}</h3>
            <input value={whyEdit.title} onChange={(e) => setWhyEdit({ ...whyEdit, title: e.target.value })} placeholder={t('sectionTitlePlaceholder')} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
            <input value={whyEdit.subtitle} onChange={(e) => setWhyEdit({ ...whyEdit, subtitle: e.target.value })} placeholder={t('subtitlePlaceholder')} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
            <label className="block font-semibold text-slate-700">{t('cardsJsonLabel')}</label>
            <textarea rows={10} value={whyEdit.cardsJson} onChange={(e) => setWhyEdit({ ...whyEdit, cardsJson: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono" dir="ltr" />
            <button type="submit" className="px-4 py-2 font-semibold text-white bg-blue-700 rounded-lg">{t('saveWhyChooseUs')}</button>
          </form>
        </div>
      )}

      {tab === 'pages' && (
        <div className="space-y-5">
          <form onSubmit={savePage} className="rounded-xl border border-slate-200 bg-white p-5 space-y-3 text-xs">
            <h3 className="font-display font-bold text-slate-950 text-sm">{pageForm.id ? t('editCustomPage') : t('createCustomPage')}</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <input required placeholder={t('pageTitlePlaceholder')} value={pageForm.title} onChange={(e) => setPageForm({ ...pageForm, title: e.target.value })} className="px-3 py-2 border border-slate-300 rounded-lg" />
              <input placeholder={t('urlSlugPlaceholder')} value={pageForm.slug} disabled={Boolean(pageForm.id)} onChange={(e) => setPageForm({ ...pageForm, slug: e.target.value })} className="px-3 py-2 border border-slate-300 rounded-lg font-mono disabled:bg-slate-100" dir="ltr" />
              <label className="inline-flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-lg">
                <input type="checkbox" checked={pageForm.is_published} onChange={(e) => setPageForm({ ...pageForm, is_published: e.target.checked })} />
                <span>{t('publishedOnWebsite')}</span>
              </label>
            </div>
            {/* Rich formatting toolbar */}
            <div className="flex items-center gap-2 pt-1">
              <button type="button" onClick={() => appendHtmlSnippet('<h2>عنوان بخش</h2>')} className="px-2.5 py-1 border border-slate-300 rounded bg-slate-50 font-semibold">H2</button>
              <button type="button" onClick={() => appendHtmlSnippet('<p><strong>نکته مهم:</strong> </p>')} className="p-1.5 border border-slate-300 rounded bg-slate-50" aria-label="H2 / Bold"><Bold className="w-3.5 h-3.5" /></button>
              <button type="button" onClick={() => appendHtmlSnippet('<p><em>توضیح:</em> </p>')} className="p-1.5 border border-slate-300 rounded bg-slate-50" aria-label="Italic"><Italic className="w-3.5 h-3.5" /></button>
              <button type="button" onClick={() => appendHtmlSnippet('<ul><li>مورد اول</li><li>مورد دوم</li></ul>')} className="p-1.5 border border-slate-300 rounded bg-slate-50" aria-label="List"><List className="w-3.5 h-3.5" /></button>
            </div>
            <textarea rows={6} required placeholder={t('richHtmlPlaceholder')} value={pageForm.content_html} onChange={(e) => setPageForm({ ...pageForm, content_html: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono" />
            <div className="flex items-center gap-2">
              <button type="submit" className="px-4 py-2 font-semibold text-white bg-blue-700 rounded-lg">{pageForm.id ? t('updatePageBtn') : t('publishPageBtn')}</button>
              {pageForm.id > 0 && (
                <button type="button" onClick={() => setPageForm({ id: 0, title: '', slug: '', content_html: '', is_published: true })} className="px-4 py-2 border border-slate-300 rounded-lg">{t('cancelEditBtn')}</button>
              )}
            </div>
          </form>

          <DataTable
            rows={cms.pages || []}
            columns={[
              { key: 'title', header: t('title'), render: (r) => <span className="font-semibold">{r.title}</span> },
              { key: 'slug', header: t('slugCol'), render: (r) => <span className="font-mono text-xs text-blue-700" dir="ltr">/page/{r.slug}</span> },
              { key: 'pub', header: t('status'), render: (r) => (r.is_published ? t('statusPublished') : t('statusDraft')) },
              {
                key: 'act',
                header: t('actions'),
                render: (r) => (
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => setPageForm({ id: r.id, title: r.title, slug: r.slug, content_html: r.content_html, is_published: Boolean(r.is_published) })} className="px-2.5 py-1 text-xs border border-slate-300 rounded">
                      {t('edit')}
                    </button>
                    {!r.is_system && (
                      <button type="button" onClick={() => void deletePage(r)} className="p-1 text-red-600 hover:bg-red-50 rounded" aria-label={t('delete')}>
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ),
              },
            ]}
          />
        </div>
      )}

      {tab === 'menus' && (
        <div className="space-y-5">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                await apiRequest('/api/admin/cms/menus', { method: 'POST', body: JSON.stringify(menuForm) });
                toast(t('menuLinkAddedMsg'));
                setMenuForm({ label: '', url: '', target_page_slug: '', sort_order: 10 });
                void load();
              } catch (err: any) {
                toast(translateServerError(err.message), 'error');
              }
            }}
            className="rounded-xl border border-slate-200 bg-white p-5 grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs"
          >
            <input required placeholder={t('menuLabelPlaceholder')} value={menuForm.label} onChange={(e) => setMenuForm({ ...menuForm, label: e.target.value })} className="px-3 py-2 border border-slate-300 rounded-lg" />
            <input required placeholder={t('menuUrlPlaceholder')} value={menuForm.url} onChange={(e) => setMenuForm({ ...menuForm, url: e.target.value })} className="px-3 py-2 border border-slate-300 rounded-lg" dir="ltr" />
            <select value={menuForm.target_page_slug} onChange={(e) => setMenuForm({ ...menuForm, target_page_slug: e.target.value })} className="px-3 py-2 border border-slate-300 rounded-lg bg-white">
              <option value="">{t('anchorExternalOpt')}</option>
              {(cms.pages || []).map((p: any) => <option key={p.id} value={p.slug}>{t('cmsPagePrefix')} {p.title}</option>)}
            </select>
            <button type="submit" className="px-4 py-2 font-semibold text-white bg-blue-700 rounded-lg">{t('addMenuLinkBtn')}</button>
          </form>

          <DataTable
            rows={cms.menus || []}
            columns={[
              { key: 'lbl', header: t('labelCol'), render: (r) => <span className="font-semibold">{r.label}</span> },
              { key: 'url', header: t('urlCol'), render: (r) => <span className="font-mono text-xs" dir="ltr">{r.url}</span> },
              { key: 'sys', header: t('type'), render: (r) => (r.is_essential ? t('coreProtected') : t('customType')) },
              {
                key: 'del',
                header: t('actions'),
                render: (r) => (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      aria-label={t('edit')}
                      onClick={() => setEditMenu({ ...r, is_visible: Boolean(r.is_visible) })}
                      className="p-1 text-blue-700 hover:bg-blue-50 rounded"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    {!r.is_essential ? (
                      <button
                        type="button"
                        aria-label={t('delete')}
                        onClick={async () => {
                          try {
                            await apiRequest(`/api/admin/cms/menus/${r.id}`, { method: 'DELETE' });
                            void load();
                          } catch (err: any) {
                            toast(translateServerError(err.message), 'error');
                          }
                        }}
                        className="p-1 text-red-600 hover:bg-red-50 rounded"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    ) : (
                      <span className="text-xs text-slate-400">{t('protectedLabel')}</span>
                    )}
                  </div>
                ),
              },
            ]}
          />
        </div>
      )}

      {tab === 'gallery' && (
        <div className="space-y-5">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                await apiRequest('/api/admin/cms/gallery', { method: 'POST', body: JSON.stringify(galleryForm) });
                toast(t('galleryItemAddedMsg'));
                setGalleryForm((p) => ({ ...p, title: '', description: '' }));
                void load();
              } catch (err: any) {
                toast(translateServerError(err.message), 'error');
              }
            }}
            className="rounded-xl border border-slate-200 bg-white p-5 space-y-3 text-xs"
          >
            <h3 className="font-display font-bold text-slate-950 text-sm">{t('addGalleryMediaTitle')}</h3>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <select required value={galleryForm.category_id} onChange={(e) => setGalleryForm({ ...galleryForm, category_id: e.target.value })} className="px-3 py-2 border border-slate-300 rounded-lg bg-white">
                {(cms.galleryCategories || []).map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <input required placeholder={t('title')} value={galleryForm.title} onChange={(e) => setGalleryForm({ ...galleryForm, title: e.target.value })} className="px-3 py-2 border border-slate-300 rounded-lg" />
              <select value={galleryForm.media_type} onChange={(e) => setGalleryForm({ ...galleryForm, media_type: e.target.value })} className="px-3 py-2 border border-slate-300 rounded-lg bg-white">
                <option value="image">{t('mediaImageOpt')}</option>
                <option value="video">{t('mediaVideoOpt')}</option>
              </select>
              <input required placeholder={t('mediaUrlPlaceholder')} value={galleryForm.file_url} onChange={(e) => setGalleryForm({ ...galleryForm, file_url: e.target.value })} className="px-3 py-2 border border-slate-300 rounded-lg" dir="ltr" />
            </div>
            <FileUploader
              imageOnly={galleryForm.media_type !== 'video'}
              accept={galleryForm.media_type === 'video' ? 'video/*,image/*' : 'image/*'}
              label={t('uploadMediaFile')}
              onUploaded={(m) => setGalleryForm({ ...galleryForm, file_url: m.url })}
            />
            <button type="submit" className="px-4 py-2 font-semibold text-white bg-blue-700 rounded-lg">{t('addToGalleryBtn')}</button>
          </form>

          <DataTable
            rows={cms.galleryMedia || []}
            columns={[
              { key: 'title', header: t('title'), render: (r) => <span className="font-semibold">{r.title}</span> },
              { key: 'cat', header: t('category'), render: (r) => r.category_name },
              { key: 'type', header: t('type'), render: (r) => tStatus(r.media_type) },
              {
                key: 'del',
                header: t('actions'),
                render: (r) => (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      aria-label={t('edit')}
                      onClick={() => setEditGallery({ ...r, is_published: Boolean(r.is_published) })}
                      className="p-1 text-blue-700 hover:bg-blue-50 rounded"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      aria-label={t('delete')}
                      onClick={async () => {
                        try {
                          await apiRequest(`/api/admin/cms/gallery/${r.id}`, { method: 'DELETE' });
                          void load();
                        } catch (err: any) {
                          toast(translateServerError(err.message), 'error');
                        }
                      }}
                      className="p-1 text-red-600 hover:bg-red-50 rounded"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ),
              },
            ]}
          />
        </div>
      )}

      {tab === 'top' && (
        <div className="space-y-5">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                await apiRequest('/api/admin/cms/featured-students', { method: 'POST', body: JSON.stringify(topForm) });
                toast(t('topStudentPublishedMsg'));
                setTopForm({ student_id: '', achievement_title: '', achievement_detail: '', display_photo_url: '' });
                void load();
              } catch (err: any) {
                toast(translateServerError(err.message), 'error');
              }
            }}
            className="rounded-xl border border-slate-200 bg-white p-5 space-y-3 text-xs"
          >
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <select required value={topForm.student_id} onChange={(e) => setTopForm({ ...topForm, student_id: e.target.value })} className="px-3 py-2 border border-slate-300 rounded-lg bg-white">
                <option value="">{t('selectStudentOpt')}</option>
                {students.map((s) => <option key={s.id} value={s.id}>{s.student_code} · {s.first_name} {s.last_name}</option>)}
              </select>
              <input required placeholder={t('achievementTitlePlaceholder')} value={topForm.achievement_title} onChange={(e) => setTopForm({ ...topForm, achievement_title: e.target.value })} className="px-3 py-2 border border-slate-300 rounded-lg" />
              <input placeholder={t('detailQuotePlaceholder')} value={topForm.achievement_detail} onChange={(e) => setTopForm({ ...topForm, achievement_detail: e.target.value })} className="px-3 py-2 border border-slate-300 rounded-lg" />
              <button type="submit" className="px-4 py-2 font-semibold text-white bg-blue-700 rounded-lg">{t('publishTopStudentBtn')}</button>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex-1 min-w-[220px] max-w-sm">
                <FileUploader imageOnly accept="image/*" label={t('uploadStudentPhoto')} onUploaded={(m) => setTopForm({ ...topForm, display_photo_url: m.url })} />
              </div>
              {topForm.display_photo_url && (
                <div className="flex items-center gap-2">
                  <img src={resolveMediaUrl(topForm.display_photo_url)} alt="" className="w-10 h-10 rounded-lg object-cover border border-slate-200" />
                  <button type="button" onClick={() => setTopForm({ ...topForm, display_photo_url: '' })} className="text-red-600 hover:underline">
                    {t('removePhotoBtn')}
                  </button>
                </div>
              )}
            </div>
          </form>

          <DataTable
            rows={cms.featuredStudents || []}
            columns={[
              { key: 'name', header: t('studentCol'), render: (r) => <span className="font-semibold">{r.student_name}</span> },
              { key: 'ach', header: t('achievementCol'), render: (r) => r.achievement_title },
              { key: 'det', header: t('detailCol'), render: (r) => <span className="text-xs text-slate-600">{r.achievement_detail}</span> },
              {
                key: 'pub',
                header: t('togglePublishLabel'),
                render: (r) => (
                  <button
                    type="button"
                    onClick={() => void toggleTopStudentPublished(r)}
                    className={`px-3 py-1 text-xs font-semibold rounded-lg border ${
                      r.is_published
                        ? 'bg-blue-700 text-white border-blue-700'
                        : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    {r.is_published ? t('publishedLabel') : t('hiddenFromHomeLabel')}
                  </button>
                ),
              },
              {
                key: 'del',
                header: t('actions'),
                render: (r) => (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      aria-label={t('edit')}
                      onClick={() => setEditTopStudent({ ...r, is_published: Boolean(r.is_published) })}
                      className="p-1 text-blue-700 hover:bg-blue-50 rounded"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      aria-label={t('delete')}
                      onClick={async () => {
                        try {
                          await apiRequest(`/api/admin/cms/featured-students/${r.id}`, { method: 'DELETE' });
                          void load();
                        } catch (err: any) {
                          toast(translateServerError(err.message), 'error');
                        }
                      }}
                      className="p-1 text-red-600 hover:bg-red-50 rounded"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ),
              },
            ]}
          />
        </div>
      )}

      {tab === 'contact' && (
        <form onSubmit={saveSettings} className="rounded-xl border border-slate-200 bg-white p-5 space-y-4 text-xs">
          <h3 className="font-display font-bold text-slate-950 text-sm flex items-center gap-2">
            <Globe className="w-4 h-4 text-blue-700" />
            <span>{t('cmsContactSettingsTitle')}</span>
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              ['site_name', t('centerNameLabel')],
              ['site_tagline', t('centerTaglineLabel')],
              ['contact_phone', t('phone')],
              ['contact_email', t('email')],
              ['contact_address', t('contactAddress')],
              ['slider_interval_ms', t('sliderIntervalLabel')],
              ['social_facebook', t('facebookUrlLabel')],
              ['social_telegram', t('telegramUrlLabel')],
              ['social_linkedin', t('linkedInUrlLabel')],
              ['map_embed_note', t('mapCoordsLabel')],
              ['footer_text', t('footerCopyrightLabel')],
            ].map(([k, label]) => (
              <div key={k}>
                <label className="block font-semibold text-slate-700 mb-1">{label}</label>
                <input
                  value={settingsForm[k] || ''}
                  onChange={(e) => setSettingsForm({ ...settingsForm, [k]: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>
            ))}
          </div>
          <button type="submit" className="inline-flex items-center gap-1.5 px-4 py-2 font-semibold text-white bg-blue-700 rounded-lg">
            <Save className="w-3.5 h-3.5" />
            <span>{t('save')}</span>
          </button>
        </form>
      )}

      {/* Edit Slider Modal */}
      {editSlider && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4 overflow-y-auto">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                await apiRequest(`/api/admin/cms/sliders/${editSlider.id}`, {
                  method: 'PUT',
                  body: JSON.stringify(editSlider),
                });
                toast(t('slideUpdatedMsg'));
                setEditSlider(null);
                void load();
              } catch (err: any) {
                toast(translateServerError(err.message), 'error');
              }
            }}
            className="w-full max-w-lg bg-white rounded-xl p-6 space-y-4 text-xs"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-display font-bold text-slate-950 text-sm">{t('editSliderTitle')}</h3>
              <button type="button" onClick={() => setEditSlider(null)} aria-label={t('close')} className="p-1 text-slate-500 hover:text-slate-800">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">{t('headlineCol')}</label>
                <input required value={editSlider.title || ''} onChange={(e) => setEditSlider({ ...editSlider, title: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">{t('subtitleCol')}</label>
                <input value={editSlider.subtitle || ''} onChange={(e) => setEditSlider({ ...editSlider, subtitle: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">{t('buttonLabelPlaceholder')}</label>
                  <input value={editSlider.button_label || ''} onChange={(e) => setEditSlider({ ...editSlider, button_label: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">{t('buttonUrlPlaceholder')}</label>
                  <input value={editSlider.button_url || ''} onChange={(e) => setEditSlider({ ...editSlider, button_url: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg" dir="ltr" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">{t('previewCol')}</label>
                  <select value={editSlider.image_url || ''} onChange={(e) => setEditSlider({ ...editSlider, image_url: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white">
                    {ASSET_PRESETS.map((a) => <option key={a.url} value={a.url}>{t(a.labelKey)}</option>)}
                    {editSlider.image_url && !ASSET_PRESETS.some((a) => a.url === editSlider.image_url) && (
                      <option value={editSlider.image_url}>{editSlider.image_url}</option>
                    )}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">{t('sortOrderLabel')}</label>
                  <input type="number" value={editSlider.sort_order ?? 1} onChange={(e) => setEditSlider({ ...editSlider, sort_order: Number(e.target.value) })} className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono" />
                </div>
              </div>
              <FileUploader imageOnly accept="image/*" label={t('uploadCustomSlideImage')} onUploaded={(m) => setEditSlider({ ...editSlider, image_url: m.url })} />
              <label className="inline-flex items-center gap-2">
                <input type="checkbox" checked={Boolean(editSlider.is_active)} onChange={(e) => setEditSlider({ ...editSlider, is_active: e.target.checked })} />
                <span>{t('active')}</span>
              </label>
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setEditSlider(null)} className="px-4 py-2 border border-slate-300 rounded-lg">{t('cancel')}</button>
              <button type="submit" className="px-4 py-2 font-semibold text-white bg-blue-700 rounded-lg">{t('saveChangesBtn')}</button>
            </div>
          </form>
        </div>
      )}

      {/* Edit Menu Modal */}
      {editMenu && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4 overflow-y-auto">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                await apiRequest(`/api/admin/cms/menus/${editMenu.id}`, {
                  method: 'PUT',
                  body: JSON.stringify(editMenu),
                });
                toast(t('menuLinkUpdatedMsg'));
                setEditMenu(null);
                void load();
              } catch (err: any) {
                toast(translateServerError(err.message), 'error');
              }
            }}
            className="w-full max-w-md bg-white rounded-xl p-6 space-y-4 text-xs"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-display font-bold text-slate-950 text-sm">{t('editMenuTitle')}</h3>
              <button type="button" onClick={() => setEditMenu(null)} aria-label={t('close')} className="p-1 text-slate-500 hover:text-slate-800">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">{t('labelCol')}</label>
                <input required value={editMenu.label || ''} onChange={(e) => setEditMenu({ ...editMenu, label: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">{t('urlCol')}</label>
                <input required disabled={Boolean(editMenu.is_essential)} value={editMenu.url || ''} onChange={(e) => setEditMenu({ ...editMenu, url: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg disabled:bg-slate-100" dir="ltr" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">{t('slugCol')}</label>
                  <select disabled={Boolean(editMenu.is_essential)} value={editMenu.target_page_slug || ''} onChange={(e) => setEditMenu({ ...editMenu, target_page_slug: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white disabled:bg-slate-100">
                    <option value="">{t('anchorExternalOpt')}</option>
                    {(cms.pages || []).map((p: any) => <option key={p.id} value={p.slug}>{t('cmsPagePrefix')} {p.title}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">{t('sortOrderLabel')}</label>
                  <input type="number" value={editMenu.sort_order ?? 10} onChange={(e) => setEditMenu({ ...editMenu, sort_order: Number(e.target.value) })} className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono" />
                </div>
              </div>
              <label className="inline-flex items-center gap-2">
                <input type="checkbox" checked={Boolean(editMenu.is_visible)} onChange={(e) => setEditMenu({ ...editMenu, is_visible: e.target.checked })} />
                <span>{t('publishedOnWebsite')}</span>
              </label>
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setEditMenu(null)} className="px-4 py-2 border border-slate-300 rounded-lg">{t('cancel')}</button>
              <button type="submit" className="px-4 py-2 font-semibold text-white bg-blue-700 rounded-lg">{t('saveChangesBtn')}</button>
            </div>
          </form>
        </div>
      )}

      {/* Edit Gallery Modal */}
      {editGallery && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4 overflow-y-auto">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                await apiRequest(`/api/admin/cms/gallery/${editGallery.id}`, {
                  method: 'PUT',
                  body: JSON.stringify(editGallery),
                });
                toast(t('galleryItemUpdatedMsg'));
                setEditGallery(null);
                void load();
              } catch (err: any) {
                toast(translateServerError(err.message), 'error');
              }
            }}
            className="w-full max-w-lg bg-white rounded-xl p-6 space-y-4 text-xs"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-display font-bold text-slate-950 text-sm">{t('editGalleryTitle')}</h3>
              <button type="button" onClick={() => setEditGallery(null)} aria-label={t('close')} className="p-1 text-slate-500 hover:text-slate-800">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">{t('category')}</label>
                  <select required value={editGallery.category_id || ''} onChange={(e) => setEditGallery({ ...editGallery, category_id: Number(e.target.value) })} className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white">
                    {(cms.galleryCategories || []).map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">{t('type')}</label>
                  <select value={editGallery.media_type || 'image'} onChange={(e) => setEditGallery({ ...editGallery, media_type: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white">
                    <option value="image">{t('mediaImageOpt')}</option>
                    <option value="video">{t('mediaVideoOpt')}</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">{t('title')}</label>
                <input required value={editGallery.title || ''} onChange={(e) => setEditGallery({ ...editGallery, title: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">{t('description')}</label>
                <textarea rows={2} value={editGallery.description || ''} onChange={(e) => setEditGallery({ ...editGallery, description: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">{t('mediaUrlPlaceholder')}</label>
                <input required value={editGallery.file_url || ''} onChange={(e) => setEditGallery({ ...editGallery, file_url: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg" dir="ltr" />
              </div>
              <FileUploader
                imageOnly={editGallery.media_type !== 'video'}
                accept={editGallery.media_type === 'video' ? 'video/*,image/*' : 'image/*'}
                label={t('uploadMediaFile')}
                onUploaded={(m) => setEditGallery({ ...editGallery, file_url: m.url })}
              />
              <label className="inline-flex items-center gap-2">
                <input type="checkbox" checked={Boolean(editGallery.is_published)} onChange={(e) => setEditGallery({ ...editGallery, is_published: e.target.checked })} />
                <span>{t('publishedOnWebsite')}</span>
              </label>
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setEditGallery(null)} className="px-4 py-2 border border-slate-300 rounded-lg">{t('cancel')}</button>
              <button type="submit" className="px-4 py-2 font-semibold text-white bg-blue-700 rounded-lg">{t('saveChangesBtn')}</button>
            </div>
          </form>
        </div>
      )}

      {/* Edit Top Student Modal */}
      {editTopStudent && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4 overflow-y-auto">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                await apiRequest(`/api/admin/cms/featured-students/${editTopStudent.id}`, {
                  method: 'PUT',
                  body: JSON.stringify(editTopStudent),
                });
                toast(t('topStudentUpdatedMsg'));
                setEditTopStudent(null);
                void load();
              } catch (err: any) {
                toast(translateServerError(err.message), 'error');
              }
            }}
            className="w-full max-w-md bg-white rounded-xl p-6 space-y-4 text-xs"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-display font-bold text-slate-950 text-sm">{t('editTopStudentTitle')} — {editTopStudent.student_name}</h3>
              <button type="button" onClick={() => setEditTopStudent(null)} aria-label={t('close')} className="p-1 text-slate-500 hover:text-slate-800">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">{t('achievementCol')}</label>
                <input required value={editTopStudent.achievement_title || ''} onChange={(e) => setEditTopStudent({ ...editTopStudent, achievement_title: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">{t('detailCol')}</label>
                <textarea rows={2} value={editTopStudent.achievement_detail || ''} onChange={(e) => setEditTopStudent({ ...editTopStudent, achievement_detail: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">{t('sortOrderLabel')}</label>
                <input type="number" value={editTopStudent.sort_order ?? 1} onChange={(e) => setEditTopStudent({ ...editTopStudent, sort_order: Number(e.target.value) })} className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono" />
              </div>
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <FileUploader imageOnly accept="image/*" label={t('uploadStudentPhoto')} onUploaded={(m) => setEditTopStudent({ ...editTopStudent, display_photo_url: m.url })} />
                </div>
                {editTopStudent.display_photo_url && (
                  <button type="button" onClick={() => setEditTopStudent({ ...editTopStudent, display_photo_url: '' })} className="text-red-600 hover:underline">
                    {t('removePhotoBtn')}
                  </button>
                )}
              </div>
              <label className="inline-flex items-center gap-2">
                <input type="checkbox" checked={Boolean(editTopStudent.is_published)} onChange={(e) => setEditTopStudent({ ...editTopStudent, is_published: e.target.checked })} />
                <span>{t('publishedOnWebsite')}</span>
              </label>
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setEditTopStudent(null)} className="px-4 py-2 border border-slate-300 rounded-lg">{t('cancel')}</button>
              <button type="submit" className="px-4 py-2 font-semibold text-white bg-blue-700 rounded-lg">{t('saveChangesBtn')}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

// ─── USERS, PASSWORD RESETS & SYSTEM SETTINGS MODULE ─────────────────────────
export const UsersAndSettingsModule: React.FC = () => {
  const { branding, refreshUser, setBranding } = useAuth();
  const { t, tStatus, tRole, setLanguage, translateServerError } = useI18n();
  const { toast } = useFeedback();

  const [users, setUsers] = useState<any[]>([]);
  const [resets, setResets] = useState<any[]>([]);
  const [sysSettings, setSysSettings] = useState<Record<string, string>>({});
  const [resetTarget, setResetTarget] = useState<{ userId: number; requestId?: number; label: string } | null>(null);
  const [newPassword, setNewPassword] = useState('Reset@2026');

  const load = async () => {
    try {
      const res = await apiRequest<{ users: any[]; resetRequests: any[]; systemSettings: Record<string, string> }>('/api/admin/users');
      setUsers(res.users || []);
      setResets(res.resetRequests || []);
      setSysSettings(res.systemSettings || {});
    } catch (err: any) {
      toast(translateServerError(err.message), 'error');
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const toggleUserStatus = async (u: any) => {
    try {
      await apiRequest(`/api/admin/users/${u.id}/status`, {
        method: 'POST',
        body: JSON.stringify({ status: u.status === 'active' ? 'inactive' : 'active' }),
      });
      toast(t('userStatusUpdatedMsg'));
      void load();
    } catch (err: any) {
      toast(translateServerError(err.message), 'error');
    }
  };

  const applyPasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetTarget) return;
    try {
      await apiRequest(`/api/admin/users/${resetTarget.userId}/reset-password`, {
        method: 'POST',
        body: JSON.stringify({ new_password: newPassword, request_id: resetTarget.requestId }),
      });
      toast(t('passwordResetResolvedMsg'));
      setResetTarget(null);
      void load();
    } catch (err: any) {
      toast(translateServerError(err.message), 'error');
    }
  };

  const saveSystemSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest('/api/admin/system-settings', {
        method: 'PUT',
        body: JSON.stringify({ ...sysSettings, currency_symbol: 'AFN' }),
      });
      if (sysSettings.default_language) {
        setLanguage(sysSettings.default_language as LangCode, false);
      }
      toast(t('systemSettingsSavedMsg'));
    } catch (err: any) {
      toast(translateServerError(err.message), 'error');
    }
  };

  const handleSettingsLogoUpload = async (m: { url: string }) => {
    try {
      await apiRequest('/api/admin/cms/logo', {
        method: 'PUT',
        body: JSON.stringify({ site_logo_url: m.url }),
      });
      setBranding((prev) => ({ ...prev, site_logo_url: m.url }));
      await refreshUser();
      toast(t('logoUpdatedMsg'));
    } catch (err: any) {
      toast(translateServerError(err.message), 'error');
    }
  };

  const handleSettingsLogoRemove = async () => {
    try {
      await apiRequest('/api/admin/cms/logo', { method: 'DELETE' });
      setBranding((prev) => ({ ...prev, site_logo_url: '' }));
      await refreshUser();
      toast(t('logoRemovedMsg'));
    } catch (err: any) {
      toast(translateServerError(err.message), 'error');
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
        <div>
          <h2 className="font-display font-bold text-slate-950 flex items-center gap-2">
            <ImageIcon className="w-4 h-4 text-blue-700" />
            <span>{t('systemLogoTitle')}</span>
          </h2>
          <p className="text-xs text-slate-600 mt-1">{t('systemLogoSubtitle')}</p>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 text-xs">
          <BrandLogo logoUrl={branding.site_logo_url} alt={branding.site_name} sizeClass="w-16 h-16" iconClass="w-8 h-8" />
          <div className="flex-1 space-y-2">
            <div className="font-semibold text-slate-800">
              {branding.site_logo_url ? t('currentLogoPreview') : t('noLogoFallbackNote')}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="min-w-[200px] flex-1 max-w-xs">
                <FileUploader
                  imageOnly
                  accept="image/*"
                  label={branding.site_logo_url ? t('replaceLogoBtn') : t('uploadLogoBtn')}
                  onUploaded={(m) => void handleSettingsLogoUpload(m)}
                />
              </div>
              {branding.site_logo_url && (
                <button
                  type="button"
                  onClick={() => void handleSettingsLogoRemove()}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-red-700 border border-red-200 bg-red-50 rounded-lg hover:bg-red-100"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{t('removeLogoBtn')}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <form onSubmit={saveSystemSettings} className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
        <h2 className="font-display font-bold text-slate-950 flex items-center gap-2">
          <Settings className="w-4 h-4 text-blue-700" />
          <span>{t('systemConfigurationTitle')}</span>
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">{t('defaultCenterLanguage')}</label>
            <select
              value={sysSettings.default_language || 'fa'}
              onChange={(e) => setSysSettings({ ...sysSettings, default_language: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
            >
              <option value="fa">دری (RTL)</option>
              <option value="ps">پښتو (RTL)</option>
              <option value="uz">اوزبیکی (RTL)</option>
              <option value="tk">تورکمنی (RTL)</option>
              <option value="en">English (LTR)</option>
            </select>
          </div>
          <div>
            <label className="block font-semibold text-slate-700 mb-1">{t('currencySymbolLabel')}</label>
            <div className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 text-slate-700 font-medium">
              {t('afnFixedNote')}
            </div>
          </div>
          <div>
            <label className="block font-semibold text-slate-700 mb-1">{t('sessionTimeoutLabel')}</label>
            <input type="number" value={sysSettings.session_timeout_minutes || '120'} onChange={(e) => setSysSettings({ ...sysSettings, session_timeout_minutes: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono" />
          </div>
          <div>
            <label className="block font-semibold text-slate-700 mb-1">{t('academicYearLabel')}</label>
            <input value={sysSettings.academic_year || '2026'} onChange={(e) => setSysSettings({ ...sysSettings, academic_year: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono" />
          </div>
        </div>
        <button type="submit" className="px-4 py-2 text-xs font-semibold text-white bg-blue-700 rounded-lg">{t('saveSystemSettings')}</button>
      </form>

      {/* Password Reset Requests Queue */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
        <h3 className="font-display font-bold text-slate-950 text-sm flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-amber-600" />
          <span>{t('adminResetRequestsTitle')}</span>
        </h3>
        {resets.length === 0 ? (
          <div className="text-xs text-slate-500">{t('noResetRequests')}</div>
        ) : (
          <div className="divide-y divide-slate-100 text-xs">
            {resets.map((r) => (
              <div key={r.id} className="py-2.5 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <span className="font-semibold text-slate-900">{r.identifier}</span>
                  <span className="mx-2 text-slate-400">·</span>
                  <span className="text-slate-600">{r.reason || t('noReasonProvided')}</span>
                  <div className="text-[11px] text-slate-500 mt-0.5">{r.created_at} · {t('status')}: {tStatus(r.status)}</div>
                </div>
                {r.status === 'pending' && r.user_id && (
                  <button
                    type="button"
                    onClick={() => setResetTarget({ userId: r.user_id, requestId: r.id, label: r.identifier })}
                    className="px-3 py-1.5 font-semibold text-white bg-blue-700 rounded-lg"
                  >
                    {t('issueNewPasswordBtn')}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* All User Accounts */}
      <DataTable
        rows={users}
        columns={[
          { key: 'user', header: t('username'), render: (r) => <span className="font-mono text-xs font-semibold">{r.username}</span> },
          { key: 'name', header: t('fullName'), render: (r) => r.full_name },
          { key: 'role', header: t('roleCol'), render: (r) => <span className="text-xs font-semibold">{tRole(r.role)}</span> },
          { key: 'lang', header: t('langCol'), render: (r) => <span className="font-mono text-xs">{r.preferred_lang}</span> },
          { key: 'st', header: t('status'), render: (r) => <span className={r.status === 'active' ? 'text-emerald-700 font-semibold' : 'text-red-600 font-semibold'}>{tStatus(r.status)}</span> },
          {
            key: 'act',
            header: t('actions'),
            render: (r) => (
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setResetTarget({ userId: r.id, label: r.username })} className="px-2.5 py-1 text-xs border border-slate-300 rounded">
                  {t('resetPasswordBtn')}
                </button>
                <button type="button" onClick={() => void toggleUserStatus(r)} className="px-2.5 py-1 text-xs border border-slate-300 rounded">
                  {r.status === 'active' ? t('deactivateBtn') : t('activateBtn')}
                </button>
              </div>
            ),
          },
        ]}
      />

      {resetTarget && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <form onSubmit={applyPasswordReset} className="w-full max-w-md bg-white rounded-xl p-6 space-y-4">
            <h3 className="font-display font-bold text-slate-950 flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-700" />
              <span>{t('passwordResetForTitle', { label: resetTarget.label })}</span>
            </h3>
            <input required minLength={8} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono" dir="ltr" />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setResetTarget(null)} className="px-4 py-2 text-xs border border-slate-300 rounded-lg">{t('cancel')}</button>
              <button type="submit" className="px-4 py-2 text-xs font-semibold text-white bg-blue-700 rounded-lg">{t('setPasswordBtn')}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

// ─── AUTOMATED REMINDERS ENGINE MODULE ───────────────────────────────────────
export const RemindersModule: React.FC = () => {
  const { t, tJobType, translateServerError } = useI18n();
  const { toast } = useFeedback();
  const [jobs, setJobs] = useState<any[]>([]);
  const [running, setRunning] = useState(false);

  const load = async () => {
    try {
      const res = await apiRequest<{ jobs: any[] }>('/api/admin/reminders');
      setJobs(res.jobs || []);
    } catch (err: any) {
      toast(translateServerError(err.message), 'error');
    }
  };
  useEffect(() => {
    void load();
  }, []);

  const updateJob = async (job: any, patch: any) => {
    try {
      await apiRequest(`/api/admin/reminders/${job.id}`, {
        method: 'PUT',
        body: JSON.stringify({ ...job, ...patch }),
      });
      toast(t('reminderRuleUpdatedMsg'));
      void load();
    } catch (err: any) {
      toast(translateServerError(err.message), 'error');
    }
  };

  const runNow = async () => {
    setRunning(true);
    try {
      const res = await apiRequest<{ sent: number }>('/api/admin/reminders/run', { method: 'POST' });
      toast(t('remindersDispatchedMsg', { count: res.sent }));
      void load();
    } catch (err: any) {
      toast(translateServerError(err.message), 'error');
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-display font-bold text-slate-950 flex items-center gap-2">
            <BellRing className="w-4 h-4 text-blue-700" />
            <span>{t('automatedReminderEngine')}</span>
          </h2>
          <p className="text-xs text-slate-600 mt-1">
            {t('automatedReminderDesc')}
          </p>
        </div>
        <button
          type="button"
          disabled={running}
          onClick={() => void runNow()}
          className="px-4 py-2 text-xs font-semibold text-white bg-blue-700 rounded-lg hover:bg-blue-800 disabled:opacity-60"
        >
          {running ? t('runningLabel') : t('runRemindersNow')}
        </button>
      </div>

      <DataTable
        rows={jobs}
        columns={[
          { key: 'type', header: t('reminderJobCol'), render: (r) => <span className="font-semibold text-xs">{tJobType(r.job_type)}</span> },
          {
            key: 'days',
            header: t('leadDaysCol'),
            render: (r) => (
              <input
                type="number"
                min={0}
                max={30}
                defaultValue={r.days_before}
                onBlur={(e) => void updateJob(r, { days_before: Number(e.target.value) })}
                className="w-20 px-2 py-1 text-xs border border-slate-300 rounded font-mono"
              />
            ),
          },
          { key: 'cron', header: t('scheduleCronCol'), render: (r) => <span className="font-mono text-xs" dir="ltr">{r.schedule_cron}</span> },
          { key: 'last', header: t('lastRunCol'), render: (r) => <span className="font-mono text-xs">{r.last_run_at || t('never')} {t('sentCountParens', { count: r.last_run_count })}</span> },
          {
            key: 'en',
            header: t('status'),
            render: (r) => (
              <button
                type="button"
                onClick={() => void updateJob(r, { is_enabled: !r.is_enabled })}
                className={`px-3 py-1 text-xs font-semibold rounded border ${r.is_enabled ? 'border-emerald-300 bg-emerald-50 text-emerald-800' : 'border-slate-300 text-slate-600'}`}
              >
                {r.is_enabled ? t('statusEnabled') : t('statusPaused')}
              </button>
            ),
          },
        ]}
      />
    </div>
  );
};

// ─── READ-ONLY AUDIT LOGS MODULE ─────────────────────────────────────────────
export const AuditLogsModule: React.FC = () => {
  const { t, tRole, translateServerError } = useI18n();
  const [logs, setLogs] = useState<any[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadLogs = async () => {
    setErrorMsg(null);
    try {
      const res = await apiRequest<{ logs: any[] }>('/api/admin/audit-logs');
      setLogs(res.logs || []);
    } catch (err: any) {
      setErrorMsg(translateServerError(err.message));
    }
  };

  useEffect(() => {
    void loadLogs();
  }, []);

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-4 flex items-center gap-2 text-xs text-slate-700">
        <History className="w-4 h-4 text-blue-700" />
        <span>{t('auditTrailBanner')}</span>
      </div>
      {errorMsg && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 flex items-center justify-between gap-4">
          <span className="text-xs text-red-700">{errorMsg}</span>
          <button type="button" onClick={() => void loadLogs()} className="px-3 py-1.5 text-xs font-semibold text-white bg-red-700 rounded-lg">
            {t('retry')}
          </button>
        </div>
      )}
      <DataTable
        rows={logs}
        columns={[
          { key: 'ts', header: t('timestampCol'), render: (r) => <span className="font-mono text-xs">{r.created_at}</span> },
          { key: 'usr', header: t('userCol'), render: (r) => <span className="font-medium">{r.user_name || 'system'} ({r.user_role ? tRole(r.user_role) : '-'})</span> },
          { key: 'act', header: t('actionCol'), render: (r) => <span className="font-mono text-xs font-semibold text-blue-800">{r.action}</span> },
          { key: 'mod', header: t('moduleCol'), render: (r) => r.module },
          { key: 'ref', header: t('refCol'), render: (r) => <span className="font-mono text-xs">{r.record_ref || '—'}</span> },
          { key: 'res', header: t('result'), render: (r) => r.result },
        ]}
      />
    </div>
  );
};

// ─── DATABASE BACKUP & SAFE RESTORE MODULE ───────────────────────────────────
export const BackupsModule: React.FC = () => {
  const { t, tStatus, translateServerError } = useI18n();
  const { toast, confirm } = useFeedback();
  const [backups, setBackups] = useState<any[]>([]);
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      const res = await apiRequest<{ backups: any[] }>('/api/admin/backups');
      setBackups(res.backups || []);
    } catch (err: any) {
      toast(translateServerError(err.message), 'error');
    }
  };
  useEffect(() => {
    void load();
  }, []);

  const createBackup = async () => {
    setBusy(true);
    try {
      await apiRequest('/api/admin/backups', {
        method: 'POST',
        body: JSON.stringify({ notes: notes || t('createBackup') }),
      });
      toast(t('backupCreatedMsg'));
      setNotes('');
      void load();
    } catch (err: any) {
      toast(translateServerError(err.message), 'error');
    } finally {
      setBusy(false);
    }
  };

  const restoreBackup = async (b: any) => {
    const ok = await confirm({
      title: t('confirmRestoreTitle'),
      message: t('confirmRestoreMsg', { filename: b.filename }),
      confirmLabel: t('confirmRestoreBtn'),
      danger: true,
    });
    if (!ok) return;
    setBusy(true);
    try {
      await apiRequest(`/api/admin/backups/${b.id}/restore`, {
        method: 'POST',
        body: JSON.stringify({ confirm: true }),
      });
      toast(t('databaseRestoredMsg'), 'success');
      void load();
    } catch (err: any) {
      toast(translateServerError(err.message), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-display font-bold text-slate-950 flex items-center gap-2">
            <DatabaseBackup className="w-4 h-4 text-blue-700" />
            <span>{t('backupsTitle')}</span>
          </h2>
          <p className="text-xs text-slate-600 mt-1">
            {t('backupsDesc')}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            placeholder={t('snapshotNotePlaceholder')}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="px-3 py-2 text-xs border border-slate-300 rounded-lg"
          />
          <button
            type="button"
            disabled={busy}
            onClick={() => void createBackup()}
            className="px-4 py-2 text-xs font-semibold text-white bg-blue-700 rounded-lg hover:bg-blue-800 disabled:opacity-60"
          >
            {t('createBackup')}
          </button>
        </div>
      </div>

      <DataTable
        rows={backups}
        columns={[
          { key: 'fn', header: t('filenameCol'), render: (r) => <span className="font-mono text-xs font-semibold">{r.filename}</span> },
          { key: 'sz', header: t('sizeCol'), align: 'end', render: (r) => <span className="font-mono text-xs">{(Number(r.file_size) / 1024).toFixed(1)} KB</span> },
          { key: 'sha', header: t('checksumCol'), render: (r) => <span className="font-mono text-[11px] text-slate-500">{String(r.checksum_sha256).slice(0, 14)}…</span> },
          { key: 'tp', header: t('type'), render: (r) => <span className="text-xs font-semibold">{tStatus(r.backup_type)}</span> },
          { key: 'dt', header: t('createdCol'), render: (r) => <span className="font-mono text-xs">{r.created_at}</span> },
          {
            key: 'act',
            header: t('actions'),
            render: (r) => (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => void downloadAuthenticatedFile(`/api/admin/backups/${r.id}/download`, r.filename).catch((err: any) => toast(translateServerError(err?.message), 'error'))}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs border border-slate-300 rounded hover:bg-slate-50"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>{t('download')}</span>
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void restoreBackup(r)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-amber-800 border border-amber-300 bg-amber-50 rounded hover:bg-amber-100"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>{t('restoreBackup')}</span>
                </button>
              </div>
            ),
          },
        ]}
      />
    </div>
  );
};
