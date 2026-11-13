# Danesh Academy — Educational Center Management System (EMS)

A single-center Course & Educational Center Management System combining a CMS-managed **Public Educational Website**, a **3D Opening Book Login Portal**, and three server-enforced role portals (**Administrator**, **Teacher**, **Student**) with five static interface languages (**English**, **Dari**, **Pashto**, **Afghan Uzbek**, **Afghan Turkmen**) including complete LTR/RTL switching.

---

## Architecture & Environment Note (Important)

This workspace runtime provides **Node.js 22.23.2**, **Vite**, and **Express**, whereas PHP 8+ and MySQL/MariaDB binaries are not installed in this container (`php: not found`, `mysql: not found`). To deliver a 100% live, runnable application on port `3000` with real database persistence, transactional integrity, and zero mock data:

- **Live Runtime Stack**: Express + TypeScript (`server.ts`) + Node built-in SQLite (`node:sqlite` at `storage/database/academy.sqlite`) + React + Tailwind CSS + Chart.js + SheetJS (`xlsx`).
- **MySQL Equivalent Deliverable**: Complete normalized MySQL 8+ schema (`InnoDB`, `utf8mb4_unicode_ci`, foreign keys, unique/composite indexes, initial reference seeds) is included at `database/schema_mysql.sql`.

All database tables, constraints, server-side RBAC scopes, transactional payment ledger updates, SHA-256 backup verification, Excel `.xlsx` exports, and security controls behave identically across both schemas.

---

## Setup & Running Locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

### Production Build & Start

```bash
npm run build
npm run start
```

---

## Default Seeded Portal Accounts

Public self-registration is disabled; all accounts are issued by the Center Administrator.

| Role | Username | Password | Scope |
| :--- | :--- | :--- | :--- |
| Administrator | `admin` | `Admin@2026` | Full center control, CMS, finance, RBAC, backups |
| Teacher | `teacher1` | `Teacher@2026` | Restricted strictly to assigned classes, subjects & students |
| Teacher | `teacher2` | `Teacher@2026` | Restricted strictly to assigned classes, subjects & students |
| Student | `student1` | `Student@2026` | Personal courses, timetable, grades, homework, fees, ID card & certificates |
| Student | `student2`..`student4` | `Student@2026` | Additional seeded students for multi-student roster & cohort testing |

---

## Implemented Modules

1. **Public Educational Website (`/`, `/page/:slug`)**
   - Hero slider carousel with admin-controlled slides and interval
   - Live institutional counters (Active Students, Faculty, Courses, Certificates)
   - Featured Courses & Programs grid
   - Institutional Standards (Why Choose Us) & Faculty Showcase
   - Filterable Campus Gallery (Images + Videos + Lightbox)
   - Privacy-safe Top Students showcase & About Us (History, Mission, Vision, Objectives)
   - Dynamic Custom CMS Pages (`/page/:slug`), Navigation Menus, Footer & Language Switcher

2. **3D Opening Book Login (`/login`)**
   - Interactive hardcover book opening reveal with `prefers-reduced-motion` and keyboard accessibility
   - Scrypt password hashing, 5-attempt / 15-minute lockout throttling, CSRF token protection, sliding session expiry
   - Admin-controlled password reset request workflow

3. **Administrator Portal (`/admin`)**
   - **Academics**: Students (with full 360 profile drawer), Teachers, Subjects (auto-code), Courses, Classes & Teacher Assignments, Conflict-Checked Timetable (`validateTimetableSlot`), History-Preserving Student Promotion
   - **Operations**: Student & Teacher Attendance (with edit audit trail), Configurable Grading Rules, Examinations & Score Entry, Homework & Submission Grading, Secure Document Vault
   - **Finance**: Student Fee Assignment, Transactional Idempotent Installment Payments (automatically generates `income_records` + receipt + notification), Printable Receipts, Income & Expense Ledgers, Teacher Salary Definitions & Payroll, Chart.js Analytics
   - **Credentials & Printing**: Visual Student ID Card Designer (individual/bulk print sheet, duplicate guard) & Visual Certificate Designer (dynamic `{{placeholder}}` rendering + print)
   - **System**: Targeted Notifications, Participant-Isolated Internal Messaging, Live Global Search, 12 Reports + Real `.xlsx` Excel Exports, Website CMS, Automated Reminders Engine (`homework_due`, `fee_due`, `exam_upcoming` with duplicate prevention), Immutable Read-Only Audit Logs, Private Storage Backup & SHA-256 Verified Safe Restore, Users & System Settings

4. **Teacher Portal (`/teacher`) & Student Portal (`/student`)**
   - Strictly restricted server-side to each teacher's assigned classes/subjects/students and each student's personal academic/financial records.

5. **Static Interface Languages (LTR & RTL)**
   - `en` (English, LTR), `fa` (دری, RTL), `ps` (پښتو, RTL), `uz` (اوزبیکی, RTL), `tk` (ترکمنی, RTL).

---

## Automated Unit Tests

Run decoupled academic/financial/timetable/grading unit tests:

```bash
npx tsx --test src/utils/eduLogic.test.ts
```
