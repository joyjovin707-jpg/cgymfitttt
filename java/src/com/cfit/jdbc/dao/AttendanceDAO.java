package com.cfit.jdbc.dao;

import com.cfit.jdbc.DBConnection;
import com.cfit.jdbc.JDBCHelper;
import com.cfit.model.AttendanceRecord;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.Statement;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;

/**
 * Data Access Object (DAO) for Attendance entity:
 * Implements check-in and check-out logs against MySQL 'attendance' table.
 */
public class AttendanceDAO {

    private static final DateTimeFormatter DTF = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    public List<AttendanceRecord> findAll(int limit) {
        List<AttendanceRecord> list = new ArrayList<>();
        String sql = "SELECT id, member_id, member_name, check_in_time, check_out_time, check_in_method " +
                     "FROM attendance ORDER BY id DESC LIMIT ?";
        Connection conn = null;
        PreparedStatement ps = null;
        ResultSet rs = null;
        try {
            conn = DBConnection.getConnection();
            ps = conn.prepareStatement(sql);
            ps.setInt(1, limit > 0 ? limit : 50);
            rs = ps.executeQuery();
            while (rs.next()) {
                int id = rs.getInt("id");
                String mId = rs.getString("member_id");
                String mName = rs.getString("member_name");
                String inStr = rs.getString("check_in_time");
                String outStr = rs.getString("check_out_time");
                String method = rs.getString("check_in_method");

                LocalDateTime inTime = parseDateTime(inStr);
                LocalDateTime outTime = parseDateTime(outStr);

                list.add(new AttendanceRecord(id, mId, mName, inTime, outTime, method));
            }
        } catch (Exception e) {
            System.err.println("[AttendanceDAO] findAll error: " + e.getMessage());
        } finally {
            JDBCHelper.closeQuietly(rs, ps, conn);
        }
        return list;
    }

    public boolean recordCheckIn(String memberId, String memberName, String method) {
        String sql = "INSERT INTO attendance (member_id, member_name, check_in_time, check_in_method) " +
                     "VALUES (?, ?, NOW(), ?)";
        Connection conn = null;
        PreparedStatement ps = null;
        try {
            conn = DBConnection.getConnection();
            ps = conn.prepareStatement(sql);
            ps.setString(1, memberId);
            ps.setString(2, memberName);
            ps.setString(3, method != null ? method : "Reception Desk");
            return ps.executeUpdate() > 0;
        } catch (Exception e) {
            System.err.println("[AttendanceDAO] recordCheckIn error: " + e.getMessage());
            return false;
        } finally {
            JDBCHelper.closeQuietly(ps, conn);
        }
    }

    public boolean recordCheckOut(int logId) {
        String sql = "UPDATE attendance SET check_out_time = NOW() WHERE id = ? AND check_out_time IS NULL";
        Connection conn = null;
        PreparedStatement ps = null;
        try {
            conn = DBConnection.getConnection();
            ps = conn.prepareStatement(sql);
            ps.setInt(1, logId);
            return ps.executeUpdate() > 0;
        } catch (Exception e) {
            System.err.println("[AttendanceDAO] recordCheckOut error: " + e.getMessage());
            return false;
        } finally {
            JDBCHelper.closeQuietly(ps, conn);
        }
    }

    private LocalDateTime parseDateTime(String str) {
        if (str == null || str.trim().isEmpty()) return null;
        try {
            return LocalDateTime.parse(str.replace(" ", "T"));
        } catch (Exception e) {
            try {
                return LocalDateTime.parse(str, DTF);
            } catch (Exception ignored) {
                return null;
            }
        }
    }
}
