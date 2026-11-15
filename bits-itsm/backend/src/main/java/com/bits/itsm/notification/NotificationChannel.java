package com.bits.itsm.notification;

/** Contract for a delivery mechanism (in-app, email, SMS, push...). Add a channel = add a @Component. */
public interface NotificationChannel {
    String name();

    void send(Notification notification);
}
