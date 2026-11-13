import React, { useRef, useState } from 'react';
import { CheckCircle2, Upload } from 'lucide-react';
import { uploadFile, uploadImage } from '../../utils/api';
import { isAllowedImageUpload } from '../../utils/eduLogic';
import { useI18n } from '../../i18n';

interface FileUploaderProps {
  label?: string;
  accept?: string;
  imageOnly?: boolean;
  onUploaded: (meta: { url: string; original_name: string; mime_type: string; file_size: number }) => void;
}

export const FileUploader: React.FC<FileUploaderProps> = ({ label, accept, imageOnly = false, onUploaded }) => {
  const { t, translateServerError } = useI18n();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploadedName, setUploadedName] = useState<string>('');
  const [err, setErr] = useState<string>('');

  const handleFile = async (file?: File | null) => {
    if (!file) return;
    setErr('');
    if (imageOnly) {
      if (!isAllowedImageUpload(file.name, file.type)) {
        setErr(t('invalidImageTypeErr'));
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        setErr(t('imageTooLargeErr'));
        return;
      }
    }
    setBusy(true);
    try {
      const res = imageOnly ? await uploadImage(file) : await uploadFile(file);
      setUploadedName(res.original_name);
      onUploaded(res);
    } catch (e: any) {
      setErr(e?.message ? translateServerError(e.message) : t('uploadFailed'));
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        void handleFile(e.dataTransfer.files?.[0]);
      }}
      className="border border-dashed border-slate-300 rounded-lg p-3 bg-slate-50/70 hover:bg-slate-100/60 transition-colors"
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept || (imageOnly ? '.jpg,.jpeg,.png,.webp,.gif,image/jpeg,image/png,image/webp,image/gif' : undefined)}
        className="hidden"
        onChange={(e) => void handleFile(e.target.files?.[0])}
      />
      <button
        type="button"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
        className="w-full flex items-center justify-center gap-2 text-xs font-medium text-slate-700 py-1.5"
      >
        {uploadedName ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <Upload className="w-4 h-4 text-blue-700" />}
        <span>{busy ? t('uploading') : uploadedName || label || t('dropOrClickUpload')}</span>
      </button>
      {err && <p className="mt-1 text-xs text-red-600 text-center">{err}</p>}
    </div>
  );
};

