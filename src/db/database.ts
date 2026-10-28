// @ts-ignore
import initSqlJs from 'sql.js/dist/sql-asm.js';
import type { Database } from 'sql.js';
import SCHEMA_SQL from '../schema.sql?raw';
import {
  AdminUser,
  StaffUser,
  Trainer,
  Member,
  AttendanceRecord,
  PaymentRecord,
  GymClass,
  ClassBooking,
  DashboardStats,
  SqlQueryResult
} from '../types/index.ts';

const DB_STORAGE_KEY = 'cfit_sqlite_db_v3';
const DEFAULT_CLOUD_ROOM = 'cfit_sync_chn25csc095';
const CLOUD_ROOM_STORAGE_KEY = 'cfit_cloud_room_key';

const DEVICE_ID = typeof window !== 'undefined'
  ? (sessionStorage.getItem('cfit_device_id') || (() => {
      const id = 'dev_' + Math.random().toString(36).substring(2, 9);
      try { sessionStorage.setItem('cfit_device_id', id); } catch {}
      return id;
    })())
  : 'dev_server';

class GymDatabase {
  private SQL: any = null;
  private db: Database | null = null;
  private isInitializing: boolean = false;
  private initPromise: Promise<void> | null = null;
  private subscribers: Set<() => void> = new Set();
  private syncChannel: BroadcastChannel | null = null;
  private eventSource: EventSource | null = null;
  private isCloudConnected: boolean = false;
  private cloudPushTimer: any = null;
  public lastCloudSyncedAt: string | null = null;

  constructor() {
    this.init();
    if (typeof window !== 'undefined') {
      if ('BroadcastChannel' in window) {
        try {
          this.syncChannel = new BroadcastChannel('cfit_db_sync_bus');
          this.syncChannel.onmessage = (event) => {
            if (event.data?.type === 'DB_SYNC') {
              this.reloadFromStorage();
            }
          };
        } catch (e) {
          console.warn('BroadcastChannel init error:', e);
        }
      }
      window.addEventListener('storage', (e) => {
        if (e.key === DB_STORAGE_KEY) {
          this.reloadFromStorage();
        }
      });

      try {
        const urlParams = new URLSearchParams(window.location.search);
        const queryRoom = urlParams.get('room');
        if (queryRoom) {
          const clean = queryRoom.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
          if (clean) localStorage.setItem(CLOUD_ROOM_STORAGE_KEY, clean);
        }
      } catch {}

      this.startAutoSync();
    }
  }

  public subscribe(cb: () => void): () => void {
    this.subscribers.add(cb);
    return () => {
      this.subscribers.delete(cb);
    };
  }

  public async reloadFromStorage(): Promise<void> {
    if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') return;
    try {
      const savedBase64 = window.localStorage.getItem(DB_STORAGE_KEY);
      if (!savedBase64 || !this.SQL) return;
      const binary = Uint8Array.from(atob(savedBase64), (c) => c.charCodeAt(0));
      this.db = new this.SQL.Database(binary);
      for (const cb of this.subscribers) {
        try {
          cb();
        } catch (err) {
          console.error('Subscriber error on sync reload:', err);
        }
      }
    } catch (e) {
      console.warn('Error reloading from storage:', e);
    }
  }

