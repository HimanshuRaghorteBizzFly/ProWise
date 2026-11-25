package com.prowise.common.storage;

import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.util.UUID;
import java.util.regex.Pattern;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * Stores uploads under {@code prowise.storage.root} (env {@code FILE_STORAGE_ROOT}) as
 * {@code <org id>/<random uuid>}. Keys are generated here and validated on read, so a stored key can never point
 * outside the root (no user-controlled path segments).
 */
@Component
public class LocalDiskFileStorage implements FileStorage {

    private static final Pattern KEY = Pattern.compile("^[0-9a-f-]{36}/[0-9a-f-]{36}$");

    private final Path root;

    public LocalDiskFileStorage(@Value("${prowise.storage.root:./data/uploads}") String root) {
        this.root = Path.of(root).toAbsolutePath().normalize();
    }

    @Override
    public String put(String orgId, byte[] content) {
        String key = UUID.fromString(orgId) + "/" + UUID.randomUUID();
        Path target = resolve(key);
        try {
            Files.createDirectories(target.getParent());
            Files.write(target, content, StandardOpenOption.CREATE_NEW, StandardOpenOption.WRITE);
        } catch (IOException e) {
            throw new UncheckedIOException("The file could not be stored.", e);
        }
        return key;
    }

    @Override
    public InputStream open(String key) {
        try {
            return Files.newInputStream(resolve(key));
        } catch (IOException e) {
            throw new UncheckedIOException("The stored file is missing.", e);
        }
    }

    @Override
    public void delete(String key) {
        try {
            Files.deleteIfExists(resolve(key));
        } catch (IOException ignored) {
            // Best effort: an orphan file is harmless and never reachable without its metadata row.
        }
    }

    private Path resolve(String key) {
        if (key == null || !KEY.matcher(key).matches()) throw new IllegalArgumentException("Invalid storage key.");
        Path path = root.resolve(key).normalize();
        if (!path.startsWith(root)) throw new IllegalArgumentException("Invalid storage key.");
        return path;
    }
}
