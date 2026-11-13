import React, { useEffect, useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { I18nProvider, useI18n } from './i18n';
import { UiFeedbackProvider } from './components/ui/ToastAndConfirm';
import { PortalLayout } from './components/layout/PortalLayout';
import { PublicWebsite } from './pages/PublicWebsite';
import { LoginPage } from './pages/LoginPage';
import { DashboardOverview } from './components/modules/DashboardOverview';
import {
  ClassesAndAssignmentsModule,
  PromotionsModule,
  StudentsModule,
  SubjectsAndCoursesModule,
  TeachersModule,
  TimetableModule,
} from './components/modules/AcademicModules';
import {
  AttendanceModule,
  DocumentsModule,
  ExamsAndGradesModule,
  HomeworkModule,
} from './components/modules/OperationsModules';
import {
  AccountingModule,
  SalariesModule,
  StudentFeesAndPaymentsModule,
} from './components/modules/FinanceModules';
import {
  CertificateDesignerModule,
  IdCardDesignerModule,
} from './components/modules/CredentialsDesignerModules';
import {
  AuditLogsModule,
  BackupsModule,
  RemindersModule,
  UsersAndSettingsModule,
  WebsiteCmsModule,
} from './components/modules/SystemAdminModules';
import {
  MessagesView,
  NotificationsView,
  ProfileView,
  ReportsView,
} from './components/modules/SharedCommsModules';

export type PublicRouteType = 'home' | 'courses' | 'teachers' | 'gallery' | 'about' | 'contact' | 'custom';

function parseRoute(pathname: string): {
  view: 'public' | 'login' | 'portal';
  publicRoute: PublicRouteType;
  pageSlug?: string | null;
  portalRole?: 'admin' | 'teacher' | 'student';
  section: string;
} {
  const clean = pathname.replace(/\/+$/, '') || '/';
  if (clean === '/login') {
    return { view: 'login', publicRoute: 'home', section: 'overview' };
  }
  if (clean === '/courses') {
    return { view: 'public', publicRoute: 'courses', pageSlug: null, section: 'overview' };
  }
  if (clean === '/teachers') {
    return { view: 'public', publicRoute: 'teachers', pageSlug: null, section: 'overview' };
  }
  if (clean === '/gallery') {
    return { view: 'public', publicRoute: 'gallery', pageSlug: null, section: 'overview' };
  }
  if (clean === '/about') {
    return { view: 'public', publicRoute: 'about', pageSlug: null, section: 'overview' };
  }
  if (clean === '/contact') {
    return { view: 'public', publicRoute: 'contact', pageSlug: null, section: 'overview' };
  }
  if (clean.startsWith('/page/')) {
    const slug = decodeURIComponent(clean.slice('/page/'.length));
    if (slug === 'academic-calendar') {
      return { view: 'public', publicRoute: 'home', pageSlug: null, section: 'overview' };
    }
    return { view: 'public', publicRoute: 'custom', pageSlug: slug, section: 'overview' };
  }
  const match = /^\/(admin|teacher|student)(?:\/([a-z0-9-]+))?$/.exec(clean);
  if (match) {
    return {
      view: 'portal',
      publicRoute: 'home',
      portalRole: match[1] as 'admin' | 'teacher' | 'student',
      section: match[2] || 'overview',
    };
  }
  return { view: 'public', publicRoute: 'home', pageSlug: null, section: 'overview' };
}

const AppRouter: React.FC = () => {
  const { user, loading } = useAuth();
  const { t } = useI18n();
  const [pathname, setPathname] = useState<string>(() => window.location.pathname);

  const navigate = (to: string) => {
    const [targetPathRaw, targetHash] = to.split('#');
    const targetPath = targetPathRaw || '/';
    if (window.location.pathname !== targetPath) {
      window.history.pushState({}, '', targetHash ? `${targetPath}#${targetHash}` : targetPath);
      setPathname(targetPath);
    } else if (targetHash) {
      window.history.replaceState({}, '', `${targetPath}#${targetHash}`);
    }

    if (targetHash) {
      setTimeout(() => {
        const el = document.getElementById(targetHash);
        if (el) el.scrollIntoView({ behavior: 'smooth' });
      }, 60);
    } else {
      window.scrollTo({ top: 0, behavior: 'auto' });
    }
  };

  useEffect(() => {
    const onPop = () => setPathname(window.location.pathname);
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const route = parseRoute(pathname);

  // Guard protected portal routes
  useEffect(() => {
    if (loading) return;
    if (route.view === 'portal') {
      if (!user) {
        navigate('/login');
      } else if (route.portalRole && user.role !== route.portalRole) {
        navigate(`/${user.role}`);
      }
    } else if (route.view === 'login' && user) {
      navigate(`/${user.role}`);
    }
  }, [loading, user, route.view, route.portalRole]);

  if (route.view === 'login') {
    if (loading) {
      return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-300 text-sm">
          {t('loading')}
        </div>
      );
    }
    return (
      <LoginPage
        onBackToPublic={() => navigate('/')}
        onLoginSuccess={(role) => navigate(`/${role}`)}
      />
    );
  }

  if (route.view === 'portal') {
    if (loading || !user || (route.portalRole && user.role !== route.portalRole)) {
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-600 text-sm">
          {t('loading')}
        </div>
      );
    }

    const section = route.section;
    const selectSection = (nextSection: string) => {
      navigate(nextSection === 'overview' ? `/${user.role}` : `/${user.role}/${nextSection}`);
    };

    const renderSection = () => {
      if (user.role === 'admin') {
        switch (section) {
          case 'overview':
            return <DashboardOverview onNavigateSection={selectSection} />;
          case 'students':
            return <StudentsModule />;
          case 'teachers':
            return <TeachersModule />;
          case 'academics':
            return <SubjectsAndCoursesModule />;
          case 'classes':
            return <ClassesAndAssignmentsModule />;
          case 'timetable':
            return <TimetableModule />;
          case 'promotions':
            return <PromotionsModule />;
          case 'attendance':
            return <AttendanceModule />;
          case 'exams':
            return <ExamsAndGradesModule />;
          case 'homework':
            return <HomeworkModule />;
          case 'finance':
            return <StudentFeesAndPaymentsModule />;
          case 'accounting':
            return <AccountingModule />;
          case 'salaries':
            return <SalariesModule />;
          case 'id-cards':
            return <IdCardDesignerModule />;
          case 'certificates':
            return <CertificateDesignerModule />;
          case 'documents':
            return <DocumentsModule />;
          case 'notifications':
            return <NotificationsView />;
          case 'messages':
            return <MessagesView />;
          case 'cms':
            return <WebsiteCmsModule />;
          case 'reports':
            return <ReportsView />;
          case 'reminders':
            return <RemindersModule />;
          case 'audit-logs':
            return <AuditLogsModule />;
          case 'backups':
            return <BackupsModule />;
          case 'settings':
            return <UsersAndSettingsModule />;
          case 'profile':
            return <ProfileView />;
          default:
            return <DashboardOverview onNavigateSection={selectSection} />;
        }
      }

      if (user.role === 'teacher') {
        switch (section) {
          case 'overview':
            return <DashboardOverview onNavigateSection={selectSection} />;
          case 'classes':
            return <ClassesAndAssignmentsModule />;
          case 'timetable':
            return <TimetableModule />;
          case 'attendance':
            return <AttendanceModule />;
          case 'homework':
            return <HomeworkModule />;
          case 'exams':
            return <ExamsAndGradesModule />;
          case 'reports':
            return <ReportsView />;
          case 'notifications':
            return <NotificationsView />;
          case 'messages':
            return <MessagesView />;
          case 'profile':
            return <ProfileView />;
          default:
            return <DashboardOverview onNavigateSection={selectSection} />;
        }
      }

      // Student Portal
      switch (section) {
        case 'overview':
          return <DashboardOverview onNavigateSection={selectSection} />;
        case 'timetable':
          return <TimetableModule />;
        case 'attendance':
          return <AttendanceModule />;
        case 'exams':
          return <ExamsAndGradesModule />;
        case 'homework':
          return <HomeworkModule />;
        case 'finance':
          return <StudentFeesAndPaymentsModule />;
        case 'notifications':
          return <NotificationsView />;
        case 'messages':
          return <MessagesView />;
        case 'profile':
          return <ProfileView />;
        default:
          return <DashboardOverview onNavigateSection={selectSection} />;
      }
    };

    return (
      <PortalLayout
        activeSection={section}
        onSelectSection={selectSection}
        onNavigatePublic={() => navigate('/')}
      >
        {renderSection()}
      </PortalLayout>
    );
  }

  return (
    <PublicWebsite
      publicRoute={route.publicRoute}
      onNavigatePublic={(path) => navigate(path)}
      onNavigateLogin={() => navigate(user ? `/${user.role}` : '/login')}
      activePageSlug={route.pageSlug ?? null}
      onNavigatePage={(slug) => navigate(slug ? `/page/${slug}` : '/')}
    />
  );
};

export default function App() {
  return (
    <I18nProvider>
      <UiFeedbackProvider>
        <AuthProvider>
          <AppRouter />
        </AuthProvider>
      </UiFeedbackProvider>
    </I18nProvider>
  );
}
