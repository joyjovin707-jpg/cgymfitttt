import express from 'express';
import { createServer as createViteServer } from 'vite';
import fs from 'fs';
import path from 'path';
import os from 'os';
import {
  testMySQLConnection,
  initializeMySQLDatabase,
  updateMySQLConfig,
  getActiveMySQLConfig,
  getJDBCConnectionInfo,
  syncDataToMySQL,
} from './src/db/mysqlService.ts';
const PORT = 3000;
const SERVER_DEVICE_ID = 'cfit_server_daemon';
const DATA_DIR = path.resolve(import.meta.dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'cfit_shared_db.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

export interface SharedGymData {
  members: any[];
  staff_users: any[];
  trainers: any[];
  attendance: any[];
  payments: any[];
  classes: any[];
  class_bookings: any[];
  updatedAt?: string;
  senderId?: string;
}

// Robust SQL parser to extract seed records from src/schema.sql
function parseSqlInserts(sql: string): SharedGymData {
  const result: SharedGymData = {
    updatedAt: new Date().toISOString(),
    senderId: SERVER_DEVICE_ID,
    members: [],
    staff_users: [],
    trainers: [],
    attendance: [],
    payments: [],
    classes: [],
    class_bookings: [],
  };

  const insertRegex = /INSERT\s+(?:OR\s+IGNORE\s+)?INTO\s+([a-zA-Z0-9_]+)\s*\(([^)]+)\)\s*VALUES\s*([\s\S]+?);/gi;
  let match;
  while ((match = insertRegex.exec(sql)) !== null) {
    const table = match[1].toLowerCase();
    const cols = match[2].split(',').map((c) => c.trim().toLowerCase());
    const valuesBlock = match[3].trim();

    // Parse each row (...)
    const rowRegex = /\(([^)]+)\)/g;
    let rowMatch;
    const rows: any[] = [];
    while ((rowMatch = rowRegex.exec(valuesBlock)) !== null) {
      const rawVals: string[] = [];
      let currentVal = '';
      let inQuote = false;
      let quoteChar = '';
      const text = rowMatch[1];
      for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if ((ch === "'" || ch === '"') && (i === 0 || text[i - 1] !== '\\')) {
          if (!inQuote) {
            inQuote = true;
            quoteChar = ch;
          } else if (quoteChar === ch) {
            inQuote = false;
          } else {
            currentVal += ch;
          }
        } else if (ch === ',' && !inQuote) {
          rawVals.push(currentVal.trim());
          currentVal = '';
        } else {
          currentVal += ch;
        }
      }
      if (currentVal.trim()) {
        rawVals.push(currentVal.trim());
      }

      const rowObj: any = {};
      cols.forEach((col, idx) => {
        let valStr = rawVals[idx] !== undefined ? rawVals[idx].trim() : null;
        if (valStr === null || valStr.toUpperCase() === 'NULL') {
          rowObj[col] = null;
        } else if (valStr.startsWith("'") && valStr.endsWith("'")) {
          rowObj[col] = valStr.slice(1, -1).replace(/''/g, "'");
        } else if (valStr.startsWith('"') && valStr.endsWith('"')) {
          rowObj[col] = valStr.slice(1, -1);
        } else if (!isNaN(Number(valStr))) {
          rowObj[col] = Number(valStr);
        } else {
          rowObj[col] = valStr;
        }
      });
      rows.push(rowObj);
    }

    if (table === 'members') result.members = rows;
    else if (table === 'staff_users') result.staff_users = rows;
    else if (table === 'trainers') result.trainers = rows;
    else if (table === 'attendance') result.attendance = rows;
    else if (table === 'payments') result.payments = rows;
    else if (table === 'classes') result.classes = rows;
    else if (table === 'class_bookings') result.class_bookings = rows;
  }

  return result;
}

