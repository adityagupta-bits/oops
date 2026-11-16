package com.bits.itsm.auth;

import com.bits.itsm.user.UserRepository;
import com.bits.itsm.user.User;
import jakarta.servlet.*;
import jakarta.servlet.http.*;
import java.io.IOException;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

/** Disabling an account also stops its previously authenticated session. */
public class EnabledAccountFilter extends OncePerRequestFilter {
    private final UserRepository users;
    public EnabledAccountFilter(UserRepository users) { this.users = users; }
    @Override protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain) throws ServletException, IOException {
        var auth = SecurityContextHolder.getContext().getAuthentication();
        if (request.getRequestURI().startsWith("/api/") && auth != null && auth.isAuthenticated() && !(auth instanceof AnonymousAuthenticationToken)
                && users.findByEmail(auth.getName()).filter(User::isEnabled).isEmpty()) {
            SecurityContextHolder.clearContext();
            if (request.getSession(false) != null) request.getSession(false).invalidate();
            response.setStatus(401); response.setContentType("application/json");
            response.getWriter().write("{\"message\":\"This account is unavailable. Please sign in again.\"}");
            return;
        }
        chain.doFilter(request, response);
    }
}
