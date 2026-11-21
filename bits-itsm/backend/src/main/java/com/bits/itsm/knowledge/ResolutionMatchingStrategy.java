package com.bits.itsm.knowledge;

import com.bits.itsm.incident.Incident;

/** Replaceable rule for comparing an open incident with a resolved knowledge source. */
public interface ResolutionMatchingStrategy {
    double score(Incident current, Incident historical);
}
