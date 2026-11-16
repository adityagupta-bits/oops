package com.bits.itsm.event;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.List;

/**
 * Subject of the Observer pattern. Spring injects every IncidentObserver bean,
 * so adding a new observer needs no change here.
 * Failures are propagated after notifying observers so the database transaction rolls back.
 */
@Service
public class EventBus {

    private static final Logger log = LoggerFactory.getLogger(EventBus.class);

    private final List<IncidentObserver> observers;

    public EventBus(List<IncidentObserver> observers) {
        this.observers = List.copyOf(observers);
    }

    public void publish(IncidentEvent event) {
        RuntimeException failure = null;
        for (IncidentObserver observer : observers) {
            try {
                observer.onEvent(event);
            } catch (RuntimeException ex) {
                failure = ex;
                log.error("Observer {} failed on {}", observer.getClass().getSimpleName(), event.type(), ex);
            }
        }
        if (failure != null) throw failure;
    }
}
