import React, { useState, useEffect } from 'react';
import {
  Database,
  RefreshCw,
  Download,
  Upload,
  CheckCircle2,
  Server,
  FileCode2,
  Layers,
  ArrowRight,
  Shield,
  Edit2,
  Check,
  X,
  AlertCircle
} from 'lucide-react';
import { gymDb } from '../../db/database.ts';
import { StaffUser } from '../../types/index.ts';

interface SettingsScreenProps {
  onNotify: (msg: string) => void;
  currentUser?: StaffUser | null;
  onOpenSync?: () => void;
}

export const SettingsScreen: React.FC<SettingsScreenProps> = ({ onNotify, onOpenSync, currentUser }) => {
  const isAdmin = currentUser?.role === 'Admin';
  const [gymName] = useState('C-fit Fitness Club');
  const [branch] = useState('Thiruvananthapuram — Main');
  const [currency] = useState('INR (₹)');
  const [checkinMethod] = useState('Reception Desk');
  const [tableCounts, setTableCounts] = useState<{ table: string; count: number }[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [backendStatus, setBackendStatus] = useState<{ connected: boolean; latencyMs?: number; message?: string } | null>(null);

  // Admin Username Edit
  const [isEditingUsername, setIsEditingUsername] = useState(false);
  const [newAdminUsername, setNewAdminUsername] = useState('');
  const [isSavingUsername, setIsSavingUsername] = useState(false);
  const [usernameError, setUsernameError] = useState('');

  const handleStartEditUsername = () => {
    setNewAdminUsername(currentUser?.username || 'admin');
    setUsernameError('');
    setIsEditingUsername(true);
  };

  const handleSaveAdminUsername = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    const clean = newAdminUsername.trim().toLowerCase();
    if (!clean) {
      setUsernameError('Username cannot be empty.');
      return;
    }
    if (clean.length < 3) {
      setUsernameError('Username must be at least 3 characters.');
      return;
    }
    if (!/^[a-zA-Z0-9_.-]+$/.test(clean)) {
      setUsernameError('Only letters, numbers, hyphens, and underscores allowed.');
      return;
    }
    setIsSavingUsername(true);
    setUsernameError('');
    try {
      const res = await gymDb.updateStaffUser(currentUser.id, { username: clean });
      if (res.success) {
        onNotify(`Admin username updated to @${clean}`);
        setIsEditingUsername(false);
      } else {
        setUsernameError(res.message || 'Failed to update username.');
      }
    } catch (err: any) {
      setUsernameError(err?.message || 'Error updating username.');
    } finally {
      setIsSavingUsername(false);
    }
  };

  useEffect(() => {
    loadCounts();
    checkJava();
  }, []);

  const loadCounts = async () => {
    try {
      const db = await gymDb.getDb();
      const tables = ['staff_users', 'trainers', 'members', 'attendance', 'payments', 'classes', 'class_bookings'];
      const counts: { table: string; count: number }[] = [];
      for (const t of tables) {
        try {
          const res = db.exec(`SELECT COUNT(*) FROM ${t}`);
          const cnt = (res[0]?.values[0]?.[0] as number) || 0;
          counts.push({ table: t, count: cnt });
        } catch {
          // Table may not exist yet
        }
      }
      setTableCounts(counts);
    } catch (e) {
      console.error(e);
    }
  };

  const checkJava = async () => {
    const res = await gymDb.checkBackendStatus();
    setBackendStatus(res);
  };

  const handleQuickSync = async () => {
    setIsSyncing(true);
    const res = await gymDb.syncWithJavaBackend();
    setIsSyncing(false);
    onNotify(res.message);
    loadCounts();
    checkJava();
  };

  const handleExecuteSchemaSql = async () => {
    const res = await gymDb.reloadFromSchemaSql();
    onNotify(res.message);
    loadCounts();
  };

  const handleExportJson = async () => {
    try {
      const jsonStr = await gymDb.exportCompleteDatabaseJson();
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `cfit_full_db_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      onNotify('Database JSON downloaded successfully!');
    } catch (e: any) {
      onNotify('Export failed: ' + e?.message);
    }
  };

  const handleExportSql = async () => {
    try {
      const sqlStr = await gymDb.exportCompleteDatabaseSql();
      const blob = new Blob([sqlStr], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `cfit_sql_backup_${new Date().toISOString().split('T')[0]}.sql`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      onNotify('SQL Dump generated successfully!');
    } catch (e: any) {
      onNotify('SQL Export failed: ' + e?.message);
    }
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const res = await gymDb.importCompleteDatabaseJson(text);
        onNotify(res.message);
        loadCounts();
      } catch (err: any) {
        onNotify('Import failed: ' + err?.message);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="space-y-6">
      {/* Topbar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="font-anton text-3xl tracking-wide text-[#EDEEEA]">Settings & System Hub</h1>
          <p className="text-xs text-[#9A9E9F] mt-1">
            Database connection, live synchronization, and organization configuration
          </p>
        </div>
        {onOpenSync && isAdmin && (
          <button
            onClick={onOpenSync}
            className="px-4 py-2 bg-[#C9FF3D] hover:bg-[#b8eb32] text-[#101214] font-bold text-xs rounded-lg transition-colors flex items-center gap-2 cursor-pointer shadow-sm"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Open Database Tables</span>
          </button>
        )}
      </div>

      {/* Database Connection & Sync Status Panel */}
      <div className="bg-[#1A1D21] border border-[#2C3034] rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-[#2C3034] pb-3">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-[#C9FF3D]" />
            <h3 className="text-sm font-bold text-[#EDEEEA]">Database Connection & Real-Time Sync</h3>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#C9FF3D] animate-pulse" />
            <span className="text-xs font-mono font-bold text-[#C9FF3D]">SQLite WASM Active</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="bg-[#212528] p-3.5 rounded-lg border border-[#2C3034]">
            <div className="text-[10px] text-[#5D6164] uppercase font-mono">Persistence Engine</div>
            <div className="text-xs font-bold text-[#EDEEEA] mt-1 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-[#C9FF3D]" />
              <span>In-Browser SQLite + LocalStorage</span>
            </div>
            <div className="text-[10px] text-[#8FB82A] mt-1">Auto-persisted on all mutations</div>
          </div>

          <div className="bg-[#212528] p-3.5 rounded-lg border border-[#2C3034]">
            <div className="text-[10px] text-[#5D6164] uppercase font-mono">Multi-Tab Realtime Bus</div>
            <div className="text-xs font-bold text-[#EDEEEA] mt-1 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-[#C9FF3D]" />
              <span>BroadcastChannel Active</span>
            </div>
            <div className="text-[10px] text-[#9A9E9F] mt-1">Changes sync live across all windows</div>
          </div>

          <div className="bg-[#212528] p-3.5 rounded-lg border border-[#2C3034]">
            <div className="text-[10px] text-[#5D6164] uppercase font-mono">Java Backend (:8080)</div>
            <div className="text-xs font-bold text-[#EDEEEA] mt-1 flex items-center gap-1.5">
              <Server className="w-3.5 h-3.5 text-[#C9FF3D]" />
              <span>{backendStatus?.connected ? `Connected (${backendStatus.latencyMs}ms)` : 'Standalone Web'}</span>
            </div>
            <div className="text-[10px] text-[#9A9E9F] mt-1">
              {backendStatus?.connected ? 'OOP Service in sync' : 'Run ./run_java.sh to bridge'}
            </div>
          </div>
        </div>

        {/* Quick Sync & Backup Controls */}
        <div className="pt-2 flex flex-wrap items-center gap-2.5">
          <button
            onClick={handleQuickSync}
            disabled={isSyncing}
            className="px-3.5 py-2 bg-[#212528] hover:bg-[#2C3034] text-[#C9FF3D] border border-[#2C3034] hover:border-[#C9FF3D]/40 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'Syncing...' : 'Sync with Java Backend'}</span>
          </button>

          <button
            onClick={handleExecuteSchemaSql}
            className="px-3.5 py-2 bg-[#212528] hover:bg-[#2C3034] text-[#C9FF3D] border border-[#C9FF3D]/40 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Execute schema.sql directly into database"
          >
            <FileCode2 className="w-3.5 h-3.5" />
            <span>Execute schema.sql</span>
          </button>

          <button
            onClick={handleExportJson}
            className="px-3.5 py-2 bg-[#212528] hover:bg-[#2C3034] text-[#EDEEEA] border border-[#2C3034] rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-[#C9FF3D]" />
            <span>Download Full Database (JSON)</span>
          </button>

          <button
            onClick={handleExportSql}
            className="px-3.5 py-2 bg-[#212528] hover:bg-[#2C3034] text-[#EDEEEA] border border-[#2C3034] rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <FileCode2 className="w-3.5 h-3.5 text-[#C9FF3D]" />
            <span>Download SQL Backup (.sql)</span>
          </button>

          <label className="px-3.5 py-2 bg-[#212528] hover:bg-[#2C3034] text-[#EDEEEA] border border-[#2C3034] rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer">
            <Upload className="w-3.5 h-3.5 text-[#C9FF3D]" />
            <span>Import Database File</span>
            <input
              type="file"
              accept=".json"
              onChange={handleImportFile}
              className="hidden"
            />
          </label>

          {onOpenSync && isAdmin && (
            <button
              onClick={onOpenSync}
              className="ml-auto text-xs text-[#C9FF3D] hover:underline flex items-center gap-1 cursor-pointer font-medium"
            >
              <span>View Database Tables</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* Database Schema Diagnostics */}
      <div className="bg-[#1A1D21] border border-[#2C3034] rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-2 border-b border-[#2C3034] pb-3">
          <Database className="w-4 h-4 text-[#C9FF3D]" />
          <h3 className="text-sm font-bold text-[#EDEEEA]">Synchronized Database Records (SQLite Tables)</h3>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
          {tableCounts.map((tc) => (
            <div key={tc.table} className="bg-[#212528] p-3 rounded-lg border border-[#2C3034] text-center">
              <div className="text-[10px] text-[#5D6164] uppercase font-mono truncate">{tc.table}</div>
              <div className="text-xl font-bold font-mono text-[#EDEEEA] mt-1">{tc.count}</div>
              <div className="text-[10px] text-[#8FB82A]">records</div>
            </div>
          ))}
        </div>
      </div>

      {/* Administrator Account & Username Settings */}
      {isAdmin && currentUser && (
        <div className="bg-[#1A1D21] border border-[#2C3034] rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-[#2C3034] pb-3">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-[#C9FF3D]" />
              <h3 className="text-sm font-bold text-[#EDEEEA]">Administrator Profile & Username</h3>
            </div>
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-[#C9FF3D]/15 text-[#C9FF3D] border border-[#C9FF3D]/30 uppercase">
              Full Privileges
            </span>
          </div>

          {!isEditingUsername ? (
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-[#212528] p-4 rounded-lg border border-[#2C3034]">
              <div className="space-y-1">
                <div className="text-sm font-bold text-[#EDEEEA]">{currentUser.full_name}</div>
                <div className="text-xs text-[#9A9E9F] flex items-center gap-2">
                  <span>Current Username:</span>
                  <span className="text-[#C9FF3D] font-mono font-bold bg-[#101214] px-2 py-0.5 rounded border border-[#2C3034]">
                    @{currentUser.username}
                  </span>
                </div>
                <p className="text-[11px] text-[#5D6164]">
                  This handle is used to log in as Administrator to the terminal and SQLite database.
                </p>
              </div>

              <button
                type="button"
                onClick={handleStartEditUsername}
                className="px-3.5 py-2 bg-[#C9FF3D] hover:bg-[#b8eb32] text-[#101214] font-bold text-xs rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm shrink-0"
              >
                <Edit2 className="w-3.5 h-3.5" />
                <span>Change My Username</span>
              </button>
            </div>
          ) : (
            <form onSubmit={handleSaveAdminUsername} className="bg-[#212528] p-4 rounded-lg border border-[#C9FF3D]/40 space-y-3">
              <div className="text-xs font-bold text-[#EDEEEA]">Modify Administrator Username</div>

              {usernameError && (
                <div className="p-2.5 bg-[#FF5F45]/15 border border-[#FF5F45]/40 text-[#FF5F45] text-xs rounded-lg flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{usernameError}</span>
                </div>
              )}

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <div className="relative flex-1">
                  <span className="absolute left-3 top-2.5 text-xs text-[#5D6164] font-mono">@</span>
                  <input
                    type="text"
                    value={newAdminUsername}
                    onChange={(e) => setNewAdminUsername(e.target.value.toLowerCase().replace(/\s+/g, ''))}
                    placeholder="Enter new username"
                    className="w-full bg-[#1A1D21] border border-[#2C3034] rounded-lg pl-7 pr-3 py-2 text-xs text-[#EDEEEA] font-mono focus:outline-none focus:border-[#C9FF3D]"
                    required
                    autoFocus
                  />
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="submit"
                    disabled={isSavingUsername}
                    className="px-3.5 py-2 bg-[#C9FF3D] hover:bg-[#b8eb32] text-[#101214] font-bold text-xs rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>{isSavingUsername ? 'Saving...' : 'Save Username'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsEditingUsername(false)}
                    className="px-3 py-2 bg-[#1A1D21] hover:bg-[#2C3034] text-[#9A9E9F] hover:text-[#EDEEEA] border border-[#2C3034] rounded-lg text-xs font-medium transition-colors cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <p className="text-[10px] text-[#5D6164]">
                Username must be at least 3 characters and unique. Uppercase letters will automatically be converted to lowercase.
              </p>
            </form>
          )}
        </div>
      )}

      {/* Gym Organization Details */}
      <div className="bg-[#1A1D21] border border-[#2C3034] rounded-xl p-5 space-y-4">
        <h3 className="text-sm font-bold text-[#EDEEEA] border-b border-[#2C3034] pb-3">
          Gym Organization Details
        </h3>

        <div className="flex justify-between items-center py-2 border-b border-[#2C3034] text-xs">
          <span className="text-[#5D6164]">Gym name</span>
          <span className="font-medium text-[#EDEEEA]">{gymName}</span>
        </div>

        <div className="flex justify-between items-center py-2 border-b border-[#2C3034] text-xs">
          <span className="text-[#5D6164]">Branch</span>
          <span className="font-medium text-[#EDEEEA]">{branch}</span>
        </div>

        <div className="flex justify-between items-center py-2 border-b border-[#2C3034] text-xs">
          <span className="text-[#5D6164]">Check-in method</span>
          <span className="font-medium text-[#EDEEEA]">{checkinMethod}</span>
        </div>

        <div className="flex justify-between items-center py-2 border-b border-[#2C3034] text-xs">
          <span className="text-[#5D6164]">Currency</span>
          <span className="font-medium text-[#EDEEEA]">{currency}</span>
        </div>
      </div>
    </div>
  );
};
