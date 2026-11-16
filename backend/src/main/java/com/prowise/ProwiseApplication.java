package com.prowise;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/** Runs as the HTTP API by default, or as the background worker with profile {@code worker}. */
@SpringBootApplication
public class ProwiseApplication {

    public static void main(String[] args) {
        SpringApplication.run(ProwiseApplication.class, args);
    }
}
