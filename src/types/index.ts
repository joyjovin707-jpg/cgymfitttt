export type UserRole = 'Admin' | 'Staff';

export interface User {
  id?: number;
  username: string;
  role: UserRole | string;
  full_name?: string;
  email?: string;
  created_at?: string;
}

export interface AdminUser extends User {
  username: string;
  role: string;
  full_name?: string;
}

export interface StaffUser extends User {
  id: number;
  username: string;
  password?: string;
  full_name: string;
  role: UserRole | string;
  email?: string;
  phone?: string;
  shift?: string;
  status?: 'Active' | 'Inactive' | 'Suspended';
  can_manage_members?: boolean | number;
  can_process_payments?: boolean | number;
  can_manage_classes?: boolean | number;
  can_manage_trainers?: boolean | number;
  created_at?: string;
}

export interface Trainer {
  id: number;
  trainer_code: string;
  full_name: string;
  specialty: string;
  rating: number;
  clients_assigned?: number;
  sessions_this_week?: number;
  phone?: string;
  email?: string;
  status?: string;
}

export interface Member {
  id: number;
  member_id: string;
  full_name: string;
  plan_type: string;
  trainer_id?: number | null;
  trainer_name?: string;
  join_date: string;
  expiry_date: string;
  status: 'Active' | 'Expiring' | 'Paused' | 'Expired';
  balance_due?: number;
  notes?: string;
  email?: string;
  phone?: string;
}

export interface AttendanceRecord {
  id: number;
  member_id: string;
  member_name?: string;
  check_in_time: string;
  check_out_time?: string | null;
  check_in_method: string;
  duration?: string;
  duration_minutes?: number;
}

export interface PaymentRecord {
  id: number;
  invoice_number?: string;
  member_id: string;
  member_name?: string;
  plan_description: string;
  plan_type?: string;
  amount: number;
  due_date: string;
  payment_date?: string;
  payment_method?: string;
  payment_status: 'Paid' | 'Overdue' | 'Pending';
  status?: string;
}

export interface ClassBooking {
  id: number;
  class_id: number;
  member_id: string;
  member_name?: string;
  booked_at: string;
}

export interface GymClass {
  id: number;
  class_name: string;
  trainer_id: number;
  trainer_name?: string;
  studio_location: string;
  start_time: string;
  max_capacity: number;
  booked_count: number;
  bookings?: ClassBooking[];
}

export interface DashboardStats {
  activeMembers: number;
  checkedInToday: number;
  revenueMtd: number;
  expiringCount: number;
  checkinsLast7Days: Array<{ day: string; count: number; percentage: number }>;
  todayClasses: GymClass[];
  expiringMembers: Member[];
}

export interface SqlQueryResult {
  columns: string[];
  values: any[][];
  error?: string;
  executionTimeMs?: number;
}