// Initial baseline memory records
function getBaselineDb(): SharedGymData {
  const schemaPath = path.resolve(import.meta.dirname, 'src', 'schema.sql');
  if (fs.existsSync(schemaPath)) {
    try {
      const sql = fs.readFileSync(schemaPath, 'utf-8');
      const parsed = parseSqlInserts(sql);
      if (parsed.members.length > 0) {
        return parsed;
      }
    } catch (e) {
      console.warn('Could not parse src/schema.sql, using fallback baseline:', e);
    }
  }

  return {
    updatedAt: new Date().toISOString(),
    senderId: SERVER_DEVICE_ID,
    members: [
      { id: 1, member_id: 'GYM-0101', full_name: 'neeraj', plan_type: 'Gold', trainer_id: 1, trainer_name: 'Vikram Sethi', join_date: '2025-11-15', expiry_date: '2026-11-15', status: 'Active' },
      { id: 2, member_id: 'GYM-0102', full_name: 'abin', plan_type: 'Platinum', trainer_id: 2, trainer_name: 'Sneha Pillai', join_date: '2026-01-10', expiry_date: '2027-01-10', status: 'Active' },
      { id: 3, member_id: 'GYM-0103', full_name: 'sadi', plan_type: 'Silver', trainer_id: 3, trainer_name: 'Anand Jacob', join_date: '2026-03-01', expiry_date: '2026-09-01', status: 'Active' },
      { id: 4, member_id: 'GYM-0104', full_name: 'vinod', plan_type: 'Gold', trainer_id: 1, trainer_name: 'Vikram Sethi', join_date: '2025-12-05', expiry_date: '2026-12-05', status: 'Active' },
      { id: 5, member_id: 'GYM-0105', full_name: 'farzan', plan_type: 'Platinum', trainer_id: 2, trainer_name: 'Sneha Pillai', join_date: '2026-04-12', expiry_date: '2027-04-12', status: 'Active' }
    ],
    staff_users: [
      { id: 1, username: 'admin', password: 'admin123', full_name: 'JOVIN', role: 'Admin', email: 'admin@cfitgym.com', phone: '+91 98470 11223', shift: 'Full Day', status: 'Active', can_manage_members: true, can_process_payments: true, can_manage_classes: true, can_manage_trainers: true, created_at: '2025-01-01 00:00:00' },
      { id: 2, username: 'staff', password: 'staff123', full_name: 'staff', role: 'Staff', email: 'staff@cfitgym.com', phone: '+91 98470 44556', shift: 'Morning', status: 'Active', can_manage_members: true, can_process_payments: true, can_manage_classes: true, can_manage_trainers: true, created_at: '2025-03-15 08:30:00' },
      { id: 3, username: 'adhil', password: 'adhil123', full_name: 'adhil', role: 'Staff', email: 'adhil@cfitgym.com', phone: '+91 94471 22334', shift: 'Morning', status: 'Active', can_manage_members: true, can_process_payments: true, can_manage_classes: true, can_manage_trainers: true, created_at: '2025-06-20 14:00:00' },
      { id: 4, username: 'dnv', password: 'dnv123', full_name: 'DNV', role: 'Staff', email: 'dnv@cfitgym.com', phone: '+91 98950 33445', shift: 'Evening', status: 'Active', can_manage_members: true, can_process_payments: true, can_manage_classes: true, can_manage_trainers: true, created_at: '2025-08-10 09:15:00' },
      { id: 5, username: 'balu', password: 'balu123', full_name: 'balu', role: 'Staff', email: 'balu@cfitgym.com', phone: '+91 98472 55667', shift: 'Evening', status: 'Active', can_manage_members: true, can_process_payments: true, can_manage_classes: true, can_manage_trainers: true, created_at: '2025-09-01 10:00:00' },
      { id: 6, username: 'abhiram', password: 'abhiram123', full_name: 'abhiram', role: 'Staff', email: 'abhiram@cfitgym.com', phone: '+91 98473 66778', shift: 'Full Day', status: 'Active', can_manage_members: true, can_process_payments: true, can_manage_classes: true, can_manage_trainers: true, created_at: '2025-09-15 11:30:00' }
    ],
    trainers: [
      { id: 1, trainer_code: 'TR-01', full_name: 'Vikram Sethi', specialty: 'Strength & Bodybuilding', rating: 4.9, clients_assigned: 14, sessions_this_week: 22 },
      { id: 2, trainer_code: 'TR-02', full_name: 'Sneha Pillai', specialty: 'Cardio & HIIT Conditioning', rating: 4.8, clients_assigned: 11, sessions_this_week: 18 },
      { id: 3, trainer_code: 'TR-03', full_name: 'Anand Jacob', specialty: 'CrossFit & Olympic Lifting', rating: 4.7, clients_assigned: 9, sessions_this_week: 16 },
      { id: 4, trainer_code: 'TR-04', full_name: 'Meera Varma', specialty: 'Yoga & Flexibility', rating: 4.9, clients_assigned: 8, sessions_this_week: 14 }
    ],
    attendance: [
      { id: 1, member_id: 'GYM-0101', member_name: 'neeraj', check_in_time: '2026-10-19 06:15:00', check_out_time: '2026-10-19 07:30:00', check_in_method: 'Reception Desk', duration: '1h 15m' },
      { id: 2, member_id: 'GYM-0102', member_name: 'abin', check_in_time: '2026-10-19 07:05:00', check_out_time: null, check_in_method: 'Reception Desk', duration: 'In progress' },
      { id: 3, member_id: 'GYM-0103', member_name: 'sadi', check_in_time: '2026-10-18 17:30:00', check_out_time: '2026-10-18 18:45:00', check_in_method: 'Reception Desk', duration: '1h 15m' },
      { id: 4, member_id: 'GYM-0104', member_name: 'vinod', check_in_time: '2026-10-19 08:15:00', check_out_time: '2026-10-19 09:20:00', check_in_method: 'Reception Desk', duration: '1h 05m' },
      { id: 5, member_id: 'GYM-0105', member_name: 'farzan', check_in_time: '2026-10-19 09:00:00', check_out_time: null, check_in_method: 'Reception Desk', duration: 'In progress' }
    ],
    payments: [
      { id: 1, member_id: 'GYM-0101', member_name: 'neeraj', plan_description: 'Gold — monthly', amount: 2500, due_date: '2026-10-15', payment_status: 'Paid' },
      { id: 2, member_id: 'GYM-0102', member_name: 'abin', plan_description: 'Platinum — annual', amount: 28000, due_date: '2026-10-01', payment_status: 'Paid' },
      { id: 3, member_id: 'GYM-0103', member_name: 'sadi', plan_description: 'Silver — monthly', amount: 1800, due_date: '2026-10-10', payment_status: 'Paid' },
      { id: 4, member_id: 'GYM-0104', member_name: 'vinod', plan_description: 'Gold — 6 month', amount: 14000, due_date: '2026-10-25', payment_status: 'Paid' },
      { id: 5, member_id: 'GYM-0105', member_name: 'farzan', plan_description: 'Platinum — monthly', amount: 3500, due_date: '2026-10-24', payment_status: 'Pending' }
    ],
    classes: [
      { id: 1, class_name: 'CrossFit Power Hour', trainer_id: 1, trainer_name: 'Vikram Sethi', studio_location: 'Studio A (Ground)', start_time: '06:30 AM', max_capacity: 15, booked_count: 1 },
      { id: 2, class_name: 'HIIT Conditioning Blitz', trainer_id: 2, trainer_name: 'Sneha Pillai', studio_location: 'Studio B (Level 1)', start_time: '07:30 AM', max_capacity: 20, booked_count: 1 },
      { id: 3, class_name: 'Power Yoga Flow', trainer_id: 4, trainer_name: 'Meera Varma', studio_location: 'Studio C (Level 2)', start_time: '08:30 AM', max_capacity: 12, booked_count: 1 },
      { id: 4, class_name: 'Strength & Hypertrophy', trainer_id: 3, trainer_name: 'Anand Jacob', studio_location: 'Studio A (Ground)', start_time: '05:30 PM', max_capacity: 15, booked_count: 1 },
      { id: 5, class_name: 'Spin & Cardio Blast', trainer_id: 2, trainer_name: 'Sneha Pillai', studio_location: 'Studio B (Level 1)', start_time: '06:30 PM', max_capacity: 18, booked_count: 1 }
    ],
    class_bookings: [
      { id: 1, class_id: 1, member_id: 'GYM-0101', member_name: 'neeraj', booked_at: '2026-10-26 19:00:00' },
      { id: 2, class_id: 2, member_id: 'GYM-0102', member_name: 'abin', booked_at: '2026-10-26 19:15:00' },
      { id: 3, class_id: 2, member_id: 'GYM-0103', member_name: 'sadi', booked_at: '2026-10-26 19:30:00' },
      { id: 4, class_id: 3, member_id: 'GYM-0104', member_name: 'vinod', booked_at: '2026-10-26 20:00:00' },
      { id: 5, class_id: 4, member_id: 'GYM-0105', member_name: 'farzan', booked_at: '2026-10-26 20:30:00' },
      { id: 6, class_id: 5, member_id: 'GYM-0101', member_name: 'neeraj', booked_at: '2026-10-26 21:00:00' }
    ]
  };
}

