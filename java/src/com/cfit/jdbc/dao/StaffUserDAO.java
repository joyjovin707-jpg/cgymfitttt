package com.cfit.jdbc.dao;

import com.cfit.jdbc.DBConnection;
import com.cfit.jdbc.JDBCHelper;
import com.cfit.model.StaffUser;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.List;

/**
 * Data Access Object (DAO) for StaffUser entity:
 * Authenticates staff and manager accounts against MySQL 'staff_users' and 'admin' tables.
 */
public class StaffUserDAO {

    public StaffUser authenticate(String username, String password) {
        if (username == null || password == null) return null;
        String sql = "SELECT id, username, full_name, role, phone, email, is_active FROM staff_users " +
                     "WHERE LOWER(username) = LOWER(?) AND password_hash = ? AND is_active = 1";
        Connection conn = null;
        PreparedStatement ps = null;
        ResultSet rs = null;
        try {
            conn = DBConnection.getConnection();
            ps = conn.prepareStatement(sql);
            ps.setString(1, username.trim());
            ps.setString(2, password);
            rs = ps.executeQuery();
            if (rs.next()) {
                return new StaffUser(
                        rs.getInt("id"),
                        rs.getString("username"),
                        rs.getString("full_name"),
                        rs.getString("role"),
                        rs.getString("phone"),
                        rs.getString("email"),
                        rs.getInt("is_active") == 1
                );
            }
        } catch (Exception e) {
            System.err.println("[StaffUserDAO] authenticate error: " + e.getMessage());
        } finally {
            JDBCHelper.closeQuietly(rs, ps, conn);
        }
        return null;
    }

    public List<StaffUser> findAll() {
        List<StaffUser> list = new ArrayList<>();
        String sql = "SELECT id, username, full_name, role, phone, email, is_active FROM staff_users ORDER BY id ASC";
        Connection conn = null;
        Statement stmt = null;
        ResultSet rs = null;
        try {
            conn = DBConnection.getConnection();
            stmt = conn.createStatement();
            rs = stmt.executeQuery(sql);
            while (rs.next()) {
                list.add(new StaffUser(
                        rs.getInt("id"),
                        rs.getString("username"),
                        rs.getString("full_name"),
                        rs.getString("role"),
                        rs.getString("phone"),
                        rs.getString("email"),
                        rs.getInt("is_active") == 1
                ));
            }
        } catch (Exception e) {
            System.err.println("[StaffUserDAO] findAll error: " + e.getMessage());
        } finally {
            JDBCHelper.closeQuietly(rs, stmt, conn);
        }
        return list;
    }
}
