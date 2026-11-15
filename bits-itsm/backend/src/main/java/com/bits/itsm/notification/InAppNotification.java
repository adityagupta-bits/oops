package com.bits.itsm.notification;

import java.time.Instant;

/** What the UI shows: a notification plus its read flag. */
public record InAppNotification(String id, Long recipientId, String type, Long incidentId,
                                String title, String message, Instant timestamp, boolean read) {
}
