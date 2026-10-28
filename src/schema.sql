-- C-fit Gym Management System Database Schema
-- File: src/schema.sql

-- 1. System Users / Staff Credentials
CREATE TABLE IF NOT EXISTS admin (
    username TEXT PRIMARY KEY,
    password TEXT NOT NULL,
    role TEXT DEFAULT 'Admin access'
);

-- Staff Accounts & Role Control
CREATE TABLE IF NOT EXISTS staff_users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    full_name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'Staff',
    email TEXT,
    phone TEXT,
    shift TEXT DEFAULT 'Morning',
    status TEXT DEFAULT 'Active',
    can_manage_members INTEGER DEFAULT 1,
    can_process_payments INTEGER DEFAULT 1,
    can_manage_classes INTEGER DEFAULT 1,
    can_manage_trainers INTEGER DEFAULT 1,
    created_at TEXT NOT NULL
);

-- 2. Trainers Table
CREATE TABLE IF NOT EXISTS trainers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    trainer_code TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    specialty TEXT NOT NULL,
    rating REAL DEFAULT 5.0
);

-- 3. Gym Members Table
CREATE TABLE IF NOT EXISTS members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    member_id TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    plan_type TEXT NOT NULL,           -- e.g., Gold, Silver, Platinum
    trainer_id INTEGER,
    trainer_name TEXT,
    join_date TEXT NOT NULL,            -- YYYY-MM-DD
    expiry_date TEXT NOT NULL,          -- YYYY-MM-DD
    status TEXT NOT NULL,               -- Active, Expiring, Paused, Expired
    FOREIGN KEY (trainer_id) REFERENCES trainers(id)
);

-- 4. Attendance / Check-in Logs
CREATE TABLE IF NOT EXISTS attendance (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    member_id TEXT NOT NULL,
    check_in_time TEXT NOT NULL,        -- YYYY-MM-DD HH:MM:SS
    check_out_time TEXT,                -- YYYY-MM-DD HH:MM:SS or NULL
    check_in_method TEXT NOT NULL,      -- RFID card, Fingerprint, QR code
    FOREIGN KEY (member_id) REFERENCES members(member_id)
);

-- 5. Payments & Billing Records
CREATE TABLE IF NOT EXISTS payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    member_id TEXT NOT NULL,
    plan_description TEXT NOT NULL,
    amount REAL NOT NULL,
    due_date TEXT NOT NULL,             -- YYYY-MM-DD
    payment_status TEXT NOT NULL,       -- Paid, Overdue, Pending
    FOREIGN KEY (member_id) REFERENCES members(member_id)
);

-- 6. Class Schedule Table
CREATE TABLE IF NOT EXISTS classes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    class_name TEXT NOT NULL,
    trainer_id INTEGER NOT NULL,
    studio_location TEXT NOT NULL,
    start_time TEXT NOT NULL,           -- e.g., '06:00 AM'
    max_capacity INTEGER NOT NULL,
    booked_count INTEGER DEFAULT 0,
    FOREIGN KEY (trainer_id) REFERENCES trainers(id)
);

-- 7. Class Bookings (Roster)
CREATE TABLE IF NOT EXISTS class_bookings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    class_id INTEGER NOT NULL,
    member_id TEXT NOT NULL,
    booked_at TEXT NOT NULL,
    FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
    FOREIGN KEY (member_id) REFERENCES members(member_id) ON DELETE CASCADE,
    UNIQUE(class_id, member_id)
);

-- Default Staff & Sample Data Initializers
-- Default Staff & Sample Data Initializers
INSERT OR IGNORE INTO admin (username, password, role) 
VALUES ('admin', 'admin123', 'Admin access'),
       ('staff', 'staff123', 'Staff access'),
       ('adhil', 'adhil123', 'Staff access'),
       ('dnv', 'dnv123', 'Staff access'),
       ('balu', 'balu123', 'Staff access'),
       ('abhiram', 'abhiram123', 'Staff access');

INSERT OR IGNORE INTO staff_users (id, username, password, full_name, role, email, phone, shift, status, can_manage_members, can_process_payments, can_manage_classes, can_manage_trainers, created_at)
VALUES (1, 'admin', 'admin123', 'JOVIN', 'Admin', 'admin@cfitgym.com', '+91 98470 11223', 'Full Day', 'Active', 1, 1, 1, 1, '2025-01-01 00:00:00'),
       (2, 'staff', 'staff123', 'staff', 'Staff', 'staff@cfitgym.com', '+91 98470 44556', 'Morning', 'Active', 1, 1, 1, 1, '2025-03-15 08:30:00'),
       (3, 'adhil', 'adhil123', 'adhil', 'Staff', 'adhil@cfitgym.com', '+91 94471 22334', 'Morning', 'Active', 1, 1, 1, 1, '2025-06-20 14:00:00'),
       (4, 'dnv', 'dnv123', 'DNV', 'Staff', 'dnv@cfitgym.com', '+91 98950 33445', 'Evening', 'Active', 1, 1, 1, 1, '2025-08-10 09:15:00'),
       (5, 'balu', 'balu123', 'balu', 'Staff', 'balu@cfitgym.com', '+91 98472 55667', 'Evening', 'Active', 1, 1, 1, 1, '2025-09-01 10:00:00'),
       (6, 'abhiram', 'abhiram123', 'abhiram', 'Staff', 'abhiram@cfitgym.com', '+91 98473 66778', 'Full Day', 'Active', 1, 1, 1, 1, '2025-09-15 11:30:00');

