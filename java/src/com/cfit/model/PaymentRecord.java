package com.cfit.model;

import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * Encapsulated Payment Record:
 * Maps directly to MySQL 'payments' table and TypeScript PaymentRecord interface.
 */
public class PaymentRecord {
    private int id;
    private String paymentCode;
    private String memberId;
    private String memberName;
    private String planDescription;
    private double amount;
    private LocalDate dueDate;
    private String paymentStatus; // "Paid", "Pending", "Overdue"
    private String paymentMethod; // "UPI", "Credit Card", "Cash", "Reception Desk"
    private LocalDateTime paymentDate;

    public PaymentRecord(int id, String memberId, String memberName, String planDescription,
                         double amount, LocalDate dueDate, String paymentStatus) {
        this.id = id;
        this.paymentCode = "INV-" + (1000 + id);
        this.memberId = memberId;
        this.memberName = memberName;
        this.planDescription = planDescription;
        this.amount = amount;
        this.dueDate = dueDate != null ? dueDate : LocalDate.now();
        this.paymentStatus = paymentStatus != null ? paymentStatus : "Paid";
        this.paymentMethod = "Reception Desk";
        this.paymentDate = LocalDateTime.now();
    }

    public PaymentRecord(int id, String paymentCode, String memberId, String memberName,
                         String planDescription, double amount, String paymentMethod,
                         String paymentStatus, LocalDate dueDate) {
        this(id, memberId, memberName, planDescription, amount, dueDate, paymentStatus);
        this.paymentCode = paymentCode;
        this.paymentMethod = paymentMethod;
    }

    public int getId() { return id; }
    public void setId(int id) { this.id = id; }

    public String getPaymentCode() { return paymentCode; }
    public void setPaymentCode(String paymentCode) { this.paymentCode = paymentCode; }

    public String getMemberId() { return memberId; }
    public void setMemberId(String memberId) { this.memberId = memberId; }

    // Alias for getMemberId()
    public String getMemberCode() { return memberId; }

    public String getMemberName() { return memberName; }
    public void setMemberName(String memberName) { this.memberName = memberName; }

    public String getPlanDescription() { return planDescription; }
    public void setPlanDescription(String planDescription) { this.planDescription = planDescription; }

    // Alias for planDescription
    public String getPlanType() { return planDescription; }

    public double getAmount() { return amount; }
    public void setAmount(double amount) { this.amount = amount; }

    public LocalDate getDueDate() { return dueDate; }
    public void setDueDate(LocalDate dueDate) { this.dueDate = dueDate; }

    public String getPaymentStatus() { return paymentStatus; }
    public void setPaymentStatus(String paymentStatus) { this.paymentStatus = paymentStatus; }

    // Alias for getPaymentStatus()
    public String getStatus() { return paymentStatus; }

    public String getPaymentMethod() { return paymentMethod; }
    public void setPaymentMethod(String paymentMethod) { this.paymentMethod = paymentMethod; }

    public LocalDateTime getPaymentDate() { return paymentDate; }
    public void setPaymentDate(LocalDateTime paymentDate) { this.paymentDate = paymentDate; }

    @Override
    public String toString() {
        return String.format("[%s] #%d | %s (%s) | %-24s | ₹%,.2f | Status: %-7s | Due: %s",
                paymentCode, id, memberName, memberId, planDescription, amount, paymentStatus, dueDate);
    }
}
