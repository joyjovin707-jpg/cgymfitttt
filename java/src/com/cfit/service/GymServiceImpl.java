package com.cfit.service;

import com.cfit.model.*;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;

/**
 * Implementation of GymOperations:
 * - Singleton Design Pattern (getInstance)
 * - Polymorphic Tier Resolution (Silver, Gold, Platinum)
 * - Method Overloading (findMember by String vs int)
 * - Encapsulated in-memory relational store
 */
public class GymServiceImpl implements GymOperations {

    // Singleton instance
    private static GymServiceImpl instance;

    // Encapsulated collections
    private final Map<String, User> userRegistry = new HashMap<>();
    private final Map<String, Member> memberRegistry = new LinkedHashMap<>();
    private final List<AttendanceRecord> attendanceLog = new ArrayList<>();
    private final List<PaymentRecord> paymentLedger = new ArrayList<>();
    private final Map<Integer, Trainer> trainerRegistry = new LinkedHashMap<>();
    private final Map<Integer, FitnessClass> classRegistry = new LinkedHashMap<>();

    // Polymorphic plan strategies
    private final Map<String, MembershipPlan> planCatalog = new HashMap<>();

    private int attendanceSeq = 1;
    private int paymentSeq = 1;
    private int memberSeq = 1;
    private int trainerSeq = 1;
    private int classSeq = 1;

    // Private constructor enforcing Singleton pattern
    private GymServiceImpl() {
        initPlans();
        seedInitialData();
    }

    public static synchronized GymServiceImpl getInstance() {
        if (instance == null) {
            instance = new GymServiceImpl();
        }
        return instance;
    }

    private void initPlans() {
        planCatalog.put("Silver", new SilverPlan());
        planCatalog.put("Gold", new GoldPlan());
        planCatalog.put("Platinum", new PlatinumPlan());
    }

