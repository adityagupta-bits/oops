package com.bits.itsm.auth;

import java.util.Map;
import org.springframework.security.core.Authentication;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
public class PasswordController {
    private final PasswordRecovery recovery;
    public PasswordController(PasswordRecovery recovery) { this.recovery=recovery; }
    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<Map<String,String>> invalid(IllegalArgumentException error) {
        return ResponseEntity.badRequest().body(Map.of("message",error.getMessage()));
    }
    @GetMapping("/api/auth/password-capabilities") public Map<String,Boolean> capabilities() { return Map.of("enabled",true); }
    public record Input(String token,String currentPassword,String password,String confirmation) {
        @Override public String toString() { return "PasswordInput[redacted]"; }
    }
    @PostMapping("/api/admin/users/{id}/password-reset")
    public ResponseEntity<PasswordRecovery.ResetCode> initiate(@PathVariable Long id,Authentication auth) {
        return ResponseEntity.ok().header("Cache-Control","no-store").body(recovery.initiate(id,auth.getName()));
    }
    @PostMapping("/api/auth/reset-password")
    public Map<String,String> reset(@RequestBody Input input) {
        recovery.reset(input.token(),input.password(),input.confirmation());
        return Map.of("message","Password updated. Sign in with your new password.");
    }
    @PostMapping("/api/auth/change-password")
    public Map<String,String> change(@RequestBody Input input,Authentication auth) {
        recovery.change(auth.getName(),input.currentPassword(),input.password(),input.confirmation());
        return Map.of("message","Password updated. Sign in again with your new password.");
    }
}
