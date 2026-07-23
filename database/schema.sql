-- =====================================================
-- Nursephere Database Schema
-- Table: students
-- =====================================================

CREATE TABLE IF NOT EXISTS students (

    id TEXT PRIMARY KEY,

    full_name TEXT NOT NULL,

    email TEXT NOT NULL UNIQUE,

    password_hash TEXT NOT NULL,

    account_status TEXT NOT NULL DEFAULT 'active',

    trial_active INTEGER NOT NULL DEFAULT 1,

    trial_started_at TEXT NOT NULL,

    trial_expires_at TEXT NOT NULL,

    subscription_status TEXT NOT NULL DEFAULT 'trial',

    email_verified INTEGER NOT NULL DEFAULT 0,

    last_login_at TEXT,

    created_at TEXT NOT NULL,

    updated_at TEXT NOT NULL

);

-- =====================================================
-- Table: notifications
-- =====================================================

CREATE TABLE IF NOT EXISTS notifications (

    id TEXT PRIMARY KEY,

    student_id TEXT NOT NULL,

    title TEXT NOT NULL,

    message TEXT NOT NULL,

    type TEXT NOT NULL,

    is_read INTEGER NOT NULL DEFAULT 0,

    created_at TEXT NOT NULL,

    FOREIGN KEY(student_id) REFERENCES students(id)

);