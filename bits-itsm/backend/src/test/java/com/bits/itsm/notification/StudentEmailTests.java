package com.bits.itsm.notification;

import org.junit.jupiter.api.Test;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.MailSendException;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.transaction.PlatformTransactionManager;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class StudentEmailTests {
    EmailChannel channel(JavaMailSender sender) {
        return new EmailChannel(null, null, null, sender, null, mock(PlatformTransactionManager.class), "sender@gmail.com", "test-only", "https://campus.example", 60);
    }
    @Test void sendsOnlyToReporterWithSafeContentAndVerificationRequest() {
        JavaMailSender sender = mock(JavaMailSender.class);
        String body = EmailChannel.body("Student", 7L, "Wi-Fi unavailable", "RESOLVED", "INCIDENT_RESOLVED", "https://campus.example");
        channel(sender).send(new EmailChannel.Pending("mail-7", 7L, "reporter@hyderabad.bits-pilani.ac.in", "BITSolve", body, 1));
        var message = org.mockito.ArgumentCaptor.forClass(SimpleMailMessage.class);
        verify(sender).send(message.capture());
        assertArrayEquals(new String[]{"reporter@hyderabad.bits-pilani.ac.in"}, message.getValue().getTo());
        assertNull(message.getValue().getCc()); assertNull(message.getValue().getBcc());
        assertTrue(body.contains("verify the resolution")); assertTrue(body.contains("https://campus.example/?incident=7"));
        assertTrue(body.contains("Student")); assertTrue(body.contains("RESOLVED"));
    }
    @Test void contentWithoutBaseUrlHasNoInventedLink() {
        String body = EmailChannel.body("Student", 8L, "Network", "NEW", "INCIDENT_RECEIVED", "");
        assertFalse(body.contains("View incident:")); assertTrue(body.contains("received your incident"));
        assertTrue(EmailChannel.body("Student", 8L, "Network", "IN_PROGRESS", "WORK_STARTED", "").contains("started investigating"));
    }
    @Test void missingCredentialsNeverCallsSmtp() {
        JavaMailSender sender = mock(JavaMailSender.class);
        new EmailChannel(null, null, null, sender, null, mock(PlatformTransactionManager.class), "", "", "", 60).deliverPending();
        verifyNoInteractions(sender);
    }
    @Test void senderFailureIsReportedToWorker() {
        JavaMailSender sender = mock(JavaMailSender.class);
        doThrow(new MailSendException("SMTP unavailable")).when(sender).send(any(SimpleMailMessage.class));
        assertThrows(MailSendException.class, () -> channel(sender).send(new EmailChannel.Pending("id", 1L, "student@example.com", "BITSolve", "Message", 1)));
    }
}
