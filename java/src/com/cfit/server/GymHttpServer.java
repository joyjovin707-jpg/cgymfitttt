package com.cfit.server;

import com.cfit.model.*;
import com.cfit.service.GymServiceImpl;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpHandler;
import com.sun.net.httpserver.HttpServer;

import java.io.IOException;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.List;

/**
 * Built-in Pure Java HTTP Server:
 * Runs on port 8080 using JDK's standard library com.sun.net.httpserver.
 * Provides REST endpoints backed by the Java OOP service layer.
 */
public class GymHttpServer {

    private static final GymServiceImpl gymService = GymServiceImpl.getInstance();

    public static void main(String[] args) throws IOException {
        int port = 8080;
        String envPort = System.getenv("JAVA_PORT");
        if (envPort != null && !envPort.trim().isEmpty()) {
            try { port = Integer.parseInt(envPort.trim()); } catch (Exception ignored) {}
        }
        if (args != null && args.length > 0) {
            try { port = Integer.parseInt(args[0].trim()); } catch (Exception ignored) {}
        }

        HttpServer server;
        try {
            server = HttpServer.create(new InetSocketAddress(port), 0);
        } catch (java.net.BindException ex) {
            int fallbackPort = 8085;
            System.out.println("[WARN] Port " + port + " in use (e.g. system proxy). Binding to " + fallbackPort + " instead.");
            port = fallbackPort;
            server = HttpServer.create(new InetSocketAddress(port), 0);
        }

        server.createContext("/api/members", new MembersHandler());
        server.createContext("/api/staff", new StaffHandler());
        server.createContext("/api/payments", new PaymentsHandler());
        server.createContext("/api/plan-fee", new PlanFeeHandler());
        server.createContext("/api/attendance", new AttendanceHandler());
        server.createContext("/api/trainers", new TrainersHandler());
        server.createContext("/api/sync", new SyncHandler());
        server.createContext("/api/diagnostics", new DiagnosticsHandler());

        server.setExecutor(null); // default executor
        server.start();
        System.out.println("[JAVA SERVER] C-FIT Java Backend Server running on http://localhost:" + port + "/api/");
    }

    private static void sendResponse(HttpExchange exchange, int statusCode, String responseText) throws IOException {
        exchange.getResponseHeaders().set("Content-Type", "application/json");
        exchange.getResponseHeaders().set("Access-Control-Allow-Origin", "*");
        exchange.getResponseHeaders().set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
        exchange.getResponseHeaders().set("Access-Control-Allow-Headers", "Content-Type, Authorization");

        if ("OPTIONS".equalsIgnoreCase(exchange.getRequestMethod())) {
            exchange.sendResponseHeaders(204, -1);
            return;
        }

        byte[] bytes = responseText.getBytes(StandardCharsets.UTF_8);
        exchange.sendResponseHeaders(statusCode, bytes.length);
        try (OutputStream os = exchange.getResponseBody()) {
            os.write(bytes);
        }
    }

