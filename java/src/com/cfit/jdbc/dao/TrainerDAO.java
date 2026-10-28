package com.cfit.jdbc.dao;

import com.cfit.jdbc.DBConnection;
import com.cfit.jdbc.JDBCHelper;
import com.cfit.model.Trainer;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.List;

/**
 * Data Access Object (DAO) for Trainer entity:
 * Implements CRUD operations against MySQL 'trainers' table via JDBC.
 */
public class TrainerDAO {

    public List<Trainer> findAll() {
        List<Trainer> list = new ArrayList<>();
        String sql = "SELECT id, trainer_code, full_name, specialty, rating, phone, email, status FROM trainers ORDER BY id ASC";
        Connection conn = null;
        Statement stmt = null;
        ResultSet rs = null;
        try {
            conn = DBConnection.getConnection();
            stmt = conn.createStatement();
            rs = stmt.executeQuery(sql);
            while (rs.next()) {
                int id = rs.getInt("id");
                String code = rs.getString("trainer_code");
                String name = rs.getString("full_name");
                String specialty = rs.getString("specialty");
                double rating = rs.getDouble("rating");
                String phone = rs.getString("phone");
                String email = rs.getString("email");
                String status = rs.getString("status");

                list.add(new Trainer(id, code, name, specialty, rating, phone, email, status));
            }
        } catch (Exception e) {
            System.err.println("[TrainerDAO] findAll error: " + e.getMessage());
        } finally {
            JDBCHelper.closeQuietly(rs, stmt, conn);
        }
        return list;
    }

    public Trainer findById(int id) {
        String sql = "SELECT id, trainer_code, full_name, specialty, rating, phone, email, status FROM trainers WHERE id = ?";
        Connection conn = null;
        PreparedStatement ps = null;
        ResultSet rs = null;
        try {
            conn = DBConnection.getConnection();
            ps = conn.prepareStatement(sql);
            ps.setInt(1, id);
            rs = ps.executeQuery();
            if (rs.next()) {
                return new Trainer(
                        rs.getInt("id"),
                        rs.getString("trainer_code"),
                        rs.getString("full_name"),
                        rs.getString("specialty"),
                        rs.getDouble("rating"),
                        rs.getString("phone"),
                        rs.getString("email"),
                        rs.getString("status")
                );
            }
        } catch (Exception e) {
            System.err.println("[TrainerDAO] findById error: " + e.getMessage());
        } finally {
            JDBCHelper.closeQuietly(rs, ps, conn);
        }
        return null;
    }

    public boolean insert(Trainer t) {
        String sql = "INSERT INTO trainers (trainer_code, full_name, specialty, rating, phone, email, status) VALUES (?, ?, ?, ?, ?, ?, ?)";
        Connection conn = null;
        PreparedStatement ps = null;
        try {
            conn = DBConnection.getConnection();
            ps = conn.prepareStatement(sql, Statement.RETURN_GENERATED_KEYS);
            ps.setString(1, t.getTrainerCode());
            ps.setString(2, t.getFullName());
            ps.setString(3, t.getSpecialty());
            ps.setDouble(4, t.getRating());
            ps.setString(5, t.getPhone());
            ps.setString(6, t.getEmail());
            ps.setString(7, t.getStatus());

            int affected = ps.executeUpdate();
            if (affected > 0) {
                ResultSet keys = ps.getGeneratedKeys();
                if (keys.next()) {
                    t.setId(keys.getInt(1));
                }
                keys.close();
                return true;
            }
        } catch (Exception e) {
            System.err.println("[TrainerDAO] insert error: " + e.getMessage());
        } finally {
            JDBCHelper.closeQuietly(ps, conn);
        }
        return false;
    }
}