    private void seedInitialData() {
        // Seed Admin
        userRegistry.put("admin", new AdminUser(1, "admin", "admin123", "JOVIN", "admin@cfit.com"));

        // Seed Staff
        userRegistry.put("staff", new StaffUser(2, "staff", "staff123", "staff", "staff@cfit.com",
                "Morning Shift", "9847044556", "Active", true, true, true, true));

        userRegistry.put("adhil", new StaffUser(3, "adhil", "adhil123", "adhil", "adhil@cfit.com",
                "Morning Shift", "9447122334", "Active", true, true, true, true));

        userRegistry.put("dnv", new StaffUser(4, "dnv", "dnv123", "DNV", "dnv@cfit.com",
                "Evening Shift", "9895033445", "Active", true, true, true, true));

        userRegistry.put("balu", new StaffUser(5, "balu", "balu123", "balu", "balu@cfit.com",
                "Evening Shift", "9847255667", "Active", true, true, true, true));

        userRegistry.put("abhiram", new StaffUser(6, "abhiram", "abhiram123", "abhiram", "abhiram@cfit.com",
                "Full Day", "9847366778", "Active", true, true, true, true));

        // Seed Trainers
        registerTrainer(new Trainer(trainerSeq++, "Vikram Sethi", "Strength & Bodybuilding", "+91 98471 22334", "vikram@cfit.com", "Active"));
        registerTrainer(new Trainer(trainerSeq++, "Sneha Pillai", "HIIT & Functional Cardio", "+91 98471 33445", "sneha@cfit.com", "Active"));
        registerTrainer(new Trainer(trainerSeq++, "Mathew Thomas", "CrossFit & Olympic Lifting", "+91 98471 44556", "mathew@cfit.com", "Active"));

        // Seed Default Members
        registerMember(new Member(memberSeq++, "GYM-0101", "neeraj", "Gold", 1,
                LocalDate.now().minusMonths(11), LocalDate.now().plusMonths(1), "Active"));

        registerMember(new Member(memberSeq++, "GYM-0102", "abin", "Platinum", 2,
                LocalDate.now().minusMonths(5), LocalDate.now().plusMonths(7), "Active"));

        registerMember(new Member(memberSeq++, "GYM-0103", "sadi", "Silver", 3,
                LocalDate.now().minusMonths(3), LocalDate.now().plusMonths(9), "Active"));

        registerMember(new Member(memberSeq++, "GYM-0104", "vinod", "Gold", 1,
                LocalDate.now().minusMonths(6), LocalDate.now().plusMonths(6), "Active"));

        registerMember(new Member(memberSeq++, "GYM-0105", "farzan", "Platinum", 2,
                LocalDate.now().minusMonths(2), LocalDate.now().plusMonths(10), "Active"));

        // Seed Payments (5 records for 5 members)
        recordPayment("GYM-0101", "Gold — Monthly Access", 2500.0, "Paid");
        recordPayment("GYM-0102", "Platinum — Annual Access", 28000.0, "Paid");
        recordPayment("GYM-0103", "Silver — Monthly Renewal", 1800.0, "Paid");
        recordPayment("GYM-0104", "Gold — 6 Month Access", 14000.0, "Paid");
        recordPayment("GYM-0105", "Platinum — Monthly Renewal", 3500.0, "Pending");

        // Seed Attendance Logs (5 records for 5 members)
        AttendanceRecord a1 = new AttendanceRecord(attendanceSeq++, "GYM-0101", "neeraj", LocalDateTime.now().minusHours(4));
        a1.checkOut(LocalDateTime.now().minusHours(2));
        AttendanceRecord a2 = new AttendanceRecord(attendanceSeq++, "GYM-0102", "abin", LocalDateTime.now().minusHours(3));
        AttendanceRecord a3 = new AttendanceRecord(attendanceSeq++, "GYM-0103", "sadi", LocalDateTime.now().minusDays(1).minusHours(2));
        a3.checkOut(LocalDateTime.now().minusDays(1).minusHours(1));
        AttendanceRecord a4 = new AttendanceRecord(attendanceSeq++, "GYM-0104", "vinod", LocalDateTime.now().minusHours(2));
        a4.checkOut(LocalDateTime.now().minusHours(1));
        AttendanceRecord a5 = new AttendanceRecord(attendanceSeq++, "GYM-0105", "farzan", LocalDateTime.now().minusMinutes(50));
        attendanceLog.add(a1);
        attendanceLog.add(a2);
        attendanceLog.add(a3);
        attendanceLog.add(a4);
        attendanceLog.add(a5);

        // Seed Classes (5 classes)
        FitnessClass c1 = new FitnessClass(classSeq++, "CrossFit Power Hour", "Strength", 1, "Vikram Sethi", "06:30 AM - 07:30 AM", "Mon, Wed, Fri", 15, 1);
        FitnessClass c2 = new FitnessClass(classSeq++, "HIIT Conditioning Blitz", "HIIT", 2, "Sneha Pillai", "07:30 AM - 08:30 AM", "Tue, Thu, Sat", 20, 1);
        FitnessClass c3 = new FitnessClass(classSeq++, "Power Yoga Flow", "Yoga", 3, "Mathew Thomas", "08:30 AM - 09:30 AM", "Mon, Wed, Fri", 12, 1);
        FitnessClass c4 = new FitnessClass(classSeq++, "Strength & Hypertrophy", "Strength", 1, "Vikram Sethi", "05:30 PM - 06:30 PM", "Mon, Tue, Thu", 15, 1);
        FitnessClass c5 = new FitnessClass(classSeq++, "Spin & Cardio Blast", "Cardio", 2, "Sneha Pillai", "06:30 PM - 07:30 PM", "Daily", 18, 1);
        classRegistry.put(c1.getId(), c1);
        classRegistry.put(c2.getId(), c2);
        classRegistry.put(c3.getId(), c3);
        classRegistry.put(c4.getId(), c4);
        classRegistry.put(c5.getId(), c5);
    }

    @Override
    public User authenticate(String username, String password) {
        User user = userRegistry.get(username);
        if (user != null && user.verifyPassword(password)) {
            return user;
        }
        return null;
    }

    @Override
    public void registerMember(Member member) {
        if (member == null) throw new IllegalArgumentException("Member cannot be null.");
        memberRegistry.put(member.getMemberId(), member);
    }

    @Override
    public List<Member> getAllMembers() {
        return new ArrayList<>(memberRegistry.values());
    }

