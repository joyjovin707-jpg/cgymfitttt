package com.cfit.jdbc;

import java.sql.Connection;
import java.sql.DatabaseMetaData;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;

/**
 * JDBC Database Initializer:
 * Bootstraps the full relational database schema for C-FIT Gym Management System.
 * Creates all tables (admin, staff_users, trainers, members, attendance, payments, classes, class_bookings)
 * with MySQL constraints and inserts seed data if tables are empty.
 */
public class DatabaseInitializer {

    public static void initializeSchema(Connection conn) {
        if (conn == null) return;
        try (Statement stmt = conn.createStatement()) {
            boolean isMySQL = false;
            try {
                DatabaseMetaData meta = conn.getMetaData();
                String prodName = meta.getDatabaseProductName();
                if (prodName != null && prodName.toLowerCase().contains("mysql")) {
                    isMySQL = true;
                }
            } catch (Exception ignored) {}

            if (isMySQL) {
                initializeMySQLSchema(stmt);
            } else {
                initializeSQLiteSchema(stmt);
            }
        } catch (SQLException e) {
            System.err.println("[WARN] DatabaseInitializer schema setup notification: " + e.getMessage());
        }
    }

    private static void initializeMySQLSchema(Statement stmt) throws SQLException {
        // Table 1: admin
        stmt.executeUpdate("CREATE TABLE IF NOT EXISTS admin (" +
                "id INT NOT NULL AUTO_INCREMENT PRIMARY KEY," +
                "username VARCHAR(50) NOT NULL UNIQUE," +
                "password_hash VARCHAR(255) NOT NULL," +
                "updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP" +
                ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

        // Table 2: staff_users
        stmt.executeUpdate("CREATE TABLE IF NOT EXISTS staff_users (" +
                "id INT NOT NULL AUTO_INCREMENT PRIMARY KEY," +
                "username VARCHAR(50) NOT NULL UNIQUE," +
                "full_name VARCHAR(100) NOT NULL," +
                "role VARCHAR(50) NOT NULL," +
                "phone VARCHAR(30) DEFAULT NULL," +
                "email VARCHAR(100) DEFAULT NULL," +
                "is_active TINYINT(1) NOT NULL DEFAULT 1," +
                "password_hash VARCHAR(255) NOT NULL," +
                "created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP" +
                ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

        // Table 3: trainers
        stmt.executeUpdate("CREATE TABLE IF NOT EXISTS trainers (" +
                "id INT NOT NULL AUTO_INCREMENT PRIMARY KEY," +
                "trainer_code VARCHAR(50) NOT NULL UNIQUE," +
                "full_name VARCHAR(120) NOT NULL," +
                "specialty VARCHAR(120) NOT NULL," +
                "rating DECIMAL(3,2) NOT NULL DEFAULT 5.00," +
                "phone VARCHAR(30) DEFAULT NULL," +
                "email VARCHAR(100) DEFAULT NULL," +
                "status VARCHAR(20) NOT NULL DEFAULT 'Active'" +
                ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

        // Table 4: members
        stmt.executeUpdate("CREATE TABLE IF NOT EXISTS members (" +
                "id INT NOT NULL AUTO_INCREMENT PRIMARY KEY," +
                "member_code VARCHAR(50) NOT NULL UNIQUE," +
                "full_name VARCHAR(120) NOT NULL," +
                "email VARCHAR(100) DEFAULT NULL," +
                "phone VARCHAR(30) DEFAULT NULL," +
                "plan_type VARCHAR(20) NOT NULL DEFAULT 'Gold'," +
                "trainer_id INT DEFAULT NULL," +
                "trainer_name VARCHAR(120) DEFAULT 'Unassigned'," +
                "join_date DATE NOT NULL," +
                "expiry_date DATE NOT NULL," +
                "status VARCHAR(20) NOT NULL DEFAULT 'Active'," +
                "balance_due DECIMAL(10,2) NOT NULL DEFAULT 0.00," +
                "notes TEXT" +
                ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

        // Table 5: attendance
        stmt.executeUpdate("CREATE TABLE IF NOT EXISTS attendance (" +
                "id INT NOT NULL AUTO_INCREMENT PRIMARY KEY," +
                "member_id VARCHAR(50) NOT NULL," +
                "member_name VARCHAR(120) NOT NULL," +
                "check_in_time DATETIME NOT NULL," +
                "check_out_time DATETIME DEFAULT NULL," +
                "check_in_method VARCHAR(50) NOT NULL DEFAULT 'Reception Desk'," +
                "duration_minutes INT NOT NULL DEFAULT 0," +
                "INDEX idx_att_member (member_id)," +
                "INDEX idx_att_checkin (check_in_time)" +
                ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

        // Table 6: payments
        stmt.executeUpdate("CREATE TABLE IF NOT EXISTS payments (" +
                "id INT NOT NULL AUTO_INCREMENT PRIMARY KEY," +
                "invoice_number VARCHAR(50) NOT NULL UNIQUE," +
                "member_id VARCHAR(50) NOT NULL," +
                "member_name VARCHAR(120) NOT NULL," +
                "plan_type VARCHAR(50) NOT NULL," +
                "amount DECIMAL(10,2) NOT NULL," +
                "payment_method VARCHAR(50) NOT NULL DEFAULT 'UPI'," +
                "status VARCHAR(20) NOT NULL DEFAULT 'Paid'," +
                "payment_date DATETIME NOT NULL," +
                "INDEX idx_pay_member (member_id)" +
                ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

        // Table 7: classes
        stmt.executeUpdate("CREATE TABLE IF NOT EXISTS classes (" +
                "id INT NOT NULL AUTO_INCREMENT PRIMARY KEY," +
                "class_name VARCHAR(120) NOT NULL," +
                "trainer_id INT NOT NULL," +
                "studio_location VARCHAR(100) NOT NULL," +
                "start_time VARCHAR(50) NOT NULL," +
                "max_capacity INT NOT NULL DEFAULT 20," +
                "booked_count INT NOT NULL DEFAULT 0" +
                ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

        // Table 8: class_bookings
        stmt.executeUpdate("CREATE TABLE IF NOT EXISTS class_bookings (" +
                "id INT NOT NULL AUTO_INCREMENT PRIMARY KEY," +
                "class_id INT NOT NULL," +
                "member_id VARCHAR(50) NOT NULL," +
                "booking_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP," +
                "UNIQUE KEY uq_class_member (class_id, member_id)" +
                ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

        // Seed data if trainers table is empty
        ResultSet rs = stmt.executeQuery("SELECT COUNT(*) FROM trainers");
        if (rs.next() && rs.getInt(1) == 0) {
            stmt.executeUpdate("INSERT INTO admin (username, password_hash) VALUES ('admin', 'admin123')");
            stmt.executeUpdate("INSERT INTO staff_users (username, full_name, role, phone, email, is_active, password_hash) VALUES " +
                    "('staff', 'Staff User', 'Manager', '+91 98470 11223', 'staff@cfit.com', 1, 'staff123')," +
                    "('adhil', 'Adhil K', 'Front Desk', '+91 94471 22334', 'adhil@cfit.com', 1, 'adhil123')," +
                    "('dnv', 'DNV', 'Floor Supervisor', '+91 97452 33445', 'dnv@cfit.com', 1, 'dnv123')," +
                    "('balu', 'Balu', 'Fitness Coach', '+91 98953 44556', 'balu@cfit.com', 1, 'balu123')," +
                    "('abhiram', 'Abhiram', 'Nutritionist', '+91 96334 55667', 'abhiram@cfit.com', 1, 'abhiram123')," +
                    "('JOVIN', 'Jovin Joy', 'Chief Administrator', '+91 99465 66778', 'jovin@cfit.com', 1, 'JOVIN123')");

            stmt.executeUpdate("INSERT INTO trainers (trainer_code, full_name, specialty, rating, phone, email, status) VALUES " +
                    "('TR-01', 'Vikram Sethi', 'Strength & Bodybuilding', 4.90, '+91 98471 22334', 'vikram@cfit.com', 'Active')," +
                    "('TR-02', 'Sneha Pillai', 'HIIT & Functional Cardio', 4.85, '+91 98472 33445', 'sneha@cfit.com', 'Active')," +
                    "('TR-03', 'Anand Jacob', 'Mobility & Powerlifting', 4.95, '+91 98473 44556', 'anand@cfit.com', 'Active')," +
                    "('TR-04', 'Meera Varma', 'Yoga & Posture Rehab', 4.80, '+91 98474 55667', 'meera@cfit.com', 'Active')");

            stmt.executeUpdate("INSERT INTO members (member_code, full_name, email, phone, plan_type, trainer_id, trainer_name, join_date, expiry_date, status, balance_due, notes) VALUES " +
                    "('GYM-0101', 'neeraj', 'neeraj@example.com', '+91 98470 12345', 'Gold', 1, 'Vikram Sethi', '2025-11-20', '2026-11-20', 'Active', 0.00, 'Consistent 6-day split')," +
                    "('GYM-0102', 'abin', 'abin@example.com', '+91 98471 23456', 'Platinum', 2, 'Sneha Pillai', '2025-08-15', '2026-08-15', 'Active', 0.00, 'CrossFit athlete')," +
                    "('GYM-0103', 'sadi', 'sadi@example.com', '+91 98472 34567', 'Silver', NULL, 'Unassigned', '2026-01-10', '2026-07-10', 'Active', 500.00, 'Pending renewal deposit')," +
                    "('GYM-0104', 'vinod', 'vinod@example.com', '+91 98473 45678', 'Gold', 3, 'Anand Jacob', '2025-10-05', '2026-10-05', 'Active', 0.00, 'Powerlifting training')," +
                    "('GYM-0105', 'farzan', 'farzan@example.com', '+91 98474 56789', 'Platinum', 1, 'Vikram Sethi', '2026-02-01', '2027-02-01', 'Active', 0.00, 'VIP annual member')," +
                    "('GYM-0106', 'JOVIN', 'jovin.member@example.com', '+91 99465 66778', 'Platinum', 2, 'Sneha Pillai', '2025-12-01', '2026-12-01', 'Active', 0.00, 'All-access pass')");

            stmt.executeUpdate("INSERT INTO classes (class_name, trainer_id, studio_location, start_time, max_capacity, booked_count) VALUES " +
                    "('CrossFit Power Hour', 1, 'Studio A (Ground Floor)', '06:30 AM', 20, 14)," +
                    "('Cardio HIIT Blast', 2, 'Aerobics Deck', '08:00 AM', 25, 18)," +
                    "('Mobility & Power Core', 3, 'Free Weights Arena', '05:30 PM', 15, 12)," +
                    "('Ashtanga Vinyasa Yoga', 4, 'Zen Studio (2nd Floor)', '07:00 PM', 20, 9)");
        }
    }

    private static void initializeSQLiteSchema(Statement stmt) throws SQLException {
        stmt.executeUpdate("CREATE TABLE IF NOT EXISTS admin (" +
                "id INTEGER PRIMARY KEY AUTOINCREMENT," +
                "username TEXT UNIQUE NOT NULL," +
                "password_hash TEXT NOT NULL," +
                "updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP" +
                ")");
        stmt.executeUpdate("CREATE TABLE IF NOT EXISTS staff_users (" +
                "id INTEGER PRIMARY KEY AUTOINCREMENT," +
                "username TEXT UNIQUE NOT NULL," +
                "full_name TEXT NOT NULL," +
                "role TEXT NOT NULL," +
                "phone TEXT," +
                "email TEXT," +
                "is_active INTEGER DEFAULT 1," +
                "password_hash TEXT NOT NULL," +
                "created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP" +
                ")");
        stmt.executeUpdate("CREATE TABLE IF NOT EXISTS trainers (" +
                "id INTEGER PRIMARY KEY AUTOINCREMENT," +
                "trainer_code TEXT UNIQUE NOT NULL," +
                "full_name TEXT NOT NULL," +
                "specialty TEXT NOT NULL," +
                "rating REAL DEFAULT 5.0," +
                "phone TEXT," +
                "email TEXT," +
                "status TEXT DEFAULT 'Active'" +
                ")");
        stmt.executeUpdate("CREATE TABLE IF NOT EXISTS members (" +
                "id INTEGER PRIMARY KEY AUTOINCREMENT," +
                "member_code TEXT UNIQUE NOT NULL," +
                "full_name TEXT NOT NULL," +
                "email TEXT," +
                "phone TEXT," +
                "plan_type TEXT DEFAULT 'Gold'," +
                "trainer_id INTEGER," +
                "trainer_name TEXT DEFAULT 'Unassigned'," +
                "join_date TEXT NOT NULL," +
                "expiry_date TEXT NOT NULL," +
                "status TEXT DEFAULT 'Active'," +
                "balance_due REAL DEFAULT 0.0," +
                "notes TEXT" +
                ")");
        stmt.executeUpdate("CREATE TABLE IF NOT EXISTS attendance (" +
                "id INTEGER PRIMARY KEY AUTOINCREMENT," +
                "member_id TEXT NOT NULL," +
                "member_name TEXT NOT NULL," +
                "check_in_time TEXT NOT NULL," +
                "check_out_time TEXT," +
                "check_in_method TEXT DEFAULT 'Reception Desk'," +
                "duration_minutes INTEGER DEFAULT 0" +
                ")");
        stmt.executeUpdate("CREATE TABLE IF NOT EXISTS payments (" +
                "id INTEGER PRIMARY KEY AUTOINCREMENT," +
                "invoice_number TEXT UNIQUE NOT NULL," +
                "member_id TEXT NOT NULL," +
                "member_name TEXT NOT NULL," +
                "plan_type TEXT NOT NULL," +
                "amount REAL NOT NULL," +
                "payment_method TEXT DEFAULT 'UPI'," +
                "status TEXT DEFAULT 'Paid'," +
                "payment_date TEXT NOT NULL" +
                ")");
        stmt.executeUpdate("CREATE TABLE IF NOT EXISTS classes (" +
                "id INTEGER PRIMARY KEY AUTOINCREMENT," +
                "class_name TEXT NOT NULL," +
                "trainer_id INTEGER NOT NULL," +
                "studio_location TEXT NOT NULL," +
                "start_time TEXT NOT NULL," +
                "max_capacity INTEGER DEFAULT 20," +
                "booked_count INTEGER DEFAULT 0" +
                ")");
        stmt.executeUpdate("CREATE TABLE IF NOT EXISTS class_bookings (" +
                "id INTEGER PRIMARY KEY AUTOINCREMENT," +
                "class_id INTEGER NOT NULL," +
                "member_id TEXT NOT NULL," +
                "booking_time TEXT DEFAULT CURRENT_TIMESTAMP" +
                ")");
    }
}
