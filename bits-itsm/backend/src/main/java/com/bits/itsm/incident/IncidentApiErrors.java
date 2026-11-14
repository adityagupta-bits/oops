package com.bits.itsm.incident;

import java.util.Map;
import org.springframework.http.ResponseEntity;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.bind.annotation.*;
import com.bits.itsm.assignment.AssignmentController;

@RestControllerAdvice(assignableTypes = {IncidentController.class, AssignmentController.class})
public class IncidentApiErrors {
    @ExceptionHandler(ResponseStatusException.class)
    ResponseEntity<Map<String, String>> accessError(ResponseStatusException error) { return ResponseEntity.status(error.getStatusCode()).body(Map.of("message", error.getReason())); }
    @ExceptionHandler(IllegalStateException.class)
    ResponseEntity<Map<String, String>> conflict(IllegalStateException error) { return ResponseEntity.status(409).body(Map.of("message", error.getMessage())); }
    @ExceptionHandler(IllegalArgumentException.class)
    ResponseEntity<Map<String, String>> invalid(IllegalArgumentException error) { return ResponseEntity.badRequest().body(Map.of("message", error.getMessage())); }
    @ExceptionHandler({MethodArgumentNotValidException.class, HttpMessageNotReadableException.class, MethodArgumentTypeMismatchException.class})
    ResponseEntity<Map<String, String>> malformed() { return ResponseEntity.badRequest().body(Map.of("message", "Check required fields, allowed options and text lengths.")); }
}
