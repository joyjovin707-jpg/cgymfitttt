package com.cfit.jdbc.dao;

import com.cfit.jdbc.DBConnection;
import com.cfit.jdbc.JDBCHelper;
import com.cfit.model.PaymentRecord;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.Statement;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

/**
 * Data Access Object (DAO) for Payment entity:
 * Implements billing queries and invoice generation in MySQL 'payments' table.
 */
public class PaymentDAO {

    public List<PaymentRecord> findAll() {
        List<PaymentRecord> list = new ArrayList<>();
        String sql = "SELECT id, invoice_number, member_id, member_name, plan_type, amount, payment_method, status, payment_date " +
                     "FROM payments ORDER BY id DESC";
        Connection conn = null;
        Statement stmt = null;
        ResultSet rs = null;
        try {
            conn = DBConnection.getConnection();
            stmt = conn.createStatement();
            rs = stmt.executeQuery(sql);
            while (rs.next()) {
                int id = rs.getInt("id");
                String inv = rs.getString("invoice_number");
                String mId = rs.getString("member_id");
                String mName = rs.getString("member_name");
                String plan = rs.getString("plan_type");
                double amt = rs.getDouble("amount");
                String method = rs.getString("payment_method");
                String status = rs.getString("status");
                String pDateStr = rs.getString("payment_date");
                LocalDate dueDate = LocalDate.now();
                if (pDateStr != null && pDateStr.length() >= 10) {
                    try { dueDate = LocalDate.parse(pDateStr.substring(0, 10)); } catch (Exception ignored) {}
                }

                list.add(new PaymentRecord(id, inv, mId, mName, plan, amt, method, status, dueDate));
            }
        } catch (Exception e) {
            System.err.println("[PaymentDAO] findAll error: " + e.getMessage());
        } finally {
            JDBCHelper.closeQuietly(rs, stmt, conn);
        }
        return list;
    }

    public boolean insert(PaymentRecord p) {
        String sql = "INSERT INTO payments (invoice_number, member_id, member_name, plan_type, amount, payment_method, status, payment_date) " +
                     "VALUES (?, ?, ?, ?, ?, ?, ?, NOW())";
        Connection conn = null;
        PreparedStatement ps = null;
        try {
            conn = DBConnection.getConnection();
            ps = conn.prepareStatement(sql, Statement.RETURN_GENERATED_KEYS);
            ps.setString(1, p.getPaymentCode());
            ps.setString(2, p.getMemberId());
            ps.setString(3, p.getMemberName());
            ps.setString(4, p.getPlanDescription());
            ps.setDouble(5, p.getAmount());
            ps.setString(6, p.getPaymentMethod());
            ps.setString(7, p.getPaymentStatus());

            int affected = ps.executeUpdate();
            if (affected > 0) {
                ResultSet keys = ps.getGeneratedKeys();
                if (keys.next()) {
                    p.setId(keys.getInt(1));
                }
                keys.close();
                return true;
            }
        } catch (Exception e) {
            System.err.println("[PaymentDAO] insert error: " + e.getMessage());
        } finally {
            JDBCHelper.closeQuietly(ps, conn);
        }
        return false;
    }
}
