declare module 'mysql2/promise' {
  export interface Connection {
    query(sql: string, values?: any): Promise<[any, any]>;
    changeUser(options: any): Promise<void>;
    end(): Promise<void>;
  }

  export function createConnection(options: any): Promise<Connection>;
  export default {
    createConnection,
  };
}

declare module '*.sql?raw' {
  const content: string;
  export default content;
}

declare module '*.sql' {
  const content: string;
  export default content;
}

