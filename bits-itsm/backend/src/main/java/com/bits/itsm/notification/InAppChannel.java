package com.bits.itsm.notification;

import org.springframework.stereotype.Component;

import java.util.Comparator;
import java.util.List;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;

/** In-app channel: keeps notifications in memory for the dashboards to read. */
@Component
public class InAppChannel implements NotificationChannel {

    private final List<Notification> inbox = new CopyOnWriteArrayList<>();
    private final Set<String> readIds = ConcurrentHashMap.newKeySet();

    @Override
    public String name() {
        return "IN_APP";
    }

    @Override
    public void send(Notification n) {
        inbox.add(n);
    }

    /** Notifications for one user, newest first. */
    public List<InAppNotification> getFor(Long recipientId) {
        return inbox.stream()
                .filter(n -> n.recipientId().equals(recipientId))
                .sorted(Comparator.comparing(Notification::timestamp).thenComparing(Notification::id).reversed())
                .map(n -> new InAppNotification(n.id(), n.recipientId(), n.type().name(), n.incidentId(),
                        n.title(), n.message(), n.timestamp(), readIds.contains(n.id())))
                .toList();
    }

    /** Marks one of the user's own notifications as read. Returns false if it does not exist or is not theirs. */
    public boolean markRead(String notificationId, Long recipientId) {
        boolean ownedByUser = inbox.stream()
                .anyMatch(n -> n.id().equals(notificationId) && n.recipientId().equals(recipientId));
        if (ownedByUser) {
            readIds.add(notificationId);
        }
        return ownedByUser;
    }
}
