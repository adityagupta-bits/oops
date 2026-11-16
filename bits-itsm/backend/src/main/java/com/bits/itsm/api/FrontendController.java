package com.bits.itsm.api;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

@Controller
public class FrontendController {
    @GetMapping({"/student", "/student/**", "/technician", "/technician/**", "/admin", "/admin/**", "/login"})
    public String index() { return "forward:/index.html"; }
}
