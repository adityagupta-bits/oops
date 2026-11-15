package com.bits.itsm.event;

/** Observer contract: anything that wants to react to incident events implements this. */
public interface IncidentObserver {
    void onEvent(IncidentEvent event);
}
