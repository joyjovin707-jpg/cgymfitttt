#!/bin/bash
# ==============================================================================
# C-FIT Gym Management System — Unified Java OOP & MySQL JDBC Launcher
# ==============================================================================
cd "$(dirname "$0")"

mkdir -p java/bin
mkdir -p lib

# 1. Check or download MySQL Connector JAR if missing
MYSQL_JAR="lib/mysql-connector-j-8.3.0.jar"
if [ ! -f "$MYSQL_JAR" ] && [ ! -f "java/lib/mysql-connector-j-8.3.0.jar" ]; then
    echo "[INFO] MySQL JDBC Driver not found in lib/. Downloading mysql-connector-j-8.3.0.jar..."
    if command -v curl >/dev/null 2>&1; then
        curl -sSL -o "$MYSQL_JAR" https://repo1.maven.org/maven2/com/mysql/mysql-connector-j/8.3.0/mysql-connector-j-8.3.0.jar
    elif command -v wget >/dev/null 2>&1; then
        wget -q -O "$MYSQL_JAR" https://repo1.maven.org/maven2/com/mysql/mysql-connector-j/8.3.0/mysql-connector-j-8.3.0.jar
    fi
fi

# Define classpath
CP="java/bin:lib/*:java/lib/*"

echo "[INFO] Compiling C-FIT Java OOP & JDBC System..."
if command -v javac >/dev/null 2>&1; then
    javac -cp "$CP" -d java/bin $(find java/src -name "*.java")
    if [ $? -ne 0 ]; then
        echo "[ERROR] Java compilation failed. Please verify syntax."
        exit 1
    fi
    echo "[SUCCESS] Java sources compiled successfully into java/bin."
else
    echo "[WARN] 'javac' compiler not found in current PATH."
    echo "       If using precompiled bytecode, continuing with runtime..."
fi

echo ""
echo "================================================================================"
echo "   C-FIT FITNESS MANAGEMENT SYSTEM — RUNTIME LAUNCHER"
echo "================================================================================"
echo " 1. Console / Terminal Interactive Mode (com.cfit.Main)"
echo " 2. Desktop GUI Mode — Java Swing (com.cfit.gui.GymDesktopApp)"
echo " 3. Pure Java REST API Server on port 8085 (com.cfit.server.GymHttpServer)"
echo " 4. Test MySQL JDBC Connection (com.cfit.jdbc.TestMySQLConnection)"
echo " 5. Initialize MySQL Database & Tables (com.cfit.jdbc.MySQLDatabaseSetup)"
echo "================================================================================"
echo ""
read -p "Select option [1-5] (Default 1): " choice

case "$choice" in
    2)
        echo "Starting C-FIT Desktop Swing GUI with MySQL JDBC..."
        java -cp "$CP" com.cfit.gui.GymDesktopApp
        ;;
    3)
        echo "Starting C-FIT Java HTTP REST Server on :8085..."
        java -cp "$CP" com.cfit.server.GymHttpServer 8085
        ;;
    4)
        echo "Running MySQL JDBC Connection Diagnostics..."
        java -cp "$CP" com.cfit.jdbc.TestMySQLConnection
        ;;
    5)
        echo "Running MySQL Database & Table Initializer..."
        java -cp "$CP" com.cfit.jdbc.MySQLDatabaseSetup
        ;;
    *)
        echo "Starting C-FIT Console Terminal..."
        java -cp "$CP" com.cfit.Main
        ;;
esac