    // Compile-time Polymorphism: Method Overloading 1 (by String ID)
    @Override
    public Member findMember(String memberId) {
        if (memberId == null) return null;
        return memberRegistry.get(memberId.trim().toUpperCase());
    }

    // Compile-time Polymorphism: Method Overloading 2 (by numeric DB ID)
    @Override
    public Member findMember(int numericId) {
        for (Member m : memberRegistry.values()) {
            if (m.getId() == numericId) return m;
        }
        return null;
    }

    @Override
    public AttendanceRecord checkInMember(String memberCode) {
        Member member = findMember(memberCode);
        if (member == null) {
            throw new NoSuchElementException("Member with ID '" + memberCode + "' does not exist.");
        }
        if (!member.isEligibleForCheckIn()) {
            throw new IllegalStateException("Member " + member.getFullName() + " has status '" +
                    member.getStatus() + "' and cannot check in until renewed.");
        }

        AttendanceRecord record = new AttendanceRecord(attendanceSeq++, member.getMemberId(),
                member.getFullName(), LocalDateTime.now());
        attendanceLog.add(0, record);
        return record;
    }

    @Override
    public void checkOutMember(String memberCode) {
        for (AttendanceRecord rec : attendanceLog) {
            if (rec.getMemberId().equalsIgnoreCase(memberCode) && rec.getCheckOutTime() == null) {
                rec.checkOut(LocalDateTime.now());
                return;
            }
        }
        throw new NoSuchElementException("No active check-in session found for " + memberCode);
    }

    @Override
    public List<AttendanceRecord> getRecentAttendance() {
        return new ArrayList<>(attendanceLog);
    }

    /**
     * Runtime Polymorphism in Action:
     * Resolves the plan tier dynamically and delegates the pricing algorithm
     * to the appropriate subclass (SilverPlan, GoldPlan, or PlatinumPlan).
     */
    @Override
    public double computePlanFee(String planType, int durationMonths) {
        MembershipPlan plan = planCatalog.get(planType);
        if (plan == null) {
            throw new IllegalArgumentException("Unknown membership tier: " + planType);
        }
        // Polymorphic dynamic method dispatch
        return plan.calculateFee(durationMonths);
    }

    @Override
    public void recordPayment(String memberId, String planDesc, double amount, String status) {
        Member member = findMember(memberId);
        String name = (member != null) ? member.getFullName() : "Guest";
        PaymentRecord payment = new PaymentRecord(paymentSeq++, memberId, name, planDesc,
                amount, LocalDate.now().plusMonths(1), status);
        paymentLedger.add(0, payment);
    }

    @Override
    public List<PaymentRecord> getAllPayments() {
        return new ArrayList<>(paymentLedger);
    }

    @Override
    public List<Trainer> getAllTrainers() {
        return new ArrayList<>(trainerRegistry.values());
    }

    @Override
    public Trainer findTrainer(int trainerId) {
        return trainerRegistry.get(trainerId);
    }

    @Override
    public void registerTrainer(Trainer trainer) {
        if (trainer == null) throw new IllegalArgumentException("Trainer cannot be null.");
        trainerRegistry.put(trainer.getId(), trainer);
    }

    @Override
    public List<FitnessClass> getAllClasses() {
        return new ArrayList<>(classRegistry.values());
    }

    @Override
    public boolean bookClass(int classId) {
        FitnessClass fc = classRegistry.get(classId);
        if (fc != null) {
            return fc.bookSpot();
        }
        return false;
    }

    public Map<String, MembershipPlan> getPlanCatalog() {
        return planCatalog;
    }

    public Map<String, User> getUserRegistry() {
        return userRegistry;
    }

    public boolean updateUsername(String oldUsername, String newUsername) {
        if (oldUsername == null || newUsername == null) return false;
        String cleanOld = oldUsername.trim().toLowerCase();
        String cleanNew = newUsername.trim().toLowerCase();
        if (userRegistry.containsKey(cleanNew) && !cleanNew.equals(cleanOld)) {
            return false;
        }
        User user = userRegistry.remove(cleanOld);
        if (user != null) {
            user.setUsername(cleanNew);
            userRegistry.put(cleanNew, user);
            return true;
        }
        return false;
    }
}
