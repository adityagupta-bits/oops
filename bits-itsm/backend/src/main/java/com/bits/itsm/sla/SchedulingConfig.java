package com.bits.itsm.sla;

import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;

/** Turns on @Scheduled support so SlaMonitor runs in the background. */
@Configuration
@EnableScheduling
public class SchedulingConfig {
}
