import React, { useState, useEffect } from 'react';
import {
  X,
  Database,
  RefreshCw,
  Download,
  Upload,
  Search,
  Code,
  Layers,
  Sparkles,
  Smartphone,
  Server,
  Check,
  AlertCircle,
  Play,
  FileCode2,
  Copy
} from 'lucide-react';
import { gymDb } from '../../db/database.ts';

interface DatabaseSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNotify: (msg: string) => void;
}

export const DatabaseSyncModal: React.FC<DatabaseSyncModalProps> = ({
  isOpen,
  onClose,
  onNotify
}) => {
  // Tabs: 'tables' (Database List), 'schema' (schema.sql), or 'sync' (Cloud / Java Sync tools)
  const [activeTab, setActiveTab] = useState<'tables' | 'schema' | 'sync'>('tables');
  const [copiedSchema, setCopiedSchema] = useState(false);

  // Database tables list & active selected table
  const [tableCounts, setTableCounts] = useState<{ table: string; count: number }[]>([]);
  const [selectedTable, setSelectedTable] = useState<string>('members');
  const [tableData, setTableData] = useState<{ columns: string[]; values: any[][] }>({ columns: [], values: [] });
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoadingTable, setIsLoadingTable] = useState(false);

  // SQL Console
  const [showSqlConsole, setShowSqlConsole] = useState(false);
  const [customSql, setCustomSql] = useState('SELECT * FROM members LIMIT 10;');
  const [sqlResult, setSqlResult] = useState<{ columns?: string[]; values?: any[][]; message?: string; error?: string } | null>(null);

  // Sync settings
  const [serverUrl, setServerUrl] = useState('http://localhost:8080/api');
  const [isCheckingJava, setIsCheckingJava] = useState(false);
  const [isSyncingJava, setIsSyncingJava] = useState(false);
  const [backendStatus, setBackendStatus] = useState<{ connected: boolean; latencyMs?: number; message?: string } | null>(null);
  const [cloudRoom, setCloudRoom] = useState(gymDb.getCloudRoomKey());
  const [copiedLink, setCopiedLink] = useState(false);
  const [isCloudSyncing, setIsCloudSyncing] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadTableList();
      loadActiveTable(selectedTable);
      setCloudRoom(gymDb.getCloudRoomKey());
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      loadActiveTable(selectedTable);
    }
  }, [selectedTable]);

  const loadTableList = async () => {
    try {
      const counts = await gymDb.getTableListWithCounts();
      setTableCounts(counts);
    } catch (e) {
      console.error(e);
    }
  };

  const loadActiveTable = async (tableName: string) => {
    setIsLoadingTable(true);
    try {
      const data = await gymDb.getTableRecords(tableName);
      setTableData(data);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoadingTable(false);
    }
  };

  const handleResetClean5 = async () => {
    const res = await gymDb.resetToCleanFiveRecords();
    onNotify(res.message);
    await loadTableList();
    await loadActiveTable(selectedTable);
  };

  const handleRunSchemaSql = async () => {
    const res = await gymDb.reloadFromSchemaSql();
    onNotify(res.message);
    await loadTableList();
    await loadActiveTable(selectedTable);
  };

  const handleCopySchemaSql = async () => {
    try {
      await navigator.clipboard.writeText(gymDb.getSchemaSql());
      setCopiedSchema(true);
      onNotify('schema.sql copied to clipboard!');
      setTimeout(() => setCopiedSchema(false), 2500);
    } catch {
      onNotify('Failed to copy schema.sql');
    }
  };

  const handleExecuteSql = async () => {
    if (!customSql.trim()) return;
    try {
      const res = await gymDb.executeCustomSql(customSql);
      if (res.success) {
        setSqlResult({ columns: res.columns, values: res.values, message: res.message });
        loadTableList();
        loadActiveTable(selectedTable);
      } else {
        setSqlResult({ error: res.message });
      }
    } catch (err: any) {
      setSqlResult({ error: err?.message || 'SQL execution failed.' });
    }
  };

  const handleExportJson = async () => {
    try {
      const jsonStr = await gymDb.exportCompleteDatabaseJson();
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `cfit_database_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      onNotify('Database JSON exported successfully!');
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
      a.download = `cfit_database_dump_${new Date().toISOString().split('T')[0]}.sql`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      onNotify('Database SQL dump generated and downloaded!');
    } catch (e: any) {
      onNotify('SQL Export failed: ' + e?.message);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const result = await gymDb.importCompleteDatabaseJson(text);
        onNotify(result.message);
        loadTableList();
        loadActiveTable(selectedTable);
      } catch (err: any) {
        onNotify('Import error: ' + (err?.message || 'Invalid format'));
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const testBackend = async () => {
    setIsCheckingJava(true);
    const res = await gymDb.checkBackendStatus(serverUrl);
    setBackendStatus(res);
    setIsCheckingJava(false);
  };

  const handleSyncWithJava = async () => {
    setIsSyncingJava(true);
    const res = await gymDb.syncWithJavaBackend(serverUrl);
    setIsSyncingJava(false);
    onNotify(res.message);
    if (res.success) {
      loadTableList();
      loadActiveTable(selectedTable);
    }
  };

  const handleForceCloudPush = () => {
    gymDb.pushToCloudRelay();
    onNotify('Current database broadcast to Cloud Relay!');
  };

  const handleForceCloudPull = async () => {
    setIsCloudSyncing(true);
    const success = await gymDb.pollCloudRelay();
    setIsCloudSyncing(false);
    if (success) {
      onNotify('Synchronized latest records from Cloud Relay!');
      loadTableList();
      loadActiveTable(selectedTable);
    } else {
      onNotify('Checked Cloud Relay. Database is already up to date.');
    }
  };

  const handleCopyPairingLink = async () => {
    try {
      const origin = window.location.origin;
      const pathname = window.location.pathname;
      const pairingUrl = `${origin}${pathname}?sync=${encodeURIComponent(cloudRoom)}`;
      await navigator.clipboard.writeText(pairingUrl);
      setCopiedLink(true);
      onNotify('Pairing link copied to clipboard!');
      setTimeout(() => setCopiedLink(false), 3000);
    } catch {
      onNotify(`Sync link: ${window.location.origin}?sync=${cloudRoom}`);
    }
  };

  if (!isOpen) return null;

  // Filter table data by search query
  const filteredValues = tableData.values.filter((row) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return row.some((val) => String(val ?? '').toLowerCase().includes(query));
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-[#1A1D21] border border-[#2C3034] rounded-2xl w-full max-w-5xl h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-[#2C3034] flex items-center justify-between bg-[#151719] shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#C9FF3D]/10 border border-[#C9FF3D]/30 flex items-center justify-center text-[#C9FF3D] shadow-sm">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-[#EDEEEA]">
                  Database Explorer & Tables
                </h2>
                <span className="flex items-center gap-1.5 text-[10px] px-2 py-0.5 rounded-full bg-[#8FB82A]/20 text-[#C9FF3D] border border-[#C9FF3D]/30 font-mono font-bold">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#C9FF3D] animate-pulse" />
                  DB: CONNECTED
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-[#212528] text-[#9A9E9F] border border-[#2C3034] font-mono">
                  SQLite 3.40 (sql.js)
                </span>
              </div>
              <p className="text-xs text-[#9A9E9F] mt-0.5">
                Inspect raw database tables, verify records, and manage live data collections
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Main Tabs */}
            <div className="hidden sm:flex bg-[#212528] p-0.5 rounded-lg border border-[#2C3034]">
              <button
                onClick={() => setActiveTab('tables')}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                  activeTab === 'tables'
                    ? 'bg-[#C9FF3D] text-[#101214] shadow-sm'
                    : 'text-[#9A9E9F] hover:text-[#EDEEEA]'
                }`}
              >
                Database Tables
              </button>
              <button
                onClick={() => setActiveTab('schema')}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'schema'
                    ? 'bg-[#C9FF3D] text-[#101214] shadow-sm'
                    : 'text-[#9A9E9F] hover:text-[#EDEEEA]'
                }`}
              >
                <FileCode2 className="w-3.5 h-3.5" />
                <span>schema.sql</span>
              </button>
              <button
                onClick={() => setActiveTab('sync')}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                  activeTab === 'sync'
                    ? 'bg-[#C9FF3D] text-[#101214] shadow-sm'
                    : 'text-[#9A9E9F] hover:text-[#EDEEEA]'
                }`}
              >
                Cloud & Sync Tools
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-2 text-[#9A9E9F] hover:text-[#EDEEEA] hover:bg-[#212528] rounded-lg transition-colors cursor-pointer ml-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Mobile Tab Toggle */}
        <div className="sm:hidden flex bg-[#151719] border-b border-[#2C3034] p-2 gap-1 shrink-0">
          <button
            onClick={() => setActiveTab('tables')}
            className={`flex-1 py-1.5 rounded text-xs font-semibold transition-all ${
              activeTab === 'tables' ? 'bg-[#C9FF3D] text-[#101214]' : 'text-[#9A9E9F] bg-[#212528]'
            }`}
          >
            Tables
          </button>
          <button
            onClick={() => setActiveTab('schema')}
            className={`flex-1 py-1.5 rounded text-xs font-semibold transition-all ${
              activeTab === 'schema' ? 'bg-[#C9FF3D] text-[#101214]' : 'text-[#9A9E9F] bg-[#212528]'
            }`}
          >
            schema.sql
          </button>
          <button
            onClick={() => setActiveTab('sync')}
            className={`flex-1 py-1.5 rounded text-xs font-semibold transition-all ${
              activeTab === 'sync' ? 'bg-[#C9FF3D] text-[#101214]' : 'text-[#9A9E9F] bg-[#212528]'
            }`}
          >
            Sync
          </button>
        </div>

        {activeTab === 'tables' ? (
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            {/* Table Selector Pills */}
            <div className="px-4 sm:px-5 py-3 bg-[#17191C] border-b border-[#2C3034] overflow-x-auto shrink-0 flex items-center gap-2">
              <span className="text-[11px] font-bold text-[#5D6164] uppercase tracking-wider shrink-0 mr-1 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-[#C9FF3D]" />
                Tables:
              </span>
              {tableCounts.map(({ table, count }) => {
                const isSelected = selectedTable === table;
                return (
                  <button
                    key={table}
                    onClick={() => {
                      setSelectedTable(table);
                      setSearchQuery('');
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-2 shrink-0 cursor-pointer border ${
                      isSelected
                        ? 'bg-[#C9FF3D]/15 text-[#C9FF3D] border-[#C9FF3D]/50 font-bold'
                        : 'bg-[#212528] text-[#9A9E9F] border-[#2C3034] hover:bg-[#2C3034] hover:text-[#EDEEEA]'
                    }`}
                  >
                    <span>{table}</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                        isSelected ? 'bg-[#C9FF3D] text-[#101214]' : 'bg-[#1A1D21] text-[#EDEEEA]'
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Sub-toolbar: Search + Action Buttons */}
            <div className="p-3 sm:px-5 sm:py-2.5 bg-[#1A1D21] border-b border-[#2C3034] flex flex-wrap items-center justify-between gap-3 shrink-0">
              <div className="relative flex-1 min-w-[200px] max-w-md">
                <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-[#5D6164]" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={`Search records in '${selectedTable}'...`}
                  className="w-full bg-[#212528] border border-[#2C3034] rounded-lg pl-8 pr-3 py-1.5 text-xs text-[#EDEEEA] placeholder:text-[#5D6164] focus:outline-none focus:border-[#C9FF3D]"
                />
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => loadActiveTable(selectedTable)}
                  disabled={isLoadingTable}
                  className="px-2.5 py-1.5 bg-[#212528] hover:bg-[#2C3034] text-[#EDEEEA] border border-[#2C3034] rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                  title="Refresh table records"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoadingTable ? 'animate-spin' : ''}`} />
                  <span className="hidden sm:inline">Refresh</span>
                </button>

                <button
                  onClick={handleRunSchemaSql}
                  className="px-2.5 py-1.5 bg-[#212528] hover:bg-[#2C3034] text-[#C9FF3D] border border-[#C9FF3D]/40 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                  title="Execute schema.sql to initialize or enforce all tables"
                >
                  <FileCode2 className="w-3.5 h-3.5" />
                  <span>Run schema.sql</span>
                </button>

                <button
                  onClick={handleResetClean5}
                  className="px-2.5 py-1.5 bg-[#212528] hover:bg-[#2C3034] text-[#EDEEEA] border border-[#2C3034] rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                  title="Purge duplicates and enforce clean 5 records"
                >
                  <Sparkles className="w-3.5 h-3.5 text-[#C9FF3D]" />
                  <span>Enforce 5 Records</span>
                </button>

                <button
                  onClick={() => setShowSqlConsole(!showSqlConsole)}
                  className={`px-2.5 py-1.5 border rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer ${
                    showSqlConsole
                      ? 'bg-[#C9FF3D]/20 text-[#C9FF3D] border-[#C9FF3D]'
                      : 'bg-[#212528] hover:bg-[#2C3034] text-[#EDEEEA] border-[#2C3034]'
                  }`}
                  title="Toggle SQL Query Console"
                >
                  <Code className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">SQL Console</span>
                </button>

                <button
                  onClick={handleExportJson}
                  className="px-2.5 py-1.5 bg-[#212528] hover:bg-[#2C3034] text-[#EDEEEA] border border-[#2C3034] rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                  title="Export database as JSON"
                >
                  <Download className="w-3.5 h-3.5 text-[#C9FF3D]" />
                  <span className="hidden md:inline">JSON</span>
                </button>

                <button
                  onClick={handleExportSql}
                  className="px-2.5 py-1.5 bg-[#212528] hover:bg-[#2C3034] text-[#EDEEEA] border border-[#2C3034] rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                  title="Export database as SQL Dump"
                >
                  <Download className="w-3.5 h-3.5 text-[#C9FF3D]" />
                  <span className="hidden md:inline">SQL</span>
                </button>
              </div>
            </div>

            {/* Optional SQL Console Panel */}
            {showSqlConsole && (
              <div className="p-3 sm:px-5 bg-[#151719] border-b border-[#2C3034] space-y-2 shrink-0 animate-fade-in">
                <div className="flex items-center justify-between text-xs font-mono text-[#9A9E9F]">
                  <span className="flex items-center gap-1.5 text-[#C9FF3D]">
                    <Code className="w-3.5 h-3.5" /> SQLite SQL Console
                  </span>
                  <span>Direct SQLite database query execution</span>
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={customSql}
                    onChange={(e) => setCustomSql(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleExecuteSql()}
                    placeholder="SELECT * FROM members WHERE status = 'Active';"
                    className="flex-1 bg-[#1A1D21] border border-[#2C3034] rounded-lg px-3 py-1.5 text-xs text-[#EDEEEA] font-mono focus:outline-none focus:border-[#C9FF3D]"
                  />
                  <button
                    onClick={handleExecuteSql}
                    className="px-3 py-1.5 bg-[#C9FF3D] hover:bg-[#B5EB34] text-[#101214] rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
                  >
                    <Play className="w-3 h-3 fill-current" />
                    <span>Run Query</span>
                  </button>
                </div>
                {sqlResult && (
                  <div
                    className={`text-xs p-2 rounded border font-mono ${
                      sqlResult.error
                        ? 'bg-[#FF5F45]/15 border-[#FF5F45]/40 text-[#FF5F45]'
                        : 'bg-[#212528] border-[#2C3034] text-[#C9FF3D]'
                    }`}
                  >
                    {sqlResult.error || sqlResult.message || `Returned ${sqlResult.values?.length || 0} rows`}
                  </div>
                )}
              </div>
            )}

            {/* Data Table Display */}
            <div className="flex-1 overflow-auto bg-[#1A1D21] p-3 sm:p-5">
              {isLoadingTable ? (
                <div className="py-20 flex flex-col items-center justify-center text-[#9A9E9F] gap-2">
                  <RefreshCw className="w-6 h-6 animate-spin text-[#C9FF3D]" />
                  <p className="text-xs">Loading records from SQLite database...</p>
                </div>
              ) : tableData.columns.length === 0 ? (
                <div className="py-20 text-center text-xs text-[#5D6164]">
                  Table is empty or not found.
                </div>
              ) : (
                <div className="border border-[#2C3034] rounded-xl overflow-hidden shadow-sm bg-[#151719]">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-[#212528] border-b border-[#2C3034] text-[#9A9E9F]">
                          <th className="py-2.5 px-3 w-10 text-[10px] font-mono text-[#5D6164] uppercase">
                            #
                          </th>
                          {tableData.columns.map((col) => (
                            <th
                              key={col}
                              className="py-2.5 px-3 font-semibold uppercase tracking-wider text-[11px] text-[#EDEEEA] whitespace-nowrap"
                            >
                              {col}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#2C3034] font-mono">
                        {filteredValues.length === 0 ? (
                          <tr>
                            <td
                              colSpan={tableData.columns.length + 1}
                              className="py-8 text-center text-xs text-[#5D6164]"
                            >
                              {searchQuery ? `No records matching "${searchQuery}"` : 'No records found.'}
                            </td>
                          </tr>
                        ) : (
                          filteredValues.map((row, rIdx) => (
                            <tr
                              key={rIdx}
                              className="hover:bg-[#212528]/60 transition-colors group"
                            >
                              <td className="py-2 px-3 text-[#5D6164] text-[10px]">
                                {rIdx + 1}
                              </td>
                              {row.map((val, cIdx) => {
                                const colName = tableData.columns[cIdx]?.toLowerCase() || '';
                                const isNull = val === null || val === undefined;
                                const strVal = isNull ? 'NULL' : String(val);

                                // Status highlight
                                const isStatus =
                                  colName.includes('status') ||
                                  colName.includes('payment_status');
                                const isIdCode =
                                  colName === 'member_id' || colName === 'trainer_code';

                                return (
                                  <td
                                    key={cIdx}
                                    className="py-2 px-3 text-[#EDEEEA] whitespace-nowrap"
                                  >
                                    {isNull ? (
                                      <span className="text-[#5D6164] italic">null</span>
                                    ) : isStatus ? (
                                      <span
                                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase font-sans ${
                                          strVal === 'Active' || strVal === 'Paid'
                                            ? 'bg-[#8FB82A]/20 text-[#C9FF3D]'
                                            : strVal === 'Pending' || strVal === 'Expiring'
                                            ? 'bg-[#FFAE42]/20 text-[#FFAE42]'
                                            : 'bg-[#FF5F45]/20 text-[#FF5F45]'
                                        }`}
                                      >
                                        {strVal}
                                      </span>
                                    ) : isIdCode ? (
                                      <span className="text-[#C9FF3D] font-bold">
                                        {strVal}
                                      </span>
                                    ) : (
                                      <span>{strVal}</span>
                                    )}
                                  </td>
                                );
                              })}
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Table Footer info */}
                  <div className="p-2.5 bg-[#17191C] border-t border-[#2C3034] flex items-center justify-between text-[11px] text-[#5D6164] px-4">
                    <span>
                      Table: <strong className="text-[#EDEEEA]">{selectedTable}</strong> ({tableData.columns.length} columns)
                    </span>
                    <span>
                      Showing {filteredValues.length} of {tableData.values.length} records
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : activeTab === 'schema' ? (
          /* schema.sql Viewer & Runner */
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-[#151719]">
            <div className="p-4 sm:px-6 sm:py-3 bg-[#1A1D21] border-b border-[#2C3034] flex flex-wrap items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-2">
                <FileCode2 className="w-4 h-4 text-[#C9FF3D]" />
                <div>
                  <h3 className="text-xs font-bold text-[#EDEEEA] uppercase tracking-wider">
                    src/schema.sql (Active Database Blueprint)
                  </h3>
                  <p className="text-[11px] text-[#9A9E9F]">
                    Defines 8 tables (admin, staff_users, trainers, members, attendance, payments, classes, class_bookings)
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopySchemaSql}
                  className="px-3 py-1.5 bg-[#212528] hover:bg-[#2C3034] text-[#EDEEEA] border border-[#2C3034] rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  {copiedSchema ? <Check className="w-3.5 h-3.5 text-[#C9FF3D]" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedSchema ? 'Copied!' : 'Copy SQL'}</span>
                </button>
                <button
                  onClick={handleRunSchemaSql}
                  className="px-3.5 py-1.5 bg-[#C9FF3D] hover:bg-[#b8eb32] text-[#101214] rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Execute schema.sql to DB</span>
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-auto p-4 sm:p-6 font-mono text-xs text-[#EDEEEA] bg-[#121417]">
              <pre className="text-xs text-[#EDEEEA] leading-relaxed select-text font-mono whitespace-pre-wrap">
                {gymDb.getSchemaSql()}
              </pre>
            </div>
          </div>
        ) : (
          /* Sync & Transfer Hub */
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 bg-[#17191C]">
            {/* Cloud Relay Card */}
            <div className="bg-[#212528] border-2 border-[#C9FF3D]/40 rounded-xl p-4 sm:p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Smartphone className="w-5 h-5 text-[#C9FF3D]" />
                  <span className="text-sm font-bold text-[#EDEEEA] uppercase tracking-wider">
                    Cross-Device Cloud Sync
                  </span>
                </div>
                <span className="flex items-center gap-1.5 text-xs text-[#C9FF3D] font-mono bg-[#C9FF3D]/15 px-2.5 py-0.5 rounded-full border border-[#C9FF3D]/40 font-bold">
                  <span className="w-2 h-2 rounded-full bg-[#C9FF3D] animate-pulse" />
                  Active
                </span>
              </div>

              <p className="text-xs text-[#9A9E9F]">
                Changes made on your laptop sync automatically across devices via Cloud Relay.
              </p>

              <div className="flex flex-wrap items-center gap-2 pt-1">
                <button
                  onClick={handleForceCloudPush}
                  className="px-3.5 py-2 bg-[#C9FF3D] hover:bg-[#B5EB34] text-[#101214] rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Push Current DB to Cloud</span>
                </button>
                <button
                  onClick={handleForceCloudPull}
                  disabled={isCloudSyncing}
                  className="px-3.5 py-2 bg-[#1A1D21] hover:bg-[#2C3034] text-[#EDEEEA] border border-[#2C3034] rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isCloudSyncing ? 'animate-spin' : ''}`} />
                  <span>Pull Latest from Cloud</span>
                </button>
                <button
                  onClick={handleCopyPairingLink}
                  className="px-3.5 py-2 bg-[#1A1D21] hover:bg-[#2C3034] text-[#C9FF3D] border border-[#2C3034] rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Smartphone className="w-3.5 h-3.5" />}
                  <span>{copiedLink ? 'Copied Link!' : 'Copy Mobile Pairing Link'}</span>
                </button>
              </div>
            </div>

            {/* Java Desktop Bridge Card */}
            <div className="bg-[#212528] border border-[#2C3034] rounded-xl p-4 sm:p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Server className="w-4 h-4 text-[#C9FF3D]" />
                  <span className="text-xs font-bold text-[#EDEEEA] uppercase tracking-wider">
                    Optional Java Desktop / HTTP Bridge
                  </span>
                </div>
                {backendStatus?.connected ? (
                  <span className="text-xs text-[#C9FF3D] font-mono bg-[#C9FF3D]/10 px-2 py-0.5 rounded border border-[#C9FF3D]/30">
                    Java Online ({backendStatus.latencyMs}ms)
                  </span>
                ) : (
                  <span className="text-xs text-[#9A9E9F] font-mono bg-[#1A1D21] px-2 py-0.5 rounded border border-[#2C3034]">
                    Standalone Web
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={serverUrl}
                  onChange={(e) => setServerUrl(e.target.value)}
                  placeholder="http://localhost:8080/api"
                  className="flex-1 bg-[#1A1D21] border border-[#2C3034] rounded-lg px-3 py-2 text-xs text-[#EDEEEA] font-mono focus:outline-none focus:border-[#C9FF3D]"
                />
                <button
                  onClick={testBackend}
                  disabled={isCheckingJava}
                  className="px-3 py-2 bg-[#1A1D21] hover:bg-[#2C3034] text-[#EDEEEA] border border-[#2C3034] rounded-lg text-xs font-medium transition-colors cursor-pointer disabled:opacity-50"
                >
                  {isCheckingJava ? 'Testing...' : 'Test'}
                </button>
                <button
                  onClick={handleSyncWithJava}
                  disabled={isSyncingJava}
                  className="px-4 py-2 bg-[#C9FF3D] hover:bg-[#B5EB34] text-[#101214] rounded-lg text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
                >
                  {isSyncingJava ? 'Syncing...' : 'Sync with Java'}
                </button>
              </div>

              {backendStatus && (
                <div
                  className={`text-xs p-2.5 rounded-lg border ${
                    backendStatus.connected
                      ? 'bg-[#C9FF3D]/10 border-[#C9FF3D]/30 text-[#C9FF3D]'
                      : 'bg-[#212528] border-[#2C3034] text-[#EDEEEA]'
                  }`}
                >
                  {backendStatus.message}
                </div>
              )}
            </div>

            {/* Import JSON File */}
            <div className="bg-[#212528] border border-[#2C3034] rounded-xl p-4 sm:p-5 space-y-3">
              <span className="text-xs font-bold text-[#EDEEEA] uppercase tracking-wider block">
                Import JSON Snapshot
              </span>
              <p className="text-xs text-[#9A9E9F]">
                Upload a JSON database file to restore or load an external snapshot.
              </p>
              <label className="inline-flex items-center gap-2 px-4 py-2 bg-[#1A1D21] hover:bg-[#2C3034] text-[#EDEEEA] border border-[#2C3034] rounded-lg text-xs font-semibold cursor-pointer transition-colors">
                <Upload className="w-3.5 h-3.5 text-[#C9FF3D]" />
                <span>Upload JSON File</span>
                <input
                  type="file"
                  accept=".json,application/json"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
