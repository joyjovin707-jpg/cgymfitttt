/**
 * MySQL Service & JDBC Connection Bridge:
 * Converts TypeScript / SQLite data structures to real MySQL database tables
 * and provides live JDBC connection strings, credentials, diagnostics, and sync.
 */
import fs from 'fs';
import path from 'path';

export interface MySQLConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
}

export const defaultMySQLConfig: MySQLConfig = {
  host: process.env.MYSQL_HOST || 'localhost',
  port: Number(process.env.MYSQL_PORT) || 3306,
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD ?? '',
  database: process.env.MYSQL_DATABASE || 'cfit_db',
};

// In-memory runtime override if user changes config in the UI
let activeMySQLConfig: MySQLConfig = { ...defaultMySQLConfig };

export function getActiveMySQLConfig(): MySQLConfig {
  return { ...activeMySQLConfig };
}

export function updateMySQLConfig(config: Partial<MySQLConfig>): MySQLConfig {
  activeMySQLConfig = {
    ...activeMySQLConfig,
    ...config,
    port: Number(config.port) || activeMySQLConfig.port,
  };
  return activeMySQLConfig;
}

/**
 * Safely resolves mysql2/promise client dynamically to prevent dev server crashes
 */
async function getMySQLClient(): Promise<any> {
  try {
    const mod = await import('mysql2/promise');
    return mod.default || mod;
  } catch (err) {
    console.warn('[MYSQL] mysql2/promise could not be loaded dynamically:', err);
    return null;
  }
}

/**
 * Returns JDBC connection details matching Java ConnectionFactory
 */
export function getJDBCConnectionInfo(config: MySQLConfig = activeMySQLConfig) {
  const jdbcUrl = `jdbc:mysql://${config.host}:${config.port}/${config.database}?createDatabaseIfNotExist=true&useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=UTC`;
  return {
    driverClass: 'com.mysql.cj.jdbc.Driver',
    legacyDriverClass: 'com.mysql.jdbc.Driver',
    jdbcUrl,
    host: config.host,
    port: config.port,
    database: config.database,
    user: config.user,
    password: config.password,
    javaSnippet: `// 1. Load MySQL JDBC Driver
Class.forName("com.mysql.cj.jdbc.Driver");

// 2. Establish JDBC Connection
String url = "${jdbcUrl}";
Connection conn = DriverManager.getConnection(url, "${config.user}", "${config.password || ''}");

// 3. Query records with PreparedStatement
String sql = "SELECT member_code, full_name, plan_type, status FROM members";
try (PreparedStatement ps = conn.prepareStatement(sql);
     ResultSet rs = ps.executeQuery()) {
    while (rs.next()) {
        System.out.printf("[%s] %s | %s (%s)%n",
            rs.getString("member_code"),
            rs.getString("full_name"),
            rs.getString("plan_type"),
            rs.getString("status"));
    }
}`,
  };
}

/**
 * Tests live connection to MySQL server
 */
export async function testMySQLConnection(config: MySQLConfig = activeMySQLConfig) {
  const mysql = await getMySQLClient();
  if (!mysql) {
    return {
      connected: false,
      error: 'mysql2 module is not initialized in the Node runtime.',
      host: config.host,
      port: config.port,
      jdbcUrl: getJDBCConnectionInfo(config).jdbcUrl,
      troubleshooting: [
        'Ensure dependencies are installed: npm install mysql2',
        'You can also run schema_mysql.sql directly in phpMyAdmin, XAMPP, or MySQL CLI.',
      ],
    };
  }

  try {
    const connection = await mysql.createConnection({
      host: config.host,
      port: config.port,
      user: config.user,
      password: config.password,
      connectTimeout: 4000,
    });

    const [rows]: any = await connection.query('SELECT VERSION() as version, DATABASE() as currentDb, NOW() as serverTime');
    const version = rows?.[0]?.version || 'Unknown MySQL';

    // Check if database exists
    const [dbRows]: any = await connection.query(`SHOW DATABASES LIKE '${config.database}'`);
    const dbExists = Array.isArray(dbRows) && dbRows.length > 0;

    let tables: Array<{ name: string; count: number }> = [];
    if (dbExists) {
      await connection.changeUser({ database: config.database });
      const [tableList]: any = await connection.query('SHOW TABLES');
      const tableKey = `Tables_in_${config.database}`;
      for (const t of tableList) {
        const tableName = t[tableKey] || Object.values(t)[0];
        try {
          const [countRes]: any = await connection.query(`SELECT COUNT(*) as cnt FROM \`${tableName}\``);
          tables.push({ name: String(tableName), count: countRes?.[0]?.cnt || 0 });
        } catch {
          tables.push({ name: String(tableName), count: 0 });
        }
      }
    }

    await connection.end();

    return {
      connected: true,
      version,
      database: config.database,
      databaseExists: dbExists,
      tables,
      jdbcUrl: getJDBCConnectionInfo(config).jdbcUrl,
      message: `Successfully connected to MySQL ${version} on ${config.host}:${config.port}`,
    };
  } catch (err: any) {
    return {
      connected: false,
      error: err.message || 'Failed to connect to MySQL',
      code: err.code,
      host: config.host,
      port: config.port,
      jdbcUrl: getJDBCConnectionInfo(config).jdbcUrl,
      troubleshooting: getTroubleshootingTips(err, config),
    };
  }
}

