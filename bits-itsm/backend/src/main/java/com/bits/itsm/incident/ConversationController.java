package com.bits.itsm.incident;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import com.bits.itsm.incident.IncidentData.Message;
import com.bits.itsm.incident.IncidentData.InternalMessage;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController @RequestMapping("/api/incidents/{id}")
public class ConversationController {
    private final IncidentConversation conversations;
    public ConversationController(IncidentConversation conversations) { this.conversations=conversations; }
    @GetMapping("/messages") public IncidentConversation.Conversation list(@PathVariable Long id,Authentication auth) { return conversations.list(id,auth.getName()); }
    @PostMapping("/messages") public IncidentConversation.Conversation send(@PathVariable Long id,@Valid @RequestBody Message message,Authentication auth) { return conversations.send(id,message.content(),auth.getName()); }
    public record Read(@NotNull Long messageId) { }
    @PostMapping("/messages/read") public java.util.Map<String,Boolean> read(@PathVariable Long id,@Valid @RequestBody Read read,Authentication auth) {
        conversations.read(id,read.messageId(),auth.getName()); return java.util.Map.of("read",true);
    }
    @GetMapping("/internal-messages") public IncidentConversation.StaffConversation listInternal(@PathVariable Long id,Authentication auth) {
        return conversations.listInternal(id,auth.getName());
    }
    @PostMapping("/internal-messages") public IncidentConversation.StaffConversation sendInternal(@PathVariable Long id,@Valid @RequestBody InternalMessage message,Authentication auth) {
        return conversations.sendInternal(id,message.content(),message.urgent(),auth.getName());
    }
    @PostMapping("/internal-messages/read") public java.util.Map<String,Boolean> readInternal(@PathVariable Long id,@Valid @RequestBody Read read,Authentication auth) {
        conversations.readInternal(id,read.messageId(),auth.getName()); return java.util.Map.of("read",true);
    }
}
