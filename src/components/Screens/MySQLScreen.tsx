import React, { useState, useEffect } from 'react';
import {
  Database,
  Server,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  Download,
  RefreshCw,
  Play,
  Code2,
  Layers,
  Terminal,
  ExternalLink,
  ShieldCheck,
  HelpCircle,
} from 'lucide-react';

interface MySQLScreenProps {
  onNotify: (msg: string) => void;
}

export const MySQLScreen: React.FC<MySQLScreenProps> = ({ onNotify }) => {
  const [config, setConfig] = useState({
    host: 'localhost',
    port: '3306',
    database: 'cfit_db',
    user: 'root',
    password: '',
  });

  const [status, setStatus] = useState<{
    connected: boolean;
    version?: string;
    database?: string;
    databaseExists?: boolean;
    tables?: Array<{ name: string; count: number }>;
    message?: string;
    error?: string;
    troubleshooting?: string[];
  } | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [copiedJdbc, setCopiedJdbc] = useState(false);
  const [copiedJava, setCopiedJava] = useState(false);
  const [activeTab, setActiveTab] = useState<'connection' | 'schema' | 'code' | 'guide'>('connection');

  const jdbcUrl = `jdbc:mysql://${config.host}:${config.port}/${config.database}?createDatabaseIfNotExist=true&useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=UTC`;

  const javaCodeSnippet = `package com.cfit.jdbc;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;

/**
 * C-FIT Gym Management System - MySQL JDBC Connection Demo
 * KTU S3 B.Tech CSE OOP Project
 */
public class MySQLDemo {
    // 1. Connection Parameters
    private static final String URL = "${jdbcUrl}";
    private static final String USER = "${config.user}";
    private static final String PASS = "${config.password}";

    public static void main(String[] args) {
        System.out.println("Connecting to MySQL via JDBC...");
        
        try {
            // 2. Load modern MySQL Connector/J driver
            Class.forName("com.mysql.cj.jdbc.Driver");

            // 3. Establish Connection
            try (Connection conn = DriverManager.getConnection(URL, USER, PASS)) {
                System.out.println("✓ Successfully connected to MySQL database: " + conn.getCatalog());

                // 4. Query Gym Members using PreparedStatement
                String sql = "SELECT member_code, full_name, plan_type, status FROM members ORDER BY id ASC";
                try (PreparedStatement ps = conn.prepareStatement(sql);
                     ResultSet rs = ps.executeQuery()) {
                    
                    System.out.println("\\n--- REGISTERED MEMBERS (FROM MYSQL) ---");
                    while (rs.next()) {
                        System.out.printf("[%s] %-15s | Plan: %-8s | Status: %s%n",
                                rs.getString("member_code"),
                                rs.getString("full_name"),
                                rs.getString("plan_type"),
                                rs.getString("status"));
                    }
                }
            }
        } catch (ClassNotFoundException e) {
            System.err.println("Driver Error: mysql-connector-j.jar is missing from classpath.");
            System.err.println("Fix: Run with: java -cp \\"java/bin:lib/*\\" com.cfit.Main");
        } catch (SQLException e) {
            System.err.println("SQL Error: " + e.getMessage());
        }
    }
}`;

  useEffect(() => {
    checkStatus();
  }, []);

  const checkStatus = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/mysql/status');
      const data = await res.json();
      setStatus(data);
    } catch {
      setStatus({
        connected: false,
        error: 'Backend API server unavailable',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const res = await fetch('/api/mysql/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      const data = await res.json();
      setStatus(data);
      if (data.connected) {
        onNotify(`Connected to MySQL: ${data.version}`);
      } else {
        onNotify(data.error || 'Connection failed');
      }
    } catch (e: any) {
      onNotify('Network error connecting to MySQL');
    } finally {
      setIsLoading(false);
    }
  };

  const handleInitDatabase = async () => {
    setIsInitializing(true);
    try {
      const res = await fetch('/api/mysql/init-db', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        onNotify('MySQL database and 8 tables created successfully!');
        await checkStatus();
      } else {
        onNotify(data.error || 'Failed to initialize database');
      }
    } catch {
      onNotify('Failed to execute database initialization');
    } finally {
      setIsInitializing(false);
    }
  };

  const handleSyncToMySQL = async () => {
    setIsSyncing(true);
    try {
      const res = await fetch('/api/mysql/sync', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        onNotify(data.message || 'Data synced to MySQL!');
        await checkStatus();
      } else {
        onNotify(data.error || 'Sync failed');
      }
    } catch {
      onNotify('Error syncing data to MySQL');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDownloadSql = () => {
    const link = document.createElement('a');
    link.href = '/schema_mysql.sql';
    link.download = 'cfit_mysql_setup.sql';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    onNotify('MySQL SQL setup script downloaded!');
  };

  const copyToClipboard = (text: string, type: 'jdbc' | 'java') => {
    navigator.clipboard.writeText(text);
    if (type === 'jdbc') {
      setCopiedJdbc(true);
      setTimeout(() => setCopiedJdbc(false), 2500);
      onNotify('JDBC Connection URL copied!');
    } else {
      setCopiedJava(true);
      setTimeout(() => setCopiedJava(false), 2500);
      onNotify('Java JDBC Code copied to clipboard!');
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="font-anton text-3xl tracking-wide text-[#EDEEEA]">
              MySQL & JDBC Connection
            </h1>
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-[#C9FF3D]/15 text-[#C9FF3D] border border-[#C9FF3D]/30 uppercase">
              Database Bridge
            </span>
          </div>
          <p className="text-xs text-[#9A9E9F] mt-1">
            Convert TypeScript data to MySQL 8.0, establish JDBC connections, and test queries.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleDownloadSql}
            className="px-3.5 py-2 bg-[#212528] hover:bg-[#2C3034] text-[#EDEEEA] border border-[#2C3034] rounded-lg text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer"
            title="Download complete MySQL DDL and DML .sql script"
          >
            <Download className="w-3.5 h-3.5 text-[#C9FF3D]" />
            <span>Download schema_mysql.sql</span>
          </button>
          <button
            onClick={checkStatus}
            disabled={isLoading}
            className="px-3.5 py-2 bg-[#C9FF3D] hover:bg-[#B5EB34] text-[#101214] font-bold text-xs rounded-lg transition-colors flex items-center gap-2 cursor-pointer shadow-sm disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Test Connection</span>
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex gap-2 border-b border-[#2C3034] pb-2">
        {[
          { id: 'connection', label: 'Connection & Parameters', icon: Server },
          { id: 'schema', label: 'MySQL Schema & Tables (8)', icon: Layers },
          { id: 'code', label: 'Java JDBC Source Code', icon: Code2 },
          { id: 'guide', label: 'Setup Guide & Troubleshooting', icon: Terminal },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
                isActive
                  ? 'bg-[#212528] text-[#C9FF3D] border border-[#2C3034]'
                  : 'text-[#9A9E9F] hover:text-[#EDEEEA] hover:bg-[#1A1D21]'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: Connection & Parameters */}
      {activeTab === 'connection' && (
        <div className="space-y-5">
          {/* Status Alert Banner */}
          <div
            className={`p-4 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
              status?.connected
                ? 'bg-[#C9FF3D]/10 border-[#C9FF3D]/30 text-[#EDEEEA]'
                : 'bg-[#1A1D21] border-[#2C3034] text-[#EDEEEA]'
            }`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`w-9 h-9 rounded-lg flex items-center justify-center font-bold ${
                  status?.connected
                    ? 'bg-[#C9FF3D] text-[#101214]'
                    : 'bg-[#212528] text-[#9A9E9F] border border-[#2C3034]'
                }`}
              >
                <Database className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm">
                    {status?.connected
                      ? `Connected to MySQL ${status.version}`
                      : 'MySQL Server: Standalone / Ready to Connect'}
                  </span>
                  <span
                    className={`w-2 h-2 rounded-full ${
                      status?.connected ? 'bg-[#C9FF3D] animate-pulse' : 'bg-amber-400'
                    }`}
                  />
                </div>
                <p className="text-xs text-[#9A9E9F] mt-0.5">
                  {status?.connected
                    ? `Database '${status.database}' verified. Tables loaded: ${status.tables?.length || 0}.`
                    : 'Configure host, port, and credentials below or use the bundled Java launcher.'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {status?.connected && (
                <>
                  <button
                    onClick={handleInitDatabase}
                    disabled={isInitializing}
                    className="px-3 py-1.5 bg-[#212528] hover:bg-[#2C3034] text-[#C9FF3D] border border-[#C9FF3D]/40 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Play className="w-3 h-3 fill-current" />
                    <span>{isInitializing ? 'Creating Tables...' : 'Re-initialize Schema'}</span>
                  </button>
                  <button
                    onClick={handleSyncToMySQL}
                    disabled={isSyncing}
                    className="px-3 py-1.5 bg-[#C9FF3D] hover:bg-[#B5EB34] text-[#101214] rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} />
                    <span>{isSyncing ? 'Syncing...' : 'Sync Data'}</span>
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Connection Parameters Form */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            <div className="lg:col-span-7 bg-[#1A1D21] border border-[#2C3034] rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-[#2C3034] pb-3">
                <div className="flex items-center gap-2">
                  <Server className="w-4 h-4 text-[#C9FF3D]" />
                  <h3 className="text-sm font-bold text-[#EDEEEA]">MySQL Connection Parameters</h3>
                </div>
                <span className="text-[10px] font-mono text-[#5D6164]">Port 3306 Standard</span>
              </div>

              <form onSubmit={handleConnect} className="space-y-3.5">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-medium text-[#9A9E9F] uppercase mb-1">
                      Host Address
                    </label>
                    <input
                      type="text"
                      value={config.host}
                      onChange={(e) => setConfig({ ...config, host: e.target.value })}
                      placeholder="localhost"
                      className="w-full bg-[#212528] border border-[#2C3034] rounded-lg px-3 py-2 text-xs text-[#EDEEEA] font-mono focus:outline-none focus:border-[#C9FF3D]"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-[#9A9E9F] uppercase mb-1">
                      Port Number
                    </label>
                    <input
                      type="number"
                      value={config.port}
                      onChange={(e) => setConfig({ ...config, port: e.target.value })}
                      placeholder="3306"
                      className="w-full bg-[#212528] border border-[#2C3034] rounded-lg px-3 py-2 text-xs text-[#EDEEEA] font-mono focus:outline-none focus:border-[#C9FF3D]"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-medium text-[#9A9E9F] uppercase mb-1">
                      Database Name
                    </label>
                    <input
                      type="text"
                      value={config.database}
                      onChange={(e) => setConfig({ ...config, database: e.target.value })}
                      placeholder="cfit_db"
                      className="w-full bg-[#212528] border border-[#2C3034] rounded-lg px-3 py-2 text-xs text-[#EDEEEA] font-mono focus:outline-none focus:border-[#C9FF3D]"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-[#9A9E9F] uppercase mb-1">
                      Username
                    </label>
                    <input
                      type="text"
                      value={config.user}
                      onChange={(e) => setConfig({ ...config, user: e.target.value })}
                      placeholder="root"
                      className="w-full bg-[#212528] border border-[#2C3034] rounded-lg px-3 py-2 text-xs text-[#EDEEEA] font-mono focus:outline-none focus:border-[#C9FF3D]"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-[#9A9E9F] uppercase mb-1">
                    Password (leave empty if using XAMPP default)
                  </label>
                  <input
                    type="password"
                    value={config.password}
                    onChange={(e) => setConfig({ ...config, password: e.target.value })}
                    placeholder="Enter password or leave blank"
                    className="w-full bg-[#212528] border border-[#2C3034] rounded-lg px-3 py-2 text-xs text-[#EDEEEA] font-mono focus:outline-none focus:border-[#C9FF3D]"
                  />
                </div>

                <div className="pt-2 flex items-center justify-between">
                  <span className="text-[11px] text-[#5D6164]">
                    Defaults: XAMPP user <code>root</code> with empty password, or standard MySQL user <code>root</code> / <code>root</code>.
                  </span>
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="px-4 py-2 bg-[#C9FF3D] hover:bg-[#B5EB34] text-[#101214] font-bold text-xs rounded-lg transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                    <span>Save & Test</span>
                  </button>
                </div>
              </form>
            </div>

            {/* JDBC Connection String Card */}
            <div className="lg:col-span-5 space-y-4">
              <div className="bg-[#1A1D21] border border-[#2C3034] rounded-xl p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#EDEEEA] flex items-center gap-1.5">
                    <Code2 className="w-4 h-4 text-[#C9FF3D]" />
                    JDBC Connection URL
                  </span>
                  <button
                    onClick={() => copyToClipboard(jdbcUrl, 'jdbc')}
                    className="text-xs text-[#C9FF3D] hover:underline flex items-center gap-1 cursor-pointer font-mono"
                  >
                    {copiedJdbc ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedJdbc ? 'Copied!' : 'Copy'}</span>
                  </button>
                </div>
                <div className="p-3 bg-[#212528] rounded-lg border border-[#2C3034] text-xs font-mono text-[#EDEEEA] break-all select-all">
                  {jdbcUrl}
                </div>
                <div className="space-y-1.5 text-[11px] text-[#9A9E9F]">
                  <div className="flex justify-between">
                    <span className="text-[#5D6164]">Driver Class:</span>
                    <span className="font-mono text-[#C9FF3D]">com.mysql.cj.jdbc.Driver</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#5D6164]">Dialect:</span>
                    <span className="font-mono">MySQL 8.0+ / InnoDB</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#5D6164]">Character Set:</span>
                    <span className="font-mono">utf8mb4</span>
                  </div>
                </div>
              </div>

              {/* Bundled JAR Info */}
              <div className="bg-[#1A1D21] border border-[#2C3034] rounded-xl p-5 space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-[#EDEEEA]">
                  <ShieldCheck className="w-4 h-4 text-[#8FB82A]" />
                  <span>MySQL Connector/J Bundled</span>
                </div>
                <p className="text-xs text-[#9A9E9F]">
                  The official driver <code className="text-[#C9FF3D]">mysql-connector-j-8.3.0.jar</code> is included in the project <code className="text-[#EDEEEA]">lib/</code> directory and pre-configured for Java.
                </p>
                <div className="pt-1 text-[11px] font-mono text-[#5D6164]">
                  Run Command: <code>./run_java.sh</code>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: Schema & Tables */}
      {activeTab === 'schema' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center bg-[#1A1D21] border border-[#2C3034] p-4 rounded-xl">
            <div>
              <h3 className="text-sm font-bold text-[#EDEEEA]">Converted MySQL Tables (8 Total)</h3>
              <p className="text-xs text-[#9A9E9F]">
                Transformed from TypeScript types and SQLite schemas into normalized MySQL InnoDB tables.
              </p>
            </div>
            <button
              onClick={handleDownloadSql}
              className="px-3.5 py-1.5 bg-[#C9FF3D] hover:bg-[#B5EB34] text-[#101214] font-bold text-xs rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download SQL Dump</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3.5">
            {[
              {
                table: 'members',
                desc: 'Client memberships, plans, dates, coaches',
                keys: 'id (PK), member_code (UQ), trainer_id (FK)',
                records: 'neeraj, abin, sadi, vinod, farzan, JOVIN',
              },
              {
                table: 'trainers',
                desc: 'Personal coaches & trainers directory',
                keys: 'id (PK), trainer_code (UQ)',
                records: 'Vikram Sethi, Sneha Pillai, Anand Jacob, Meera Varma',
              },
              {
                table: 'attendance',
                desc: 'RFID turnstile & reception check-in logs',
                keys: 'id (PK), member_id (IDX), check_in_time',
                records: 'Logged timestamps, check-out times, duration',
              },
              {
                table: 'payments',
                desc: 'Invoices, membership fees & billing status',
                keys: 'id (PK), invoice_number (UQ), member_id',
                records: '₹2,500, ₹28,000, ₹1,800, ₹14,000, ₹3,500',
              },
              {
                table: 'classes',
                desc: 'Group fitness schedule & studio capacity',
                keys: 'id (PK), trainer_id (FK)',
                records: 'CrossFit, HIIT Blitz, Power Yoga, Spin Blast',
              },
              {
                table: 'class_bookings',
                desc: 'Member reservation roster per class',
                keys: 'id (PK), (class_id, member_id) UQ',
                records: 'Relational join between classes and members',
              },
              {
                table: 'staff_users',
                desc: 'Reception, trainer & manager accounts',
                keys: 'id (PK), username (UQ)',
                records: 'staff, adhil, dnv, balu, abhiram, JOVIN',
              },
              {
                table: 'admin',
                desc: 'Master administrator system credentials',
                keys: 'id (PK), username (UQ)',
                records: 'admin / admin123',
              },
            ].map((item) => (
              <div key={item.table} className="bg-[#1A1D21] border border-[#2C3034] rounded-xl p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-sm font-bold text-[#C9FF3D]">{item.table}</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-[#212528] text-[#9A9E9F] font-mono">
                    InnoDB
                  </span>
                </div>
                <p className="text-xs text-[#EDEEEA]">{item.desc}</p>
                <div className="text-[11px] text-[#5D6164] font-mono">
                  <span className="text-[#9A9E9F]">Keys:</span> {item.keys}
                </div>
                <div className="text-[10px] text-[#8FB82A] bg-[#212528] p-2 rounded border border-[#2C3034]">
                  {item.records}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: Java JDBC Code */}
      {activeTab === 'code' && (
        <div className="bg-[#1A1D21] border border-[#2C3034] rounded-xl overflow-hidden space-y-0">
          <div className="flex justify-between items-center px-5 py-3.5 bg-[#151719] border-b border-[#2C3034]">
            <div className="flex items-center gap-2">
              <Code2 className="w-4 h-4 text-[#C9FF3D]" />
              <span className="text-xs font-bold text-[#EDEEEA]">
                Java MySQL JDBC Connection Implementation (com.cfit.jdbc.MySQLDemo)
              </span>
            </div>
            <button
              onClick={() => copyToClipboard(javaCodeSnippet, 'java')}
              className="px-3 py-1 bg-[#212528] hover:bg-[#2C3034] text-[#C9FF3D] border border-[#2C3034] rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              {copiedJava ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
              <span>{copiedJava ? 'Copied Code!' : 'Copy Java Code'}</span>
            </button>
          </div>
          <pre className="p-5 text-xs font-mono text-[#EDEEEA] overflow-x-auto bg-[#101214] leading-relaxed">
            {javaCodeSnippet}
          </pre>
        </div>
      )}

      {/* TAB 4: Setup Guide & Troubleshooting */}
      {activeTab === 'guide' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="bg-[#1A1D21] border border-[#2C3034] rounded-xl p-5 space-y-3">
            <h3 className="text-sm font-bold text-[#EDEEEA] flex items-center gap-2">
              <Terminal className="w-4 h-4 text-[#C9FF3D]" />
              Option 1: Using XAMPP / WAMP (Easiest for Windows/Mac)
            </h3>
            <ol className="list-decimal list-inside text-xs text-[#9A9E9F] space-y-2">
              <li>Open <strong>XAMPP Control Panel</strong> and click <strong>Start</strong> next to MySQL.</li>
              <li>Open your browser to <code className="text-[#C9FF3D]">http://localhost/phpmyadmin</code>.</li>
              <li>Click <strong>Import</strong> in phpMyAdmin and upload <code className="text-[#EDEEEA]">schema_mysql.sql</code>.</li>
              <li>Database <code className="text-[#C9FF3D]">cfit_db</code> is created with all 8 tables and records.</li>
              <li>Run <code className="text-[#EDEEEA]">./run_java.sh</code> in the project terminal.</li>
            </ol>
          </div>

          <div className="bg-[#1A1D21] border border-[#2C3034] rounded-xl p-5 space-y-3">
            <h3 className="text-sm font-bold text-[#EDEEEA] flex items-center gap-2">
              <Terminal className="w-4 h-4 text-[#C9FF3D]" />
              Option 2: Using MySQL CLI or Terminal
            </h3>
            <div className="space-y-2 text-xs">
              <p className="text-[#9A9E9F]">Create database and import directly from command line:</p>
              <div className="p-3 bg-[#101214] border border-[#2C3034] rounded-lg font-mono text-xs text-[#C9FF3D]">
                mysql -u root -p &lt; src/db/schema_mysql.sql
              </div>
              <p className="text-[#9A9E9F] mt-2">To test the JDBC connection from terminal:</p>
              <div className="p-3 bg-[#101214] border border-[#2C3034] rounded-lg font-mono text-xs text-[#EDEEEA]">
                java -cp "java/bin:lib/*" com.cfit.jdbc.TestMySQLConnection
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