function getTroubleshootingTips(err: any, config: MySQLConfig) {
  const msg = err.message || '';
  if (err.code === 'ECONNREFUSED' || msg.includes('ECONNREFUSED')) {
    return [
      `MySQL is not running on ${config.host}:${config.port}.`,
      'Start MySQL in XAMPP / WAMP Control Panel, or run "sudo service mysql start".',
      'If using Docker: docker run -d -p 3306:3306 -e MYSQL_ROOT_PASSWORD= -e MYSQL_DATABASE=cfit_db mysql:8.0',
    ];
  }
  if (err.code === 'ER_ACCESS_DENIED_ERROR' || msg.includes('Access denied')) {
    return [
      `Access denied for user '${config.user}'. Check your password.`,
      'In XAMPP default MySQL root password is empty (""). In standard MySQL it may be "root" or your custom password.',
    ];
  }
  return [
    'Check network connectivity to MySQL host.',
    'Ensure port 3306 is open and allowed through your firewall.',
  ];
}

/**
 * Reads the schema_mysql.sql file and executes it on MySQL
 */
export async function initializeMySQLDatabase(config: MySQLConfig = activeMySQLConfig) {
  const mysql = await getMySQLClient();
  if (!mysql) {
    return {
      success: false,
      error: 'mysql2 module unavailable. Download schema_mysql.sql to run directly in MySQL.',
    };
  }

  try {
    const connection = await mysql.createConnection({
      host: config.host,
      port: config.port,
      user: config.user,
      password: config.password,
      multipleStatements: true,
    });

    // Read SQL script
    let sqlContent = '';
    const candidates = [
      path.resolve(process.cwd(), 'src', 'db', 'schema_mysql.sql'),
      path.resolve(process.cwd(), 'public', 'schema_mysql.sql'),
    ];
    for (const p of candidates) {
      if (fs.existsSync(p)) {
        sqlContent = fs.readFileSync(p, 'utf-8');
        break;
      }
    }

    if (!sqlContent) {
      throw new Error('schema_mysql.sql file could not be found.');
    }

    await connection.query(sqlContent);
    await connection.end();

    return {
      success: true,
      message: `Database '${config.database}' and all 8 tables created with seed records!`,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || 'Initialization failed',
    };
  }
}

/**
 * Syncs in-memory data to MySQL tables
 */
export async function syncDataToMySQL(data: any, config: MySQLConfig = activeMySQLConfig) {
  const mysql = await getMySQLClient();
  if (!mysql) {
    return { success: false, error: 'mysql2 module unavailable' };
  }

  try {
    const connection = await mysql.createConnection({
      host: config.host,
      port: config.port,
      user: config.user,
      password: config.password,
      database: config.database,
    });

    // 1. Sync Members
    if (Array.isArray(data.members)) {
      for (const m of data.members) {
        await connection.query(
          `INSERT INTO members (member_code, full_name, email, phone, plan_type, trainer_id, trainer_name, join_date, expiry_date, status, balance_due, notes)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE
             full_name = VALUES(full_name),
             plan_type = VALUES(plan_type),
             trainer_id = VALUES(trainer_id),
             trainer_name = VALUES(trainer_name),
             status = VALUES(status),
             balance_due = VALUES(balance_due)`,
          [
            m.member_id || m.member_code,
            m.full_name,
            m.email || `${(m.full_name || 'member').toLowerCase().replace(/\s+/g, '')}@example.com`,
            m.phone || '+91 98470 12345',
            m.plan_type || 'Gold',
            m.trainer_id ? Number(m.trainer_id) : null,
            m.trainer_name || 'Unassigned',
            m.join_date || '2026-01-01',
            m.expiry_date || '2026-12-31',
            m.status || 'Active',
            m.balance_due || 0,
            m.notes || '',
          ]
        );
      }
    }

    // 2. Sync Attendance
    if (Array.isArray(data.attendance)) {
      for (const a of data.attendance) {
        if (!a.id) continue;
        await connection.query(
          `INSERT INTO attendance (id, member_id, member_name, check_in_time, check_out_time, check_in_method, duration_minutes)
           VALUES (?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE
             check_out_time = VALUES(check_out_time),
             duration_minutes = VALUES(duration_minutes)`,
          [
            a.id,
            a.member_id,
            a.member_name,
            a.check_in_time ? a.check_in_time.replace('T', ' ') : '2026-10-27 06:00:00',
            a.check_out_time ? a.check_out_time.replace('T', ' ') : null,
            a.check_in_method || 'Reception Desk',
            a.duration_minutes || 0,
          ]
        );
      }
    }

    // 3. Sync Payments
    if (Array.isArray(data.payments)) {
      for (const p of data.payments) {
        const inv = p.invoice_number || p.paymentCode || `INV-${p.id}`;
        await connection.query(
          `INSERT INTO payments (invoice_number, member_id, member_name, plan_type, amount, payment_method, status, payment_date)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE
             status = VALUES(status),
             amount = VALUES(amount)`,
          [
            inv,
            p.member_id || p.memberCode || 'GYM-0101',
            p.member_name || p.memberName || 'Member',
            p.plan_type || p.planDescription || 'Gold',
            p.amount || 2500,
            p.payment_method || p.paymentMethod || 'UPI',
            p.status || p.paymentStatus || 'Paid',
            p.payment_date ? p.payment_date.replace('T', ' ') : '2026-10-27 10:00:00',
          ]
        );
      }
    }

    await connection.end();
    return { success: true, message: 'Synchronized memory data into MySQL tables!' };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
