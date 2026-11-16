package com.bits.itsm.notification;

import jakarta.persistence.*;
import java.time.Instant;

@Entity @Table(name = "notification_deliveries", indexes = @Index(name = "notification_recipient_idx", columnList = "recipientId,channel,createdAt"))
public class NotificationDelivery {
    @Id private String id;
    @Column(nullable = false) private Long recipientId;
    @Column(nullable = false) private String channel;
    @Column(nullable = false) private String type;
    private Long incidentId;
    @Column(nullable = false) private String title;
    @Column(nullable = false, length = 5000) private String message;
    @Column(nullable = false) private Instant createdAt;
    private Instant readAt;
    @Column(nullable = false) private String deliveryStatus;
    private String recipientEmail;
    private int attempts;
    private Instant nextAttemptAt;
    private Instant lastAttemptAt;
    private Instant sentAt;
    private String lastError;
    public String getRecipientEmail() { return recipientEmail; }
    public int getAttempts() { return attempts; }
    public Instant getNextAttemptAt() { return nextAttemptAt; }
    public Instant getLastAttemptAt() { return lastAttemptAt; }
    public Instant getSentAt() { return sentAt; }
    public String getLastError() { return lastError; }
    protected NotificationDelivery() { }
    public NotificationDelivery(Notification notification, String channel) {
        id = channel + "-" + notification.id(); recipientId = notification.recipientId();
        this.channel = channel; type = notification.type().name(); incidentId = notification.incidentId();
        title = notification.title(); message = notification.message(); createdAt = notification.timestamp();
        deliveryStatus = channel.equals("EMAIL") ? "SIMULATED_UNSENT" : "AVAILABLE";
    }
    public String getId() { return id; }
    public Long getRecipientId() { return recipientId; }
    public String getChannel() { return channel; }
    public String getType() { return type; }
    public Long getIncidentId() { return incidentId; }
    public String getTitle() { return title; }
    public String getMessage() { return message; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getReadAt() { return readAt; }
    public String getDeliveryStatus() { return deliveryStatus; }
    public void markRead() { if (readAt == null) readAt = Instant.now(); }
    public InAppNotification view() { return new InAppNotification(id, recipientId, type, incidentId, title, message, createdAt, readAt != null); }
}
