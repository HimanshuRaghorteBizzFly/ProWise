package com.prowise.common.storage;

import java.io.InputStream;

/**
 * Where uploaded bytes live. The database keeps the metadata (owner organization, project, kind, checksum) and every
 * permission decision; storage only maps an opaque key to bytes. {@link LocalDiskFileStorage} is the default; an S3
 * implementation can replace it without touching callers.
 */
public interface FileStorage {

    /** Stores the bytes under a new opaque key (never derived from user input) and returns that key. */
    String put(String orgId, byte[] content);

    /** Opens a stored object, or throws {@link java.io.UncheckedIOException} when it is missing. */
    InputStream open(String key);

    /** Removes a stored object; missing objects are ignored. */
    void delete(String key);
}
