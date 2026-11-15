package com.bits.itsm.notification;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;

/** Simulated email: nothing is sent, the "email" is logged and remembered so it can be shown in the demo. */
@Component
public class EmailChannel implements NotificationChannel {

    private static final Logger log = LoggerFactory.getLogger(EmailChannel.class);

    private final List<Notification> sent = new CopyOnWriteArrayList<>();

    @Override
    public String name() {
        return "EMAIL";
    }

    @Override
    public void send(Notification n) {
        sent.add(n);
        log.info("[SIMULATED EMAIL] to=user#{} subject=\"{}\" body=\"{}\"", n.recipientId(), n.title(), n.message());
    }

    public List<Notification> getSent() {
        return List.copyOf(sent);
    }
}
