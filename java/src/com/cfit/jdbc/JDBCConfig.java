package com.cfit.jdbc;

import java.io.InputStream;
import java.util.Properties;

/**
 * JDBC Configuration Manager:
 * Reads and encapsulates JDBC database connection parameters:
 * - Driver class (MySQL: com.mysql.cj.jdbc.Driver, SQLite: org.sqlite.JDBC)
 * - Host, Port, Database Name, Username, and Password
 * - Hierarchy: System Environment Variables -> db.properties -> Default fallbacks
 */
public class JDBCConfig {

    private static String dbHost = "localhost";
    private static String dbPort = "3306";
    private static String dbName = "cfit_db";
    private static String dbUser = "root";
    private static String dbPass = "root";
    private static String driverClassName = "com.mysql.cj.jdbc.Driver";

    static {
        loadConfiguration();
    }

    public static void loadConfiguration() {
        // 1. Read environment variables if available
        String envHost = System.getenv("DB_HOST");
        if (envHost != null && !envHost.trim().isEmpty()) dbHost = envHost.trim();

        String envPort = System.getenv("DB_PORT");
        if (envPort != null && !envPort.trim().isEmpty()) dbPort = envPort.trim();

        String envName = System.getenv("DB_NAME");
        if (envName != null && !envName.trim().isEmpty()) dbName = envName.trim();

        String envUser = System.getenv("DB_USER");
        if (envUser != null && !envUser.trim().isEmpty()) dbUser = envUser.trim();

        String envPass = System.getenv("DB_PASS");
        if (envPass != null) dbPass = envPass.trim();

        // 2. Read db.properties from classpath if present
        loadFromPropertiesStream(JDBCConfig.class.getResourceAsStream("/db.properties"));
        loadFromPropertiesStream(JDBCConfig.class.getResourceAsStream("/com/cfit/jdbc/db.properties"));
    }

    private static void loadFromPropertiesStream(InputStream is) {
        if (is == null) return;
        try (is) {
            Properties props = new Properties();
            props.load(is);
            if (props.getProperty("db.host") != null) dbHost = props.getProperty("db.host").trim();
            if (props.getProperty("db.port") != null) dbPort = props.getProperty("db.port").trim();
            if (props.getProperty("db.name") != null) dbName = props.getProperty("db.name").trim();
            if (props.getProperty("db.user") != null) dbUser = props.getProperty("db.user").trim();
            if (props.getProperty("db.password") != null) dbPass = props.getProperty("db.password").trim();
            if (props.getProperty("db.driver") != null) driverClassName = props.getProperty("db.driver").trim();
        } catch (Exception ignored) {}
    }

    public static String getDbHost() { return dbHost; }
    public static void setDbHost(String host) { if (host != null && !host.trim().isEmpty()) dbHost = host.trim(); }

    public static String getDbPort() { return dbPort; }
    public static void setDbPort(String port) { if (port != null && !port.trim().isEmpty()) dbPort = port.trim(); }

    public static String getDbName() { return dbName; }
    public static void setDbName(String name) { if (name != null && !name.trim().isEmpty()) dbName = name.trim(); }

    public static String getDbUser() { return dbUser; }
    public static void setDbUser(String user) { if (user != null) dbUser = user.trim(); }

    public static String getDbPass() { return dbPass; }
    public static void setDbPass(String pass) { if (pass != null) dbPass = pass.trim(); }

    public static String getDriverClassName() { return driverClassName; }
    public static void setDriverClassName(String driver) { if (driver != null) driverClassName = driver.trim(); }

    public static String getMySQLJdbcUrl() {
        return "jdbc:mysql://" + dbHost + ":" + dbPort + "/" + dbName
                + "?createDatabaseIfNotExist=true&useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=UTC";
    }

    public static String getSQLiteJdbcUrl() {
        return "jdbc:sqlite:cfit.db";
    }
}