let dbMemory: SharedGymData = getBaselineDb();

// Persist data locally to JSON and optional connected MySQL
function saveDb() {
  dbMemory.updatedAt = new Date().toISOString();
  dbMemory.senderId = SERVER_DEVICE_ID;

  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(dbMemory, null, 2), 'utf-8');
  } catch (err) {
    console.warn('[SERVER] Storage file write error:', err);
  }

  // Optional background sync to connected MySQL instance if active
  testMySQLConnection().then((status) => {
    if (status.connected && status.databaseExists) {
      syncDataToMySQL(dbMemory).catch(() => {});
    }
  }).catch(() => {});
}

// Initialize server data from local database file
function initServerDatabase() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const content = fs.readFileSync(DB_FILE, 'utf-8');
      const parsed = JSON.parse(content);
      if (parsed && (Array.isArray(parsed.members) || Array.isArray(parsed.staff_users))) {
        dbMemory = {
          ...dbMemory,
          ...parsed,
          updatedAt: parsed.updatedAt || new Date().toISOString(),
        };
        console.log('[C-FIT SERVER] Database loaded from local file.');
        return;
      }
    }
    // Write baseline
    fs.writeFileSync(DB_FILE, JSON.stringify(dbMemory, null, 2), 'utf-8');
    console.log('[C-FIT SERVER] Baseline gym database saved.');
  } catch (err) {
    console.warn('[C-FIT SERVER] Database load notice:', err);
  }
}

