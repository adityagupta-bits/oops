package com.bits.itsm.notification;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface NotificationDeliveryRepository extends JpaRepository<NotificationDelivery, String> {
    List<NotificationDelivery> findByRecipientIdAndChannelOrderByCreatedAtDesc(Long recipientId, String channel);
    List<NotificationDelivery> findByChannelOrderByCreatedAtDesc(String channel);
    long countByRecipientIdAndChannelAndReadAtIsNull(Long recipientId, String channel);
}
