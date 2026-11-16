package com.bits.itsm.notification;

import java.util.List;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component @Transactional
public class InAppChannel implements NotificationChannel {
    private final NotificationDeliveryRepository deliveries;
    public InAppChannel(NotificationDeliveryRepository deliveries) { this.deliveries = deliveries; }
    @Override public String name() { return "IN_APP"; }
    @Override public void send(Notification notification) { deliveries.save(new NotificationDelivery(notification, name())); }
    @Transactional(readOnly = true) public List<InAppNotification> getFor(Long recipientId) {
        return deliveries.findByRecipientIdAndChannelOrderByCreatedAtDesc(recipientId, name()).stream().map(NotificationDelivery::view).toList();
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
}