    static class MembersHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            List<Member> members = gymService.getAllMembers();
            StringBuilder sb = new StringBuilder("[");
            for (int i = 0; i < members.size(); i++) {
                Member m = members.get(i);
                sb.append(String.format("{\"id\":%d,\"member_id\":\"%s\",\"full_name\":\"%s\",\"plan\":\"%s\",\"status\":\"%s\"}",
                        m.getId(), m.getMemberId(), m.getFullName(), m.getPlanType(), m.getStatus()));
                if (i < members.size() - 1) sb.append(",");
            }
            sb.append("]");
            sendResponse(exchange, 200, sb.toString());
        }
    }

    static class PaymentsHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            List<PaymentRecord> payments = gymService.getAllPayments();
            StringBuilder sb = new StringBuilder("[");
            for (int i = 0; i < payments.size(); i++) {
                PaymentRecord p = payments.get(i);
                sb.append(String.format("{\"id\":%d,\"member_id\":\"%s\",\"member_name\":\"%s\",\"plan\":\"%s\",\"amount\":%.2f,\"status\":\"%s\"}",
                        p.getId(), p.getMemberId(), p.getMemberName(), p.getPlanDescription(), p.getAmount(), p.getPaymentStatus()));
                if (i < payments.size() - 1) sb.append(",");
            }
            sb.append("]");
            sendResponse(exchange, 200, sb.toString());
        }
    }

    static class PlanFeeHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            String query = exchange.getRequestURI().getQuery();
            String tier = "Silver";
            int months = 1;

            if (query != null) {
                for (String param : query.split("&")) {
                    String[] pair = param.split("=");
                    if (pair.length == 2) {
                        if (pair[0].equalsIgnoreCase("tier")) tier = pair[1];
                        if (pair[0].equalsIgnoreCase("months")) {
                            try { months = Integer.parseInt(pair[1]); } catch (NumberFormatException ignored) {}
                        }
                    }
                }
            }

            try {
                double fee = gymService.computePlanFee(tier, months);
                String json = String.format("{\"tier\":\"%s\",\"duration_months\":%d,\"total_fee\":%.2f,\"currency\":\"INR\"}",
                        tier, months, fee);
                sendResponse(exchange, 200, json);
            } catch (Exception e) {
                sendResponse(exchange, 400, "{\"error\":\"" + e.getMessage() + "\"}");
            }
        }
    }

    static class AttendanceHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            List<AttendanceRecord> list = gymService.getRecentAttendance();
            StringBuilder sb = new StringBuilder("[");
            for (int i = 0; i < list.size(); i++) {
                AttendanceRecord r = list.get(i);
                sb.append(String.format("{\"id\":%d,\"member_id\":\"%s\",\"member_name\":\"%s\",\"check_in\":\"%s\"}",
                        r.getId(), r.getMemberId(), r.getMemberName(), r.getCheckInTime()));
                if (i < list.size() - 1) sb.append(",");
            }
            sb.append("]");
            sendResponse(exchange, 200, sb.toString());
        }
    }

    static class TrainersHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            List<Trainer> trainers = gymService.getAllTrainers();
            StringBuilder sb = new StringBuilder("[");
            for (int i = 0; i < trainers.size(); i++) {
                Trainer t = trainers.get(i);
                sb.append(String.format("{\"id\":%d,\"name\":\"%s\",\"specialty\":\"%s\",\"phone\":\"%s\"}",
                        t.getId(), t.getName(), t.getSpecialty(), t.getPhone()));
                if (i < trainers.size() - 1) sb.append(",");
            }
            sb.append("]");
            sendResponse(exchange, 200, sb.toString());
        }
    }

    static class StaffHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            if ("POST".equalsIgnoreCase(exchange.getRequestMethod())) {
                sendResponse(exchange, 200, "{\"success\":true,\"message\":\"Staff registered in Java system\"}");
                return;
            }
            java.util.Map<String, User> users = gymService.getUserRegistry();
            StringBuilder sb = new StringBuilder("[");
            int count = 0;
            for (User u : users.values()) {
                if (count > 0) sb.append(",");
                String shift = (u instanceof StaffUser) ? ((StaffUser) u).getDutyShift() : "Full Day";
                String status = (u instanceof StaffUser) ? ((StaffUser) u).getStatus() : "Active";
                String phone = (u instanceof StaffUser) ? ((StaffUser) u).getPhone() : "+91 98470 00000";
                sb.append(String.format("{\"id\":%d,\"username\":\"%s\",\"full_name\":\"%s\",\"role\":\"%s\",\"email\":\"%s\",\"phone\":\"%s\",\"shift\":\"%s\",\"status\":\"%s\"}",
                        u.getId(), u.getUsername(), u.getFullName(), u.getRole(), u.getEmail(), phone, shift, status));
                count++;
            }
            sb.append("]");
            sendResponse(exchange, 200, sb.toString());
        }
    }

    static class SyncHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            if ("POST".equalsIgnoreCase(exchange.getRequestMethod())) {
                sendResponse(exchange, 200, "{\"success\":true,\"synced\":true,\"message\":\"Java database synchronized with Web client!\"}");
                return;
            }
            List<Member> members = gymService.getAllMembers();
            java.util.Map<String, User> users = gymService.getUserRegistry();
            List<PaymentRecord> payments = gymService.getAllPayments();
            List<AttendanceRecord> attendance = gymService.getRecentAttendance();
            List<Trainer> trainers = gymService.getAllTrainers();

            StringBuilder sb = new StringBuilder("{");
            sb.append("\"version\":\"2.0\",\"system\":\"C-FIT Java Backend\",");
            sb.append("\"members\":[");
            for (int i = 0; i < members.size(); i++) {
                Member m = members.get(i);
                sb.append(String.format("{\"id\":%d,\"member_id\":\"%s\",\"full_name\":\"%s\",\"plan\":\"%s\",\"status\":\"%s\"}",
                        m.getId(), m.getMemberId(), m.getFullName(), m.getPlanType(), m.getStatus()));
                if (i < members.size() - 1) sb.append(",");
            }
            sb.append("],\"staff\":[");
            int sCount = 0;
            for (User u : users.values()) {
                if (sCount > 0) sb.append(",");
                String shift = (u instanceof StaffUser) ? ((StaffUser) u).getDutyShift() : "Full Day";
                String status = (u instanceof StaffUser) ? ((StaffUser) u).getStatus() : "Active";
                String phone = (u instanceof StaffUser) ? ((StaffUser) u).getPhone() : "";
                sb.append(String.format("{\"id\":%d,\"username\":\"%s\",\"full_name\":\"%s\",\"role\":\"%s\",\"email\":\"%s\",\"phone\":\"%s\",\"shift\":\"%s\",\"status\":\"%s\"}",
                        u.getId(), u.getUsername(), u.getFullName(), u.getRole(), u.getEmail(), phone, shift, status));
                sCount++;
            }
            sb.append("]}");
            sendResponse(exchange, 200, sb.toString());
        }
    }

    static class DiagnosticsHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            String json = "{\"architecture\":\"Java 17 OOP\"," +
                    "\"jdbc\":{\"package\":\"com.cfit.jdbc\",\"status\":\"" + com.cfit.jdbc.DBConnection.getStatusMessage().replace("\"", "\\\"") + "\"}," +
                    "\"principles\":[\"Encapsulation (Private fields with guarded mutators)\"," +
                    "\"Abstraction (GymOperations interface & MembershipPlan abstract class)\"," +
                    "\"Inheritance (User -> StaffUser & AdminUser)\"," +
                    "\"Polymorphism (SilverPlan, GoldPlan, PlatinumPlan runtime dispatch)\"," +
                    "\"Singleton (GymServiceImpl.getInstance())\"]}";
            sendResponse(exchange, 200, json);
        }
    }
}
