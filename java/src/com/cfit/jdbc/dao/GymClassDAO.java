package com.cfit.jdbc.dao;

import com.cfit.jdbc.DBConnection;
import com.cfit.jdbc.JDBCHelper;
import com.cfit.model.FitnessClass;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.List;

/**
 * Data Access Object (DAO) for FitnessClass / GymClass entity:
 * Implements schedule queries and booking counters in MySQL 'classes' table.
 */
public class GymClassDAO {

    public List<FitnessClass> findAll() {
        List<FitnessClass> list = new ArrayList<>();
        String sql = "SELECT c.id, c.class_name, c.trainer_id, COALESCE(t.full_name, 'Staff Coach') as trainer_name, " +
                     "c.studio_location, c.start_time, c.max_capacity, c.booked_count " +
                     "FROM classes c " +
                     "LEFT JOIN trainers t ON c.trainer_id = t.id " +
                     "ORDER BY c.id ASC";
        Connection conn = null;
        Statement stmt = null;
        ResultSet rs = null;
        try {
            conn = DBConnection.getConnection();
            stmt = conn.createStatement();
            rs = stmt.executeQuery(sql);
            while (rs.next()) {
                int id = rs.getInt("id");
                String name = rs.getString("class_name");
                int tId = rs.getInt("trainer_id");
                String tName = rs.getString("trainer_name");
                String location = rs.getString("studio_location");
                String time = rs.getString("start_time");
                int maxCap = rs.getInt("max_capacity");
                int booked = rs.getInt("booked_count");

                list.add(new FitnessClass(id, name, tId, tName, location, time, maxCap, booked));
            }
        } catch (Exception e) {
            System.err.println("[GymClassDAO] findAll error: " + e.getMessage());
        } finally {
            JDBCHelper.closeQuietly(rs, stmt, conn);
        }
        return list;
    }

    public boolean bookMemberInClass(int classId, String memberId) {
        String insertBooking = "INSERT IGNORE INTO class_bookings (class_id, member_id, booking_time) VALUES (?, ?, NOW())";
        String updateCount = "UPDATE classes SET booked_count = (SELECT COUNT(*) FROM class_bookings WHERE class_id = ?) WHERE id = ?";
        Connection conn = null;
        PreparedStatement ps1 = null;
        PreparedStatement ps2 = null;
        try {
            conn = DBConnection.getConnection();
            ps1 = conn.prepareStatement(insertBooking);
            ps1.setInt(1, classId);
            ps1.setString(2, memberId);
            int inserted = ps1.executeUpdate();
            if (inserted > 0) {
                ps2 = conn.prepareStatement(updateCount);
                ps2.setInt(1, classId);
                ps2.setInt(2, classId);
                ps2.executeUpdate();
                return true;
            }
            return false;
        } catch (Exception e) {
            System.err.println("[GymClassDAO] bookMemberInClass error: " + e.getMessage());
            return false;
        } finally {
            JDBCHelper.closeQuietly(ps1, ps2, conn);
        }
    }
}
