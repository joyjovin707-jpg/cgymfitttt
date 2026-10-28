package com.cfit.jdbc;

import java.sql.Connection;
import java.sql.DatabaseMetaData;
import java.sql.SQLException;

/**
 * JDBC Database Connection Coordinator for C-FIT System:
 * - Resides in package: com.cfit.jdbc
 * - Manages JDBC connections to MySQL (localhost:3306 / cfit_db)
 * - Automatically validates driver availability (com.mysql.cj.jdbc.Driver)
 * - Automatically bootstraps MySQL schema on first connection
 * - Provides clear diagnostics for KTU CSE viva / evaluations
 */
public class DBConnection {

    private static boolean isInitialized = false;
    private static boolean usingMySQL = false;
    private static String activeStatusMessage = "JDBC connection uninitialized";
    private static String lastErrorDetails = null;

    static {
        JDBCConfig.loadConfiguration();
    }

    public static String getJdbcUrl() {
        return JDBCConfig.getMySQLJdbcUrl();
    }

    public static String getDbHost() {
        return JDBCConfig.getDbHost();
    }

    public static String getDbPort() {
        return JDBCConfig.getDbPort();
    }

    public static String getDbName() {
        return JDBCConfig.getDbName();
    }

    public static String getDbUser() {
        return JDBCConfig.getDbUser();
    }

    /**
     * Primary method to obtain an active JDBC Connection.
     * Connects to MySQL on localhost:3306/cfit_db.
     */
    public static synchronized Connection getConnection() throws SQLException {
        // 1. Try MySQL Connection First
        try {
            Connection conn = ConnectionFactory.createMySQLConnection();
            usingMySQL = true;
            lastErrorDetails = null;
            
            try {
                DatabaseMetaData meta = conn.getMetaData();
                activeStatusMessage = String.format("Connected to MySQL %s via JDBC [%s:%s/%s as user '%s']",
                        meta.getDatabaseProductVersion(),
                        JDBCConfig.getDbHost(), JDBCConfig.getDbPort(),
                        JDBCConfig.getDbName(), JDBCConfig.getDbUser());
            } catch (Exception ignored) {
                activeStatusMessage = "Connected to MySQL via JDBC (" + JDBCConfig.getDbHost() + ":" + JDBCConfig.getDbPort() + "/" + JDBCConfig.getDbName() + ")";
            }

            if (!isInitialized) {
                DatabaseInitializer.initializeSchema(conn);
                isInitialized = true;
            }
            return conn;
        } catch (ClassNotFoundException driverEx) {
            lastErrorDetails = driverEx.getMessage();
            activeStatusMessage = "MySQL Driver Error: " + driverEx.getMessage();
            
            // Check if SQLite is available as an offline fallback
            if (ConnectionFactory.isSQLiteDriverAvailable()) {
                try {
                    Connection sqliteConn = ConnectionFactory.createSQLiteConnection();
                    usingMySQL = false;
                    activeStatusMessage = "Connected to SQLite JDBC fallback (cfit.db). Install MySQL Connector to enable MySQL.";
                    if (!isInitialized) {
                        DatabaseInitializer.initializeSchema(sqliteConn);
                        isInitialized = true;
                    }
                    return sqliteConn;
                } catch (Exception ignored) {}
            }
            throw new SQLException(driverEx.getMessage(), driverEx);
            
        } catch (SQLException sqlEx) {
            lastErrorDetails = sqlEx.getMessage();
            activeStatusMessage = "MySQL Connection Failed: " + sqlEx.getMessage();

            // Try SQLite fallback only if SQLite driver is available
            if (ConnectionFactory.isSQLiteDriverAvailable()) {
                try {
                    Connection sqliteConn = ConnectionFactory.createSQLiteConnection();
                    usingMySQL = false;
                    activeStatusMessage = "Connected to SQLite JDBC fallback (cfit.db). MySQL offline: " + sqlEx.getMessage();
                    if (!isInitialized) {
                        DatabaseInitializer.initializeSchema(sqliteConn);
                        isInitialized = true;
                    }
                    return sqliteConn;
                } catch (Exception ignored) {}
            }
            throw new SQLException("Cannot connect to MySQL via JDBC at " + getJdbcUrl() + ": " + sqlEx.getMessage(), sqlEx);
        }
    }

    /**
     * Explicit direct MySQL connection method.
     */
    public static Connection getMySQLConnection() throws SQLException, ClassNotFoundException {
        return ConnectionFactory.createMySQLConnection();
    }

    public static String getStatusMessage() {
        return activeStatusMessage;
    }

    public static String getLastErrorDetails() {
        return lastErrorDetails;
    }

    public static boolean isUsingMySQL() {
        return usingMySQL;
    }

    /**
     * Diagnostic helper: Tests if JDBC connection is working.
     */
    public static boolean testConnection() {
        try (Connection conn = getConnection()) {
            return conn != null && !conn.isClosed();
        } catch (Exception e) {
            return false;
        }
    }

    /**
     * Safely closes a connection.
     */
    public static void closeConnection(Connection conn) {
        JDBCHelper.closeQuietly(conn);
    }
}
