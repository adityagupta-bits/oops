package com.bits.itsm.notification;

import com.bits.itsm.event.EventType;

import java.time.Instant;

/** A message addressed to one user about one incident. */
public record Notification(String id, Long recipientId, EventType type, Long incidentId,
                           String title, String message, Instant timestamp) {
}
