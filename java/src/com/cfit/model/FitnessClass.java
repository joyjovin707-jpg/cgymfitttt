package com.cfit.model;

/**
 * Encapsulated Fitness Class Model:
 * Manages group fitness schedules, studio rooms, capacity limits, and trainers.
 * Maps to MySQL 'classes' table.
 */
public class FitnessClass {
    private int id;
    private String className;      // e.g. "CrossFit Power Hour"
    private int trainerId;
    private String trainerName;    // e.g. "Vikram Sethi"
    private String studioLocation; // e.g. "Studio A (Ground)"
    private String startTime;      // e.g. "06:30 AM"
    private int maxCapacity;
    private int bookedCount;

    public FitnessClass(int id, String className, int trainerId, String trainerName,
                        String studioLocation, String startTime, int maxCapacity, int bookedCount) {
        this.id = id;
        this.className = className;
        this.trainerId = trainerId;
        this.trainerName = trainerName != null ? trainerName : "Unassigned";
        this.studioLocation = studioLocation != null ? studioLocation : "Studio A";
        this.startTime = startTime != null ? startTime : "06:00 AM";
        this.maxCapacity = maxCapacity > 0 ? maxCapacity : 20;
        this.bookedCount = Math.max(0, bookedCount);
    }

    /**
     * Backward compatibility constructor
     */
    public FitnessClass(int id, String title, String category, int trainerId, String trainerName,
                        String scheduleTime, String dayOfWeek, int maxCapacity, int bookedCount) {
        this(id, title, trainerId, trainerName, category, scheduleTime, maxCapacity, bookedCount);
    }

    public int getId() { return id; }
    public void setId(int id) { this.id = id; }

    public String getClassName() { return className; }
    public void setClassName(String className) { this.className = className; }

    // Aliases for legacy code
    public String getTitle() { return className; }
    public void setTitle(String title) { this.className = title; }

    public int getTrainerId() { return trainerId; }
    public void setTrainerId(int trainerId) { this.trainerId = trainerId; }

    public String getTrainerName() { return trainerName; }
    public void setTrainerName(String trainerName) { this.trainerName = trainerName; }

    public String getStudioLocation() { return studioLocation; }
    public void setStudioLocation(String studioLocation) { this.studioLocation = studioLocation; }

    // Alias for legacy category
    public String getCategory() { return studioLocation; }

    public String getStartTime() { return startTime; }
    public void setStartTime(String startTime) { this.startTime = startTime; }

    // Alias for legacy scheduleTime
    public String getScheduleTime() { return startTime; }
    public String getDayOfWeek() { return "Daily Schedule"; }

    public int getMaxCapacity() { return maxCapacity; }
    public void setMaxCapacity(int maxCapacity) { this.maxCapacity = maxCapacity; }

    public int getBookedCount() { return bookedCount; }
    public void setBookedCount(int bookedCount) { this.bookedCount = bookedCount; }

    public boolean isFull() {
        return bookedCount >= maxCapacity;
    }

    public boolean bookSpot() {
        if (!isFull()) {
            bookedCount++;
            return true;
        }
        return false;
    }

    public boolean cancelSpot() {
        if (bookedCount > 0) {
            bookedCount--;
            return true;
        }
        return false;
    }

    @Override
    public String toString() {
        return String.format("[%d] %-24s | %-16s | %-10s | Coach: %-15s | Slots: %d/%d",
                id, className, studioLocation, startTime, trainerName, bookedCount, maxCapacity);
    }
}
