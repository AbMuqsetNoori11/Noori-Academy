import React, { useEffect, useRef, useState } from 'react';
import {
  Award,
  BarChart3,
  Bell,
  BookOpen,
  CalendarClock,
  CheckCheck,
  ChevronDown,
  ClipboardCheck,
  CreditCard,
  DatabaseBackup,
  FileSpreadsheet,
  FileText,
  FolderLock,
  Globe,
  GraduationCap,
  History,
  IdCard,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquare,
  Search,
  Settings,
  TrendingUp,
  User,
  UserCheck,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useI18n } from '../../i18n';
import { LanguageSwitcher } from '../ui/LanguageSwitcher';
import { BrandLogo } from '../ui/BrandLogo';
import { UserAvatar } from '../ui/UserAvatar';
import { apiRequest } from '../../utils/api';

export interface NavGroup {
  id: string;
  label: string;
  items: Array<{
    key: string;
    label: string;
    icon: React.ReactNode;
  }>;
}

interface PortalLayoutProps {
  activeSection: string;
  onSelectSection: (key: string) => void;
  onNavigatePublic: () => void;
  children: React.ReactNode;
}

export const PortalLayout: React.FC<PortalLayoutProps> = ({
  activeSection,
  onSelectSection,
  onNavigatePublic,
  children,
}) => {
  const { user, branding, logout } = useAuth();
  const { t, tRole, tSearchType } = useI18n();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [showSearchDrop, setShowSearchDrop] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const activeItemRef = useRef<HTMLButtonElement | null>(null);

  const navGroups: NavGroup[] =
    user?.role === 'admin'
      ? [
          {
            id: 'overview',
            label: t('menuOverview'),
            items: [{ key: 'overview', label: t('menuOverview'), icon: <LayoutDashboard className="w-4 h-4" /> }],
          },
          {
            id: 'academics',
            label: t('menuAcademics'),
            items: [
              { key: 'students', label: t('menuStudents'), icon: <Users className="w-4 h-4" /> },
              { key: 'teachers', label: t('menuTeachers'), icon: <UserCheck className="w-4 h-4" /> },
              { key: 'academics', label: t('menuSubjectsAndCourses'), icon: <BookOpen className="w-4 h-4" /> },
              { key: 'classes', label: t('menuClasses'), icon: <GraduationCap className="w-4 h-4" /> },
              { key: 'timetable', label: t('menuTimetable'), icon: <CalendarClock className="w-4 h-4" /> },
              { key: 'promotions', label: t('menuPromotions'), icon: <TrendingUp className="w-4 h-4" /> },
            ],
          },
          {
            id: 'operations',
            label: t('menuOperations'),
            items: [
              { key: 'attendance', label: t('menuAttendance'), icon: <ClipboardCheck className="w-4 h-4" /> },
              { key: 'exams', label: t('menuExams'), icon: <FileSpreadsheet className="w-4 h-4" /> },
              { key: 'homework', label: t('menuHomework'), icon: <FileText className="w-4 h-4" /> },
            ],
          },
          {
            id: 'finance',
            label: t('menuFinanceGroup'),
            items: [
              { key: 'finance', label: t('menuFinance'), icon: <CreditCard className="w-4 h-4" /> },
              { key: 'accounting', label: t('menuAccounting'), icon: <Wallet className="w-4 h-4" /> },
              { key: 'salaries', label: t('menuSalaries'), icon: <BarChart3 className="w-4 h-4" /> },
            ],
          },
          {
            id: 'credentials',
            label: t('menuCredentials'),
            items: [
              { key: 'id-cards', label: t('menuIdCards'), icon: <IdCard className="w-4 h-4" /> },
              { key: 'certificates', label: t('menuCertificates'), icon: <Award className="w-4 h-4" /> },
              { key: 'documents', label: t('menuDocuments'), icon: <FolderLock className="w-4 h-4" /> },
            ],
          },
          {
            id: 'comms',
            label: t('menuComms'),
            items: [
              { key: 'notifications', label: t('menuNotifications'), icon: <Bell className="w-4 h-4" /> },
              { key: 'messages', label: t('menuMessages'), icon: <MessageSquare className="w-4 h-4" /> },
            ],
          },
          {
            id: 'system',
            label: t('menuSystemGroup'),
            items: [
              { key: 'cms', label: t('menuWebsiteCms'), icon: <Globe className="w-4 h-4" /> },
              { key: 'reports', label: t('menuReports'), icon: <FileSpreadsheet className="w-4 h-4" /> },
              { key: 'reminders', label: t('menuReminders'), icon: <Bell className="w-4 h-4" /> },
              { key: 'audit-logs', label: t('menuAuditLogs'), icon: <History className="w-4 h-4" /> },
              { key: 'backups', label: t('menuBackups'), icon: <DatabaseBackup className="w-4 h-4" /> },
              { key: 'settings', label: t('menuSettings'), icon: <Settings className="w-4 h-4" /> },
              { key: 'profile', label: t('menuProfile'), icon: <User className="w-4 h-4" /> },
            ],
          },
        ]
      : user?.role === 'teacher'
      ? [
          {
            id: 'overview',
            label: t('menuOverview'),
            items: [{ key: 'overview', label: t('menuOverview'), icon: <LayoutDashboard className="w-4 h-4" /> }],
          },
          {
            id: 'teaching',
            label: t('menuAcademics'),
            items: [
              { key: 'classes', label: t('menuClasses'), icon: <Users className="w-4 h-4" /> },
              { key: 'timetable', label: t('menuTimetable'), icon: <CalendarClock className="w-4 h-4" /> },
              { key: 'attendance', label: t('menuAttendance'), icon: <ClipboardCheck className="w-4 h-4" /> },
              { key: 'homework', label: t('menuHomework'), icon: <FileText className="w-4 h-4" /> },
              { key: 'exams', label: t('menuExams'), icon: <FileSpreadsheet className="w-4 h-4" /> },
              { key: 'reports', label: t('menuReports'), icon: <BarChart3 className="w-4 h-4" /> },
            ],
          },
          {
            id: 'comms',
            label: t('menuComms'),
            items: [
              { key: 'notifications', label: t('menuNotifications'), icon: <Bell className="w-4 h-4" /> },
              { key: 'messages', label: t('menuMessages'), icon: <MessageSquare className="w-4 h-4" /> },
              { key: 'profile', label: t('menuProfile'), icon: <Settings className="w-4 h-4" /> },
            ],
          },
        ]
      : [
          {
            id: 'overview',
            label: t('menuOverview'),
            items: [{ key: 'overview', label: t('menuOverview'), icon: <LayoutDashboard className="w-4 h-4" /> }],
          },
          {
            id: 'learning',
            label: t('menuAcademics'),
            items: [
              { key: 'timetable', label: t('menuTimetable'), icon: <CalendarClock className="w-4 h-4" /> },
              { key: 'attendance', label: t('menuAttendance'), icon: <ClipboardCheck className="w-4 h-4" /> },
              { key: 'exams', label: t('menuExams'), icon: <FileSpreadsheet className="w-4 h-4" /> },
              { key: 'homework', label: t('menuHomework'), icon: <FileText className="w-4 h-4" /> },
            ],
          },
          {
            id: 'finance',
            label: t('menuFinanceGroup'),
            items: [
              { key: 'finance', label: t('menuFinance'), icon: <CreditCard className="w-4 h-4" /> },
            ],
          },
          {
            id: 'comms',
            label: t('menuComms'),
            items: [
              { key: 'notifications', label: t('menuNotifications'), icon: <Bell className="w-4 h-4" /> },
              { key: 'messages', label: t('menuMessages'), icon: <MessageSquare className="w-4 h-4" /> },
              { key: 'profile', label: t('menuProfile'), icon: <Settings className="w-4 h-4" /> },
            ],
          },
        ];

  // Auto-expand group containing active item & scroll active item into view
  useEffect(() => {
    const activeGroup = navGroups.find((g) => g.items.some((i) => i.key === activeSection));
    if (activeGroup) {
      setOpenGroups((prev) => ({ ...prev, [activeGroup.id]: true }));
    }
    setTimeout(() => {
      activeItemRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }, 60);
  }, [activeSection]);

  const loadNotifications = async () => {
    try {
      const data = await apiRequest<{ notifications: any[]; unreadCount: number }>('/api/comms/notifications');
      setNotifications(data.notifications || []);
      setUnreadCount(data.unreadCount || 0);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    void loadNotifications();
  }, [activeSection]);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(() => {
      apiRequest<{ results: any[] }>(`/api/comms/search?q=${encodeURIComponent(searchQuery.trim())}`)
        .then((d) => {
          setSearchResults(d.results || []);
          setShowSearchDrop(true);
        })
        .catch(() => {});
    }, 220);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const markAllRead = async () => {
    await apiRequest('/api/comms/notifications/read-all', { method: 'POST' });
    void loadNotifications();
  };

  const activeLabel =
    navGroups.flatMap((g) => g.items).find((i) => i.key === activeSection)?.label || t('menuOverview');

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Mobile Sidebar Backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-950/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Collapsible Sidebar */}
      <aside
        className={`fixed lg:sticky top-0 inset-y-0 start-0 z-50 w-68 h-screen bg-slate-950 text-slate-200 flex flex-col border-e border-slate-800 transition-transform duration-200 lg:translate-x-0 lg:rtl:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full rtl:translate-x-full'
        }`}
      >
        <div className="h-16 px-4 flex items-center justify-between border-b border-slate-800 shrink-0">
          <button
            type="button"
            onClick={() => onSelectSection('overview')}
            className="inline-flex items-center gap-2.5 font-display text-base font-bold text-white tracking-tight min-w-0"
          >
            <BrandLogo
              logoUrl={branding.site_logo_url}
              alt={branding.site_name || t('appName')}
              sizeClass="w-8 h-8"
              iconClass="w-4 h-4"
            />
            <span className="truncate">{branding.site_name || t('appName')}</span>
          </button>
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            aria-label={t('closeSidebar')}
            className="lg:hidden p-1.5 text-slate-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <button
          type="button"
          onClick={() => {
            onSelectSection('profile');
            setSidebarOpen(false);
          }}
          className="w-full text-start px-4 py-3 border-b border-slate-800/80 text-xs text-slate-400 hover:bg-slate-900/70 transition-colors flex items-center gap-3"
        >
          <UserAvatar
            photoUrl={user?.photo_url}
            name={user?.full_name || user?.username || 'U'}
            sizeClass="w-9 h-9"
            textClass="text-xs"
          />
          <div className="min-w-0 flex-1">
            <div className="font-semibold text-white truncate">{user?.full_name}</div>
            <div className="mt-0.5 text-slate-400 truncate">
              {tRole(user?.role)} · {user?.username}
            </div>
          </div>
        </button>

        <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-1.5">
          {navGroups.map((group) => {
            const isOpen = openGroups[group.id] ?? group.id === 'overview';
            if (group.items.length === 1 && group.id === 'overview') {
              const item = group.items[0];
              const isActive = activeSection === item.key;
              return (
                <button
                  key={item.key}
                  ref={isActive ? activeItemRef : undefined}
                  type="button"
                  onClick={() => {
                    onSelectSection(item.key);
                    setSidebarOpen(false);
                  }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive ? 'bg-blue-700 text-white' : 'text-slate-300 hover:bg-slate-900 hover:text-white'
                  }`}
                >
                  {item.icon}
                  <span className="truncate">{item.label}</span>
                </button>
              );
            }

            return (
              <div key={group.id} className="pt-1">
                <button
                  type="button"
                  aria-expanded={isOpen}
                  onClick={() => setOpenGroups((prev) => ({ ...prev, [group.id]: !isOpen }))}
                  className="w-full flex items-center justify-between px-3 py-1.5 text-xs font-semibold text-slate-400 hover:text-slate-200 transition-colors"
                >
                  <span className="truncate">{group.label}</span>
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
                </button>
                {isOpen && (
                  <div className="mt-1 space-y-0.5 ps-1">
                    {group.items.map((item) => {
                      const isActive = activeSection === item.key;
                      return (
                        <button
                          key={item.key}
                          ref={isActive ? activeItemRef : undefined}
                          type="button"
                          onClick={() => {
                            onSelectSection(item.key);
                            setSidebarOpen(false);
                          }}
                          className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                            isActive ? 'bg-blue-700 text-white font-semibold' : 'text-slate-300 hover:bg-slate-900 hover:text-white'
                          }`}
                        >
                          {item.icon}
                          <span className="truncate">{item.label}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        <div className="p-3 border-t border-slate-800 space-y-1 shrink-0">
          <button
            type="button"
            onClick={onNavigatePublic}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-slate-300 hover:bg-slate-900 hover:text-white"
          >
            <Globe className="w-4 h-4" />
            <span>{t('backToWebsite')}</span>
          </button>
          <button
            type="button"
            onClick={() => void logout()}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-red-300 hover:bg-red-950/60 hover:text-red-200"
          >
            <LogOut className="w-4 h-4" />
            <span>{t('logout')}</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="sticky top-0 z-30 h-16 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between gap-4 app-topbar">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              aria-label={t('openMenu')}
              className="lg:hidden p-2 rounded-lg border border-slate-200 text-slate-700"
            >
              <Menu className="w-5 h-5" />
            </button>
            <nav aria-label={t('menuOverview')} className="flex items-center gap-2 text-sm min-w-0">
              <span className="text-slate-500 hidden sm:inline">{tRole(user?.role)}</span>
              <span className="text-slate-400 hidden sm:inline">/</span>
              <span className="font-display font-bold text-slate-950 truncate">{activeLabel}</span>
            </nav>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            {/* Live Global Search */}
            <div className="relative hidden md:block w-64">
              <Search className="w-4 h-4 text-slate-400 absolute start-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => searchResults.length > 0 && setShowSearchDrop(true)}
                onBlur={() => setTimeout(() => setShowSearchDrop(false), 180)}
                placeholder={t('search')}
                className="w-full ps-9 pe-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:bg-white focus:border-blue-700"
              />
              {showSearchDrop && searchResults.length > 0 && (
                <div className="absolute top-full mt-1 inset-x-0 bg-white border border-slate-200 rounded-lg shadow-lg z-50 max-h-64 overflow-y-auto">
                  {searchResults.map((r, i) => (
                    <button
                      key={i}
                      type="button"
                      onMouseDown={() => {
                        const target = r.url.split('/').pop() || 'overview';
                        onSelectSection(target);
                        setSearchQuery('');
                        setShowSearchDrop(false);
                      }}
                      className="w-full text-start px-3 py-2 hover:bg-slate-50 border-b border-slate-100 last:border-none"
                    >
                      <div className="text-xs font-semibold text-slate-900">{r.title}</div>
                      <div className="text-[11px] text-slate-500">
                        {tSearchType(r.type)} · {r.subtitle}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <LanguageSwitcher compact />

            {/* Notification Center Trigger */}
            <div className="relative">
              <button
                type="button"
                aria-label={t('menuNotifications')}
                onClick={() => setNotifOpen((v) => !v)}
                className="relative p-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700"
              >
                <Bell className="w-4 h-4" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -end-1 min-w-[18px] h-[18px] px-1 rounded-full bg-blue-700 text-white text-[10px] font-bold flex items-center justify-center tabular-nums">
                    {unreadCount}
                  </span>
                )}
              </button>
              {notifOpen && (
                <div className="absolute end-0 top-full mt-2 w-80 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-200 bg-slate-50">
                    <span className="text-xs font-bold text-slate-900">{t('menuNotifications')}</span>
                    <button
                      type="button"
                      onClick={() => void markAllRead()}
                      className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-700 hover:underline"
                    >
                      <CheckCheck className="w-3.5 h-3.5" />
                      <span>{t('markAllRead')}</span>
                    </button>
                  </div>
                  <div className="max-h-72 overflow-y-auto divide-y divide-slate-100">
                    {notifications.length === 0 ? (
                      <div className="p-4 text-xs text-slate-500 text-center">{t('noRecords')}</div>
                    ) : (
                      notifications.slice(0, 8).map((n) => (
                        <button
                          key={n.id}
                          type="button"
                          onClick={() => {
                            setNotifOpen(false);
                            onSelectSection('notifications');
                          }}
                          className={`w-full text-start px-4 py-2.5 hover:bg-slate-50 ${n.is_read ? 'opacity-70' : 'bg-blue-50/40'}`}
                        >
                          <div className="text-xs font-semibold text-slate-900">{n.title}</div>
                          <div className="text-[11px] text-slate-600 mt-0.5 line-clamp-2">{n.message}</div>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
            {/* Profile Quick Link Avatar */}
            <button
              type="button"
              onClick={() => onSelectSection('profile')}
              aria-label={t('menuProfile')}
              className="inline-flex items-center gap-2 p-1 pe-2 rounded-full border border-slate-200 bg-white hover:bg-slate-50 transition-colors"
            >
              <UserAvatar
                photoUrl={user?.photo_url}
                name={user?.full_name || user?.username || 'U'}
                sizeClass="w-7 h-7"
                textClass="text-[10px]"
              />
              <span className="hidden xl:inline text-xs font-medium text-slate-700 max-w-[120px] truncate">
                {user?.full_name}
              </span>
            </button>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 max-w-[1440px] w-full mx-auto">{children}</main>
      </div>
    </div>
  );
};
