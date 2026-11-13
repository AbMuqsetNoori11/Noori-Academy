import React, { useEffect, useMemo, useState } from 'react';
import { Award, CheckSquare, IdCard, Palette, Printer, Save, Sparkles, Trash2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useI18n } from '../../i18n';
import { apiRequest } from '../../utils/api';
import { renderTemplatePlaceholders } from '../../utils/eduLogic';
import { resolveMediaUrl } from '../../utils/mediaAssets';
import { useFeedback } from '../ui/ToastAndConfirm';
import { DataTable } from '../ui/DataTable';
import { FileUploader } from '../ui/FileUploader';
import { BrandLogo } from '../ui/BrandLogo';
import { UserAvatar } from '../ui/UserAvatar';

// ─── STUDENT ID CARD DESIGNER & BULK ISSUANCE MODULE ─────────────────────────
export const IdCardDesignerModule: React.FC = () => {
  const { user, branding } = useAuth();
  const { t, translateServerError } = useI18n();
  const { toast } = useFeedback();

  const [templates, setTemplates] = useState<any[]>([]);
  const [cards, setCards] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [selectedStudentIds, setSelectedStudentIds] = useState<number[]>([]);
  const [selectedCardPrintIds, setSelectedCardPrintIds] = useState<number[]>([]);
  const [activeTemplateId, setActiveTemplateId] = useState<number>(0);
  const [form, setForm] = useState({
    name: '',
    orientation: 'landscape',
    width_mm: 85.6,
    height_mm: 54,
    bg_color: '#ffffff',
    accent_color: '#1e3a8a',
    text_color: '#0f172a',
    bg_image_url: '',
    logo_url: '',
    is_default: true,
    show_father: true,
    show_phone: true,
    show_class: true,
    header_title: '',
  });
  const [issueDate, setIssueDate] = useState(new Date().toISOString().slice(0, 10));
  const [expiryDate, setExpiryDate] = useState('2027-06-30');
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      const [tplRes, cardRes] = await Promise.all([
        apiRequest<{ templates: any[] }>('/api/credentials/id-cards/templates'),
        apiRequest<{ cards: any[] }>('/api/credentials/id-cards'),
      ]);
      const tList = tplRes.templates || [];
      setTemplates(tList);
      setCards(cardRes.cards || []);

      if (tList.length > 0 && activeTemplateId === 0) {
        const def = tList[0];
        setActiveTemplateId(def.id);
        let layout: any = {};
        try {
          layout = def.layout_json ? JSON.parse(def.layout_json) : {};
        } catch {
          layout = {};
        }
        setForm({
          name: def.name || '',
          orientation: def.orientation || 'landscape',
          width_mm: Number(def.width_mm || 85.6),
          height_mm: Number(def.height_mm || 54),
          bg_color: def.bg_color || '#ffffff',
          accent_color: def.accent_color || '#1e3a8a',
          text_color: def.text_color || '#0f172a',
          bg_image_url: def.bg_image_url || '',
          logo_url: def.logo_url || '',
          is_default: Boolean(def.is_default),
          show_father: layout.show_father ?? true,
          show_phone: layout.show_phone ?? true,
          show_class: layout.show_class ?? true,
          header_title: layout.header_title || layout.headerTitle || '',
        });
      }

      if (user?.role === 'admin') {
        const stuRes = await apiRequest<{ students: any[] }>('/api/academics/students');
        setStudents(stuRes.students || []);
      }
    } catch (err: any) {
      toast(translateServerError(err.message), 'error');
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const selectTemplate = (tpl: any) => {
    setActiveTemplateId(tpl.id);
    let layout: any = {};
    try {
      layout = tpl.layout_json ? JSON.parse(tpl.layout_json) : {};
    } catch {
      layout = {};
    }
    setForm({
      name: tpl.name,
      orientation: tpl.orientation || 'landscape',
      width_mm: Number(tpl.width_mm || 85.6),
      height_mm: Number(tpl.height_mm || 54),
      bg_color: tpl.bg_color || '#ffffff',
      accent_color: tpl.accent_color || '#1e3a8a',
      text_color: tpl.text_color || '#0f172a',
      bg_image_url: tpl.bg_image_url || '',
      logo_url: tpl.logo_url || '',
      is_default: Boolean(tpl.is_default),
      show_father: layout.show_father ?? true,
      show_phone: layout.show_phone ?? true,
      show_class: layout.show_class ?? true,
      header_title: layout.header_title || layout.headerTitle || '',
    });
  };

  const saveTemplate = async (e: React.FormEvent, asNew = false) => {
    e.preventDefault();
    setBusy(true);
    try {
      const payload = {
        name: form.name || t('visualIdDesignerTitle'),
        orientation: form.orientation,
        width_mm: Number(form.width_mm),
        height_mm: Number(form.height_mm),
        bg_color: form.bg_color,
        accent_color: form.accent_color,
        text_color: form.text_color,
        bg_image_url: form.bg_image_url,
        logo_url: form.logo_url,
        is_default: form.is_default,
        layout_json: {
          show_father: form.show_father,
          show_phone: form.show_phone,
          show_class: form.show_class,
          header_title: form.header_title || t('defaultCardHeader'),
        },
      };
      if (activeTemplateId && !asNew) {
        await apiRequest(`/api/credentials/id-cards/templates/${activeTemplateId}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        toast(t('idTemplateUpdatedMsg'));
      } else {
        const res = await apiRequest<{ id: number }>('/api/credentials/id-cards/templates', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        setActiveTemplateId(res.id);
        toast(t('idTemplateCreatedMsg'));
      }
      void load();
    } catch (err: any) {
      toast(translateServerError(err.message), 'error');
    } finally {
      setBusy(false);
    }
  };

  const issueCards = async () => {
    if (selectedStudentIds.length === 0 || !activeTemplateId) {
      toast(t('selectStudentAndTemplateWarn'), 'warning');
      return;
    }
    setBusy(true);
    try {
      const res = await apiRequest<{ issued: number; skipped: number }>('/api/credentials/id-cards/issue', {
        method: 'POST',
        body: JSON.stringify({
          student_ids: selectedStudentIds,
          template_id: activeTemplateId,
          issue_date: issueDate,
          expiry_date: expiryDate,
        }),
      });
      toast(
        res.skipped
          ? t('cardsIssuedSkippedMsg', { issued: res.issued, skipped: res.skipped })
          : t('cardsIssuedMsg', { issued: res.issued })
      );
      setSelectedStudentIds([]);
      void load();
    } catch (err: any) {
      toast(translateServerError(err.message), 'error');
    } finally {
      setBusy(false);
    }
  };

  const toggleStudentCheck = (id: number) => {
    setSelectedStudentIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const togglePrintCheck = (id: number) => {
    setSelectedCardPrintIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const cardsToPrint = useMemo(() => {
    if (selectedCardPrintIds.length > 0) {
      return cards.filter((c) => selectedCardPrintIds.includes(c.id));
    }
    return cards;
  }, [cards, selectedCardPrintIds]);

  const previewStudent = students[0] || {
    student_code: 'STU-2026-0001',
    first_name: 'احمد فرید',
    last_name: 'احمدی',
    father_name: 'کریم',
    phone: '+93 700 201 301',
    class_name: 'صنف اول — مهندسی نرم‌افزار',
    photo_url: '',
  };

  const renderCardFace = (cardData: any, tplCfg: typeof form, cardNum: string, issued: string, expiry: string) => {
    const isPortrait = tplCfg.orientation === 'portrait';
    let layout: any = {};
    if (cardData.layout_json) {
      try {
        layout = typeof cardData.layout_json === 'string' ? JSON.parse(cardData.layout_json) : cardData.layout_json;
      } catch {
        layout = {};
      }
    }
    const bgColor = cardData.bg_color || tplCfg.bg_color;
    const accent = cardData.accent_color || tplCfg.accent_color;
    const txtColor = cardData.text_color || tplCfg.text_color;
    const bgImg = resolveMediaUrl(cardData.bg_image_url || tplCfg.bg_image_url);
    const logoImg = cardData.logo_url || tplCfg.logo_url || branding.site_logo_url;
    const showFather = layout.show_father ?? tplCfg.show_father;
    const showPhone = layout.show_phone ?? tplCfg.show_phone;
    const showClass = layout.show_class ?? tplCfg.show_class;
    const headerTitle = layout.header_title || layout.headerTitle || tplCfg.header_title || t('defaultCardHeader');

    return (
      <div
        className="print-break-inside-avoid rounded-xl border border-slate-300 shadow-sm overflow-hidden relative flex flex-col justify-between"
        style={{
          width: isPortrait ? '240px' : '342px',
          minHeight: isPortrait ? '342px' : '216px',
          backgroundColor: bgColor,
          color: txtColor,
          backgroundImage: bgImg ? `url(${bgImg})` : undefined,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        <div
          className="px-4 py-2.5 flex items-center justify-between text-white"
          style={{ backgroundColor: accent }}
        >
          <div className="flex items-center gap-2 min-w-0">
            <BrandLogo logoUrl={logoImg} alt={branding.site_name || t('appName')} sizeClass="w-6 h-6" iconClass="w-3.5 h-3.5" />
            <span className="text-[11px] font-bold tracking-wider truncate">{headerTitle}</span>
          </div>
          <span className="font-mono text-[10px] opacity-90">{cardNum}</span>
        </div>

        <div className={`p-4 flex-1 flex ${isPortrait ? 'flex-col items-center text-center' : 'items-center'} gap-3.5`}>
          <UserAvatar
            photoUrl={cardData.photo_url}
            name={`${cardData.first_name || ''} ${cardData.last_name || ''}`}
            sizeClass="w-16 h-20"
            roundedClass="rounded-lg"
            textClass="text-lg"
          />
          <div className="min-w-0 flex-1 space-y-1 text-xs">
            <div className="font-display font-bold text-sm truncate">
              {cardData.first_name} {cardData.last_name}
            </div>
            <div className="font-mono text-[11px] font-semibold" style={{ color: accent }}>
              {cardData.student_code}
            </div>
            {showFather && cardData.father_name && (
              <div className="text-[11px] opacity-80 truncate">{t('fatherPrefix')} {cardData.father_name}</div>
            )}
            {showClass && (cardData.class_name || cardData.course_title) && (
              <div className="text-[11px] opacity-85 truncate">
                {cardData.class_name || cardData.course_title}
              </div>
            )}
            {showPhone && cardData.phone && (
              <div className="text-[11px] font-mono opacity-80 truncate" dir="ltr">{cardData.phone}</div>
            )}
          </div>
        </div>

        <div
          className="px-4 py-1.5 border-t border-slate-200/80 bg-slate-50/90 flex items-center justify-between text-[10px] font-mono text-slate-600"
        >
          <span>{t('issuedPrefix')} {issued}</span>
          {expiry && <span>{t('validThruPrefix')} {expiry}</span>}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {user?.role === 'admin' && (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 no-print">
          {/* Template Visual Builder */}
          <form onSubmit={(e) => void saveTemplate(e, false)} className="xl:col-span-7 rounded-xl border border-slate-200 bg-white p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-display font-bold text-slate-950 flex items-center gap-2">
                <Palette className="w-4 h-4 text-blue-700" />
                <span>{t('visualIdDesignerTitle')}</span>
              </h2>
              <select
                aria-label={t('selectIdTemplateAria')}
                value={activeTemplateId}
                onChange={(e) => {
                  const found = templates.find((x) => x.id === Number(e.target.value));
                  if (found) selectTemplate(found);
                }}
                className="px-3 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
              >
                {templates.map((tpl) => (
                  <option key={tpl.id} value={tpl.id}>
                    {tpl.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">{t('templateNameLabel')}</label>
                <input
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">{t('orientationLabel')}</label>
                <select
                  value={form.orientation}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      orientation: e.target.value,
                      width_mm: e.target.value === 'portrait' ? 54 : 85.6,
                      height_mm: e.target.value === 'portrait' ? 85.6 : 54,
                    })
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                >
                  <option value="landscape">{t('orientationLandscape')}</option>
                  <option value="portrait">{t('orientationPortrait')}</option>
                </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">{t('headerBannerTextLabel')}</label>
                <input
                  value={form.header_title}
                  placeholder={t('defaultCardHeader')}
                  onChange={(e) => setForm({ ...form, header_title: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">{t('cardBackgroundLabel')}</label>
                <input type="color" value={form.bg_color} onChange={(e) => setForm({ ...form, bg_color: e.target.value })} className="w-full h-9 rounded border border-slate-300 cursor-pointer" />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">{t('accentBannerLabel')}</label>
                <input type="color" value={form.accent_color} onChange={(e) => setForm({ ...form, accent_color: e.target.value })} className="w-full h-9 rounded border border-slate-300 cursor-pointer" />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">{t('textColorLabel')}</label>
                <input type="color" value={form.text_color} onChange={(e) => setForm({ ...form, text_color: e.target.value })} className="w-full h-9 rounded border border-slate-300 cursor-pointer" />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-semibold text-slate-700">{t('logoUploadOptional')}</label>
                  {form.logo_url && (
                    <button type="button" onClick={() => setForm({ ...form, logo_url: '' })} className="text-red-600 hover:underline inline-flex items-center gap-1">
                      <Trash2 className="w-3 h-3" />
                      <span>{t('removePhotoBtn')}</span>
                    </button>
                  )}
                </div>
                <FileUploader imageOnly accept="image/*" label={t('uploadCenterLogo')} onUploaded={(m) => setForm({ ...form, logo_url: m.url })} />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-semibold text-slate-700">{t('backgroundImageOptional')}</label>
                  {form.bg_image_url && (
                    <button type="button" onClick={() => setForm({ ...form, bg_image_url: '' })} className="text-red-600 hover:underline inline-flex items-center gap-1">
                      <Trash2 className="w-3 h-3" />
                      <span>{t('removePhotoBtn')}</span>
                    </button>
                  )}
                </div>
                <FileUploader imageOnly accept="image/*" label={t('uploadCardBackdrop')} onUploaded={(m) => setForm({ ...form, bg_image_url: m.url })} />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-700">
              <label className="inline-flex items-center gap-1.5">
                <input type="checkbox" checked={form.show_father} onChange={(e) => setForm({ ...form, show_father: e.target.checked })} />
                <span>{t('showFatherName')}</span>
              </label>
              <label className="inline-flex items-center gap-1.5">
                <input type="checkbox" checked={form.show_class} onChange={(e) => setForm({ ...form, show_class: e.target.checked })} />
                <span>{t('showActiveClass')}</span>
              </label>
              <label className="inline-flex items-center gap-1.5">
                <input type="checkbox" checked={form.show_phone} onChange={(e) => setForm({ ...form, show_phone: e.target.checked })} />
                <span>{t('showPhone')}</span>
              </label>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button type="submit" disabled={busy} className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-700 rounded-lg hover:bg-blue-800">
                <Save className="w-3.5 h-3.5" />
                <span>{t('updateTemplateBtn')}</span>
              </button>
              <button type="button" disabled={busy} onClick={(e) => void saveTemplate(e as any, true)} className="px-4 py-2 text-xs font-semibold text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50">
                {t('saveAsNewTemplateBtn')}
              </button>
            </div>
          </form>

          {/* Live Preview + Bulk Issue */}
          <div className="xl:col-span-5 rounded-xl border border-slate-200 bg-white p-5 space-y-4 flex flex-col justify-between">
            <div>
              <h3 className="font-display font-bold text-sm text-slate-950 mb-3">{t('liveCardPreview')}</h3>
              <div className="flex justify-center p-4 bg-slate-100 rounded-xl border border-slate-200">
                {renderCardFace(previewStudent, form, 'IDC-2026-PREVIEW', issueDate, expiryDate)}
              </div>
            </div>

            <div className="space-y-3 pt-3 border-t border-slate-200">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-800">
                <span>{t('issueCardsToStudentsCount', { count: selectedStudentIds.length })}</span>
                <button
                  type="button"
                  onClick={() =>
                    setSelectedStudentIds(
                      selectedStudentIds.length === students.length ? [] : students.map((s) => s.id)
                    )
                  }
                  className="text-blue-700 hover:underline"
                >
                  {selectedStudentIds.length === students.length ? t('clearSelection') : t('selectAll')}
                </button>
              </div>
              <div className="max-h-36 overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-100 text-xs">
                {students.map((s) => (
                  <label key={s.id} className="flex items-center gap-2 px-3 py-1.5 hover:bg-slate-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedStudentIds.includes(s.id)}
                      onChange={() => toggleStudentCheck(s.id)}
                    />
                    <span className="font-mono text-slate-500">{s.student_code}</span>
                    <span className="font-medium text-slate-900">{s.first_name} {s.last_name}</span>
                  </label>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <label className="block text-slate-600 mb-1">{t('issueDateLabel')}</label>
                  <input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg" />
                </div>
                <div>
                  <label className="block text-slate-600 mb-1">{t('expiryDateLabel')}</label>
                  <input type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg" />
                </div>
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={() => void issueCards()}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-emerald-700 rounded-lg hover:bg-emerald-800"
              >
                <IdCard className="w-4 h-4" />
                <span>{t('issueSelectedCardsBtn')}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Issued ID Cards Table & Print Actions */}
      <div className="no-print">
        <DataTable
          rows={cards}
          extraControls={
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-blue-700 rounded-lg hover:bg-blue-800"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>{selectedCardPrintIds.length > 0 ? t('printSelectedCount', { count: selectedCardPrintIds.length }) : t('printAllCards')}</span>
            </button>
          }
          columns={[
            {
              key: 'sel',
              header: t('printCol'),
              render: (r) => (
                <input
                  type="checkbox"
                  aria-label={r.card_number}
                  checked={selectedCardPrintIds.includes(r.id)}
                  onChange={() => togglePrintCheck(r.id)}
                />
              ),
            },
            { key: 'num', header: t('cardNumCol'), render: (r) => <span className="font-mono text-xs font-semibold text-blue-700">{r.card_number}</span> },
            { key: 'stu', header: t('studentCol'), render: (r) => <span className="font-medium">{r.student_code} · {r.first_name} {r.last_name}</span> },
            { key: 'tpl', header: t('templateCol'), render: (r) => r.template_name },
            { key: 'iss', header: t('issuedCol'), render: (r) => <span className="font-mono text-xs">{r.issue_date}</span> },
            { key: 'exp', header: t('expiresCol'), render: (r) => <span className="font-mono text-xs">{r.expiry_date || '—'}</span> },
          ]}
        />
      </div>

      {/* Printable Cards Sheet */}
      <div className="print-only-container rounded-xl border border-slate-200 bg-white p-6">
        <h3 className="font-display font-bold text-slate-950 mb-4 no-print">{t('issuedCardsSheetCount', { count: cardsToPrint.length })}</h3>
        {cardsToPrint.length === 0 ? (
          <div className="text-sm text-slate-500">{t('noRecords')}</div>
        ) : (
          <div className="flex flex-wrap gap-5 justify-start">
            {cardsToPrint.map((c) => (
              <div key={c.id}>{renderCardFace(c, form, c.card_number, c.issue_date, c.expiry_date)}</div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// ─── CERTIFICATE DESIGNER, DYNAMIC PLACEHOLDERS & PRINTING MODULE ────────────
export const CertificateDesignerModule: React.FC = () => {
  const { user, branding } = useAuth();
  const { t, translateServerError } = useI18n();
  const { toast } = useFeedback();

  const [templates, setTemplates] = useState<any[]>([]);
  const [certificates, setCertificates] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [courses, setCourses] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [activeTplId, setActiveTplId] = useState<number>(0);
  const [previewCert, setPreviewCert] = useState<any>(null);
  const [selectedStudentIds, setSelectedStudentIds] = useState<number[]>([]);
  const [issueForm, setIssueForm] = useState({
    course_id: '',
    class_id: '',
    issue_date: new Date().toISOString().slice(0, 10),
    grade_summary: 'ممتاز (۹۴٪)',
    remarks: 'تکمیل موفقانه نصاب دوره با درجه امتیاز.',
  });
  const [tplForm, setTplForm] = useState({
    name: '',
    paper_size: 'A4',
    orientation: 'landscape',
    bg_color: '#fffdf7',
    border_color: '#b45309',
    accent_color: '#1e3a8a',
    bg_image_url: '',
    logo_url: '',
    signature_left_label: '',
    signature_right_label: '',
    body_template:
      'بدین‌وسیله تصدیق می‌گردد که شاگرد گرامی {{student_name}} (کد: {{student_code}}) برنامه آموزشی {{course_title}} ({{class_name}}) را با درجه {{grade_summary}} در تاریخ {{issue_date}} با موفقیت تکمیل نموده است.',
    is_default: true,
  });

  const load = async () => {
    try {
      const [tplRes, certRes] = await Promise.all([
        apiRequest<{ templates: any[] }>('/api/credentials/certificates/templates'),
        apiRequest<{ certificates: any[] }>('/api/credentials/certificates'),
      ]);
      const tList = tplRes.templates || [];
      setTemplates(tList);
      setCertificates(certRes.certificates || []);
      if (certRes.certificates?.length && !previewCert) {
        setPreviewCert(certRes.certificates[0]);
      }
      if (tList.length > 0 && activeTplId === 0) {
        const def = tList[0];
        setActiveTplId(def.id);
        setTplForm({
          name: def.name,
          paper_size: def.paper_size || 'A4',
          orientation: def.orientation || 'landscape',
          bg_color: def.bg_color || '#fffdf7',
          border_color: def.border_color || '#b45309',
          accent_color: def.accent_color || '#1e3a8a',
          bg_image_url: def.bg_image_url || '',
          logo_url: def.logo_url || '',
          signature_left_label: def.signature_left_label || '',
          signature_right_label: def.signature_right_label || '',
          body_template: def.body_template || tplForm.body_template,
          is_default: Boolean(def.is_default),
        });
      }
      if (user?.role === 'admin') {
        const [sRes, cRes, clRes] = await Promise.all([
          apiRequest<{ students: any[] }>('/api/academics/students'),
          apiRequest<{ courses: any[] }>('/api/academics/courses'),
          apiRequest<{ classes: any[] }>('/api/academics/classes'),
        ]);
        setStudents(sRes.students || []);
        setCourses(cRes.courses || []);
        setClasses(clRes.classes || []);
      }
    } catch (err: any) {
      toast(translateServerError(err.message), 'error');
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const saveTemplate = async (e: React.FormEvent, asNew = false) => {
    e.preventDefault();
    try {
      const payload = {
        ...tplForm,
        name: tplForm.name || t('visualCertDesignerTitle'),
        seal_text: '',
        signature_left_label: tplForm.signature_left_label || t('defaultDirectorLabel'),
        signature_right_label: tplForm.signature_right_label || t('defaultPrincipalLabel'),
      };
      if (activeTplId && !asNew) {
        await apiRequest(`/api/credentials/certificates/templates/${activeTplId}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        toast(t('certTemplateUpdatedMsg'));
      } else {
        const res = await apiRequest<{ id: number }>('/api/credentials/certificates/templates', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        setActiveTplId(res.id);
        toast(t('certTemplateCreatedMsg'));
      }
      void load();
    } catch (err: any) {
      toast(translateServerError(err.message), 'error');
    }
  };

  const issueCertificates = async () => {
    if (selectedStudentIds.length === 0 || !activeTplId) {
      toast(t('selectStudentAndTemplateWarn'), 'warning');
      return;
    }
    try {
      const res = await apiRequest<{ issued: number; skipped: number }>('/api/credentials/certificates/issue', {
        method: 'POST',
        body: JSON.stringify({
          student_ids: selectedStudentIds,
          template_id: activeTplId,
          course_id: issueForm.course_id ? Number(issueForm.course_id) : null,
          class_id: issueForm.class_id ? Number(issueForm.class_id) : null,
          issue_date: issueForm.issue_date,
          grade_summary: issueForm.grade_summary,
          remarks: issueForm.remarks,
        }),
      });
      toast(
        res.skipped
          ? t('certsIssuedSkippedMsg', { issued: res.issued, skipped: res.skipped })
          : t('certsIssuedMsg', { issued: res.issued })
      );
      setSelectedStudentIds([]);
      void load();
    } catch (err: any) {
      toast(translateServerError(err.message), 'error');
    }
  };

  const renderCertificateCanvas = (certData?: any) => {
    const cfg = certData
      ? {
          bg_color: certData.bg_color || tplForm.bg_color,
          border_color: certData.border_color || tplForm.border_color,
          accent_color: certData.accent_color || tplForm.accent_color,
          bg_image_url: certData.bg_image_url || tplForm.bg_image_url,
          logo_url: certData.logo_url || tplForm.logo_url,
          signature_left_label: certData.signature_left_label || tplForm.signature_left_label || t('defaultDirectorLabel'),
          signature_right_label: certData.signature_right_label || tplForm.signature_right_label || t('defaultPrincipalLabel'),
          body_template: certData.body_template || tplForm.body_template,
        }
      : {
          ...tplForm,
          signature_left_label: tplForm.signature_left_label || t('defaultDirectorLabel'),
          signature_right_label: tplForm.signature_right_label || t('defaultPrincipalLabel'),
        };

    const values = certData
      ? {
          student_name: `${certData.first_name} ${certData.last_name}`,
          student_code: certData.student_code,
          course_title: certData.course_title || 'برنامه آموزشی',
          class_name: certData.class_name || 'صنف',
          grade_summary: certData.grade_summary || 'ممتاز',
          issue_date: certData.issue_date,
          certificate_number: certData.certificate_number,
        }
      : {
          student_name: 'احمد فرید احمدی',
          student_code: 'STU-2026-0001',
          course_title: courses[0]?.title || 'کورس مهندسی نرم‌افزار',
          class_name: classes[0]?.name || 'صنف اول',
          grade_summary: issueForm.grade_summary,
          issue_date: issueForm.issue_date,
          certificate_number: 'CERT-2026-0001',
        };

    const renderedText = renderTemplatePlaceholders(cfg.body_template, values);

    return (
      <div
        className="print-only-container rounded-xl p-8 sm:p-12 shadow-sm relative overflow-hidden"
        style={{
          backgroundColor: cfg.bg_color,
          border: `6px double ${cfg.border_color}`,
          backgroundImage: cfg.bg_image_url ? `url(${resolveMediaUrl(cfg.bg_image_url)})` : undefined,
          backgroundSize: 'cover',
        }}
      >
        <div className="text-center space-y-4 max-w-2xl mx-auto">
          <div className="flex items-center justify-center gap-3">
            <BrandLogo logoUrl={cfg.logo_url || branding.site_logo_url} alt={branding.site_name || t('appName')} sizeClass="w-12 h-12" iconClass="w-6 h-6" />
            <div className="text-xs font-mono uppercase tracking-[0.2em]" style={{ color: cfg.border_color }}>
              {branding.site_name || t('appName')} · {t('officialAcademicCredential')}
            </div>
          </div>
          <h2 className="font-display text-3xl sm:text-4xl font-bold tracking-tight" style={{ color: cfg.accent_color }}>
            {t('certificateOfAchievement')}
          </h2>
          <div className="font-display text-xl font-bold text-slate-900 pt-2">{values.student_name}</div>
          <p className="text-sm sm:text-base text-slate-700 leading-relaxed pt-1">{renderedText}</p>
        </div>

        <div className="mt-10 pt-6 border-t border-slate-300/70 grid grid-cols-2 items-end text-center gap-12 max-w-2xl mx-auto">
          <div>
            <div className="border-b border-slate-400 w-40 max-w-full mx-auto mb-1.5" />
            <div className="text-xs font-semibold text-slate-700">{cfg.signature_left_label}</div>
          </div>
          <div>
            <div className="border-b border-slate-400 w-40 max-w-full mx-auto mb-1.5" />
            <div className="text-xs font-semibold text-slate-700">{cfg.signature_right_label}</div>
          </div>
        </div>
        <div className="mt-5 text-center font-mono text-[10px] text-slate-500" dir="ltr">
          {values.certificate_number}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {user?.role === 'admin' && (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 no-print">
          <form onSubmit={(e) => void saveTemplate(e, false)} className="xl:col-span-7 rounded-xl border border-slate-200 bg-white p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-display font-bold text-slate-950 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-600" />
                <span>{t('visualCertDesignerTitle')}</span>
              </h2>
              <select
                aria-label={t('selectCertTemplateAria')}
                value={activeTplId}
                onChange={(e) => {
                  const found = templates.find((x) => x.id === Number(e.target.value));
                  if (found) {
                    setActiveTplId(found.id);
                    setTplForm({
                      name: found.name || '',
                      paper_size: found.paper_size || 'A4',
                      orientation: found.orientation || 'landscape',
                      bg_color: found.bg_color || '#fffdf7',
                      border_color: found.border_color || '#b45309',
                      accent_color: found.accent_color || '#1e3a8a',
                      bg_image_url: found.bg_image_url || '',
                      logo_url: found.logo_url || '',
                      signature_left_label: found.signature_left_label || '',
                      signature_right_label: found.signature_right_label || '',
                      body_template: found.body_template || tplForm.body_template,
                      is_default: Boolean(found.is_default),
                    });
                  }
                }}
                className="px-3 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
              >
                {templates.map((tpl) => (
                  <option key={tpl.id} value={tpl.id}>{tpl.name}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">{t('templateNameLabel')}</label>
                <input required value={tplForm.name} onChange={(e) => setTplForm({ ...tplForm, name: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">{t('paperSizeLabel')}</label>
                <select value={tplForm.paper_size} onChange={(e) => setTplForm({ ...tplForm, paper_size: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white">
                  <option value="A4">A4</option>
                  <option value="Letter">Letter</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">{t('backgroundLabel')}</label>
                <input type="color" value={tplForm.bg_color} onChange={(e) => setTplForm({ ...tplForm, bg_color: e.target.value })} className="w-full h-9 rounded border border-slate-300 cursor-pointer" />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">{t('borderAccentLabel')}</label>
                <input type="color" value={tplForm.border_color} onChange={(e) => setTplForm({ ...tplForm, border_color: e.target.value })} className="w-full h-9 rounded border border-slate-300 cursor-pointer" />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">{t('headingColorLabel')}</label>
                <input type="color" value={tplForm.accent_color} onChange={(e) => setTplForm({ ...tplForm, accent_color: e.target.value })} className="w-full h-9 rounded border border-slate-300 cursor-pointer" />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-semibold text-slate-700">{t('logoUploadOptional')}</label>
                  {tplForm.logo_url && (
                    <button type="button" onClick={() => setTplForm({ ...tplForm, logo_url: '' })} className="text-red-600 hover:underline inline-flex items-center gap-1">
                      <Trash2 className="w-3 h-3" />
                      <span>{t('removePhotoBtn')}</span>
                    </button>
                  )}
                </div>
                <FileUploader imageOnly accept="image/*" label={t('uploadCenterLogo')} onUploaded={(m) => setTplForm({ ...tplForm, logo_url: m.url })} />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-semibold text-slate-700">{t('backgroundImageOptional')}</label>
                  {tplForm.bg_image_url && (
                    <button type="button" onClick={() => setTplForm({ ...tplForm, bg_image_url: '' })} className="text-red-600 hover:underline inline-flex items-center gap-1">
                      <Trash2 className="w-3 h-3" />
                      <span>{t('removePhotoBtn')}</span>
                    </button>
                  )}
                </div>
                <FileUploader imageOnly accept="image/*" label={t('uploadCardBackdrop')} onUploaded={(m) => setTplForm({ ...tplForm, bg_image_url: m.url })} />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">{t('leftSignatureLabel')}</label>
                <input value={tplForm.signature_left_label} placeholder={t('defaultDirectorLabel')} onChange={(e) => setTplForm({ ...tplForm, signature_left_label: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">{t('rightSignatureLabel')}</label>
                <input value={tplForm.signature_right_label} placeholder={t('defaultPrincipalLabel')} onChange={(e) => setTplForm({ ...tplForm, signature_right_label: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
              </div>
            </div>

            <div className="text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                <label className="font-semibold text-slate-700">{t('dynamicBodyTemplateLabel')}</label>
                <span className="font-mono text-[10px] text-slate-500" dir="ltr">
                  {'{{student_name}} {{student_code}} {{course_title}} {{class_name}} {{grade_summary}} {{issue_date}} {{certificate_number}}'}
                </span>
              </div>
              <textarea
                rows={3}
                value={tplForm.body_template}
                onChange={(e) => setTplForm({ ...tplForm, body_template: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button type="submit" className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-700 rounded-lg hover:bg-blue-800">
                <Save className="w-3.5 h-3.5" />
                <span>{t('updateTemplateBtn')}</span>
              </button>
              <button type="button" onClick={(e) => void saveTemplate(e as any, true)} className="px-4 py-2 text-xs font-semibold text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50">
                {t('saveAsNewTemplateBtn')}
              </button>
            </div>
          </form>

          {/* Issue Certificates Box */}
          <div className="xl:col-span-5 rounded-xl border border-slate-200 bg-white p-5 space-y-3">
            <h3 className="font-display font-bold text-slate-950 flex items-center gap-2 text-sm">
              <Award className="w-4 h-4 text-amber-600" />
              <span>{t('issueOfficialCertsTitle')}</span>
            </h3>
            <div className="grid grid-cols-2 gap-2.5 text-xs">
              <select value={issueForm.course_id} onChange={(e) => setIssueForm({ ...issueForm, course_id: e.target.value })} className="px-2.5 py-2 border border-slate-300 rounded-lg bg-white">
                <option value="">{t('courseOptionalOpt')}</option>
                {courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
              </select>
              <select value={issueForm.class_id} onChange={(e) => setIssueForm({ ...issueForm, class_id: e.target.value })} className="px-2.5 py-2 border border-slate-300 rounded-lg bg-white">
                <option value="">{t('classOptionalOpt')}</option>
                {classes.map((cl) => <option key={cl.id} value={cl.id}>{cl.name}</option>)}
              </select>
              <input value={issueForm.grade_summary} onChange={(e) => setIssueForm({ ...issueForm, grade_summary: e.target.value })} placeholder={t('gradeSummaryPlaceholder')} className="px-2.5 py-2 border border-slate-300 rounded-lg" />
              <input type="date" value={issueForm.issue_date} onChange={(e) => setIssueForm({ ...issueForm, issue_date: e.target.value })} className="px-2.5 py-2 border border-slate-300 rounded-lg" />
            </div>

            <div className="text-xs font-semibold text-slate-700 flex items-center justify-between">
              <span>{t('selectStudentsCount', { count: selectedStudentIds.length })}</span>
              <button
                type="button"
                onClick={() => setSelectedStudentIds(selectedStudentIds.length === students.length ? [] : students.map((s) => s.id))}
                className="text-blue-700 hover:underline inline-flex items-center gap-1"
              >
                <CheckSquare className="w-3.5 h-3.5" />
                <span>{t('toggleAll')}</span>
              </button>
            </div>
            <div className="max-h-40 overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-100 text-xs">
              {students.map((s) => (
                <label key={s.id} className="flex items-center gap-2 px-3 py-1.5 hover:bg-slate-50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedStudentIds.includes(s.id)}
                    onChange={() =>
                      setSelectedStudentIds((prev) => (prev.includes(s.id) ? prev.filter((x) => x !== s.id) : [...prev, s.id]))
                    }
                  />
                  <span className="font-mono text-slate-500">{s.student_code}</span>
                  <span className="font-medium text-slate-900">{s.first_name} {s.last_name}</span>
                </label>
              ))}
            </div>
            <button
              type="button"
              onClick={() => void issueCertificates()}
              className="w-full px-4 py-2 text-xs font-semibold text-white bg-emerald-700 rounded-lg hover:bg-emerald-800"
            >
              {t('issueCertsToSelectedBtn')}
            </button>
          </div>
        </div>
      )}

      {/* Issued Certificates Registry */}
      <div className="no-print">
        <DataTable
          rows={certificates}
          extraControls={
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-blue-700 rounded-lg hover:bg-blue-800"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>{t('printActiveCertBtn')}</span>
            </button>
          }
          columns={[
            { key: 'num', header: t('certNumCol'), render: (r) => <span className="font-mono text-xs font-semibold text-amber-700">{r.certificate_number}</span> },
            { key: 'stu', header: t('studentCol'), render: (r) => <span className="font-medium">{r.student_code} · {r.first_name} {r.last_name}</span> },
            { key: 'crs', header: t('courseCol'), render: (r) => r.course_title || '—' },
            { key: 'grd', header: t('gradeCol'), render: (r) => r.grade_summary },
            { key: 'dt', header: t('issuedCol'), render: (r) => <span className="font-mono text-xs">{r.issue_date}</span> },
            {
              key: 'act',
              header: t('actions'),
              render: (r) => (
                <button
                  type="button"
                  onClick={() => setPreviewCert(r)}
                  className="px-2.5 py-1 text-xs font-medium text-blue-700 border border-blue-200 rounded hover:bg-blue-50"
                >
                  {t('previewAndPrint')}
                </button>
              ),
            },
          ]}
        />
      </div>

      {/* Printable Certificate Preview */}
      <div className="space-y-2">
        <div className="flex items-center justify-between no-print">
          <h3 className="font-display font-bold text-sm text-slate-950">
            {previewCert ? t('printableCertTitle', { num: previewCert.certificate_number }) : t('templatePreviewTitle')}
          </h3>
          {previewCert && (
            <button type="button" onClick={() => setPreviewCert(null)} className="text-xs text-blue-700 hover:underline">
              {t('switchDraftPreviewBtn')}
            </button>
          )}
        </div>
        {renderCertificateCanvas(previewCert)}
      </div>
    </div>
  );
};