async function startServer() {
  const app = express();

  app.use(express.json({ limit: '10mb' }));

  // CORS for local cross-device requests (e.g. mobile phone hitting laptop IP)
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    next();
  });

  // Initialize local persistent database
  initServerDatabase();

  // ==================== REST API ENDPOINTS FOR CROSS-DEVICE SYNC ====================

  app.get('/api/health', async (req, res) => {
    let mysqlConnected = false;
    try {
      const mysqlStatus = await testMySQLConnection();
      mysqlConnected = !!mysqlStatus.connected;
    } catch {
      // Ignore
    }

    res.json({
      status: 'ok',
      mode: 'database-connected',
      databases: {
        mysql: mysqlConnected,
        inMemory: true,
      },
      serverTime: new Date().toISOString(),
      updatedAt: dbMemory.updatedAt,
      stats: {
        membersCount: dbMemory.members?.length || 0,
        staffCount: dbMemory.staff_users?.length || 0,
        paymentsCount: dbMemory.payments?.length || 0,
        attendanceCount: dbMemory.attendance?.length || 0,
        trainersCount: dbMemory.trainers?.length || 0,
        classesCount: dbMemory.classes?.length || 0,
      }
    });
  });

  // ==================== SCHEMA.SQL ACCESS & RELOAD ENDPOINTS ====================

  // Serve raw schema.sql for client inspection or export
  app.get('/api/schema/sql', (req, res) => {
    const candidates = [
      path.resolve(import.meta.dirname, 'src', 'schema.sql'),
      path.resolve(process.cwd(), 'src', 'schema.sql'),
    ];
    let sqlContent = '';
    for (const p of candidates) {
      if (fs.existsSync(p)) {
        sqlContent = fs.readFileSync(p, 'utf-8');
        break;
      }
    }
    if (sqlContent) {
      res.setHeader('Content-Type', 'text/plain');
      res.send(sqlContent);
    } else {
      res.status(404).send('-- schema.sql not found');
    }
  });

  // Reload database strictly from schema.sql
  app.post('/api/schema/reload', (req, res) => {
    try {
      const reloaded = getBaselineDb();
      dbMemory = reloaded;
      saveDb();
      res.json({
        success: true,
        message: 'Server database records reloaded and synchronized with src/schema.sql',
        updatedAt: dbMemory.updatedAt,
        stats: {
          members: dbMemory.members.length,
          staff: dbMemory.staff_users.length,
          trainers: dbMemory.trainers.length,
          attendance: dbMemory.attendance.length,
          payments: dbMemory.payments.length,
          classes: dbMemory.classes.length,
        }
      });
    } catch (e: any) {
      res.status(500).json({ success: false, error: e?.message || 'Failed to reload from schema.sql' });
    }
  });

  // ==================== MYSQL & JDBC CONNECTION ENDPOINTS ====================

  // Check MySQL Connection Status & Ping
  app.get('/api/mysql/status', async (req, res) => {
    try {
      const result = await testMySQLConnection();
      res.json(result);
    } catch (e: any) {
      res.status(500).json({ connected: false, error: e?.message });
    }
  });

  // Update MySQL credentials and test
  app.post('/api/mysql/connect', async (req, res) => {
    try {
      const { host, port, user, password, database } = req.body || {};
      const newConfig = updateMySQLConfig({ host, port, user, password, database });
      const result = await testMySQLConnection(newConfig);
      res.json(result);
    } catch (e: any) {
      res.status(500).json({ success: false, error: e?.message });
    }
  });

  // Initialize MySQL Schema and Seed Data
  app.post('/api/mysql/init-db', async (req, res) => {
    try {
      const result = await initializeMySQLDatabase();
      res.json(result);
    } catch (e: any) {
      res.status(500).json({ success: false, error: e?.message });
    }
  });

  // Export complete MySQL SQL DDL & DML script
  app.get('/api/mysql/export-sql', (req, res) => {
    const candidates = [
      path.resolve(process.cwd(), 'src', 'db', 'schema_mysql.sql'),
      path.resolve(process.cwd(), 'public', 'schema_mysql.sql'),
    ];
    let sql = '';
    for (const p of candidates) {
      if (fs.existsSync(p)) {
        sql = fs.readFileSync(p, 'utf-8');
        break;
      }
    }
    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Content-Disposition', 'attachment; filename="cfit_mysql_setup.sql"');
    res.send(sql || '-- MySQL schema script not found');
  });

  // Sync memory / Firestore data to MySQL
  app.post('/api/mysql/sync', async (req, res) => {
    try {
      const result = await syncDataToMySQL(dbMemory);
      res.json(result);
    } catch (e: any) {
      res.status(500).json({ success: false, error: e?.message });
    }
  });

  // Get JDBC Connection string & Java snippet
  app.get('/api/mysql/jdbc-info', (req, res) => {
    const info = getJDBCConnectionInfo();
    res.json(info);
  });

  // Get full database snapshot for cross-device syncing
  app.get('/api/sync', (req, res) => {
    res.json(dbMemory);
  });

  // Push updates from any device (laptop or phone) to central database
  app.post('/api/sync', (req, res) => {
    try {
      const incoming = req.body;
      if (!incoming) return res.status(400).json({ error: 'Missing body' });

      if (Array.isArray(incoming.trainers)) {
        dbMemory.trainers = incoming.trainers.map((t: any, idx: number) => ({
          ...t,
          id: (t.id && Number(t.id) < 500) ? Number(t.id) : (idx + 1)
        }));
      }

      if (Array.isArray(incoming.members)) {
        dbMemory.members = incoming.members.map((m: any) => {
          let tid = (m.trainer_id !== null && m.trainer_id !== undefined && !isNaN(Number(m.trainer_id)))
            ? Number(m.trainer_id)
            : null;
          let tname = m.trainer_name;

          if (tid && Array.isArray(dbMemory.trainers)) {
            const matched = dbMemory.trainers.find((t: any) => Number(t.id) === tid);
            if (matched) {
              tname = matched.full_name;
            }
          } else if (tname && tname !== 'Unassigned' && Array.isArray(dbMemory.trainers)) {
            const matched = dbMemory.trainers.find((t: any) => t.full_name?.toLowerCase() === tname?.toLowerCase());
            if (matched) {
              tid = Number(matched.id);
            }
          }

          return {
            ...m,
            trainer_id: tid,
            trainer_name: tname || 'Unassigned'
          };
        });
      }

      if (Array.isArray(incoming.staff_users)) dbMemory.staff_users = incoming.staff_users;
      if (Array.isArray(incoming.attendance)) dbMemory.attendance = incoming.attendance;
      if (Array.isArray(incoming.payments)) dbMemory.payments = incoming.payments;
      if (Array.isArray(incoming.classes)) dbMemory.classes = incoming.classes;
      if (Array.isArray(incoming.class_bookings)) {
        dbMemory.class_bookings = incoming.class_bookings;
        if (Array.isArray(dbMemory.classes)) {
          dbMemory.classes = dbMemory.classes.map((c: any) => ({
            ...c,
            booked_count: dbMemory.class_bookings.filter((b: any) => Number(b.class_id) === Number(c.id)).length,
          }));
        }
      }

      saveDb();
      res.json({
        success: true,
        message: 'Database updated and synced across connected services.',
        updatedAt: dbMemory.updatedAt
      });
    } catch (e: any) {
      res.status(500).json({ error: e?.message || 'Sync error' });
    }
  });

  // Members endpoints
  app.get('/api/members', (req, res) => {
    res.json(dbMemory.members || []);
  });

  app.post('/api/members', (req, res) => {
    const member = req.body;
    if (!member || !member.member_id) {
      return res.status(400).json({ error: 'member_id is required' });
    }

    let tid = (member.trainer_id !== null && member.trainer_id !== undefined && !isNaN(Number(member.trainer_id)))
      ? Number(member.trainer_id)
      : null;
    let tname = member.trainer_name;

    if (tid && Array.isArray(dbMemory.trainers)) {
      const match = dbMemory.trainers.find((t: any) => Number(t.id) === tid);
      if (match) tname = match.full_name;
    } else if (tname && tname !== 'Unassigned' && Array.isArray(dbMemory.trainers)) {
      const match = dbMemory.trainers.find((t: any) => t.full_name?.toLowerCase() === tname?.toLowerCase());
      if (match) tid = Number(match.id);
    }

    const payload = {
      ...member,
      trainer_id: tid,
      trainer_name: tname || 'Unassigned'
    };

    if (!Array.isArray(dbMemory.members)) dbMemory.members = [];
    const idx = dbMemory.members.findIndex((m: any) => m.member_id === member.member_id || (member.id && m.id === member.id));
    if (idx >= 0) {
      dbMemory.members[idx] = { ...dbMemory.members[idx], ...payload };
    } else {
      const newId = dbMemory.members.reduce((max: number, m: any) => Math.max(max, m.id || 0), 0) + 1;
      dbMemory.members.push({ id: newId, ...payload });
    }
    saveDb();
    res.json({ success: true, member: payload });
  });

  app.delete('/api/members/:id', (req, res) => {
    const id = Number(req.params.id);
    const idStr = String(req.params.id);
    const prevCount = (dbMemory.members || []).length;
    dbMemory.members = (dbMemory.members || []).filter((m: any) => m.id !== id && m.member_id !== idStr);
    saveDb();
    res.json({ success: true, message: 'Member deleted from connected databases.', removed: prevCount - dbMemory.members.length });
  });

  // Staff endpoints
  app.get('/api/staff', (req, res) => {
    res.json(dbMemory.staff_users || []);
  });

  app.post('/api/staff', (req, res) => {
    const staff = req.body;
    if (!staff || (!staff.username && !staff.id)) {
      return res.status(400).json({ error: 'username or id is required' });
    }

    if (!Array.isArray(dbMemory.staff_users)) {
      dbMemory.staff_users = [];
    }
    const idx = dbMemory.staff_users.findIndex((s: any) =>
      (staff.id && s.id === staff.id) ||
      (staff.username && s.username?.toLowerCase() === staff.username?.toLowerCase())
    );
    if (idx >= 0) {
      dbMemory.staff_users[idx] = { ...dbMemory.staff_users[idx], ...staff };
    } else {
      const newId = dbMemory.staff_users.reduce((max: number, s: any) => Math.max(max, s.id || 0), 0) + 1;
      dbMemory.staff_users.push({ id: newId, ...staff });
    }
    saveDb();
    res.json({ success: true, staff });
  });

  app.patch('/api/staff/:id', (req, res) => {
    const id = Number(req.params.id);
    const param = String(req.params.id).toLowerCase();
    const updates = req.body || {};
    if (!Array.isArray(dbMemory.staff_users)) {
      dbMemory.staff_users = [];
    }
    const idx = dbMemory.staff_users.findIndex((s: any) => s.id === id || s.username?.toLowerCase() === param);
    if (idx >= 0) {
      dbMemory.staff_users[idx] = { ...dbMemory.staff_users[idx], ...updates };
      saveDb();
      res.json({ success: true, staff: dbMemory.staff_users[idx] });
    } else {
      res.status(404).json({ error: 'Staff member not found' });
    }
  });

  app.delete('/api/staff/:id', (req, res) => {
    const id = Number(req.params.id);
    const param = String(req.params.id).toLowerCase();
    if (!Array.isArray(dbMemory.staff_users)) {
      dbMemory.staff_users = [];
    }
    const beforeCount = dbMemory.staff_users.length;
    dbMemory.staff_users = dbMemory.staff_users.filter(
      (s: any) => s.id !== id && s.username?.toLowerCase() !== param
    );
    saveDb();
    res.json({
      success: true,
      deleted: beforeCount !== dbMemory.staff_users.length,
      message: 'Staff member removed from connected databases.'
    });
  });

  // Payments endpoints
  app.get('/api/payments', (req, res) => {
    res.json(dbMemory.payments || []);
  });

  app.post('/api/payments', (req, res) => {
    const p = req.body;
    if (!Array.isArray(dbMemory.payments)) dbMemory.payments = [];
    const newId = dbMemory.payments.reduce((max: number, item: any) => Math.max(max, item.id || 0), 0) + 1;
    dbMemory.payments.unshift({ id: newId, ...p });
    saveDb();
    res.json({ success: true, payment: dbMemory.payments[0] });
  });

  // Attendance endpoints
  app.get('/api/attendance', (req, res) => {
    res.json(dbMemory.attendance || []);
  });

  app.post('/api/attendance', (req, res) => {
    const a = req.body;
    if (!Array.isArray(dbMemory.attendance)) dbMemory.attendance = [];
    const newId = dbMemory.attendance.reduce((max: number, item: any) => Math.max(max, item.id || 0), 0) + 1;
    dbMemory.attendance.unshift({ id: newId, ...a });
    saveDb();
    res.json({ success: true, record: dbMemory.attendance[0] });
  });

  // Classes and Class Booking endpoints
  app.get('/api/classes', (req, res) => {
    const list = (dbMemory.classes || []).map((c: any) => {
      const bookings = (dbMemory.class_bookings || []).filter((b: any) => Number(b.class_id) === Number(c.id));
      return {
        ...c,
        booked_count: bookings.length,
        bookings,
      };
    });
    res.json(list);
  });

  app.post('/api/classes/:id/bookings', (req, res) => {
    const classId = Number(req.params.id);
    const { member_id } = req.body || {};
    if (!member_id) {
      return res.status(400).json({ success: false, message: 'member_id is required' });
    }

    if (!Array.isArray(dbMemory.classes)) dbMemory.classes = [];
    if (!Array.isArray(dbMemory.class_bookings)) dbMemory.class_bookings = [];

    const gymClass = dbMemory.classes.find((c: any) => Number(c.id) === classId);
    if (!gymClass) {
      return res.status(404).json({ success: false, message: 'Class not found' });
    }

    const currentBookings = dbMemory.class_bookings.filter((b: any) => Number(b.class_id) === classId);
    if (currentBookings.length >= Number(gymClass.max_capacity)) {
      return res.status(400).json({ success: false, message: 'Class has reached maximum capacity.' });
    }

    const alreadyBooked = currentBookings.some((b: any) => b.member_id?.toUpperCase() === member_id.toUpperCase());
    if (alreadyBooked) {
      return res.status(400).json({ success: false, message: 'This member is already booked in this class.' });
    }

    const member = (dbMemory.members || []).find((m: any) => m.member_id?.toUpperCase() === member_id.toUpperCase());
    const memberName = member ? member.full_name : member_id;

    const newBookingId = dbMemory.class_bookings.reduce((max: number, b: any) => Math.max(max, Number(b.id || 0)), 0) + 1;
    const newBooking = {
      id: newBookingId,
      class_id: classId,
      member_id,
      member_name: memberName,
      booked_at: new Date().toISOString().replace('T', ' ').substring(0, 19),
    };

    dbMemory.class_bookings.push(newBooking);
    gymClass.booked_count = dbMemory.class_bookings.filter((b: any) => Number(b.class_id) === classId).length;

    saveDb();
    res.json({ success: true, booking: newBooking, class: gymClass });
  });

  app.delete('/api/classes/:id/bookings/:memberId', (req, res) => {
    const classId = Number(req.params.id);
    const memberId = String(req.params.memberId).toUpperCase();

    if (!Array.isArray(dbMemory.class_bookings)) dbMemory.class_bookings = [];
    dbMemory.class_bookings = dbMemory.class_bookings.filter(
      (b: any) => !(Number(b.class_id) === classId && b.member_id?.toUpperCase() === memberId)
    );

    const gymClass = (dbMemory.classes || []).find((c: any) => Number(c.id) === classId);
    if (gymClass) {
      gymClass.booked_count = dbMemory.class_bookings.filter((b: any) => Number(b.class_id) === classId).length;
    }

    saveDb();
    res.json({ success: true });
  });

  // Local Network IP discovery endpoint
  app.get('/api/network-info', (req, res) => {
    const interfaces = os.networkInterfaces();
    const ips: string[] = [];
    for (const devName in interfaces) {
      const iface = interfaces[devName];
      if (!iface) continue;
      for (const alias of iface) {
        if (alias.family === 'IPv4' && !alias.internal) {
          ips.push(alias.address);
        }
      }
    }
    res.json({
      localIps: ips,
      port: PORT,
      lanUrls: ips.map((ip) => `http://${ip}:${PORT}`),
      instructions: 'Open any of these URLs in your mobile phone browser while connected to the same Wi-Fi network.'
    });
  });

  // ==================== VITE MIDDLEWARE / STATIC ASSETS ====================
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(import.meta.dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[C-FIT SERVER] Full-Stack Server active on http://0.0.0.0:${PORT}`);
    console.log(`[C-FIT SERVER] Connected to Firebase Firestore & MySQL database services (Zero file dependency)`);
  });
}

startServer().catch((err) => {
  console.error('[C-FIT SERVER] Failed to start server:', err);
});
