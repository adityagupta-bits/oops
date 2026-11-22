package com.bits.itsm.notification;

import com.bits.itsm.support.IncidentLookup;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component @Transactional
public class InAppChannel implements NotificationChannel {
    private final NotificationDeliveryRepository deliveries;
    private final IncidentLookup incidents;
    public InAppChannel(NotificationDeliveryRepository deliveries, IncidentLookup incidents) {
        this.deliveries = deliveries;
        this.incidents = incidents;
    }
    @Override public String name() { return "IN_APP"; }
    @Override public void send(Notification notification) { deliveries.save(new NotificationDelivery(notification, name())); }
    @Transactional(readOnly = true) public List<InAppNotification> getFor(Long recipientId) {
        var recipientNotifications = deliveries.findByRecipientIdAndChannelOrderByCreatedAtDesc(recipientId, name());
        List<Long> incidentIds = recipientNotifications.stream().map(NotificationDelivery::getIncidentId)
                .filter(Objects::nonNull).distinct().toList();
        Map<Long, String> incidentTitles = incidents.findTitlesByIds(incidentIds);
        return recipientNotifications.stream()
                .map(delivery -> {
                    Long incidentId = delivery.getIncidentId();
                    return delivery.view(incidentId == null ? null : incidentTitles.get(incidentId));
                })
                .toList();
    }
    @Transactional(readOnly = true) public long unreadCount(Long recipientId) {
        return deliveries.countByRecipientIdAndChannelAndReadAtIsNull(recipientId, name());
    }
    public boolean markRead(String notificationId, Long recipientId) {
        var delivery = deliveries.findById(notificationId).orElse(null);
        if (delivery == null || !delivery.getRecipientId().equals(recipientId) || !delivery.getChannel().equals(name())) return false;
        delivery.markRead();
        return true;
    }

    public int markAllRead(Long recipientId) {
        var recipientNotifications = deliveries.findByRecipientIdAndChannelOrderByCreatedAtDesc(recipientId, name());
        int updated = 0;
        for (NotificationDelivery delivery : recipientNotifications) {
            if (delivery.getReadAt() == null) {
                delivery.markRead();
                updated++;
            }
        }
        return updated;
    }
}
