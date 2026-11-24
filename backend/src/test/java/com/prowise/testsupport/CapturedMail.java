package com.prowise.testsupport;

import static org.mockito.Mockito.atLeast;
import static org.mockito.Mockito.verify;

import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import jakarta.mail.BodyPart;
import jakarta.mail.Multipart;
import jakarta.mail.internet.MimeMessage;

import org.mockito.ArgumentCaptor;
import org.springframework.mail.javamail.JavaMailSender;

/** Reads the HTML of messages handed to a mocked {@link JavaMailSender} and extracts link tokens. */
public final class CapturedMail {

    private CapturedMail() {}

    /** HTML bodies of every message sent so far, oldest first. */
    public static List<String> sentHtml(JavaMailSender mailSender) throws Exception {
        ArgumentCaptor<MimeMessage> captor = ArgumentCaptor.forClass(MimeMessage.class);
        verify(mailSender, atLeast(1)).send(captor.capture());
        List<String> bodies = new ArrayList<>();
        for (MimeMessage message : captor.getAllValues()) {
            bodies.add(htmlOf(message.getContent()));
        }
        return bodies;
    }

    /** The token in the first link matching {@code linkPrefix} (for example {@code "verify-email?token="}). */
    public static String token(String html, String linkPrefix) {
        Matcher matcher = Pattern.compile(Pattern.quote(linkPrefix) + "([A-Za-z0-9_-]+)").matcher(html);
        if (!matcher.find()) {
            throw new AssertionError("No link starting with " + linkPrefix + " in the email");
        }
        return matcher.group(1);
    }

    private static String htmlOf(Object content) throws Exception {
        if (content instanceof String text) {
            return text;
        }
        if (content instanceof Multipart multipart) {
            StringBuilder all = new StringBuilder();
            for (int i = 0; i < multipart.getCount(); i++) {
                BodyPart part = multipart.getBodyPart(i);
                all.append(htmlOf(part.getContent()));
            }
            return all.toString();
        }
        return "";
    }
}
