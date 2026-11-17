package com.prowise.testsupport.github;

import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.util.List;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

/** Loads the synthetic deliveries described in fixtures/github/deliveries.json. */
public final class GitHubFixtures {

    private static final String BASE = "/fixtures/github/";
    private static final ObjectMapper MAPPER = new ObjectMapper();

    private GitHubFixtures() {
    }

    public record Delivery(String name, String deliveryId, String event, String payloadFile,
            String signature, boolean expectValid, String note) {

        public byte[] body() {
            return read(payloadFile);
        }
    }

    public static List<Delivery> deliveries() {
        try {
            JsonNode root = MAPPER.readTree(read("deliveries.json"));
            return MAPPER.readerForListOf(Delivery.class).readValue(root.path("deliveries"));
        } catch (IOException exception) {
            throw new UncheckedIOException(exception);
        }
    }

    public static Delivery delivery(String name) {
        return deliveries().stream().filter(d -> d.name().equals(name)).findFirst()
                .orElseThrow(() -> new IllegalArgumentException("no fixture " + name));
    }

    /** Raw bytes exactly as stored; signatures are computed over these bytes. */
    public static byte[] read(String file) {
        try (InputStream in = GitHubFixtures.class.getResourceAsStream(BASE + file)) {
            if (in == null) {
                throw new IllegalArgumentException("missing fixture " + file);
            }
            return in.readAllBytes();
        } catch (IOException exception) {
            throw new UncheckedIOException(exception);
        }
    }
}