-- Seed Mock Trainers
INSERT OR IGNORE INTO trainers (id, trainer_code, full_name, specialty, rating) 
VALUES (1, 'TR-01', 'Vikram Sethi', 'Strength & Bodybuilding', 4.9),
       (2, 'TR-02', 'Sneha Pillai', 'Cardio & HIIT Conditioning', 4.8),
       (3, 'TR-03', 'Anand Jacob', 'CrossFit & Olympic Lifting', 4.7),
       (4, 'TR-04', 'Meera Varma', 'Yoga & Flexibility', 4.9);

-- Seed Mock Members
INSERT OR IGNORE INTO members (id, member_id, full_name, plan_type, trainer_id, trainer_name, join_date, expiry_date, status)
VALUES (1, 'GYM-0101', 'neeraj', 'Gold', 1, 'Vikram Sethi', '2025-11-15', '2026-11-15', 'Active'),
       (2, 'GYM-0102', 'abin', 'Platinum', 2, 'Sneha Pillai', '2026-01-10', '2027-01-10', 'Active'),
       (3, 'GYM-0103', 'sadi', 'Silver', 3, 'Anand Jacob', '2026-03-01', '2026-09-01', 'Active'),
       (4, 'GYM-0104', 'vinod', 'Gold', 1, 'Vikram Sethi', '2025-12-05', '2026-12-05', 'Active'),
       (5, 'GYM-0105', 'farzan', 'Platinum', 2, 'Sneha Pillai', '2026-04-12', '2027-04-12', 'Active');

-- Seed Mock Attendance Logs
INSERT OR IGNORE INTO attendance (id, member_id, check_in_time, check_out_time, check_in_method)
VALUES (1, 'GYM-0101', '2026-10-19 06:15:00', '2026-10-19 07:30:00', 'Reception Desk'),
       (2, 'GYM-0102', '2026-10-19 07:05:00', NULL, 'Reception Desk'),
       (3, 'GYM-0103', '2026-10-18 17:30:00', '2026-10-18 18:45:00', 'Reception Desk'),
       (4, 'GYM-0104', '2026-10-19 08:15:00', '2026-10-19 09:20:00', 'Reception Desk'),
       (5, 'GYM-0105', '2026-10-19 09:00:00', NULL, 'Reception Desk');

-- Seed Mock Payments
INSERT OR IGNORE INTO payments (id, member_id, plan_description, amount, due_date, payment_status)
VALUES (1, 'GYM-0101', 'Gold — monthly', 2500, '2026-10-15', 'Paid'),
       (2, 'GYM-0102', 'Platinum — annual', 28000, '2026-10-01', 'Paid'),
       (3, 'GYM-0103', 'Silver — monthly', 1800, '2026-10-10', 'Paid'),
       (4, 'GYM-0104', 'Gold — 6 month', 14000, '2026-10-25', 'Paid'),
       (5, 'GYM-0105', 'Platinum — monthly', 3500, '2026-10-24', 'Pending');

-- Seed Mock Class Schedule
INSERT OR IGNORE INTO classes (id, class_name, trainer_id, studio_location, start_time, max_capacity, booked_count)
VALUES (1, 'CrossFit Power Hour', 1, 'Studio A (Ground)', '06:30 AM', 15, 1),
       (2, 'HIIT Conditioning Blitz', 2, 'Studio B (Level 1)', '07:30 AM', 20, 1),
       (3, 'Power Yoga Flow', 4, 'Studio C (Level 2)', '08:30 AM', 12, 1),
       (4, 'Strength & Hypertrophy', 3, 'Studio A (Ground)', '05:30 PM', 15, 1),
       (5, 'Spin & Cardio Blast', 2, 'Studio B (Level 1)', '06:30 PM', 18, 1);

-- Seed Mock Class Bookings
INSERT OR IGNORE INTO class_bookings (id, class_id, member_id, booked_at)
VALUES (1, 1, 'GYM-0101', '2026-10-18 10:00:00'),
       (2, 2, 'GYM-0102', '2026-10-18 11:00:00'),
       (3, 3, 'GYM-0103', '2026-10-18 14:00:00'),
       (4, 4, 'GYM-0104', '2026-10-19 08:00:00'),
       (5, 5, 'GYM-0105', '2026-10-19 08:30:00');
