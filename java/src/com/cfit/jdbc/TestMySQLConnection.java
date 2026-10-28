package com.cfit.jdbc;

import java.sql.Connection;
import java.sql.DatabaseMetaData;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;

/**
 * Standalone MySQL JDBC Connection Test Utility:
 * Run this directly to verify your MySQL JDBC setup:
 *   java -cp "java/bin:lib/*" com.cfit.jdbc.TestMySQLConnection
 */
public class TestMySQLConnection {

    public static void main(String[] args) {
        System.out.println("================================================================================");
        System.out.println("   C-FIT FITNESS MANAGEMENT SYSTEM — MYSQL JDBC CONNECTION TEST");
        System.out.println("================================================================================");

        // Step 1: Check Driver Availability
        System.out.print("[STEP 1/4] Checking MySQL JDBC Driver... ");
        boolean hasDriver = ConnectionFactory.isMySQLDriverAvailable();
        if (hasDriver) {
            System.out.println("OK (Found " + ConnectionFactory.MYSQL_CJ_DRIVER + ")");
        } else {
            System.out.println("FAILED!");
            System.out.println("\n[ERROR] MySQL JDBC Driver is missing from the classpath.");
            System.out.println("Resolution:");
            System.out.println("  1. Ensure 'mysql-connector-j-8.3.0.jar' is located in the 'lib/' folder.");
            System.out.println("  2. Run with classpath: java -cp \"java/bin:lib/*\" com.cfit.jdbc.TestMySQLConnection");
            System.out.println("  3. Or run via the launcher: ./run_java.sh");
            return;
        }

        // Step 2: Display Configuration
        System.out.println("[STEP 2/4] Loaded MySQL Configuration:");
        System.out.println("  - Host     : " + JDBCConfig.getDbHost());
        System.out.println("  - Port     : " + JDBCConfig.getDbPort());
        System.out.println("  - Database : " + JDBCConfig.getDbName());
        System.out.println("  - User     : " + JDBCConfig.getDbUser());
        System.out.println("  - JDBC URL : " + JDBCConfig.getMySQLJdbcUrl());

        // Step 3: Attempt Live JDBC Connection
        System.out.print("[STEP 3/4] Connecting to MySQL Server... ");
        try (Connection conn = ConnectionFactory.createMySQLConnection()) {
            DatabaseMetaData meta = conn.getMetaData();
            System.out.println("SUCCESS!");
            System.out.println("  - Connected to   : " + meta.getDatabaseProductName() + " " + meta.getDatabaseProductVersion());
            System.out.println("  - Driver Name    : " + meta.getDriverName() + " (" + meta.getDriverVersion() + ")");
            System.out.println("  - Connection URL : " + meta.getURL());

            // Step 4: Verify Tables and Seed Data
            System.out.println("[STEP 4/4] Verifying Schema Tables in '" + JDBCConfig.getDbName() + "':");
            DatabaseInitializer.initializeSchema(conn);

            String[] tables = {"members", "trainers", "attendance", "payments", "classes", "staff_users"};
            try (Statement stmt = conn.createStatement()) {
                for (String t : tables) {
                    try (ResultSet rs = stmt.executeQuery("SELECT COUNT(*) FROM " + t)) {
                        if (rs.next()) {
                            System.out.printf("  ✓ Table %-14s : %d records%n", t, rs.getInt(1));
                        }
                    } catch (SQLException ex) {
                        System.out.printf("  ✗ Table %-14s : Missing or error (%s)%n", t, ex.getMessage());
                    }
                }
            }

            System.out.println("\n================================================================================");
            System.out.println("   [STATUS] MYSQL JDBC CONNECTION ESTABLISHED AND VERIFIED SUCCESSFULLY!");
            System.out.println("================================================================================");

        } catch (SQLException e) {
            System.out.println("FAILED!");
            System.out.println("\n[ERROR] Connection failed: " + e.getMessage());
            System.out.println("\n--- TROUBLESHOOTING GUIDE ---");
            if (e.getMessage().contains("Communications link failure") || e.getMessage().contains("Connection refused")) {
                System.out.println("1. MySQL Server is NOT running on " + JDBCConfig.getDbHost() + ":" + JDBCConfig.getDbPort() + ".");
                System.out.println("   - If using XAMPP: Open XAMPP Control Panel and click 'Start' next to MySQL.");
                System.out.println("   - If using Linux: Run 'sudo systemctl start mysql' or 'sudo service mysql start'.");
                System.out.println("   - If using Docker: Run 'docker run -d -p 3306:3306 -e MYSQL_ROOT_PASSWORD=root -e MYSQL_DATABASE=cfit_db mysql:8.0'");
            } else if (e.getMessage().contains("Access denied")) {
                System.out.println("2. Incorrect MySQL credentials for user '" + JDBCConfig.getDbUser() + "'.");
                System.out.println("   - Update 'java/resources/db.properties' with your correct MySQL password.");
                System.out.println("   - Or set environment variables: export DB_USER=root DB_PASS=your_password");
            } else if (e.getMessage().contains("Unknown database")) {
                System.out.println("3. Database '" + JDBCConfig.getDbName() + "' does not exist.");
                System.out.println("   - Run 'CREATE DATABASE cfit_db;' in MySQL or run: com.cfit.jdbc.MySQLDatabaseSetup");
            }
            System.out.println("================================================================================");
        } catch (Exception e) {
            System.out.println("UNEXPECTED ERROR: " + e.getMessage());
            e.printStackTrace();
        }
    }
}
