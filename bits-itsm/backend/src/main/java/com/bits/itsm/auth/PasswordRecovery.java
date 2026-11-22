package com.bits.itsm.auth;

import com.bits.itsm.user.*;
import com.bits.itsm.audit.*;
import java.time.Instant;
import java.security.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class PasswordRecovery {
    private final UserRepository users;
    private final PasswordEncoder passwords;
    private final JdbcTemplate jdbc;
    private final AuditStore audit;
    public PasswordRecovery(UserRepository users, PasswordEncoder passwords, JdbcTemplate jdbc, AuditStore audit) {
        this.users=users; this.passwords=passwords; this.jdbc=jdbc; this.audit=audit;
    }
    public record ResetCode(String token, Instant expiresAt) {
        @Override public String toString() { return "ResetCode[redacted]"; }
    }
    private User actor(String email) {
        return users.findByEmail(email).filter(User::isEnabled).orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED,"Sign in with an enabled account."));
    }
    @Transactional public ResetCode initiate(Long id, String email) {
        User admin=actor(email);
        if (admin.getRole()!=Role.ADMIN) throw new ResponseStatusException(HttpStatus.FORBIDDEN,"Only administrators can initiate password recovery.");
        User target=users.findForUpdate(id).filter(User::isEnabled).orElseThrow(() -> new IllegalArgumentException("Choose an enabled account."));
        byte[] random=new byte[32]; new SecureRandom().nextBytes(random);
        String token=Base64.getUrlEncoder().withoutPadding().encodeToString(random);
        Instant expires=Instant.now().plusSeconds(1800);
        revoke(target.getId());
        jdbc.update("insert into password_reset_tokens(token_hash,user_id,expires_at) values(?,?,?)",digest(token),id,java.sql.Timestamp.from(expires));
        record(admin.getId(),"PASSWORD_RESET_INITIATED",id);
        return new ResetCode(token,expires);
    }
    @Transactional public void reset(String token, String password, String confirmation) {
        validate(password,confirmation);
        if(token==null || !token.matches("[A-Za-z0-9_-]{43}")) throw invalidCode();
        String hash=digest(token);
        var ids=jdbc.queryForList("select user_id from password_reset_tokens where token_hash=?",Long.class,hash);
        if(ids.size()!=1) throw invalidCode();
        User target=users.findForUpdate(ids.getFirst()).filter(User::isEnabled).orElseThrow(PasswordRecovery::invalidCode);
        // Account lock orders concurrent issue/change/reset operations; atomic consume prevents replay.
        if(jdbc.update("update password_reset_tokens set consumed_at=CURRENT_TIMESTAMP where token_hash=? and consumed_at is null and expires_at>CURRENT_TIMESTAMP",hash)!=1) throw invalidCode();
        target.changePassword(passwords.encode(password));
        revoke(target.getId()); record(target.getId(),"PASSWORD_RESET_COMPLETED",target.getId());
    }
    @Transactional public void change(String email,String current,String password,String confirmation) {
        validate(password,confirmation);
        User target=users.findForUpdate(actor(email).getId()).orElseThrow();
        if(current==null || current.getBytes(StandardCharsets.UTF_8).length>72 || !passwords.matches(current,target.getPasswordHash()))
            throw new IllegalArgumentException("Current password is incorrect.");
        if(passwords.matches(password,target.getPasswordHash())) throw new IllegalArgumentException("Choose a different new password.");
        target.changePassword(passwords.encode(password)); revoke(target.getId());
        record(target.getId(),"PASSWORD_CHANGED",target.getId());
    }
    private void revoke(Long id) { jdbc.update("update password_reset_tokens set consumed_at=CURRENT_TIMESTAMP where user_id=? and consumed_at is null",id); }
    private static void validate(String password,String confirmation) {
        PasswordPolicy.requireValid(password);
        if(!password.equals(confirmation)) throw new IllegalArgumentException("Passwords do not match.");
    }
    private static IllegalArgumentException invalidCode() { return new IllegalArgumentException("Reset code is invalid, expired or already used. Ask an administrator for a new code."); }
    private static String digest(String token) {
        try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(token.getBytes(StandardCharsets.UTF_8))); }
        catch(NoSuchAlgorithmException impossible) { throw new IllegalStateException(impossible); }
    }
    private void record(Long actor,String action,Long target) {
        audit.save(new AuditRecord("AUD-"+UUID.randomUUID(),Instant.now(),actor,null,action,null,null,"Password security action for account " + target));
    }
}
