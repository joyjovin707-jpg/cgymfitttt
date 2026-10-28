package com.cfit.model;

/**
 * Encapsulated Trainer Model:
 * Manages gym fitness instructors and personal trainers.
 * Fully mapped to MySQL 'trainers' table and TypeScript Trainer interface.
 */
public class Trainer {
    private int id;
    private String trainerCode; // e.g. "TR-01"
    private String fullName;    // e.g. "Vikram Sethi"
    private String specialty;   // e.g. "Strength & Conditioning"
    private double rating;      // e.g. 4.9
    private String phone;
    private String email;
    private String status;      // "Active" or "On Leave"

    /**
     * Primary constructor matching MySQL database schema
     */
    public Trainer(int id, String trainerCode, String fullName, String specialty, double rating) {
        this.id = id;
        this.setTrainerCode(trainerCode);
        this.setFullName(fullName);
        this.setSpecialty(specialty);
        this.rating = rating > 0 ? rating : 5.0;
        this.phone = "+91 98471 22334";
        this.email = (fullName != null ? fullName.toLowerCase().replace(" ", ".") : "trainer") + "@cfit.com";
        this.status = "Active";
    }

    /**
     * Extended constructor with contact and status info
     */
    public Trainer(int id, String trainerCode, String fullName, String specialty, double rating,
                   String phone, String email, String status) {
        this.id = id;
        this.setTrainerCode(trainerCode);
        this.setFullName(fullName);
        this.setSpecialty(specialty);
        this.rating = rating > 0 ? rating : 5.0;
        this.phone = phone != null ? phone : "";
        this.email = email != null ? email : "";
        this.status = (status != null && !status.isEmpty()) ? status : "Active";
    }

    /**
     * Backward-compatibility constructor
     */
    public Trainer(int id, String name, String specialty, String phone, String email, String status) {
        this(id, "TR-0" + id, name, specialty, 5.0, phone, email, status);
    }

    // Encapsulated Getters & Setters
    public int getId() { return id; }
    public void setId(int id) { this.id = id; }

    public String getTrainerCode() { return trainerCode; }
    public void setTrainerCode(String trainerCode) {
        if (trainerCode == null || trainerCode.trim().isEmpty()) {
            this.trainerCode = "TR-" + id;
        } else {
            this.trainerCode = trainerCode.trim().toUpperCase();
        }
    }

    public String getFullName() { return fullName; }
    public void setFullName(String fullName) {
        if (fullName == null || fullName.trim().length() < 2) {
            throw new IllegalArgumentException("Trainer name must be at least 2 characters.");
        }
        this.fullName = fullName.trim();
    }

    // Alias for getFullName() for backwards compatibility with legacy GUI code
    public String getName() { return getFullName(); }
    public void setName(String name) { setFullName(name); }

    public String getSpecialty() { return specialty; }
    public void setSpecialty(String specialty) {
        this.specialty = (specialty != null) ? specialty.trim() : "General Fitness";
    }

    public double getRating() { return rating; }
    public void setRating(double rating) { this.rating = rating; }

    public String getPhone() { return phone; }
    public void setPhone(String phone) { this.phone = phone != null ? phone : ""; }

    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email != null ? email : ""; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status != null ? status : "Active"; }

    @Override
    public String toString() {
        return String.format("[%s] %-20s | %-24s | Rating: %.1f | Contact: %s",
                trainerCode, fullName, specialty, rating, phone);
    }
}