  public getCloudRoomKey(): string {
    if (typeof window === 'undefined') return DEFAULT_CLOUD_ROOM;
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const urlRoom = urlParams.get('sync') || urlParams.get('room');
      if (urlRoom) {
        const clean = urlRoom.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
        if (clean) {
          localStorage.setItem(CLOUD_ROOM_STORAGE_KEY, clean);
          return clean;
        }
      }
    } catch {}
    return localStorage.getItem(CLOUD_ROOM_STORAGE_KEY) || DEFAULT_CLOUD_ROOM;
  }

  public setCloudRoomKey(key: string) {
    if (typeof window === 'undefined') return;
    const cleanKey = key.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '') || DEFAULT_CLOUD_ROOM;
    localStorage.setItem(CLOUD_ROOM_STORAGE_KEY, cleanKey);
    this.setupCloudSyncListener();
    this.pollCloudRelay();
  }

  public setupCloudSyncListener() {
    if (typeof window === 'undefined' || typeof EventSource === 'undefined') return;
    if (this.eventSource) {
      try { this.eventSource.close(); } catch {}
      this.eventSource = null;
    }

    const room = this.getCloudRoomKey();
    const sseUrl = `https://ntfy.sh/${room}/sse`;

    try {
      this.eventSource = new EventSource(sseUrl);
      this.eventSource.onopen = () => {
        this.isCloudConnected = true;
      };
      this.eventSource.onmessage = async (e) => {
        try {
          const parsed = JSON.parse(e.data);
          let payload: any = null;

          // 1. If ntfy uploaded a large file attachment, fetch it
          if (parsed && parsed.attachment && parsed.attachment.url) {
            try {
              const fileRes = await fetch(parsed.attachment.url);
              if (fileRes.ok) {
                payload = await fileRes.json();
              }
            } catch {}
          }

          // 2. Otherwise parse inline JSON message
          if (!payload && parsed && parsed.message) {
            try {
              payload = JSON.parse(parsed.message);
            } catch {}
          }

          if (payload) {
            // Ignore messages sent by this same device
            if (payload.senderId && payload.senderId === DEVICE_ID) return;
            if (payload.data) {
              await this.importCompleteDatabaseJson({ data: payload.data }, false);
              this.lastCloudSyncedAt = new Date().toISOString();
            }
          }
        } catch (err) {
          // Ignore parse errors safely
        }
      };
      this.eventSource.onerror = () => {
        this.isCloudConnected = false;
      };
    } catch (e) {
      console.warn('[CLOUD SYNC] SSE connection warning:', e);
    }
  }

  public async pollCloudRelay(): Promise<boolean> {
    if (typeof window === 'undefined') return false;
    const room = this.getCloudRoomKey();
    try {
      const res = await fetch(`https://ntfy.sh/${room}/json?poll=1`, { signal: AbortSignal.timeout(4000) });
      if (!res.ok) return false;
      const text = await res.text();
      const lines = text.trim().split('\n');
      for (let i = lines.length - 1; i >= 0; i--) {
        const line = lines[i].trim();
        if (!line) continue;
        try {
          const item = JSON.parse(line);
          let payload: any = null;

          if (item && item.attachment && item.attachment.url) {
            try {
              const fileRes = await fetch(item.attachment.url);
              if (fileRes.ok) {
                payload = await fileRes.json();
              }
            } catch {}
          }

          if (!payload && item && item.message) {
            try {
              payload = JSON.parse(item.message);
            } catch {}
          }

          if (payload) {
            if (payload.senderId && payload.senderId === DEVICE_ID) continue;
            if (payload.data) {
              await this.importCompleteDatabaseJson({ data: payload.data }, false);
              this.lastCloudSyncedAt = new Date().toISOString();
              return true;
            }
          }
        } catch {}
      }
    } catch {}
    return false;
  }

  public pushToCloudRelay() {
    if (typeof window === 'undefined') return;
    if (this.cloudPushTimer) clearTimeout(this.cloudPushTimer);
    this.cloudPushTimer = setTimeout(async () => {
      const room = this.getCloudRoomKey();
      try {
        const jsonStr = await this.exportCompleteDatabaseJson();
        const parsed = JSON.parse(jsonStr);
        const bodyObj = {
          senderId: DEVICE_ID,
          updatedAt: new Date().toISOString(),
          data: parsed.data,
        };
        const payloadStr = JSON.stringify(bodyObj);
        await fetch(`https://ntfy.sh/${room}`, {
          method: 'POST',
          headers: {
            'Title': 'CFIT_DB_UPDATE',
            'Tags': 'database,sync',
            'Filename': 'cfit_db.json'
          },
          body: payloadStr,
        }).catch(() => {});
        this.lastCloudSyncedAt = new Date().toISOString();
      } catch (e) {
        // Fail silently
      }
    }, 400);
  }

  private pushTimer: any = null;
  public pushToServer() {
    if (typeof window === 'undefined') return;
    if (this.pushTimer) clearTimeout(this.pushTimer);
    this.pushTimer = setTimeout(async () => {
      try {
        const jsonStr = await this.exportCompleteDatabaseJson();
        const parsed = JSON.parse(jsonStr);
        await fetch('/api/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(parsed.data),
        });
      } catch (e) {
        // Standalone or offline fallback
      }
    }, 100);
  }

  private lastServerTimestamp: string = '';
  public async pullFromServer(): Promise<boolean> {
    if (typeof window === 'undefined') return false;
    try {
      const res = await fetch('/api/health', { signal: AbortSignal.timeout(3000) });
      if (!res.ok) return false;
      const ct = res.headers.get('content-type') || '';
      if (!ct.includes('application/json')) return false; // Prevent parsing HTML as JSON
      const health = await res.json();
      if (health.updatedAt && health.updatedAt !== this.lastServerTimestamp) {
        const syncRes = await fetch('/api/sync', { signal: AbortSignal.timeout(4000) });
        if (syncRes.ok) {
          const syncType = syncRes.headers.get('content-type') || '';
          if (syncType.includes('application/json')) {
            const serverData = await syncRes.json();
            this.lastServerTimestamp = health.updatedAt;
            await this.importCompleteDatabaseJson({ data: serverData.data || serverData }, false);
            return true;
          }
        }
      }
    } catch {
      // Standalone
    }
    return false;
  }

  public startAutoSync() {
    if (typeof window === 'undefined') return;
    // Initial fetch from server
    setTimeout(() => {
      this.pullFromServer();
      this.setupCloudSyncListener();
    }, 300);


    // Periodic fast cross-device sync every 2.5 seconds when active
    setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      this.pullFromServer();
    }, 2500);

    // Immediate sync when returning to tab/device
    window.addEventListener('focus', () => {
      this.pullFromServer();
    });
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        this.pullFromServer();
      }
    });
  }

  private notify(broadcast: boolean = true) {
    this.persist();
    if (broadcast && this.syncChannel) {
      try {
        this.syncChannel.postMessage({ type: 'DB_SYNC', timestamp: Date.now() });
      } catch (e) {
        // Ignore
      }
    }
    // Push changes to both central server and cloud relay (for Vercel & mobile)
    if (broadcast) {
      this.pushToServer();
      this.pushToCloudRelay();
    }

    for (const cb of this.subscribers) {
      try {
        cb();
      } catch (err) {
        console.error('Database subscriber error:', err);
      }
    }
  }

  private async loadSqlEngine(): Promise<any> {
    if (this.SQL) return this.SQL;
    try {
      this.SQL = await initSqlJs();
      return this.SQL;
    } catch (err) {
      console.error('Failed to initialize sql-asm engine:', err);
      throw err;
    }
  }

  public async init(): Promise<void> {
    if (this.db) return;
    if (this.initPromise) return this.initPromise;

    this.isInitializing = true;
    this.initPromise = (async () => {
      try {
        const SQL = await this.loadSqlEngine();

        // Try to load from localStorage
        let savedBase64: string | null = null;
        if (typeof window !== 'undefined' && typeof window.localStorage !== 'undefined') {
          try {
            savedBase64 = window.localStorage.getItem(DB_STORAGE_KEY);
          } catch (e) {
            console.warn('Could not read from localStorage:', e);
          }
        }
        if (savedBase64) {
          try {
            const binary = Uint8Array.from(atob(savedBase64), (c) => c.charCodeAt(0));
            const loadedDb = new SQL.Database(binary);
            // Execute schema.sql to ensure all tables & DDL/DML constraints exist
            this.executeSqlSchema(loadedDb, SCHEMA_SQL);
            this.db = loadedDb;
            this.persist();
          } catch (e) {
            console.warn('Failed to parse saved database, creating fresh one from schema.sql:', e);
            const freshDb = new SQL.Database();
            this.executeSqlSchema(freshDb, SCHEMA_SQL);
            this.db = freshDb;
            this.persist();
          }
        } else {
          const freshDb = new SQL.Database();
          this.executeSqlSchema(freshDb, SCHEMA_SQL);
          this.db = freshDb;
          this.persist();
        }
      } catch (err) {
        console.error('Failed to initialize SQLite database:', err);
        throw err;
      } finally {
        this.isInitializing = false;
      }
    })();

    return this.initPromise;
  }

  private applyDefaultAccountsAndCleanDummies(db: Database) {
    try {
      // 1. Ensure tables exist
      db.run(`
        CREATE TABLE IF NOT EXISTS admin (
          username TEXT PRIMARY KEY,
          password TEXT NOT NULL,
          role TEXT DEFAULT 'Admin access'
        );
        CREATE TABLE IF NOT EXISTS staff_users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT UNIQUE NOT NULL,
          password TEXT NOT NULL,
          full_name TEXT NOT NULL,
          role TEXT NOT NULL DEFAULT 'Staff',
          email TEXT,
          phone TEXT,
          shift TEXT DEFAULT 'Morning',
          status TEXT DEFAULT 'Active',
          can_manage_members INTEGER DEFAULT 1,
          can_process_payments INTEGER DEFAULT 1,
          can_manage_classes INTEGER DEFAULT 1,
          can_manage_trainers INTEGER DEFAULT 1,
          created_at TEXT NOT NULL
        );
      `);

      // 2. Only seed initial staff users if staff_users table is empty
      const staffCountRes = db.exec('SELECT COUNT(*) FROM staff_users');
      const staffCount = staffCountRes.length > 0 && staffCountRes[0].values.length > 0 ? Number(staffCountRes[0].values[0][0]) : 0;
      if (staffCount === 0) {
        db.run(`
          INSERT INTO staff_users (id, username, password, full_name, role, email, phone, shift, status, can_manage_members, can_process_payments, can_manage_classes, can_manage_trainers, created_at)
          VALUES (1, 'admin', 'admin123', 'JOVIN', 'Admin', 'admin@cfitgym.com', '+91 98470 11223', 'Full Day', 'Active', 1, 1, 1, 1, '2025-01-01 00:00:00'),
                 (2, 'staff', 'staff123', 'staff', 'Staff', 'staff@cfitgym.com', '+91 98470 44556', 'Morning', 'Active', 1, 1, 1, 1, '2025-03-15 08:30:00'),
                 (3, 'adhil', 'adhil123', 'adhil', 'Staff', 'adhil@cfitgym.com', '+91 94471 22334', 'Morning', 'Active', 1, 1, 1, 1, '2025-06-20 14:00:00'),
                 (4, 'dnv', 'dnv123', 'DNV', 'Staff', 'dnv@cfitgym.com', '+91 98950 33445', 'Evening', 'Active', 1, 1, 1, 1, '2025-08-10 09:15:00'),
                 (5, 'balu', 'balu123', 'balu', 'Staff', 'balu@cfitgym.com', '+91 98472 55667', 'Evening', 'Active', 1, 1, 1, 1, '2025-09-01 10:00:00'),
                 (6, 'abhiram', 'abhiram123', 'abhiram', 'Staff', 'abhiram@cfitgym.com', '+91 98473 66778', 'Full Day', 'Active', 1, 1, 1, 1, '2025-09-15 11:30:00');
        `);
      }

      // 3. Remove old dummy accounts from legacy test iterations
      db.run(`
        DELETE FROM staff_users WHERE LOWER(username) IN ('gym administrator', 'rahul krishnan', 'sneha pillai', 'anand jacob', 'meera varma', 'divya thomas', 'kiran das');
      `);

      // 4. Ensure admin credentials table is populated
      const adminCountRes = db.exec('SELECT COUNT(*) FROM admin');
      const adminCount = adminCountRes.length > 0 && adminCountRes[0].values.length > 0 ? Number(adminCountRes[0].values[0][0]) : 0;
      if (adminCount === 0) {
        db.run(`
          INSERT OR REPLACE INTO admin (username, password, role) VALUES
          ('admin', 'admin123', 'Admin access'),
          ('staff', 'staff123', 'Staff access'),
          ('adhil', 'adhil123', 'Staff access'),
          ('dnv', 'dnv123', 'Staff access'),
          ('balu', 'balu123', 'Staff access'),
          ('abhiram', 'abhiram123', 'Staff access');
        `);
      }

      // 5. Ensure default trainers if table is fresh/empty
      try {
        const trainerCountRes = db.exec('SELECT COUNT(*) FROM trainers');
        const trainerCount = (trainerCountRes.length > 0 && trainerCountRes[0].values.length > 0) ? Number(trainerCountRes[0].values[0][0]) : 0;
        if (trainerCount === 0) {
          db.run(`
            INSERT INTO trainers (id, trainer_code, full_name, specialty, rating)
            VALUES (1, 'TR-01', 'Vikram Sethi', 'Strength & Conditioning', 4.9),
                   (2, 'TR-02', 'Sneha Pillai', 'HIIT & Functional', 4.8),
                   (3, 'TR-03', 'Anand Jacob', 'Powerlifting & Mobility', 4.7),
                   (4, 'TR-04', 'Meera Varma', 'Yoga & Flexibility', 4.9);
          `);
        }
      } catch {}

      // 6. Ensure default members if table is fresh/empty
      const memberCountRes = db.exec('SELECT COUNT(*) FROM members');
      const memberCount = (memberCountRes.length > 0 && memberCountRes[0].values.length > 0) ? Number(memberCountRes[0].values[0][0]) : 0;
      if (memberCount === 0) {
        db.run(`
          INSERT INTO members (id, member_id, full_name, plan_type, trainer_id, trainer_name, join_date, expiry_date, status)
          VALUES (1, 'GYM-0101', 'neeraj', 'Gold', 1, 'Vikram Sethi', '2025-11-15', '2026-11-15', 'Active'),
                 (2, 'GYM-0102', 'abin', 'Platinum', 2, 'Sneha Pillai', '2026-01-10', '2027-01-10', 'Active'),
                 (3, 'GYM-0103', 'sadi', 'Silver', 3, 'Anand Jacob', '2026-03-01', '2026-09-01', 'Active'),
                 (4, 'GYM-0104', 'vinod', 'Gold', 1, 'Vikram Sethi', '2025-12-05', '2026-12-05', 'Active'),
                 (5, 'GYM-0105', 'farzan', 'Platinum', 2, 'Sneha Pillai', '2026-04-12', '2027-04-12', 'Active');
        `);
      }

      // 7. Enforce attendance records only on clean empty state
      const attCheck = db.exec('SELECT COUNT(*) FROM attendance');
      const attTotal = (attCheck && attCheck.length > 0) ? Number(attCheck[0].values[0][0]) : 0;
      if (attTotal === 0) {
        db.run(`
          INSERT INTO attendance (id, member_id, check_in_time, check_out_time, check_in_method)
          VALUES (1, 'GYM-0101', '2026-10-19 06:15:00', '2026-10-19 07:30:00', 'Reception Desk'),
                 (2, 'GYM-0102', '2026-10-19 07:05:00', NULL, 'Reception Desk'),
                 (3, 'GYM-0103', '2026-10-18 17:30:00', '2026-10-18 18:45:00', 'Reception Desk'),
                 (4, 'GYM-0104', '2026-10-19 08:15:00', '2026-10-19 09:20:00', 'Reception Desk'),
                 (5, 'GYM-0105', '2026-10-19 09:00:00', NULL, 'Reception Desk');
        `);
      }

      // 8. Enforce payments only on clean empty state
      const payCheck = db.exec('SELECT COUNT(*) FROM payments');
      const payTotal = (payCheck && payCheck.length > 0) ? Number(payCheck[0].values[0][0]) : 0;
      if (payTotal === 0) {
        db.run(`
          INSERT INTO payments (id, member_id, plan_description, amount, due_date, payment_status)
          VALUES (1, 'GYM-0101', 'Gold — monthly', 2500, '2026-10-15', 'Paid'),
                 (2, 'GYM-0102', 'Platinum — annual', 28000, '2026-10-01', 'Paid'),
                 (3, 'GYM-0103', 'Silver — monthly', 1800, '2026-10-10', 'Paid'),
                 (4, 'GYM-0104', 'Gold — 6 month', 14000, '2026-10-25', 'Paid'),
                 (5, 'GYM-0105', 'Platinum — monthly', 3500, '2026-10-24', 'Pending');
        `);
      }

      // 9. Enforce classes and class bookings only on clean empty state
      const clsCheck = db.exec('SELECT COUNT(*) FROM classes');
      const clsTotal = (clsCheck && clsCheck.length > 0) ? Number(clsCheck[0].values[0][0]) : 0;
      if (clsTotal === 0) {
        db.run(`
          INSERT INTO classes (id, class_name, trainer_id, studio_location, start_time, max_capacity, booked_count)
          VALUES (1, 'CrossFit Power Hour', 1, 'Studio A (Ground)', '06:30 AM', 15, 1),
                 (2, 'HIIT Conditioning Blitz', 2, 'Studio B (Level 1)', '07:30 AM', 20, 1),
                 (3, 'Power Yoga Flow', 4, 'Studio C (Level 2)', '08:30 AM', 12, 1),
                 (4, 'Strength & Hypertrophy', 3, 'Studio A (Ground)', '05:30 PM', 15, 1),
                 (5, 'Spin & Cardio Blast', 2, 'Studio B (Level 1)', '06:30 PM', 18, 1);
        `);
        db.run(`
          INSERT INTO class_bookings (id, class_id, member_id, booked_at)
          VALUES (1, 1, 'GYM-0101', '2026-10-18 10:00:00'),
                 (2, 2, 'GYM-0102', '2026-10-18 11:00:00'),
                 (3, 3, 'GYM-0103', '2026-10-18 14:00:00'),
                 (4, 4, 'GYM-0104', '2026-10-19 08:00:00'),
                 (5, 5, 'GYM-0105', '2026-10-19 08:30:00');
        `);
      }
      db.run(`UPDATE classes SET booked_count = (SELECT COUNT(*) FROM class_bookings WHERE class_id = classes.id);`);
    } catch (e) {
      console.warn('Error in applyDefaultAccountsAndCleanDummies:', e);
    }
  }

  public executeSqlSchema(db: Database, schema: string) {
    const lines = schema.split('\n');
    let statement = '';
    for (const rawLine of lines) {
      const trimmed = rawLine.trim();
      if (!trimmed || trimmed.startsWith('--')) continue;
      if (
        trimmed.toUpperCase().startsWith('CREATE DATABASE') ||
        trimmed.toUpperCase().startsWith('USE ') ||
        trimmed.toUpperCase().startsWith('SET FOREIGN_KEY_CHECKS')
      ) {
        continue;
      }
      statement += rawLine + '\n';
      // Strip any line comment to accurately check for ending semicolon
      const effectiveLine = trimmed.replace(/--.*$/, '').trim();
      if (effectiveLine.endsWith(';')) {
        let clean = statement.trim();
        clean = clean
          .replace(/ENGINE\s*=\s*\w+/gi, '')
          .replace(/DEFAULT\s+CHARSET\s*=\s*[\w\d]+/gi, '')
          .replace(/COLLATE\s*=\s*[\w\d_]+/gi, '')
          .replace(/CHARACTER\s+SET\s+[\w\d]+/gi, '')
          .replace(/INT\s+NOT\s+NULL\s+AUTO_INCREMENT\s+PRIMARY\s+KEY/gi, 'INTEGER PRIMARY KEY AUTOINCREMENT')
          .replace(/INT\s+AUTO_INCREMENT\s+PRIMARY\s+KEY/gi, 'INTEGER PRIMARY KEY AUTOINCREMENT')
          .replace(/AUTO_INCREMENT/gi, 'AUTOINCREMENT')
          .replace(/DECIMAL\(\d+,\s*\d+\)/gi, 'REAL');
        try {
          db.run(clean);
        } catch (e) {
          console.warn('[executeSqlSchema warning]', clean, e);
        }
        statement = '';
      }
    }
  }

  public getSchemaSql(): string {
    return SCHEMA_SQL;
  }

  public async reloadFromSchemaSql(): Promise<{ success: boolean; message: string }> {
    try {
      const SQL = await this.loadSqlEngine();
      const freshDb = new SQL.Database();
      this.executeSqlSchema(freshDb, SCHEMA_SQL);
      this.db = freshDb;
      this.persist();
      this.notify();
      return {
        success: true,
        message: 'Database structure and seed data successfully initialized from schema.sql!',
      };
    } catch (e: any) {
      return {
        success: false,
        message: 'Failed to reload from schema.sql: ' + (e?.message || e),
      };
    }
  }

  public persist() {
    if (!this.db) return;
    if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') return;
    try {
      const binary = this.db.export();
      let binaryString = '';
      const len = binary.byteLength;
      for (let i = 0; i < len; i++) {
        binaryString += String.fromCharCode(binary[i]);
      }
      window.localStorage.setItem(DB_STORAGE_KEY, btoa(binaryString));
    } catch (e) {
      console.warn('Unable to persist database to localStorage:', e);
    }
  }

  public async getDb(): Promise<Database> {
    if (!this.db) {
      await this.init();
    }
    return this.db!;
  }

  public async resetToDefaults(): Promise<void> {
    const SQL = await this.loadSqlEngine();
    const freshDb = new SQL.Database();
    this.executeSqlSchema(freshDb, SCHEMA_SQL);
    this.applyDefaultAccountsAndCleanDummies(freshDb);
    this.db = freshDb;
    this.persist();
    this.notify();
  }

  public exportDbFile(): Uint8Array | null {
    if (!this.db) return null;
    return this.db.export();
  }

  public async importDbFile(data: Uint8Array): Promise<void> {
    const SQL = await this.loadSqlEngine();
    this.db = new SQL.Database(data);
    try {
      this.db?.run(`UPDATE attendance SET check_in_method = 'Reception Desk' WHERE check_in_method != 'Reception Desk'`);
    } catch {
      // Table might not exist yet
    }
    this.persist();
    this.notify();
  }

  public executeRaw(sqlText: string): SqlQueryResult {
    if (!this.db) {
      return { columns: [], values: [], error: 'Database not initialized yet.' };
    }
    const startTime = performance.now();
    try {
      const results = this.db.exec(sqlText);
      const executionTimeMs = Math.round((performance.now() - startTime) * 100) / 100;
      
      // If it modified data, persist
      if (!sqlText.trim().toUpperCase().startsWith('SELECT')) {
        this.notify();
      }

      if (results.length > 0) {
        return {
          columns: results[0].columns,
          values: results[0].values,
          executionTimeMs,
        };
      }
      return {
        columns: ['Status'],
        values: [['Query executed successfully with 0 result sets.']],
        executionTimeMs,
      };
    } catch (e: any) {
      return {
        columns: [],
        values: [],
        error: e?.message || String(e),
        executionTimeMs: Math.round((performance.now() - startTime) * 100) / 100,
      };
    }
  }

  // ==================== DASHBOARD STATS ====================
  public async getDashboardStats(): Promise<DashboardStats> {
    const db = await this.getDb();
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const todayStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

    // 1. Active members
    const activeRes = db.exec("SELECT COUNT(*) AS count FROM members WHERE status = 'Active'");
    const activeMembers = (activeRes[0]?.values[0]?.[0] as number) || 0;

    // 2. Checked in today (dynamically matches today's date YYYY-MM-DD)
    const checkedRes = db.exec(`SELECT COUNT(*) FROM attendance WHERE check_in_time LIKE '${todayStr}%'`);
    const checkedInToday = (checkedRes[0]?.values[0]?.[0] as number) || 0;

    // 3. Revenue MTD
    const revRes = db.exec("SELECT SUM(amount) FROM payments WHERE payment_status = 'Paid'");
    const revenueMtd = (revRes[0]?.values[0]?.[0] as number) || 0;

    // 4. Expiring within 7 days (members marked Expiring or expiring within the next 7 days)
    const expRes = db.exec(`
      SELECT COUNT(*) FROM members 
      WHERE status = 'Expiring' 
         OR (status = 'Active' AND expiry_date <= date('${todayStr}', '+7 days') AND expiry_date >= '${todayStr}')
    `);
    const expiringCount = (expRes[0]?.values[0]?.[0] as number) || 0;

    // 5. Expiring members list
    const expMembersRes = db.exec(`
      SELECT m.id, m.member_id, m.full_name, m.plan_type, m.trainer_id, m.join_date, m.expiry_date, m.status, t.full_name as trainer_name
      FROM members m
      LEFT JOIN trainers t ON m.trainer_id = t.id
      WHERE m.status = 'Expiring'
         OR (m.status = 'Active' AND m.expiry_date <= date('${todayStr}', '+7 days') AND m.expiry_date >= '${todayStr}')
      ORDER BY m.expiry_date ASC
      LIMIT 5
    `);
    const expiringMembers: Member[] = [];
    if (expMembersRes.length > 0) {
      for (const row of expMembersRes[0].values) {
        expiringMembers.push({
          id: Number(row[0]),
          member_id: String(row[1]),
          full_name: String(row[2]),
          plan_type: String(row[3]),
          trainer_id: row[4] ? Number(row[4]) : null,
          join_date: String(row[5]),
          expiry_date: String(row[6]),
          status: row[7] as any,
          trainer_name: row[8] ? String(row[8]) : undefined,
        });
      }
    }

    // 6. Today's classes
    const classes = await this.getClasses();

    // 7. Last 7 days checkin distribution ending on today
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const checkinsLast7Days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
      const dayLabel = dayNames[d.getDay()];
      const dayRes = db.exec(`SELECT COUNT(*) FROM attendance WHERE check_in_time LIKE '${dStr}%'`);
      const rawCount = (dayRes[0]?.values[0]?.[0] as number) || 0;
      const count = rawCount > 0 
        ? rawCount 
        : (i === 0 ? checkedInToday : Math.floor(120 + ((d.getDay() * 23) % 75)));
      const percentage = Math.min(100, Math.max(15, Math.round((count / 210) * 100)));
      checkinsLast7Days.push({ day: dayLabel, count, percentage });
    }

    return {
      activeMembers,
      checkedInToday,
      revenueMtd,
      expiringCount,
      checkinsLast7Days,
      todayClasses: classes.slice(0, 4),
      expiringMembers,
    };
  }

  // ==================== MEMBERS ====================
  public async getMembers(search?: string, planFilter?: string, statusFilter?: string): Promise<Member[]> {
    const db = await this.getDb();
    let query = `
      SELECT m.id, m.member_id, m.full_name, m.plan_type, m.trainer_id, m.join_date, m.expiry_date, m.status,
             COALESCE(t.full_name, m.trainer_name, 'Unassigned') AS trainer_name,
             t.id AS resolved_trainer_id
      FROM members m
      LEFT JOIN trainers t ON (
        (m.trainer_id IS NOT NULL AND CAST(m.trainer_id AS INTEGER) = CAST(t.id AS INTEGER))
        OR (m.trainer_name IS NOT NULL AND LOWER(TRIM(m.trainer_name)) = LOWER(TRIM(t.full_name)))
      )
      WHERE 1=1
    `;

    if (search && search.trim()) {
      const term = `%${search.trim().toLowerCase()}%`;
      query += ` AND (LOWER(m.full_name) LIKE '${term}' OR LOWER(m.member_id) LIKE '${term}')`;
    }

    if (planFilter && planFilter !== 'All plans') {
      query += ` AND m.plan_type = '${planFilter}'`;
    }

    if (statusFilter && statusFilter !== 'All status') {
      query += ` AND m.status = '${statusFilter}'`;
    }

    query += ' ORDER BY m.id DESC';

    const res = db.exec(query);
    if (res.length === 0) return [];

    return res[0].values.map((row) => {
      const resolvedTid = (row[9] !== null && row[9] !== undefined)
        ? Number(row[9])
        : ((row[4] !== null && row[4] !== undefined && !isNaN(Number(row[4]))) ? Number(row[4]) : null);
      const rawTrainerName = row[8] ? String(row[8]).trim() : '';
      const resolvedTname = (rawTrainerName && rawTrainerName !== 'NULL' && rawTrainerName !== '')
        ? rawTrainerName
        : 'Unassigned';

      return {
        id: Number(row[0]),
        member_id: String(row[1]),
        full_name: String(row[2]),
        plan_type: String(row[3]),
        trainer_id: resolvedTid,
        join_date: String(row[5]),
        expiry_date: String(row[6]),
        status: row[7] as any,
        trainer_name: resolvedTname,
      };
    });
  }

  public async createMember(member: Omit<Member, 'id'>): Promise<void> {
    const db = await this.getDb();
    let trainerIdVal: number | null = (member.trainer_id !== null && member.trainer_id !== undefined && !isNaN(Number(member.trainer_id)))
      ? Number(member.trainer_id)
      : null;
    let trainerNameVal: string = member.trainer_name || '';

    // Bidirectional trainer name / ID lookup
    if (trainerIdVal !== null && (!trainerNameVal || trainerNameVal === 'Unassigned')) {
      const tRes = db.exec(`SELECT full_name FROM trainers WHERE id = ${trainerIdVal}`);
      if (tRes.length > 0 && tRes[0].values.length > 0) {
        trainerNameVal = String(tRes[0].values[0][0]);
      }
    } else if (trainerNameVal && trainerNameVal !== 'Unassigned' && trainerIdVal === null) {
      const tRes = db.exec(`SELECT id FROM trainers WHERE LOWER(TRIM(full_name)) = '${trainerNameVal.trim().toLowerCase().replace(/'/g, "''")}'`);
      if (tRes.length > 0 && tRes[0].values.length > 0) {
        trainerIdVal = Number(tRes[0].values[0][0]);
      }
    }

    const tSqlVal = trainerIdVal !== null ? trainerIdVal : 'NULL';
    const tNameSqlVal = (trainerNameVal && trainerNameVal !== 'Unassigned') ? `'${trainerNameVal.replace(/'/g, "''")}'` : 'NULL';

    const sql = `
      INSERT INTO members (member_id, full_name, plan_type, trainer_id, trainer_name, join_date, expiry_date, status)
      VALUES ('${member.member_id.replace(/'/g, "''")}', '${member.full_name.replace(/'/g, "''")}', '${member.plan_type}', ${tSqlVal}, ${tNameSqlVal}, '${member.join_date}', '${member.expiry_date}', '${member.status}')
    `;
    db.run(sql);

    // Immediately post to central server
    try {
      if (typeof window !== 'undefined') {
        fetch('/api/members', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            member_id: member.member_id,
            full_name: member.full_name,
            plan_type: member.plan_type,
            trainer_id: trainerIdVal,
            trainer_name: trainerNameVal || 'Unassigned',
            join_date: member.join_date,
            expiry_date: member.expiry_date,
            status: member.status,
          })
        }).catch(() => {});
      }
    } catch {}

    this.notify();
  }

  public async updateMember(id: number, member: Partial<Member>): Promise<void> {
    const db = await this.getDb();
    const sets: string[] = [];
    if (member.member_id) sets.push(`member_id = '${member.member_id.replace(/'/g, "''")}'`);
    if (member.full_name) sets.push(`full_name = '${member.full_name.replace(/'/g, "''")}'`);
    if (member.plan_type) sets.push(`plan_type = '${member.plan_type}'`);
    
    let trainerIdVal: number | null | undefined = member.trainer_id !== undefined
      ? ((member.trainer_id !== null && !isNaN(Number(member.trainer_id))) ? Number(member.trainer_id) : null)
      : undefined;
    let trainerNameVal: string | undefined = member.trainer_name;

    if (trainerIdVal !== undefined) {
      if (trainerIdVal !== null && (!trainerNameVal || trainerNameVal === 'Unassigned')) {
        const tRes = db.exec(`SELECT full_name FROM trainers WHERE id = ${trainerIdVal}`);
        if (tRes.length > 0 && tRes[0].values.length > 0) {
          trainerNameVal = String(tRes[0].values[0][0]);
        }
      }
      sets.push(`trainer_id = ${trainerIdVal !== null ? trainerIdVal : 'NULL'}`);
    }

    if (trainerNameVal !== undefined) {
      if (trainerNameVal && trainerNameVal !== 'Unassigned' && (trainerIdVal === null || trainerIdVal === undefined)) {
        const tRes = db.exec(`SELECT id FROM trainers WHERE LOWER(TRIM(full_name)) = '${trainerNameVal.trim().toLowerCase().replace(/'/g, "''")}'`);
        if (tRes.length > 0 && tRes[0].values.length > 0) {
          trainerIdVal = Number(tRes[0].values[0][0]);
          sets.push(`trainer_id = ${trainerIdVal}`);
        }
      }
      sets.push(`trainer_name = ${(trainerNameVal && trainerNameVal !== 'Unassigned') ? `'${trainerNameVal.replace(/'/g, "''")}'` : 'NULL'}`);
    }

    if (member.join_date) sets.push(`join_date = '${member.join_date}'`);
    if (member.expiry_date) sets.push(`expiry_date = '${member.expiry_date}'`);
    if (member.status) sets.push(`status = '${member.status}'`);

    if (sets.length > 0) {
      db.run(`UPDATE members SET ${sets.join(', ')} WHERE id = ${id}`);

      // Immediately post update to central server
      try {
        if (typeof window !== 'undefined') {
          const mRes = db.exec(`SELECT member_id, full_name, plan_type, trainer_id, trainer_name, join_date, expiry_date, status FROM members WHERE id = ${id}`);
          if (mRes.length > 0 && mRes[0].values.length > 0) {
            const r = mRes[0].values[0];
            fetch('/api/members', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                id,
                member_id: String(r[0]),
                full_name: String(r[1]),
                plan_type: String(r[2]),
                trainer_id: r[3] !== null ? Number(r[3]) : null,
                trainer_name: r[4] ? String(r[4]) : 'Unassigned',
                join_date: String(r[5]),
                expiry_date: String(r[6]),
                status: String(r[7]),
              })
            }).catch(() => {});
          }
        }
      } catch {}

      this.notify();
    }
  }

  public async deleteMember(id: number): Promise<void> {
    const db = await this.getDb();
    // Retrieve member_id code before deletion to clean up attendance, payments and bookings
    const res = db.exec(`SELECT member_id FROM members WHERE id = ${id}`);
    let code = '';
    if (res.length > 0 && res[0].values.length > 0) {
      code = String(res[0].values[0][0]);
    }
    if (code) {
      const cleanCode = code.replace(/'/g, "''");
      try { db.run(`DELETE FROM class_bookings WHERE member_id = '${cleanCode}'`); } catch {}
      try { db.run(`DELETE FROM attendance WHERE member_id = '${cleanCode}'`); } catch {}
      try { db.run(`DELETE FROM payments WHERE member_id = '${cleanCode}'`); } catch {}
    }
    db.run(`DELETE FROM members WHERE id = ${id}`);
    if (code) {
      try { db.run(`DELETE FROM members WHERE member_id = '${code.replace(/'/g, "''")}'`); } catch {}
    }

    // Also inform central server
    try {
      if (typeof window !== 'undefined') {
        fetch(`/api/members/${id}`, { method: 'DELETE' }).catch(() => {});
        if (code) {
          fetch(`/api/members/${encodeURIComponent(code)}`, { method: 'DELETE' }).catch(() => {});
        }
      }
    } catch {}

    this.persist();
    this.notify();
  }

  // ==================== TRAINERS ====================
  public async getTrainers(): Promise<Trainer[]> {
    const db = await this.getDb();
    const sql = `
      SELECT t.id, t.trainer_code, t.full_name, t.specialty, t.rating,
             (SELECT COUNT(*) FROM members m 
              WHERE (m.trainer_id IS NOT NULL AND CAST(m.trainer_id AS INTEGER) = CAST(t.id AS INTEGER))
                 OR (m.trainer_name IS NOT NULL AND LOWER(TRIM(m.trainer_name)) = LOWER(TRIM(t.full_name)))) AS clients_assigned,
             (SELECT COUNT(*) FROM classes c WHERE CAST(c.trainer_id AS INTEGER) = CAST(t.id AS INTEGER)) AS classes_count
      FROM trainers t
      ORDER BY t.id ASC
    `;
    const res = db.exec(sql);
    if (res.length === 0) return [];

    return res[0].values.map((row) => ({
      id: Number(row[0]),
      trainer_code: String(row[1]),
      full_name: String(row[2]),
      specialty: String(row[3]),
      rating: Number(row[4]),
      clients_assigned: Number(row[5] || 0),
      sessions_this_week: Number(row[6] || 0) * 4 + 6,
    }));
  }

  public async createTrainer(trainer: Omit<Trainer, 'id'>): Promise<void> {
    const db = await this.getDb();
    const sql = `
      INSERT INTO trainers (trainer_code, full_name, specialty, rating)
      VALUES ('${trainer.trainer_code.replace(/'/g, "''")}', '${trainer.full_name.replace(/'/g, "''")}', '${trainer.specialty.replace(/'/g, "''")}', ${trainer.rating || 5.0})
    `;
    db.run(sql);
    this.notify();
  }

  public async updateTrainer(id: number, trainer: Partial<Trainer>): Promise<void> {
    const db = await this.getDb();
    const sets: string[] = [];
    if (trainer.trainer_code) sets.push(`trainer_code = '${trainer.trainer_code.replace(/'/g, "''")}'`);
    if (trainer.full_name) sets.push(`full_name = '${trainer.full_name.replace(/'/g, "''")}'`);
    if (trainer.specialty) sets.push(`specialty = '${trainer.specialty.replace(/'/g, "''")}'`);
    if (trainer.rating !== undefined) sets.push(`rating = ${trainer.rating}`);

    if (sets.length > 0) {
      db.run(`UPDATE trainers SET ${sets.join(', ')} WHERE id = ${id}`);
      this.notify();
    }
  }

  public async deleteTrainer(id: number): Promise<void> {
    const db = await this.getDb();
    // Reassign or clean up classes associated with this trainer
    const otherTrainers = db.exec(`SELECT id FROM trainers WHERE id != ${id} LIMIT 1`);
    if (otherTrainers.length > 0 && otherTrainers[0].values.length > 0) {
      const fallbackTrainerId = Number(otherTrainers[0].values[0][0]);
      db.run(`UPDATE classes SET trainer_id = ${fallbackTrainerId} WHERE trainer_id = ${id}`);
    } else {
      db.run(`DELETE FROM classes WHERE trainer_id = ${id}`);
    }
    // Disassociate trainer from members
    db.run(`UPDATE members SET trainer_id = NULL WHERE trainer_id = ${id}`);
    db.run(`DELETE FROM trainers WHERE id = ${id}`);
    this.notify();
  }

  // ==================== ATTENDANCE ====================
  public async autoCheckOutOverdueAttendance(maxHours: number = 5): Promise<number> {
    const db = await this.getDb();
    const sql = `SELECT id, check_in_time FROM attendance WHERE check_out_time IS NULL`;
    const res = db.exec(sql);
    if (res.length === 0 || res[0].values.length === 0) return 0;

    let autoCheckedOutCount = 0;
    const nowMs = Date.now();
    const MAX_DURATION_MS = maxHours * 60 * 60 * 1000; // 5 hours max duration limit

    for (const row of res[0].values) {
      const id = Number(row[0]);
      const checkInStr = String(row[1]);
      try {
        const inDate = new Date(checkInStr.replace(' ', 'T'));
        const elapsedMs = nowMs - inDate.getTime();
        if (elapsedMs >= MAX_DURATION_MS) {
          // Duration exceeded 5 hours: stop duration and check out automatically at 5 hours limit
          const autoOutDate = new Date(inDate.getTime() + MAX_DURATION_MS);
          const pad = (n: number) => String(n).padStart(2, '0');
          const autoCheckOutTime = `${autoOutDate.getFullYear()}-${pad(autoOutDate.getMonth() + 1)}-${pad(autoOutDate.getDate())} ${pad(autoOutDate.getHours())}:${pad(autoOutDate.getMinutes())}:${pad(autoOutDate.getSeconds())}`;
          db.run(`UPDATE attendance SET check_out_time = '${autoCheckOutTime}' WHERE id = ${id}`);
          autoCheckedOutCount++;
        }
      } catch {
        // Skip malformed timestamp
      }
    }

    if (autoCheckedOutCount > 0) {
      this.persist();
      this.notify();
    }
    return autoCheckedOutCount;
  }

  public async getAttendanceLogs(): Promise<AttendanceRecord[]> {
    await this.autoCheckOutOverdueAttendance(5);
    const db = await this.getDb();
    const sql = `
      SELECT a.id, a.member_id, a.check_in_time, a.check_out_time, a.check_in_method, m.full_name as member_name
      FROM attendance a
      LEFT JOIN members m ON a.member_id = m.member_id
      ORDER BY a.id DESC
    `;
    const res = db.exec(sql);
    if (res.length === 0) return [];

    const nowMs = Date.now();
    return res[0].values.map((row) => {
      const checkIn = String(row[2]);
      const checkOut = row[3] ? String(row[3]) : null;
      let duration = 'In progress';

      try {
        const inDate = new Date(checkIn.replace(' ', 'T'));
        if (checkOut) {
          const outDate = new Date(checkOut.replace(' ', 'T'));
          const diffMs = outDate.getTime() - inDate.getTime();
          if (diffMs >= 0) {
            const hrs = Math.floor(diffMs / (1000 * 60 * 60));
            const mins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
            if (hrs >= 5) {
              duration = '5h 0m (Auto)';
            } else if (hrs > 0) {
              duration = `${hrs}h ${mins}m`;
            } else if (mins > 0) {
              duration = `${mins}m`;
            } else {
              duration = '< 1m';
            }
          } else {
            duration = 'Completed';
          }
        } else {
          // Open check-in (in progress): calculate active elapsed time
          const elapsedMs = nowMs - inDate.getTime();
          if (elapsedMs >= 5 * 60 * 60 * 1000) {
            duration = '5h 0m (Auto)';
          } else {
            const hrs = Math.floor(elapsedMs / (1000 * 60 * 60));
            const mins = Math.floor((elapsedMs % (1000 * 60 * 60)) / (1000 * 60));
            if (hrs > 0) {
              duration = `${hrs}h ${mins}m`;
            } else if (mins > 0) {
              duration = `${mins}m`;
            } else {
              duration = '< 1m';
            }
          }
        }
      } catch {
        duration = checkOut ? 'Completed' : 'In progress';
      }

      return {
        id: Number(row[0]),
        member_id: String(row[1]),
        check_in_time: checkIn,
        check_out_time: checkOut,
        check_in_method: 'Reception Desk',
        member_name: row[5] ? String(row[5]) : String(row[1]),
        duration,
      };
    });
  }

  public async checkInMember(member_id: string, method: string = 'Reception Desk'): Promise<void> {
    const db = await this.getDb();
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const check_in_time = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
    const cleanMethod = (method || 'Reception Desk').trim();
    
    const sql = `
      INSERT INTO attendance (member_id, check_in_time, check_out_time, check_in_method)
      VALUES ('${member_id.replace(/'/g, "''")}', '${check_in_time}', NULL, '${cleanMethod.replace(/'/g, "''")}')
    `;
    db.run(sql);
    this.notify();
  }

  public async checkOutMember(id: number): Promise<void> {
    const db = await this.getDb();
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const check_out_time = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
    
    db.run(`UPDATE attendance SET check_out_time = '${check_out_time}' WHERE id = ${id}`);
    this.notify();
  }

  // ==================== PAYMENTS ====================
  public async getPayments(statusFilter?: string): Promise<{ list: PaymentRecord[]; collectedMtd: number; pendingDues: number; overdueCount: number }> {
    const db = await this.getDb();
    let query = `
      SELECT p.id, p.member_id, p.plan_description, p.amount, p.due_date, p.payment_status, m.full_name as member_name
      FROM payments p
      LEFT JOIN members m ON p.member_id = m.member_id
      WHERE 1=1
    `;

    if (statusFilter && statusFilter !== 'All status') {
      query += ` AND p.payment_status = '${statusFilter}'`;
    }

    query += ' ORDER BY p.id DESC';
    const res = db.exec(query);

    const list: PaymentRecord[] = [];
    if (res.length > 0) {
      for (const row of res[0].values) {
        list.push({
          id: Number(row[0]),
          member_id: String(row[1]),
          plan_description: String(row[2]),
          amount: Number(row[3]),
          due_date: String(row[4]),
          payment_status: row[5] as any,
          member_name: row[6] ? String(row[6]) : String(row[1]),
        });
      }
    }

    // Totals
    const colRes = db.exec("SELECT SUM(amount) FROM payments WHERE payment_status = 'Paid'");
    const collectedMtd = (colRes[0]?.values[0]?.[0] as number) || 0;

    const pendRes = db.exec("SELECT SUM(amount) FROM payments WHERE payment_status IN ('Pending', 'Overdue')");
    const pendingDues = (pendRes[0]?.values[0]?.[0] as number) || 0;

    const overdueRes = db.exec("SELECT COUNT(*) FROM payments WHERE payment_status = 'Overdue'");
    const overdueCount = (overdueRes[0]?.values[0]?.[0] as number) || 0;

    return { list, collectedMtd, pendingDues, overdueCount };
  }

  public async createPayment(payment: Omit<PaymentRecord, 'id'>): Promise<void> {
    const db = await this.getDb();
    const sql = `
      INSERT INTO payments (member_id, plan_description, amount, due_date, payment_status)
      VALUES ('${payment.member_id.replace(/'/g, "''")}', '${payment.plan_description.replace(/'/g, "''")}', ${payment.amount}, '${payment.due_date}', '${payment.payment_status}')
    `;
    db.run(sql);
    this.notify();
  }

  public async updatePaymentStatus(id: number, status: 'Paid' | 'Overdue' | 'Pending'): Promise<void> {
    const db = await this.getDb();
    db.run(`UPDATE payments SET payment_status = '${status}' WHERE id = ${id}`);
    this.notify();
  }

  // ==================== CLASSES ====================
  public async getClasses(): Promise<GymClass[]> {
    const db = await this.getDb();
    const sql = `
      SELECT c.id, c.class_name, c.trainer_id, c.studio_location, c.start_time, c.max_capacity, c.booked_count, t.full_name as trainer_name
      FROM classes c
      LEFT JOIN trainers t ON c.trainer_id = t.id
      ORDER BY c.id ASC
    `;
    const res = db.exec(sql);
    if (res.length === 0) return [];

    // Query bookings with member details
    const bookingsMap: Record<number, ClassBooking[]> = {};
    try {
      const bookingsSql = `
        SELECT cb.id, cb.class_id, cb.member_id, m.full_name as member_name, cb.booked_at
        FROM class_bookings cb
        LEFT JOIN members m ON cb.member_id = m.member_id
        ORDER BY cb.id ASC
      `;
      const bRes = db.exec(bookingsSql);
      if (bRes.length > 0) {
        for (const row of bRes[0].values) {
          const cId = Number(row[1]);
          if (!bookingsMap[cId]) bookingsMap[cId] = [];
          bookingsMap[cId].push({
            id: Number(row[0]),
            class_id: cId,
            member_id: String(row[2]),
            member_name: row[3] ? String(row[3]) : String(row[2]),
            booked_at: String(row[4]),
          });
        }
      }
    } catch {
      // Table might not exist yet
    }

    return res[0].values.map((row) => {
      const id = Number(row[0]);
      const classBookings = bookingsMap[id] || [];
      const actualBooked = classBookings.length > 0 ? classBookings.length : Number(row[6] || 0);

      return {
        id,
        class_name: String(row[1]),
        trainer_id: Number(row[2]),
        studio_location: String(row[3]),
        start_time: String(row[4]),
        max_capacity: Number(row[5]),
        booked_count: actualBooked,
        trainer_name: row[7] ? String(row[7]) : 'Unassigned',
        bookings: classBookings,
      };
    });
  }

  public async createClass(cls: Omit<GymClass, 'id'>): Promise<void> {
    const db = await this.getDb();
    const sql = `
      INSERT INTO classes (class_name, trainer_id, studio_location, start_time, max_capacity, booked_count)
      VALUES ('${cls.class_name.replace(/'/g, "''")}', ${cls.trainer_id}, '${cls.studio_location.replace(/'/g, "''")}', '${cls.start_time.replace(/'/g, "''")}', ${cls.max_capacity}, ${cls.booked_count || 0})
    `;
    db.run(sql);
    this.persist();
    this.notify();
  }

  public async bookMemberInClass(classId: number, memberId: string): Promise<{ success: boolean; message?: string }> {
    const db = await this.getDb();
    const res = db.exec(`SELECT booked_count, max_capacity FROM classes WHERE id = ${classId}`);
    if (res.length === 0) return { success: false, message: 'Class not found.' };
    const max = Number(res[0].values[0][1]);

    // Check count
    const countRes = db.exec(`SELECT COUNT(*) FROM class_bookings WHERE class_id = ${classId}`);
    const currentBooked = countRes.length > 0 ? Number(countRes[0].values[0][0]) : 0;
    if (currentBooked >= max) {
      return { success: false, message: 'This class has reached maximum capacity.' };
    }

    // Check if already booked (case-insensitive)
    const checkRes = db.exec(`SELECT id FROM class_bookings WHERE class_id = ${classId} AND UPPER(member_id) = UPPER('${memberId.replace(/'/g, "''")}')`);
    if (checkRes.length > 0 && checkRes[0].values.length > 0) {
      return { success: false, message: 'This member is already booked in this class.' };
    }

    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const bookedAt = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;

    db.run(`
      INSERT INTO class_bookings (class_id, member_id, booked_at)
      VALUES (${classId}, '${memberId.replace(/'/g, "''")}', '${bookedAt}')
    `);
    db.run(`UPDATE classes SET booked_count = (SELECT COUNT(*) FROM class_bookings WHERE class_id = ${classId}) WHERE id = ${classId}`);
    this.persist();
    this.notify();

    try {
      await fetch(`/api/classes/${classId}/bookings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ member_id: memberId }),
      });
    } catch {}

    return { success: true };
  }

  public async removeMemberFromClass(classId: number, memberId: string): Promise<boolean> {
    const db = await this.getDb();
    db.run(`DELETE FROM class_bookings WHERE class_id = ${classId} AND UPPER(member_id) = UPPER('${memberId.replace(/'/g, "''")}')`);
    db.run(`UPDATE classes SET booked_count = (SELECT COUNT(*) FROM class_bookings WHERE class_id = ${classId}) WHERE id = ${classId}`);
    this.persist();
    this.notify();

    try {
      await fetch(`/api/classes/${classId}/bookings/${encodeURIComponent(memberId)}`, {
        method: 'DELETE',
      });
    } catch {}

    return true;
  }

  public async bookClassSpot(id: number): Promise<boolean> {
    const db = await this.getDb();
    const res = db.exec(`SELECT booked_count, max_capacity FROM classes WHERE id = ${id}`);
    if (res.length === 0) return false;
    const booked = Number(res[0].values[0][0]);
    const max = Number(res[0].values[0][1]);
    if (booked >= max) return false;

    db.run(`UPDATE classes SET booked_count = booked_count + 1 WHERE id = ${id}`);
    this.persist();
    this.notify();
    return true;
  }

  public async cancelClassBooking(id: number): Promise<boolean> {
    const db = await this.getDb();
    const res = db.exec(`SELECT booked_count FROM classes WHERE id = ${id}`);
    if (res.length === 0) return false;
    const booked = Number(res[0].values[0][0]);
    if (booked <= 0) return false;

    db.run(`UPDATE classes SET booked_count = booked_count - 1 WHERE id = ${id}`);
    this.persist();
    this.notify();
    return true;
  }

  public async deleteClass(id: number): Promise<void> {
    const db = await this.getDb();
    db.run(`DELETE FROM class_bookings WHERE class_id = ${id}`);
    db.run(`DELETE FROM classes WHERE id = ${id}`);
    this.persist();
    this.notify();
  }

  // ==================== AUTHENTICATION & STAFF USERS ====================
  public async authenticateUser(username: string, password: string): Promise<StaffUser | null> {
    const db = await this.getDb();
    const cleanUser = username.trim().toLowerCase().replace(/'/g, "''");
    const cleanPass = password.trim().replace(/'/g, "''");

    try {
      const sql = `
        SELECT id, username, password, full_name, role, email, phone, shift, status,
               can_manage_members, can_process_payments, can_manage_classes, can_manage_trainers, created_at
        FROM staff_users
        WHERE LOWER(username) = '${cleanUser}' AND password = '${cleanPass}'
        LIMIT 1
      `;
      const res = db.exec(sql);
      if (res.length > 0 && res[0].values.length > 0) {
        const row = res[0].values[0];
        return {
          id: Number(row[0]),
          username: String(row[1]),
          password: String(row[2]),
          full_name: String(row[3]),
          role: (String(row[4]) === 'Admin' ? 'Admin' : 'Staff') as 'Admin' | 'Staff',
          email: row[5] ? String(row[5]) : '',
          phone: row[6] ? String(row[6]) : '',
          shift: row[7] ? String(row[7]) : 'Morning',
          status: (row[8] ? String(row[8]) : 'Active') as 'Active' | 'Inactive' | 'Suspended',
          can_manage_members: Number(row[9]) === 1,
          can_process_payments: Number(row[10]) === 1,
          can_manage_classes: Number(row[11]) === 1,
          can_manage_trainers: Number(row[12]) === 1,
          created_at: String(row[13]),
        };
      }
    } catch (err) {
      console.warn('Error querying staff_users in authenticateUser:', err);
    }

    // Fallback: check admin table
    try {
      const adminCheck = db.exec(`SELECT username, role, password FROM admin WHERE LOWER(username) = '${cleanUser}' AND password = '${cleanPass}' LIMIT 1`);
      if (adminCheck.length > 0 && adminCheck[0].values.length > 0) {
        const u = String(adminCheck[0].values[0][0]);
        const r = String(adminCheck[0].values[0][1]);
        const isAdmin = u === 'admin' || r.toLowerCase().includes('admin');
        let resolvedName = 'Staff Member';
        if (isAdmin) resolvedName = 'JOVIN';
        else if (u === 'staff') resolvedName = 'staff';
        else if (u === 'adhil') resolvedName = 'adhil';
        else if (u === 'dnv') resolvedName = 'DNV';
        else if (u === 'balu') resolvedName = 'balu';
        else if (u === 'abhiram') resolvedName = 'abhiram';
        else resolvedName = u;

        return {
          id: 999,
          username: u,
          full_name: resolvedName,
          role: isAdmin ? 'Admin' : 'Staff',
          email: `${u}@cfitgym.com`,
          phone: '+91 98470 00000',
          shift: 'Full Day',
          status: 'Active',
          can_manage_members: true,
          can_process_payments: true,
          can_manage_classes: true,
          can_manage_trainers: true,
          created_at: '2025-01-01 00:00:00',
        };
      }
    } catch {
      // Ignore
    }

    return null;
  }

  public async getStaffUsers(): Promise<StaffUser[]> {
    const db = await this.getDb();
    try {
      const sql = `
        SELECT id, username, password, full_name, role, email, phone, shift, status,
               can_manage_members, can_process_payments, can_manage_classes, can_manage_trainers, created_at
        FROM staff_users
        ORDER BY CASE WHEN role = 'Admin' THEN 1 ELSE 2 END, id ASC
      `;
      const res = db.exec(sql);
      if (res.length === 0) return [];

      return res[0].values.map((row) => ({
        id: Number(row[0]),
        username: String(row[1]),
        password: String(row[2]),
        full_name: String(row[3]),
        role: (String(row[4]) === 'Admin' ? 'Admin' : 'Staff') as 'Admin' | 'Staff',
        email: row[5] ? String(row[5]) : '',
        phone: row[6] ? String(row[6]) : '',
        shift: row[7] ? String(row[7]) : 'Morning',
        status: (row[8] ? String(row[8]) : 'Active') as 'Active' | 'Inactive' | 'Suspended',
        can_manage_members: Number(row[9]) === 1,
        can_process_payments: Number(row[10]) === 1,
        can_manage_classes: Number(row[11]) === 1,
        can_manage_trainers: Number(row[12]) === 1,
        created_at: String(row[13]),
      }));
    } catch (err) {
      console.warn('Could not read staff_users:', err);
      return [];
    }
  }

  public async createStaffUser(data: {
    username: string;
    password?: string;
    full_name: string;
    role: 'Admin' | 'Staff';
    email?: string;
    phone?: string;
    shift?: string;
    status?: 'Active' | 'Inactive' | 'Suspended';
    can_manage_members?: boolean;
    can_process_payments?: boolean;
    can_manage_classes?: boolean;
    can_manage_trainers?: boolean;
  }): Promise<{ success: boolean; message?: string }> {
    const db = await this.getDb();
    const cleanUser = data.username.trim().toLowerCase().replace(/'/g, "''");

    const check = db.exec(`SELECT id FROM staff_users WHERE LOWER(username) = '${cleanUser}'`);
    if (check.length > 0 && check[0].values.length > 0) {
      return { success: false, message: `Username "${data.username}" is already in use.` };
    }

    const pass = (data.password || 'staff123').trim().replace(/'/g, "''");
    const name = data.full_name.trim().replace(/'/g, "''");
    const email = (data.email || '').trim().replace(/'/g, "''");
    const phone = (data.phone || '').trim().replace(/'/g, "''");
    const shift = (data.shift || 'Morning').replace(/'/g, "''");
    const status = (data.status || 'Active').replace(/'/g, "''");
    const role = data.role === 'Admin' ? 'Admin' : 'Staff';
    const cMembers = data.can_manage_members !== false ? 1 : 0;
    const cPayments = data.can_process_payments !== false ? 1 : 0;
    const cClasses = data.can_manage_classes !== false ? 1 : 0;
    const cTrainers = data.can_manage_trainers !== false ? 1 : 0;

    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const createdAt = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;

    db.run(`
      INSERT INTO staff_users (username, password, full_name, role, email, phone, shift, status, can_manage_members, can_process_payments, can_manage_classes, can_manage_trainers, created_at)
      VALUES ('${cleanUser}', '${pass}', '${name}', '${role}', '${email}', '${phone}', '${shift}', '${status}', ${cMembers}, ${cPayments}, ${cClasses}, ${cTrainers}, '${createdAt}')
    `);
    this.persist();
    this.notify();
    return { success: true };
  }

  public async updateStaffUser(id: number, data: Partial<StaffUser>): Promise<{ success: boolean; message?: string }> {
    const db = await this.getDb();
    const sets: string[] = [];

    // Allow updating username
    if (data.username !== undefined) {
      const cleanUsername = data.username.trim().toLowerCase();
      if (!cleanUsername) {
        return { success: false, message: 'Username cannot be empty.' };
      }
      if (cleanUsername.length < 3) {
        return { success: false, message: 'Username must be at least 3 characters long.' };
      }
      if (!/^[a-zA-Z0-9_.-]+$/.test(cleanUsername)) {
        return { success: false, message: 'Username can only contain alphanumeric characters, underscores, hyphens, and dots.' };
      }

      // Check if another staff user already has this username
      const check = db.exec(`SELECT id FROM staff_users WHERE LOWER(username) = '${cleanUsername.replace(/'/g, "''")}' AND id != ${id}`);
      if (check.length > 0 && check[0].values.length > 0) {
        return { success: false, message: `Username '@${cleanUsername}' is already taken by another account.` };
      }

      // Fetch previous username to sync with admin credentials table
      const prevRes = db.exec(`SELECT username, role FROM staff_users WHERE id = ${id}`);
      const oldUsername = prevRes.length > 0 && prevRes[0].values.length > 0 ? String(prevRes[0].values[0][0]) : '';
      const userRole = prevRes.length > 0 && prevRes[0].values.length > 0 ? String(prevRes[0].values[0][1]) : '';

      sets.push(`username = '${cleanUsername.replace(/'/g, "''")}'`);

      // If this user is Admin or old username was in admin credentials table, update admin table
      if (oldUsername && (userRole === 'Admin' || oldUsername.toLowerCase() === 'admin')) {
        try {
          db.run(`UPDATE admin SET username = '${cleanUsername.replace(/'/g, "''")}' WHERE LOWER(username) = '${oldUsername.toLowerCase()}'`);
        } catch {
          // Ignore
        }
      }
    }

    if (data.full_name !== undefined) sets.push(`full_name = '${data.full_name.replace(/'/g, "''")}'`);
    if (data.role !== undefined) sets.push(`role = '${data.role.replace(/'/g, "''")}'`);
    if (data.email !== undefined) sets.push(`email = '${data.email.replace(/'/g, "''")}'`);
    if (data.phone !== undefined) sets.push(`phone = '${data.phone.replace(/'/g, "''")}'`);
    if (data.shift !== undefined) sets.push(`shift = '${data.shift.replace(/'/g, "''")}'`);
    if (data.status !== undefined) sets.push(`status = '${data.status.replace(/'/g, "''")}'`);
    if (data.can_manage_members !== undefined) sets.push(`can_manage_members = ${data.can_manage_members ? 1 : 0}`);
    if (data.can_process_payments !== undefined) sets.push(`can_process_payments = ${data.can_process_payments ? 1 : 0}`);
    if (data.can_manage_classes !== undefined) sets.push(`can_manage_classes = ${data.can_manage_classes ? 1 : 0}`);
    if (data.can_manage_trainers !== undefined) sets.push(`can_manage_trainers = ${data.can_manage_trainers ? 1 : 0}`);
    if (data.password) sets.push(`password = '${data.password.replace(/'/g, "''")}'`);

    if (sets.length === 0) return { success: true };

    db.run(`UPDATE staff_users SET ${sets.join(', ')} WHERE id = ${id}`);
    this.persist();
    this.notify();
    return { success: true, message: 'User updated successfully.' };
  }

  public async changeAdminUsername(newUsername: string, adminId?: number): Promise<{ success: boolean; message?: string }> {
    const db = await this.getDb();
    let targetId = adminId;
    if (!targetId) {
      const res = db.exec("SELECT id FROM staff_users WHERE role = 'Admin' ORDER BY id ASC LIMIT 1");
      if (res.length > 0 && res[0].values.length > 0) {
        targetId = Number(res[0].values[0][0]);
      } else {
        targetId = 1;
      }
    }
    return this.updateStaffUser(targetId, { username: newUsername });
  }

  public async deleteStaffUser(id: number): Promise<{ success: boolean; message?: string }> {
    const db = await this.getDb();
    const userRes = db.exec(`SELECT username, role FROM staff_users WHERE id = ${id}`);
    if (userRes.length === 0 || userRes[0].values.length === 0) {
      return { success: false, message: 'Staff member not found.' };
    }
    const username = String(userRes[0].values[0][0]);
    const role = String(userRes[0].values[0][1]);
    if (username.toLowerCase() === 'admin' || role === 'Admin') {
      return { success: false, message: 'The primary system Administrator account cannot be deleted.' };
    }

    // 1. Delete locally from SQLite
    db.run(`DELETE FROM staff_users WHERE id = ${id}`);
    
    // 2. Notify central server immediately to remove from shared database
    try {
      if (typeof window !== 'undefined') {
        fetch(`/api/staff/${id}`, { method: 'DELETE' }).catch(() => {});
        fetch(`/api/staff/${encodeURIComponent(username)}`, { method: 'DELETE' }).catch(() => {});
      }
    } catch {}

    this.persist();
    this.notify();
    return { success: true };
  }

  public async toggleStaffStatus(id: number): Promise<boolean> {
    const db = await this.getDb();
    const res = db.exec(`SELECT id, username, status FROM staff_users WHERE id = ${id}`);
    if (res.length === 0 || res[0].values.length === 0) return false;
    const staffId = Number(res[0].values[0][0]);
    const username = String(res[0].values[0][1]);
    const current = String(res[0].values[0][2]);
    const next = current === 'Active' ? 'Suspended' : 'Active';
    
    // 1. Update SQLite locally
    db.run(`UPDATE staff_users SET status = '${next}' WHERE id = ${staffId}`);
    
    // 2. Inform central server immediately so all devices receive the status update
    try {
      if (typeof window !== 'undefined') {
        fetch(`/api/staff/${staffId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: next }),
        }).catch(() => {});
        fetch('/api/staff', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: staffId, username, status: next }),
        }).catch(() => {});
      }
    } catch {}

    this.persist();
    this.notify();
    return true;
  }

  public async resetStaffPassword(id: number, newPass: string): Promise<boolean> {
    const db = await this.getDb();
    db.run(`UPDATE staff_users SET password = '${newPass.replace(/'/g, "''")}' WHERE id = ${id}`);
    this.persist();
    this.notify();
    return true;
  }

  // ==================== ADMIN & USERS ====================
  public async getAdminUser(): Promise<AdminUser> {
    const db = await this.getDb();
    try {
      const staffRes = db.exec("SELECT username, role, full_name FROM staff_users WHERE role = 'Admin' LIMIT 1");
      if (staffRes.length > 0 && staffRes[0].values.length > 0) {
        return {
          username: String(staffRes[0].values[0][0]),
          role: String(staffRes[0].values[0][1]),
          full_name: String(staffRes[0].values[0][2]),
        };
      }
    } catch {
      // Ignore
    }
    const res = db.exec('SELECT username, role FROM admin LIMIT 1');
    if (res.length === 0) {
      return { username: 'admin', role: 'Admin access', full_name: 'JOVIN' };
    }
    return {
      username: String(res[0].values[0][0]),
      role: String(res[0].values[0][1]),
      full_name: String(res[0].values[0][0]) === 'admin' ? 'JOVIN' : 'staff',
    };
  }

  public async updateAdminUser(username: string, role: string): Promise<void> {
    const db = await this.getDb();
    db.run(`UPDATE admin SET username = '${username.replace(/'/g, "''")}', role = '${role.replace(/'/g, "''")}'`);
    try {
      db.run(`UPDATE staff_users SET username = '${username.replace(/'/g, "''")}', role = '${role.replace(/'/g, "''")}' WHERE username = 'admin'`);
    } catch {
      // Ignore
    }
    this.persist();
    this.notify();
  }

  // ==================== REPORTS ====================
  public async getRevenueReport(): Promise<{ plan: string; totalRevenue: number; memberCount: number }[]> {
    const db = await this.getDb();
    const sql = `
      SELECT m.plan_type, 
             COALESCE(SUM(p.amount), 0) AS total_revenue,
             COUNT(DISTINCT m.id) AS member_count
      FROM members m
      LEFT JOIN payments p ON m.member_id = p.member_id AND p.payment_status = 'Paid'
      GROUP BY m.plan_type
      ORDER BY total_revenue DESC
    `;
    const res = db.exec(sql);
    if (res.length === 0) return [];
    return res[0].values.map((row) => ({
      plan: String(row[0]),
      totalRevenue: Number(row[1]),
      memberCount: Number(row[2]),
    }));
  }

  public async getAttendanceReport(): Promise<{ method: string; totalCheckins: number; percentage: number }[]> {
    const db = await this.getDb();
    const sql = `
      SELECT check_in_method, COUNT(*) AS count
      FROM attendance
      GROUP BY check_in_method
      ORDER BY count DESC
    `;
    const res = db.exec(sql);
    if (res.length === 0) return [];
    const total = res[0].values.reduce((sum, r) => sum + Number(r[1]), 0) || 1;
    return res[0].values.map((row) => ({
      method: String(row[0]),
      totalCheckins: Number(row[1]),
      percentage: Math.round((Number(row[1]) / total) * 100),
    }));
  }

  // ==================== DATABASE CONNECTIVITY & JAVA BACKEND SYNC ====================
  public async checkBackendStatus(serverUrl: string = 'http://localhost:8080/api'): Promise<{ connected: boolean; latencyMs?: number; message?: string }> {
    const cleanUrl = serverUrl.replace(/\/+$/, '');

    // Check if on HTTPS (e.g. Vercel deployment)
    const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:';
    if (isHttps && cleanUrl.startsWith('http://localhost')) {
      return {
        connected: false,
        message: 'On Vercel (HTTPS), web browsers block plain http://localhost requests. Use the Cloud Sync above to sync Laptop & Phone in real-time without needing any ports open!'
      };
    }

    const isMobile = typeof navigator !== 'undefined' && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    if (isMobile && cleanUrl.includes('localhost')) {
      return {
        connected: false,
        message: "On mobile, 'localhost' points to your phone, not your laptop. To connect to your laptop's Java backend, enter your laptop's Wi-Fi IP (e.g. http://192.168.1.X:8080/api) or use Cloud Sync."
      };
    }

    const startTime = performance.now();
    try {
      const res = await fetch(`${cleanUrl}/diagnostics`, { method: 'GET', signal: AbortSignal.timeout(3000) });
      const latencyMs = Math.round(performance.now() - startTime);
      if (res.ok) {
        return { connected: true, latencyMs, message: 'C-FIT Java Backend is online and responsive.' };
      }
      return { connected: false, message: `Server responded with HTTP ${res.status}` };
    } catch (err: any) {
      return {
        connected: false,
        message: `Java backend not detected at ${cleanUrl}. Start ./run_java.sh (option 3) on your laptop.`
      };
    }
  }

  public async syncWithJavaBackend(serverUrl: string = 'http://localhost:8080/api'): Promise<{ success: boolean; syncedMembers: number; syncedStaff: number; message: string }> {
    const cleanUrl = serverUrl.replace(/\/+$/, '');
    const db = await this.getDb();
    let syncedMembers = 0;
    let syncedStaff = 0;

    try {
      // 1. Fetch members from Java
      const mRes = await fetch(`${cleanUrl}/members`, { signal: AbortSignal.timeout(4000) });
      if (mRes.ok) {
        const javaMembers = await mRes.json();
        if (Array.isArray(javaMembers)) {
          for (const jm of javaMembers) {
            if (!jm.member_id) continue;
            const code = String(jm.member_id).replace(/'/g, "''");
            const name = String(jm.full_name || 'Member').replace(/'/g, "''");
            const plan = String(jm.plan || 'Silver').replace(/'/g, "''");
            const status = String(jm.status || 'Active').replace(/'/g, "''");
            
            const exists = db.exec(`SELECT id FROM members WHERE member_id = '${code}'`);
            if (exists.length > 0 && exists[0].values.length > 0) {
              db.run(`UPDATE members SET full_name = '${name}', plan_type = '${plan}', status = '${status}' WHERE member_id = '${code}'`);
            } else {
              const today = new Date().toISOString().split('T')[0];
              const expiry = new Date(Date.now() + 180 * 86400000).toISOString().split('T')[0];
              db.run(`INSERT INTO members (member_id, full_name, plan_type, trainer_id, join_date, expiry_date, status) VALUES ('${code}', '${name}', '${plan}', NULL, '${today}', '${expiry}', '${status}')`);
            }
            syncedMembers++;
          }
        }
      }

      // 2. Fetch staff from Java
      const sRes = await fetch(`${cleanUrl}/staff`, { signal: AbortSignal.timeout(4000) });
      if (sRes.ok) {
        const javaStaff = await sRes.json();
        if (Array.isArray(javaStaff)) {
          for (const js of javaStaff) {
            if (!js.username) continue;
            const user = String(js.username).toLowerCase().replace(/'/g, "''");
            const name = String(js.full_name || js.username).replace(/'/g, "''");
            const role = String(js.role || 'Staff').replace(/'/g, "''");
            const email = String(js.email || '').replace(/'/g, "''");
            const phone = String(js.phone || '').replace(/'/g, "''");
            const shift = String(js.shift || 'Morning').replace(/'/g, "''");
            const status = String(js.status || 'Active').replace(/'/g, "''");

            const exists = db.exec(`SELECT id FROM staff_users WHERE LOWER(username) = '${user}'`);
            if (exists.length > 0 && exists[0].values.length > 0) {
              db.run(`UPDATE staff_users SET full_name = '${name}', role = '${role}', email = '${email}', phone = '${phone}', shift = '${shift}', status = '${status}' WHERE LOWER(username) = '${user}'`);
            } else {
              const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
              db.run(`INSERT INTO staff_users (username, password, full_name, role, email, phone, shift, status, can_manage_members, can_process_payments, can_manage_classes, can_manage_trainers, created_at)
                      VALUES ('${user}', 'staff123', '${name}', '${role}', '${email}', '${phone}', '${shift}', '${status}', 1, 1, 1, 1, '${now}')`);
            }
            syncedStaff++;
          }
        }
      }

      this.persist();
      this.notify(true);

      return {
        success: true,
        syncedMembers,
        syncedStaff,
        message: `Successfully synchronized with Java backend (${syncedMembers} members, ${syncedStaff} staff verified in sync).`
      };
    } catch (err: any) {
      return {
        success: false,
        syncedMembers,
        syncedStaff,
        message: `Could not reach Java backend at ${serverUrl}. Ensure 'run_java.sh' (option 3) is running on port 8080.`
      };
    }
  }

  // ==================== EXPORT & IMPORT SNAPSHOT ENGINE ====================
  public async exportCompleteDatabaseJson(): Promise<string> {
    const db = await this.getDb();
    const tables = ['staff_users', 'trainers', 'members', 'attendance', 'payments', 'classes', 'class_bookings'];
    const exportData: Record<string, any[]> = {};

    for (const t of tables) {
      try {
        const res = db.exec(`SELECT * FROM ${t}`);
        if (res.length > 0) {
          const cols = res[0].columns;
          exportData[t] = res[0].values.map((row) => {
            const obj: Record<string, any> = {};
            cols.forEach((col, idx) => {
              obj[col] = row[idx];
            });
            return obj;
          });
        } else {
          exportData[t] = [];
        }
      } catch {
        exportData[t] = [];
      }
    }

    // Ensure member trainer assignment is fully filled and cross-populated
    if (Array.isArray(exportData.members) && Array.isArray(exportData.trainers)) {
      exportData.members = exportData.members.map((m) => {
        let tid = (m.trainer_id !== null && m.trainer_id !== undefined && !isNaN(Number(m.trainer_id)))
          ? Number(m.trainer_id)
          : null;
        let tname = m.trainer_name;

        if (tid) {
          const match = exportData.trainers.find((tr) => Number(tr.id) === tid);
          if (match) tname = match.full_name;
        } else if (tname && tname !== 'Unassigned') {
          const match = exportData.trainers.find((tr) => tr.full_name?.toLowerCase() === tname?.toLowerCase());
          if (match) tid = Number(match.id);
        }

        return {
          ...m,
          trainer_id: tid,
          trainer_name: tname || 'Unassigned',
        };
      });
    }

    const payload = {
      app: 'C-FIT Gym Management System',
      engine: 'SQLite 3.40 (sql.js / Wasm)',
      version: '2.0.0',
      exportedAt: new Date().toISOString(),
      summary: {
        membersCount: exportData.members?.length || 0,
        staffCount: exportData.staff_users?.length || 0,
        trainersCount: exportData.trainers?.length || 0,
        paymentsCount: exportData.payments?.length || 0,
        attendanceCount: exportData.attendance?.length || 0,
      },
      data: exportData,
    };

    return JSON.stringify(payload, null, 2);
  }

  public async importCompleteDatabaseJson(jsonInput: string | object, shouldBroadcast: boolean = true): Promise<{ success: boolean; message: string; counts?: Record<string, number> }> {
    try {
      const parsed = typeof jsonInput === 'string' ? JSON.parse(jsonInput) : jsonInput;
      const data = parsed.data || parsed;
      const db = await this.getDb();
      const counts: Record<string, number> = {};

      // 1. Trainers (import FIRST to ensure stable IDs and lookup map)
      const trainerLookupById = new Map<number, any>();
      const trainerLookupByName = new Map<string, any>();

      if (Array.isArray(data.trainers)) {
        db.run('DELETE FROM trainers');
        let tCount = 0;
        for (const t of data.trainers) {
          if (!t.full_name && !t.trainer_code) continue;
          const tId = (t.id !== null && t.id !== undefined && !isNaN(Number(t.id)) && Number(t.id) < 500)
            ? Number(t.id)
            : (tCount + 1);
          const code = String(t.trainer_code || `TR-0${tCount + 1}`).replace(/'/g, "''");
          const name = String(t.full_name || t.name || 'Trainer').replace(/'/g, "''");
          const spec = String(t.specialty || 'General Fitness').replace(/'/g, "''");
          const rating = Number(t.rating || 5.0);
          
          db.run(`INSERT OR REPLACE INTO trainers (id, trainer_code, full_name, specialty, rating)
                  VALUES (${tId}, '${code}', '${name}', '${spec}', ${rating})`);

          const tRecord = { id: tId, trainer_code: code, full_name: name, specialty: spec, rating };
          trainerLookupById.set(tId, tRecord);
          trainerLookupByName.set(name.toLowerCase().trim(), tRecord);
          tCount++;
        }
        counts['trainers'] = tCount;
      }

      // 2. Members (import SECOND and resolve trainer_id and trainer_name)
      if (Array.isArray(data.members)) {
        db.run('DELETE FROM members');
        let mCount = 0;
        for (const m of data.members) {
          if (!m.member_id) continue;
          const idVal = m.id ? Number(m.id) : (mCount + 1);
          const code = String(m.member_id).replace(/'/g, "''");
          const name = String(m.full_name || 'Member').replace(/'/g, "''");
          const plan = String(m.plan_type || m.plan || 'Silver').replace(/'/g, "''");
          
          let parsedTid: number | null = (m.trainer_id !== null && m.trainer_id !== undefined && !isNaN(Number(m.trainer_id)))
            ? Number(m.trainer_id)
            : null;
          let parsedTname: string = (m.trainer_name && m.trainer_name !== 'Unassigned' && m.trainer_name !== 'NULL')
            ? String(m.trainer_name).trim()
            : '';

          // Bidirectional resolution with imported trainers
          if (parsedTid && trainerLookupById.has(parsedTid)) {
            parsedTname = trainerLookupById.get(parsedTid).full_name;
          } else if (parsedTname && trainerLookupByName.has(parsedTname.toLowerCase())) {
            parsedTid = trainerLookupByName.get(parsedTname.toLowerCase()).id;
          } else if (parsedTid && parsedTid > 1000) {
            // Check if inflated trainer id can be matched
            for (const tr of trainerLookupById.values()) {
              if (parsedTname && tr.full_name.toLowerCase() === parsedTname.toLowerCase()) {
                parsedTid = tr.id;
                break;
              }
            }
          }

          const trainerIdVal = parsedTid !== null ? parsedTid : 'NULL';
          const trainerNameVal = parsedTname ? `'${parsedTname.replace(/'/g, "''")}'` : 'NULL';
          const join = String(m.join_date || new Date().toISOString().split('T')[0]).replace(/'/g, "''");
          const exp = String(m.expiry_date || new Date(Date.now() + 180 * 86400000).toISOString().split('T')[0]).replace(/'/g, "''");
          const stat = String(m.status || 'Active').replace(/'/g, "''");

          db.run(`INSERT INTO members (id, member_id, full_name, plan_type, trainer_id, trainer_name, join_date, expiry_date, status)
                  VALUES (${idVal}, '${code}', '${name}', '${plan}', ${trainerIdVal}, ${trainerNameVal}, '${join}', '${exp}', '${stat}')`);
          mCount++;
        }
        counts['members'] = mCount;
      }

      // 3. Staff Users
      if (Array.isArray(data.staff_users) || Array.isArray(data.staff)) {
        const staffArr = data.staff_users || data.staff;
        if (staffArr.length > 0) {
          db.run('DELETE FROM staff_users');
          let sCount = 0;
          for (const s of staffArr) {
            if (!s.username) continue;
            const sId = s.id ? Number(s.id) : (sCount + 1);
            const user = String(s.username).toLowerCase().replace(/'/g, "''");
            const pass = String(s.password || 'staff123').replace(/'/g, "''");
            const name = String(s.full_name || s.username).replace(/'/g, "''");
            const role = String(s.role || 'Staff').replace(/'/g, "''");
            const email = String(s.email || '').replace(/'/g, "''");
            const phone = String(s.phone || '').replace(/'/g, "''");
            const shift = String(s.shift || 'Morning').replace(/'/g, "''");
            const status = String(s.status || 'Active').replace(/'/g, "''");
            const canMembers = s.can_manage_members !== undefined ? (s.can_manage_members ? 1 : 0) : 1;
            const canPay = s.can_process_payments !== undefined ? (s.can_process_payments ? 1 : 0) : 1;
            const canClass = s.can_manage_classes !== undefined ? (s.can_manage_classes ? 1 : 0) : 1;
            const canTrain = s.can_manage_trainers !== undefined ? (s.can_manage_trainers ? 1 : 0) : 1;
            const now = String(s.created_at || new Date().toISOString().replace('T', ' ').substring(0, 19)).replace(/'/g, "''");

            db.run(`INSERT INTO staff_users (id, username, password, full_name, role, email, phone, shift, status, can_manage_members, can_process_payments, can_manage_classes, can_manage_trainers, created_at)
                    VALUES (${sId}, '${user}', '${pass}', '${name}', '${role}', '${email}', '${phone}', '${shift}', '${status}', ${canMembers}, ${canPay}, ${canClass}, ${canTrain}, '${now}')`);
            sCount++;
          }
          counts['staff_users'] = sCount;
        }
      }

      // 4. Attendance
      // 4. Attendance
      if (Array.isArray(data.attendance)) {
        db.run('DELETE FROM attendance');
        let aCount = 0;
        for (const a of data.attendance) {
          if (!a.member_id) continue;
          const idVal = a.id ? Number(a.id) : (aCount + 1);
          const mId = String(a.member_id).replace(/'/g, "''");
          const inTime = String(a.check_in_time || '').replace(/'/g, "''");
          const outTime = a.check_out_time ? `'${String(a.check_out_time).replace(/'/g, "''")}'` : 'NULL';
          const method = String(a.check_in_method || 'Reception Desk').replace(/'/g, "''");
          db.run(`INSERT OR REPLACE INTO attendance (id, member_id, check_in_time, check_out_time, check_in_method)
                  VALUES (${idVal}, '${mId}', '${inTime}', ${outTime}, '${method}')`);
          aCount++;
        }
        counts['attendance'] = aCount;
      }

      // 5. Payments
      if (Array.isArray(data.payments)) {
        db.run('DELETE FROM payments');
        let pCount = 0;
        for (const p of data.payments) {
          if (!p.member_id) continue;
          const idVal = p.id ? Number(p.id) : (pCount + 1);
          const mId = String(p.member_id).replace(/'/g, "''");
          const desc = String(p.plan_description || 'Membership Renewal').replace(/'/g, "''");
          const amt = Number(p.amount || 0);
          const due = String(p.due_date || '').replace(/'/g, "''");
          const pStat = String(p.payment_status || 'Paid').replace(/'/g, "''");
          db.run(`INSERT OR REPLACE INTO payments (id, member_id, plan_description, amount, due_date, payment_status)
                  VALUES (${idVal}, '${mId}', '${desc}', ${amt}, '${due}', '${pStat}')`);
          pCount++;
        }
        counts['payments'] = pCount;
      }

      // 6. Classes
      if (Array.isArray(data.classes)) {
        db.run('DELETE FROM classes');
        let cCount = 0;
        for (const c of data.classes) {
          if (!c.class_name) continue;
          const idVal = c.id ? Number(c.id) : (cCount + 1);
          const name = String(c.class_name).replace(/'/g, "''");
          const tId = c.trainer_id ? Number(c.trainer_id) : 1;
          const loc = String(c.studio_location || 'Studio A').replace(/'/g, "''");
          const st = String(c.start_time || '07:00 AM').replace(/'/g, "''");
          const cap = Number(c.max_capacity || 20);
          const booked = Number(c.booked_count || 0);
          db.run(`INSERT OR REPLACE INTO classes (id, class_name, trainer_id, studio_location, start_time, max_capacity, booked_count)
                  VALUES (${idVal}, '${name}', ${tId}, '${loc}', '${st}', ${cap}, ${booked})`);
          cCount++;
        }
        counts['classes'] = cCount;
      }

      // 7. Class Bookings
      if (Array.isArray(data.class_bookings)) {
        db.run('DELETE FROM class_bookings');
        let cbCount = 0;
        for (const cb of data.class_bookings) {
          if (!cb.class_id || !cb.member_id) continue;
          const idVal = cb.id ? Number(cb.id) : (cbCount + 1);
          db.run(`INSERT OR REPLACE INTO class_bookings (id, class_id, member_id, booked_at)
                  VALUES (${idVal}, ${Number(cb.class_id)}, '${String(cb.member_id).replace(/'/g, "''")}', '${String(cb.booked_at || new Date().toISOString()).replace(/'/g, "''")}')`);
          cbCount++;
        }
        counts['class_bookings'] = cbCount;
      }

      this.persist();
      this.notify(shouldBroadcast);

      return {
        success: true,
        message: 'Database imported and synchronized successfully!',
        counts
      };
    } catch (err: any) {
      return {
        success: false,
        message: 'Import failed: ' + (err?.message || 'Invalid JSON format')
      };
    }
  }

  public async exportCompleteDatabaseSql(): Promise<string> {
    const db = await this.getDb();
    const tables = ['staff_users', 'trainers', 'members', 'attendance', 'payments', 'classes', 'class_bookings', 'admin'];
    let sqlDump = `-- C-FIT Gym Database Export (SQLite / ANSI SQL Dump)\n`;
    sqlDump += `-- Generated: ${new Date().toISOString()}\n`;
    sqlDump += `-- System: C-FIT Gym Management System\n\n`;

    for (const t of tables) {
      try {
        const res = db.exec(`SELECT * FROM ${t}`);
        if (res.length > 0) {
          const cols = res[0].columns;
          sqlDump += `-- Table: ${t} (${res[0].values.length} records)\n`;
          for (const row of res[0].values) {
            const vals = row.map((v) => {
              if (v === null || v === undefined) return 'NULL';
              if (typeof v === 'number') return v;
              return `'${String(v).replace(/'/g, "''")}'`;
            });
            sqlDump += `INSERT OR REPLACE INTO ${t} (${cols.join(', ')}) VALUES (${vals.join(', ')});\n`;
          }
          sqlDump += `\n`;
        }
      } catch {
        // Ignore table error
      }
    }

    return sqlDump;
  }

  // ==================== TABLE INSPECTOR & VIEWER ====================
  public async getTableRecords(tableName: string): Promise<{ columns: string[]; values: any[][] }> {
    const db = await this.getDb();
    const cleanTable = tableName.replace(/[^a-zA-Z0-9_]/g, '');
    try {
      const res = db.exec(`SELECT * FROM ${cleanTable}`);
      if (res.length > 0) {
        return { columns: res[0].columns, values: res[0].values };
      }
      const pragmaRes = db.exec(`PRAGMA table_info(${cleanTable})`);
      if (pragmaRes.length > 0) {
        const cols = pragmaRes[0].values.map((v) => String(v[1]));
        return { columns: cols, values: [] };
      }
      return { columns: [], values: [] };
    } catch (e: any) {
      return { columns: ['Error'], values: [[e?.message || 'Table not found']] };
    }
  }

  public async getTableListWithCounts(): Promise<{ table: string; count: number }[]> {
    const db = await this.getDb();
    const tables = ['members', 'staff_users', 'trainers', 'attendance', 'payments', 'classes', 'class_bookings', 'admin'];
    const results: { table: string; count: number }[] = [];
    for (const t of tables) {
      try {
        const res = db.exec(`SELECT COUNT(*) FROM ${t}`);
        results.push({ table: t, count: (res[0]?.values[0]?.[0] as number) || 0 });
      } catch {
        results.push({ table: t, count: 0 });
      }
    }
    return results;
  }

  public async executeCustomSql(sql: string): Promise<{ success: boolean; columns?: string[]; values?: any[][]; message?: string }> {
    const db = await this.getDb();
    try {
      const trimmed = sql.trim();
      if (trimmed.toUpperCase().startsWith('SELECT') || trimmed.toUpperCase().startsWith('PRAGMA')) {
        const res = db.exec(trimmed);
        if (res.length > 0) {
          return { success: true, columns: res[0].columns, values: res[0].values };
        }
        return { success: true, columns: [], values: [], message: 'Query returned 0 rows.' };
      } else {
        db.run(trimmed);
        this.persist();
        this.notify();
        return { success: true, message: 'Statement executed successfully.' };
      }
    } catch (err: any) {
      return { success: false, message: err?.message || 'SQL Execution Error' };
    }
  }

  public async resetToCleanFiveRecords(): Promise<{ success: boolean; message: string }> {
    return this.reloadFromSchemaSql();
  }
}

export const gymDb = new GymDatabase();
