package com.cfit.jdbc;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;

/**
 * JDBC Connection Factory:
 * Implements the Factory Design Pattern to manufacture and validate JDBC connections
 * to MySQL on localhost:3306 (primary database) with proper driver loading and diagnostic reporting.
 */
public class ConnectionFactory {

    public static final String MYSQL_CJ_DRIVER = "com.mysql.cj.jdbc.Driver";
    public static final String MYSQL_LEGACY_DRIVER = "com.mysql.jdbc.Driver";
    public static final String SQLITE_DRIVER = "org.sqlite.JDBC";

    /**
     * Checks if the MySQL JDBC driver is present on the classpath.
     */
    public static boolean isMySQLDriverAvailable() {
        try {
            Class.forName(MYSQL_CJ_DRIVER);
            return true;
        } catch (ClassNotFoundException e1) {
            try {
                Class.forName(MYSQL_LEGACY_DRIVER);
                return true;
            } catch (ClassNotFoundException e2) {
                return false;
            }
        }
    }

    /**
     * Checks if the SQLite JDBC driver is present on the classpath.
     */
    public static boolean isSQLiteDriverAvailable() {
        try {
            Class.forName(SQLITE_DRIVER);
            return true;
        } catch (ClassNotFoundException e) {
            return false;
        }
    }

    /**
     * Creates a new JDBC connection to MySQL using parameters from JDBCConfig / db.properties.
     * Connects to MySQL on localhost:3306 (database: cfit_db).
     */
    public static Connection createMySQLConnection() throws SQLException, ClassNotFoundException {
        // 1. Try modern MySQL driver first
        try {
            Class.forName(MYSQL_CJ_DRIVER);
        } catch (ClassNotFoundException cjEx) {
            try {
                Class.forName(MYSQL_LEGACY_DRIVER);
            } catch (ClassNotFoundException legacyEx) {
                throw new ClassNotFoundException(
                        "MySQL JDBC Driver (" + MYSQL_CJ_DRIVER + ") not found on classpath.\n" +
                        "Resolution: Ensure 'mysql-connector-j-8.3.0.jar' is located in 'lib/' and included in your -cp argument.\n" +
                        "Example: java -cp \"java/bin:lib/*\" com.cfit.Main"
                );
            }
        }

        String url = JDBCConfig.getMySQLJdbcUrl();
        String user = JDBCConfig.getDbUser();
        String pass = JDBCConfig.getDbPass();

        return DriverManager.getConnection(url, user, pass);
    }

    /**
     * Parameterized MySQL connection creator for custom credentials or remote host.
     */
    public static Connection createMySQLConnection(String host, int port, String dbName, String user, String pass)
            throws SQLException, ClassNotFoundException {
        if (!isMySQLDriverAvailable()) {
            throw new ClassNotFoundException("MySQL Driver not present on classpath. Add mysql-connector-j.jar to lib/.");
        }
        String url = String.format(
                "jdbc:mysql://%s:%d/%s?createDatabaseIfNotExist=true&useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=UTC",
                host, port, dbName
        );
        return DriverManager.getConnection(url, user, pass);
    }

    /**
     * Explicit direct localhost MySQL connection method.
     */
    public static Connection createLocalHostConnection() throws SQLException, ClassNotFoundException {
        return createMySQLConnection("localhost", 3306, "cfit_db", "root", "root");
    }

    /**
     * Creates an embedded SQLite connection ONLY if SQLite driver is present on classpath.
     * Prevents ClassNotFoundException crash if SQLite driver is absent.
     */
    public static Connection createSQLiteConnection() throws SQLException, ClassNotFoundException {
        if (!isSQLiteDriverAvailable()) {
            throw new ClassNotFoundException("SQLite JDBC driver (org.sqlite.JDBC) is not available on classpath.");
        }
        Class.forName(SQLITE_DRIVER);
        return DriverManager.getConnection(JDBCConfig.getSQLiteJdbcUrl());
    }

    /**
     * Validates if a given JDBC connection is open and responsive.
     */
    public static boolean isConnectionValid(Connection conn, int timeoutSeconds) {
        if (conn == null) return false;
        try {
            return !conn.isClosed() && conn.isValid(timeoutSeconds);
        } catch (SQLException e) {
            return false;
        }
    }
}
