import React, { useMemo, useState } from 'react';
import { ArrowDownUp, ChevronLeft, ChevronRight, FileSpreadsheet, Printer, Search } from 'lucide-react';
import { useI18n } from '../../i18n';

export interface Column<T> {
  key: string;
  header: string;
  sortValue?: (row: T) => string | number;
  render: (row: T) => React.ReactNode;
  align?: 'start' | 'end';
}

interface DataTableProps<T> {
  rows: T[];
  columns: Column<T>[];
  searchPlaceholder?: string;
  filterTextFn?: (row: T) => string;
  pageSize?: number;
  onExportExcel?: () => void;
  onPrint?: () => void;
  extraControls?: React.ReactNode;
  emptyText?: string;
}

export function DataTable<T extends Record<string, any> = Record<string, any>>({
  rows,
  columns,
  searchPlaceholder,
  filterTextFn,
  pageSize = 10,
  onExportExcel,
  onPrint,
  extraControls,
  emptyText,
}: DataTableProps<T>) {
  const { t } = useI18n();
  const [query, setQuery] = useState('');
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) => {
      if (filterTextFn) return filterTextFn(row).toLowerCase().includes(q);
      return JSON.stringify(row).toLowerCase().includes(q);
    });
  }, [rows, query, filterTextFn]);

  const sorted = useMemo(() => {
    if (!sortKey) return filtered;
    const col = columns.find((c) => c.key === sortKey);
    if (!col?.sortValue) return filtered;
    const getter = col.sortValue;
    return [...filtered].sort((a, b) => {
      const va = getter(a);
      const vb = getter(b);
      if (typeof va === 'number' && typeof vb === 'number') {
        return sortDir === 'asc' ? va - vb : vb - va;
      }
      return sortDir === 'asc'
        ? String(va).localeCompare(String(vb))
        : String(vb).localeCompare(String(va));
    });
  }, [filtered, sortKey, sortDir, columns]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageRows = sorted.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const toggleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-slate-200 bg-slate-50/60 no-print">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="w-4 h-4 text-slate-400 absolute start-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
            placeholder={searchPlaceholder || t('search')}
            className="w-full ps-9 pe-3 py-1.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700/20 focus:border-blue-700"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {extraControls}
          {onExportExcel && (
            <button
              type="button"
              onClick={onExportExcel}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 whitespace-nowrap shrink-0"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700" />
              {t('exportExcel')}
            </button>
          )}
          {onPrint && (
            <button
              type="button"
              onClick={onPrint}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 whitespace-nowrap shrink-0"
            >
              <Printer className="w-3.5 h-3.5 text-slate-600" />
              {t('print')}
            </button>
          )}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm text-start border-collapse">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 text-xs font-semibold">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`px-4 py-2.5 whitespace-nowrap ${col.align === 'end' ? 'text-end' : 'text-start'}`}
                >
                  {col.sortValue ? (
                    <button
                      type="button"
                      onClick={() => toggleSort(col.key)}
                      className="inline-flex items-center gap-1 hover:text-slate-900"
                    >
                      <span>{col.header}</span>
                      <ArrowDownUp className="w-3 h-3 text-slate-400" />
                    </button>
                  ) : (
                    col.header
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {pageRows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-10 text-center text-slate-500">
                  {emptyText || t('noRecords')}
                </td>
              </tr>
            ) : (
              pageRows.map((row, idx) => (
                <tr key={row.id ?? idx} className="hover:bg-slate-50/70 transition-colors">
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={`px-4 py-2.5 text-slate-700 align-middle ${col.align === 'end' ? 'text-end tabular-nums' : 'text-start'}`}
                    >
                      {col.render(row)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {sorted.length > pageSize && (
        <div className="flex items-center justify-between px-4 py-2.5 border-t border-slate-200 bg-slate-50/50 text-xs text-slate-600 no-print">
          <span className="tabular-nums">
            {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, sorted.length)} / {sorted.length}
          </span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              aria-label={t('previousPage')}
              className="p-1.5 rounded border border-slate-300 bg-white disabled:opacity-40 hover:bg-slate-50"
            >
              <ChevronLeft className="w-3.5 h-3.5 rtl:rotate-180" />
            </button>
            <span className="px-2 tabular-nums font-medium">
              {currentPage} / {totalPages}
            </span>
            <button
              type="button"
              disabled={currentPage >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              aria-label={t('nextPage')}
              className="p-1.5 rounded border border-slate-300 bg-white disabled:opacity-40 hover:bg-slate-50"
            >
              <ChevronRight className="w-3.5 h-3.5 rtl:rotate-180" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
