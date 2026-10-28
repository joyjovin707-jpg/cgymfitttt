package com.cfit.model;

/**
 * Inheritance Principle - Subclass 1:
 * Specializes User with duty shifts and granular operational permission masks (RBAC).
 * Maps to MySQL 'staff_users' table.
 */
public class StaffUser extends User {
    private String dutyShift; // "Morning", "Evening", "Full Day", "Night"
    private String phone;
    private String status; // "Active", "Inactive", "Suspended"

    // Fine-grained permission flags
    private boolean canManageMembers;
    private boolean canProcessPayments;
    private boolean canManageClasses;
    private boolean canManageTrainers;

    public StaffUser(int id, String username, String passwordHash, String fullName, String email,
                     String dutyShift, String phone, String status,
                     boolean canManageMembers, boolean canProcessPayments,
                     boolean canManageClasses, boolean canManageTrainers) {
        super(id, username, passwordHash, fullName, email, "Staff");
        this.dutyShift = dutyShift != null ? dutyShift : "Morning";
        this.phone = phone != null ? phone : "";
        this.status = status != null ? status : "Active";
        this.canManageMembers = canManageMembers;
        this.canProcessPayments = canProcessPayments;
        this.canManageClasses = canManageClasses;
        this.canManageTrainers = canManageTrainers;
    }

    /**
     * Convenience constructor matching MySQL staff_users table
     */
    public StaffUser(int id, String username, String fullName, String role,
                     String phone, String email, boolean isActive) {
        super(id, username, "staff123", fullName, email, (role != null ? role : "Staff"));
        this.dutyShift = "Morning";
        this.phone = phone != null ? phone : "";
        this.status = isActive ? "Active" : "Inactive";
        this.canManageMembers = true;
        this.canProcessPayments = true;
        this.canManageClasses = true;
        this.canManageTrainers = true;
    }

    public String getDutyShift() { return dutyShift; }
    public void setDutyShift(String dutyShift) { this.dutyShift = dutyShift; }

    public String getPhone() { return phone; }
    public void setPhone(String phone) { this.phone = phone; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public boolean canManageMembers() { return canManageMembers; }
    public void setCanManageMembers(boolean canManageMembers) { this.canManageMembers = canManageMembers; }

    public boolean canProcessPayments() { return canProcessPayments; }
    public void setCanProcessPayments(boolean canProcessPayments) { this.canProcessPayments = canProcessPayments; }

    public boolean canManageClasses() { return canManageClasses; }
    public void setCanManageClasses(boolean canManageClasses) { this.canManageClasses = canManageClasses; }

    public boolean canManageTrainers() { return canManageTrainers; }
    public void setCanManageTrainers(boolean canManageTrainers) { this.canManageTrainers = canManageTrainers; }

    @Override
    public String toString() {
        return super.toString() + " | Shift: " + dutyShift + " | Status: " + status;
    }
}
