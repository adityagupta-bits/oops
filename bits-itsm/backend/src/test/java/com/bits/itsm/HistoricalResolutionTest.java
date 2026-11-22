package com.bits.itsm;
import com.bits.itsm.incident.HistoricalResolution;
import java.util.List;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;
class HistoricalResolutionTest {
 @Test void requiresFiveAndRejectsInvalidDurations() {
  assertTrue(HistoricalResolution.median(List.of(1d,2d,3d,4d)).isEmpty());
  assertTrue(HistoricalResolution.median(List.of(1d,2d,3d,4d,-1d)).isEmpty());
 }
 @Test void calculatesOddAndEvenMediansAndRounds() {
  assertEquals(40,HistoricalResolution.median(List.of(10d,30d,41d,80d,1000d)).orElseThrow().minutes());
  assertEquals(75,HistoricalResolution.median(List.of(10d,30d,60d,90d,100d,1000d)).orElseThrow().minutes());
  assertEquals(60,HistoricalResolution.median(List.of(10d,30d,40d,60d,90d,100d,1000d)).orElseThrow().minutes());
 }
}
