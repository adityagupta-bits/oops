package com.bits.itsm.incident;
import org.springframework.web.bind.annotation.*;
import org.springframework.security.core.Authentication;
import java.util.Map;
@RestController
@RequestMapping("/api/incidents")
public class HistoricalResolutionController {
    private final HistoricalResolution history;
    public HistoricalResolutionController(HistoricalResolution history) { this.history=history; }
    @GetMapping("/{id}/resolution-estimate")
    public Map<String,Object> estimate(@PathVariable Long id, Authentication auth) {
        return history.estimate(id,auth.getName()).<Map<String,Object>>map(e -> Map.of("estimate",e)).orElseGet(() -> Map.of("available",false));
    }
}
