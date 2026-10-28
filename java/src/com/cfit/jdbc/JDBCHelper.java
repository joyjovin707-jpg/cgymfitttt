package com.cfit.jdbc;

import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;

/**
 * JDBC Helper Utility:
 * Encapsulates safe resource closure, transaction handling, and SQL execution.
 */
public class JDBCHelper {

    /**
     * Safely closes any AutoCloseable JDBC resources (Connection, Statement, ResultSet)
     * preventing resource leaks.
     */
    public static void closeQuietly(AutoCloseable... closeables) {
        if (closeables == null) return;
        for (AutoCloseable c : closeables) {
            if (c != null) {
                try {
                    c.close();
                } catch (Exception ignored) {}
            }
        }
    }

    /**
     * Rolls back a transaction safely.
     */
    public static void rollbackQuietly(Connection conn) {
        if (conn != null) {
            try {
                conn.rollback();
            } catch (SQLException ignored) {}
        }
    }

    /**
     * Resets auto-commit mode safely.
     */
    public static void resetAutoCommitQuietly(Connection conn) {
        if (conn != null) {
            try {
                conn.setAutoCommit(true);
            } catch (SQLException ignored) {}
        }
    }

    /**
     * Checks if a database table exists.
     */
    public static boolean tableExists(Connection conn, String tableName) {
        if (conn == null || tableName == null) return false;
        ResultSet rs = null;
        try {
            rs = conn.getMetaData().getTables(null, null, tableName, null);
            if (rs.next()) return true;

            // Also check uppercase
            rs.close();
            rs = conn.getMetaData().getTables(null, null, tableName.toUpperCase(), null);
            return rs.next();
        } catch (SQLException e) {
            return false;
        } finally {
            closeQuietly(rs);
        }
    }
}
