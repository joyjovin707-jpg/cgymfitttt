package com.cfit.jdbc.dao;

import com.cfit.jdbc.DBConnection;
import com.cfit.jdbc.JDBCHelper;
import com.cfit.model.Member;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

/**
 * Data Access Object (DAO) for Member entity:
 * Implements CRUD operations against MySQL 'members' table via JDBC PreparedStatements.
 */
public class MemberDAO {

    public List<Member> findAll() {
        List<Member> list = new ArrayList<>();
        String sql = "SELECT m.id, m.member_code, m.full_name, m.plan_type, m.trainer_id, " +
                     "COALESCE(t.full_name, m.trainer_name, 'Unassigned') as trainer_name, " +
                     "m.join_date, m.expiry_date, m.status " +
                     "FROM members m " +
                     "LEFT JOIN trainers t ON m.trainer_id = t.id " +
                     "ORDER BY m.id ASC";

        Connection conn = null;
        Statement stmt = null;
        ResultSet rs = null;
        try {
            conn = DBConnection.getConnection();
            stmt = conn.createStatement();
            rs = stmt.executeQuery(sql);
            while (rs.next()) {
                int id = rs.getInt("id");
                String code = rs.getString("member_code");
                String name = rs.getString("full_name");
                String plan = rs.getString("plan_type");
                int tId = rs.getInt("trainer_id");
                Integer trainerId = rs.wasNull() ? null : tId;
                String trainerName = rs.getString("trainer_name");
                LocalDate joinDate = LocalDate.parse(rs.getString("join_date"));
                LocalDate expiryDate = LocalDate.parse(rs.getString("expiry_date"));
                String status = rs.getString("status");

                list.add(new Member(id, code, name, plan, trainerId, trainerName, joinDate, expiryDate, status));
            }
        } catch (Exception e) {
            System.err.println("[MemberDAO] findAll error: " + e.getMessage());
        } finally {
            JDBCHelper.closeQuietly(rs, stmt, conn);
        }
        return list;
    }

    public Member findByCode(String memberCode) {
        if (memberCode == null) return null;
        String sql = "SELECT m.id, m.member_code, m.full_name, m.plan_type, m.trainer_id, " +
                     "COALESCE(t.full_name, m.trainer_name, 'Unassigned') as trainer_name, " +
                     "m.join_date, m.expiry_date, m.status " +
                     "FROM members m " +
                     "LEFT JOIN trainers t ON m.trainer_id = t.id " +
                     "WHERE UPPER(m.member_code) = UPPER(?)";

        Connection conn = null;
        PreparedStatement ps = null;
        ResultSet rs = null;
        try {
            conn = DBConnection.getConnection();
            ps = conn.prepareStatement(sql);
            ps.setString(1, memberCode.trim());
            rs = ps.executeQuery();
            if (rs.next()) {
                int id = rs.getInt("id");
                String code = rs.getString("member_code");
                String name = rs.getString("full_name");
                String plan = rs.getString("plan_type");
                int tId = rs.getInt("trainer_id");
                Integer trainerId = rs.wasNull() ? null : tId;
                String trainerName = rs.getString("trainer_name");
                LocalDate joinDate = LocalDate.parse(rs.getString("join_date"));
                LocalDate expiryDate = LocalDate.parse(rs.getString("expiry_date"));
                String status = rs.getString("status");

                return new Member(id, code, name, plan, trainerId, trainerName, joinDate, expiryDate, status);
            }
        } catch (Exception e) {
            System.err.println("[MemberDAO] findByCode error: " + e.getMessage());
        } finally {
            JDBCHelper.closeQuietly(rs, ps, conn);
        }
        return null;
    }

    public boolean insert(Member member) {
        String sql = "INSERT INTO members (member_code, full_name, plan_type, trainer_id, trainer_name, join_date, expiry_date, status) " +
                     "VALUES (?, ?, ?, ?, ?, ?, ?, ?)";
        Connection conn = null;
        PreparedStatement ps = null;
        try {
            conn = DBConnection.getConnection();
            ps = conn.prepareStatement(sql, Statement.RETURN_GENERATED_KEYS);
            ps.setString(1, member.getMemberId());
            ps.setString(2, member.getFullName());
            ps.setString(3, member.getPlanType());
            if (member.getTrainerId() != null) {
                ps.setInt(4, member.getTrainerId());
            } else {
                ps.setNull(4, java.sql.Types.INTEGER);
            }
            ps.setString(5, member.getTrainerName());
            ps.setString(6, member.getJoinDate().toString());
            ps.setString(7, member.getExpiryDate().toString());
            ps.setString(8, member.getStatus());

            int affected = ps.executeUpdate();
            if (affected > 0) {
                ResultSet keys = ps.getGeneratedKeys();
                if (keys.next()) {
                    member.setId(keys.getInt(1));
                }
                keys.close();
                return true;
            }
        } catch (Exception e) {
            System.err.println("[MemberDAO] insert error: " + e.getMessage());
        } finally {
            JDBCHelper.closeQuietly(ps, conn);
        }
        return false;
    }

    public boolean update(Member member) {
        String sql = "UPDATE members SET full_name = ?, plan_type = ?, trainer_id = ?, trainer_name = ?, " +
                     "join_date = ?, expiry_date = ?, status = ? WHERE member_code = ?";
        Connection conn = null;
        PreparedStatement ps = null;
        try {
            conn = DBConnection.getConnection();
            ps = conn.prepareStatement(sql);
            ps.setString(1, member.getFullName());
            ps.setString(2, member.getPlanType());
            if (member.getTrainerId() != null) {
                ps.setInt(3, member.getTrainerId());
            } else {
                ps.setNull(3, java.sql.Types.INTEGER);
            }
            ps.setString(4, member.getTrainerName());
            ps.setString(5, member.getJoinDate().toString());
            ps.setString(6, member.getExpiryDate().toString());
            ps.setString(7, member.getStatus());
            ps.setString(8, member.getMemberId());

            return ps.executeUpdate() > 0;
        } catch (Exception e) {
            System.err.println("[MemberDAO] update error: " + e.getMessage());
            return false;
        } finally {
            JDBCHelper.closeQuietly(ps, conn);
        }
    }

    public boolean deleteByCode(String memberCode) {
        String sql = "DELETE FROM members WHERE UPPER(member_code) = UPPER(?)";
        Connection conn = null;
        PreparedStatement ps = null;
        try {
            conn = DBConnection.getConnection();
            ps = conn.prepareStatement(sql);
            ps.setString(1, memberCode.trim());
            return ps.executeUpdate() > 0;
        } catch (Exception e) {
            System.err.println("[MemberDAO] delete error: " + e.getMessage());
            return false;
        } finally {
            JDBCHelper.closeQuietly(ps, conn);
        }
    }
}
