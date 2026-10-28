-- =====================================================================
-- C-FIT GYM MANAGEMENT SYSTEM — COMPLETE MYSQL DATABASE SCHEMA & SEED DATA
-- Dialect: MySQL 8.0+ / 5.7+ / MariaDB
-- Default Database: cfit_db
-- JDBC URL: jdbc:mysql://localhost:3306/cfit_db?createDatabaseIfNotExist=true&useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=UTC
-- =====================================================================

-- 1. Create Database if not exists
CREATE DATABASE IF NOT EXISTS cfit_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE cfit_db;

-- 2. Disable Foreign Key Checks temporarily for clean recreation
SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS class_bookings;
DROP TABLE IF EXISTS attendance;
DROP TABLE IF EXISTS payments;
DROP TABLE IF EXISTS classes;
DROP TABLE IF EXISTS members;
DROP TABLE IF EXISTS trainers;
DROP TABLE IF EXISTS staff_users;
DROP TABLE IF EXISTS admin;

SET FOREIGN_KEY_CHECKS = 1;

-- ---------------------------------------------------------------------
-- TABLE 1: admin (Master System Credentials)
-- ---------------------------------------------------------------------
CREATE TABLE admin (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(50) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO admin (id, username, password_hash) VALUES
(1, 'admin', 'admin123');

-- ---------------------------------------------------------------------
-- TABLE 2: staff_users (Staff & Reception Desk Accounts)
-- ---------------------------------------------------------------------
CREATE TABLE staff_users (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(50) NOT NULL UNIQUE,
  full_name VARCHAR(100) NOT NULL,
  role VARCHAR(50) NOT NULL,
  phone VARCHAR(30) DEFAULT NULL,
  email VARCHAR(100) DEFAULT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO staff_users (id, username, full_name, role, phone, email, is_active, password_hash) VALUES
(1, 'staff', 'Staff User', 'Manager', '+91 98470 11223', 'staff@cfit.com', 1, 'staff123'),
(2, 'adhil', 'Adhil K', 'Front Desk', '+91 94471 22334', 'adhil@cfit.com', 1, 'adhil123'),
(3, 'dnv', 'DNV', 'Floor Supervisor', '+91 97452 33445', 'dnv@cfit.com', 1, 'dnv123'),
(4, 'balu', 'Balu', 'Fitness Coach', '+91 98953 44556', 'balu@cfit.com', 1, 'balu123'),
(5, 'abhiram', 'Abhiram', 'Nutritionist', '+91 96334 55667', 'abhiram@cfit.com', 1, 'abhiram123'),
(6, 'JOVIN', 'Jovin Joy', 'Chief Administrator', '+91 99465 66778', 'jovin@cfit.com', 1, 'JOVIN123');

-- ---------------------------------------------------------------------
-- TABLE 3: trainers (Certified Fitness Trainers & Coaches)
-- ---------------------------------------------------------------------
CREATE TABLE trainers (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  trainer_code VARCHAR(50) NOT NULL UNIQUE,
  full_name VARCHAR(120) NOT NULL,
  specialty VARCHAR(120) NOT NULL,
  rating DECIMAL(3,2) NOT NULL DEFAULT 5.00,
  phone VARCHAR(30) DEFAULT NULL,
  email VARCHAR(100) DEFAULT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'Active'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO trainers (id, trainer_code, full_name, specialty, rating, phone, email, status) VALUES
(1, 'TR-01', 'Vikram Sethi', 'Strength & Bodybuilding', 4.90, '+91 98471 22334', 'vikram@cfit.com', 'Active'),
(2, 'TR-02', 'Sneha Pillai', 'HIIT & Functional Cardio', 4.85, '+91 98472 33445', 'sneha@cfit.com', 'Active'),
(3, 'TR-03', 'Anand Jacob', 'Mobility & Powerlifting', 4.95, '+91 98473 44556', 'anand@cfit.com', 'Active'),
(4, 'TR-04', 'Meera Varma', 'Yoga & Posture Rehab', 4.80, '+91 98474 55667', 'meera@cfit.com', 'Active');

-- ---------------------------------------------------------------------
-- TABLE 4: members (Registered Gym Clients)
-- ---------------------------------------------------------------------
CREATE TABLE members (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  member_code VARCHAR(50) NOT NULL UNIQUE,
  full_name VARCHAR(120) NOT NULL,
  email VARCHAR(100) DEFAULT NULL,
  phone VARCHAR(30) DEFAULT NULL,
  plan_type VARCHAR(20) NOT NULL DEFAULT 'Gold',
  trainer_id INT DEFAULT NULL,
  trainer_name VARCHAR(120) DEFAULT 'Unassigned',
  join_date DATE NOT NULL,
  expiry_date DATE NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'Active',
  balance_due DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  notes TEXT,
  CONSTRAINT fk_member_trainer FOREIGN KEY (trainer_id) REFERENCES trainers(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO members (id, member_code, full_name, email, phone, plan_type, trainer_id, trainer_name, join_date, expiry_date, status, balance_due, notes) VALUES
(1, 'GYM-0101', 'neeraj', 'neeraj@example.com', '+91 98470 12345', 'Gold', 1, 'Vikram Sethi', '2025-11-20', '2026-11-20', 'Active', 0.00, 'Consistent 6-day split'),
(2, 'GYM-0102', 'abin', 'abin@example.com', '+91 98471 23456', 'Platinum', 2, 'Sneha Pillai', '2025-08-15', '2026-08-15', 'Active', 0.00, 'CrossFit athlete'),
(3, 'GYM-0103', 'sadi', 'sadi@example.com', '+91 98472 34567', 'Silver', NULL, 'Unassigned', '2026-01-10', '2026-07-10', 'Active', 500.00, 'Pending renewal deposit'),
(4, 'GYM-0104', 'vinod', 'vinod@example.com', '+91 98473 45678', 'Gold', 3, 'Anand Jacob', '2025-10-05', '2026-10-05', 'Active', 0.00, 'Powerlifting training'),
(5, 'GYM-0105', 'farzan', 'farzan@example.com', '+91 98474 56789', 'Platinum', 1, 'Vikram Sethi', '2026-02-01', '2027-02-01', 'Active', 0.00, 'VIP annual member'),
(6, 'GYM-0106', 'JOVIN', 'jovin.member@example.com', '+91 99465 66778', 'Platinum', 2, 'Sneha Pillai', '2025-12-01', '2026-12-01', 'Active', 0.00, 'All-access pass');

-- ---------------------------------------------------------------------
-- TABLE 5: attendance (RFID / Reception Turnstile Logs)
-- ---------------------------------------------------------------------
CREATE TABLE attendance (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  member_id VARCHAR(50) NOT NULL,
  member_name VARCHAR(120) NOT NULL,
  check_in_time DATETIME NOT NULL,
  check_out_time DATETIME DEFAULT NULL,
  check_in_method VARCHAR(50) NOT NULL DEFAULT 'Reception Desk',
  duration_minutes INT NOT NULL DEFAULT 0,
  INDEX idx_att_member (member_id),
  INDEX idx_att_checkin (check_in_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO attendance (id, member_id, member_name, check_in_time, check_out_time, check_in_method, duration_minutes) VALUES
(1, 'GYM-0101', 'neeraj', '2026-10-27 06:15:00', '2026-10-27 07:45:00', 'RFID Card', 90),
(2, 'GYM-0102', 'abin', '2026-10-27 06:30:00', '2026-10-27 08:00:00', 'Biometric', 90),
(3, 'GYM-0104', 'vinod', '2026-10-27 07:00:00', NULL, 'Reception Desk', 0),
(4, 'GYM-0105', 'farzan', '2026-10-27 07:10:00', NULL, 'RFID Card', 0),
(5, 'GYM-0106', 'JOVIN', '2026-10-26 18:00:00', '2026-10-26 19:30:00', 'Reception Desk', 90);

-- ---------------------------------------------------------------------
-- TABLE 6: payments (Invoices, Subscriptions & Collections)
-- ---------------------------------------------------------------------
CREATE TABLE payments (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  invoice_number VARCHAR(50) NOT NULL UNIQUE,
  member_id VARCHAR(50) NOT NULL,
  member_name VARCHAR(120) NOT NULL,
  plan_type VARCHAR(50) NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  payment_method VARCHAR(50) NOT NULL DEFAULT 'UPI',
  status VARCHAR(20) NOT NULL DEFAULT 'Paid',
  payment_date DATETIME NOT NULL,
  INDEX idx_pay_member (member_id),
  INDEX idx_pay_date (payment_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO payments (id, invoice_number, member_id, member_name, plan_type, amount, payment_method, status, payment_date) VALUES
(1, 'INV-2026-001', 'GYM-0101', 'neeraj', 'Gold Monthly Access', 2500.00, 'UPI', 'Paid', '2026-10-20 10:15:00'),
(2, 'INV-2026-002', 'GYM-0102', 'abin', 'Platinum Premium Tier', 4500.00, 'Credit Card', 'Paid', '2026-10-15 14:30:00'),
(3, 'INV-2026-003', 'GYM-0103', 'sadi', 'Silver Fitness Pass', 1500.00, 'Cash', 'Paid', '2026-10-10 11:00:00'),
(4, 'INV-2026-004', 'GYM-0104', 'vinod', 'Gold Monthly Access', 2500.00, 'Net Banking', 'Paid', '2026-10-05 16:45:00'),
(5, 'INV-2026-005', 'GYM-0105', 'farzan', 'Platinum VIP Annual', 24000.00, 'UPI', 'Paid', '2026-02-01 09:30:00'),
(6, 'INV-2026-006', 'GYM-0106', 'JOVIN', 'Platinum VIP Annual', 24000.00, 'UPI', 'Paid', '2025-12-01 12:00:00');

-- ---------------------------------------------------------------------
-- TABLE 7: classes (Group Fitness Sessions & Schedules)
-- ---------------------------------------------------------------------
CREATE TABLE classes (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  class_name VARCHAR(120) NOT NULL,
  trainer_id INT NOT NULL,
  studio_location VARCHAR(100) NOT NULL,
  start_time VARCHAR(50) NOT NULL,
  max_capacity INT NOT NULL DEFAULT 20,
  booked_count INT NOT NULL DEFAULT 0,
  CONSTRAINT fk_class_trainer FOREIGN KEY (trainer_id) REFERENCES trainers(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO classes (id, class_name, trainer_id, studio_location, start_time, max_capacity, booked_count) VALUES
(1, 'CrossFit Power Hour', 1, 'Studio A (Ground Floor)', '06:30 AM', 20, 14),
(2, 'Cardio HIIT Blast', 2, 'Aerobics Deck', '08:00 AM', 25, 18),
(3, 'Mobility & Power Core', 3, 'Free Weights Arena', '05:30 PM', 15, 12),
(4, 'Ashtanga Vinyasa Yoga', 4, 'Zen Studio (2nd Floor)', '07:00 PM', 20, 9);

-- ---------------------------------------------------------------------
-- TABLE 8: class_bookings (Member class reservations)
-- ---------------------------------------------------------------------
CREATE TABLE class_bookings (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  class_id INT NOT NULL,
  member_id VARCHAR(50) NOT NULL,
  booking_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_class_member (class_id, member_id),
  CONSTRAINT fk_booking_class FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO class_bookings (id, class_id, member_id, booking_time) VALUES
(1, 1, 'GYM-0101', '2026-10-26 19:00:00'),
(2, 1, 'GYM-0102', '2026-10-26 19:15:00'),
(3, 2, 'GYM-0102', '2026-10-26 20:00:00'),
(4, 3, 'GYM-0104', '2026-10-26 21:00:00'),
(5, 4, 'GYM-0105', '2026-10-26 21:30:00');
