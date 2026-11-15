package com.bits.itsm.api;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.server.ResponseStatusException;

import java.util.Map;

/** Returns {"message": "..."} for errors from ServicesController, the shape the frontend's api.js expects. */
@RestControllerAdvice(assignableTypes = ServicesController.class)
public class ServicesApiErrors {

    @ExceptionHandler(ResponseStatusException.class)
    ResponseEntity<Map<String, String>> statusError(ResponseStatusException error) {
        return ResponseEntity.status(error.getStatusCode()).body(Map.of("message", error.getReason() == null ? "Request failed." : error.getReason()));
    }
}
