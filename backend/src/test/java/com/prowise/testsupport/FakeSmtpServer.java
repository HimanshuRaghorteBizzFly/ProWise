package com.prowise.testsupport;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.InetAddress;
import java.net.ServerSocket;
import java.net.Socket;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Locale;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * A minimal plain-text SMTP server on 127.0.0.1 for tests. It speaks real SMTP over a real socket, so the mail
 * client, timeouts and error handling are exercised exactly as against a provider, without any network access.
 * It never offers STARTTLS: a client that requires STARTTLS must fail against it.
 */
public final class FakeSmtpServer implements AutoCloseable {

    public enum Mode {
        /** Accepts AUTH and messages. */
        NORMAL,
        /** Rejects AUTH with 535, as Gmail does for a wrong App Password. */
        AUTH_REJECT,
        /** Accepts the TCP connection and never answers (client read timeout). */
        SILENT,
        /** The first connection gets "421 service not available"; later ones behave normally. */
        TRANSIENT_THEN_OK,
        /** Rejects MAIL FROM with 553. */
        REJECT_SENDER
    }

    public static final String QUEUE_REPLY = "250 2.0.0 OK 1732300000 fake-queue-id-42";

    private final ServerSocket socket;
    private final ExecutorService pool = Executors.newCachedThreadPool();
    private final List<String> messages = new CopyOnWriteArrayList<>();
    private final List<String> authLines = new CopyOnWriteArrayList<>();
    private final AtomicInteger connections = new AtomicInteger();
    private volatile Mode mode;

    public FakeSmtpServer(Mode mode) throws IOException {
        this.mode = mode;
        this.socket = new ServerSocket(0, 50, InetAddress.getLoopbackAddress());
        pool.submit(this::acceptLoop);
    }

    public int port() {
        return socket.getLocalPort();
    }

    public void mode(Mode mode) {
        this.mode = mode;
    }

    /** Raw DATA sections of every accepted message. */
    public List<String> messages() {
        return List.copyOf(messages);
    }

    /** Every AUTH-related client line (used to prove the configured credentials were really presented). */
    public List<String> authLines() {
        return List.copyOf(authLines);
    }

    public int connections() {
        return connections.get();
    }

    private void acceptLoop() {
        while (!socket.isClosed()) {
            try {
                Socket client = socket.accept();
                int number = connections.incrementAndGet();
                pool.submit(() -> handle(client, number));
            } catch (IOException closed) {
                return;
            }
        }
    }

    private void handle(Socket client, int connectionNumber) {
        try (client) {
            BufferedReader in = new BufferedReader(new InputStreamReader(client.getInputStream(), StandardCharsets.US_ASCII));
            OutputStream out = client.getOutputStream();
            Mode current = mode;
            if (current == Mode.SILENT) {
                Thread.sleep(30_000);
                return;
            }
            if (current == Mode.TRANSIENT_THEN_OK && connectionNumber == 1) {
                write(out, "421 4.3.2 Service not available, try again later");
                return;
            }
            write(out, "220 fake.smtp.test ESMTP ready");
            String line;
            while ((line = in.readLine()) != null) {
                String upper = line.toUpperCase(Locale.ROOT);
                if (upper.startsWith("EHLO")) {
                    write(out, "250-fake.smtp.test greets you\r\n250-AUTH LOGIN PLAIN\r\n250-8BITMIME\r\n250 OK");
                } else if (upper.startsWith("HELO")) {
                    write(out, "250 fake.smtp.test");
                } else if (upper.startsWith("AUTH LOGIN")) {
                    authLines.add(line);
                    write(out, "334 VXNlcm5hbWU6");
                    authLines.add(in.readLine());
                    write(out, "334 UGFzc3dvcmQ6");
                    authLines.add(in.readLine());
                    authResult(out, current);
                } else if (upper.startsWith("AUTH PLAIN")) {
                    authLines.add(line);
                    if (line.trim().length() <= "AUTH PLAIN".length()) {
                        write(out, "334 ");
                        authLines.add(in.readLine());
                    }
                    authResult(out, current);
                } else if (upper.startsWith("MAIL FROM")) {
                    write(out, current == Mode.REJECT_SENDER ? "553 5.1.8 Sender address rejected" : "250 2.1.0 OK");
                } else if (upper.startsWith("RCPT TO")) {
                    write(out, "250 2.1.5 OK");
                } else if (upper.startsWith("DATA")) {
                    write(out, "354 Go ahead");
                    StringBuilder data = new StringBuilder();
                    String dataLine;
                    while ((dataLine = in.readLine()) != null && !dataLine.equals(".")) {
                        data.append(dataLine).append("\n");
                    }
                    messages.add(data.toString());
                    write(out, QUEUE_REPLY);
                } else if (upper.startsWith("RSET") || upper.startsWith("NOOP")) {
                    write(out, "250 2.0.0 OK");
                } else if (upper.startsWith("QUIT")) {
                    write(out, "221 2.0.0 Bye");
                    return;
                } else {
                    write(out, "502 5.5.1 Unrecognized command");
                }
            }
        } catch (IOException | InterruptedException ignored) {
            // client went away or server is closing
        }
    }

    private static void authResult(OutputStream out, Mode mode) throws IOException {
        write(out, mode == Mode.AUTH_REJECT
                ? "535 5.7.8 Username and Password not accepted"
                : "235 2.7.0 Accepted");
    }

    private static void write(OutputStream out, String reply) throws IOException {
        out.write((reply + "\r\n").getBytes(StandardCharsets.US_ASCII));
        out.flush();
    }

    @Override
    public void close() throws IOException {
        socket.close();
        pool.shutdownNow();
    }
}
