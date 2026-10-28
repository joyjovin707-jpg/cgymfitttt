package com.cfit.model;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;

/**
 * Encapsulated Attendance Record:
 * Maps directly to MySQL 'attendance' table and TypeScript AttendanceRecord interface.
 */
public class AttendanceRecord {
    private int id;
    private String memberId;
    private String memberName;
    private LocalDateTime checkInTime;
    private LocalDateTime checkOutTime;
    private String checkInMethod; // "Reception Desk", "RFID Card", "Biometric"
    private int durationMinutes;

    public AttendanceRecord(int id, String memberId, String memberName, LocalDateTime checkInTime) {
        this.id = id;
        this.memberId = memberId;
        this.memberName = memberName;
        this.checkInTime = checkInTime != null ? checkInTime : LocalDateTime.now();
        this.checkOutTime = null;
        this.checkInMethod = "Reception Desk";
        this.durationMinutes = 0;
    }

    public AttendanceRecord(int id, String memberId, String memberName, LocalDateTime checkInTime,
                            LocalDateTime checkOutTime, String checkInMethod) {
        this(id, memberId, memberName, checkInTime);
        this.checkOutTime = checkOutTime;
        this.checkInMethod = checkInMethod != null ? checkInMethod : "Reception Desk";
        if (checkInTime != null && checkOutTime != null) {
            this.durationMinutes = (int) java.time.Duration.between(checkInTime, checkOutTime).toMinutes();
        }
    }

    public int getId() { return id; }
    public void setId(int id) { this.id = id; }

    public String getMemberId() { return memberId; }
    public void setMemberId(String memberId) { this.memberId = memberId; }

    public String getMemberName() { return memberName; }
    public void setMemberName(String memberName) { this.memberName = memberName; }

    public LocalDateTime getCheckInTime() { return checkInTime; }
    public void setCheckInTime(LocalDateTime checkInTime) { this.checkInTime = checkInTime; }

    public LocalDateTime getCheckOutTime() { return checkOutTime; }
    public void setCheckOutTime(LocalDateTime checkOutTime) {
        this.checkOutTime = checkOutTime;
        if (checkInTime != null && checkOutTime != null) {
            this.durationMinutes = (int) java.time.Duration.between(checkInTime, checkOutTime).toMinutes();
        }
    }

    public String getCheckInMethod() { return checkInMethod; }
    public void setCheckInMethod(String checkInMethod) { this.checkInMethod = checkInMethod; }

    public int getDurationMinutes() { return durationMinutes; }

    public void checkOut(LocalDateTime outTime) {
        setCheckOutTime(outTime);
    }

    @Override
    public String toString() {
        DateTimeFormatter dtf = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm");
        String inStr = checkInTime != null ? checkInTime.format(dtf) : "-";
        String outStr = (checkOutTime != null) ? checkOutTime.format(dtf) : "Active on floor";
        return String.format("Log #%d | %s (%s) | In: %s | Out: %s | Method: %s",
                id, memberName, memberId, inStr, outStr, checkInMethod);
    }
}
