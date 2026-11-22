package com.bits.itsm.incident;

import com.bits.itsm.user.*;
import com.bits.itsm.event.IncidentEventPublisher;
import java.util.*;
import java.time.Instant;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;

@Service @Transactional
public class IncidentConversation {
    private final IncidentRepository incidents;
    private final UserRepository users;
    private final JdbcTemplate jdbc;
    private final IncidentEventPublisher events;
    public IncidentConversation(IncidentRepository incidents, UserRepository users, JdbcTemplate jdbc, IncidentEventPublisher events) {
        this.incidents=incidents; this.users=users; this.jdbc=jdbc; this.events=events;
    }
    private User actor(String email) { return users.findByEmail(email).filter(User::isEnabled).orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED)); }
    private Incident authorized(Long id, User user) {
        var incident=incidents.findForUpdate(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        boolean allowed=user.getRole()==Role.ADMIN || user.getRole()==Role.STUDENT && incident.getReporter().getId().equals(user.getId())
                || user.getRole()==Role.TECHNICIAN && incident.participates(user.getId());
        if(!allowed) throw new ResponseStatusException(HttpStatus.FORBIDDEN,"You do not have access to this conversation.");
        return incident;
    }
    public record Entry(Long id, String sender, Long senderId, String content, Instant createdAt, boolean unread) { }
    public record Conversation(List<Entry> messages, long unreadCount, boolean canSend, Long viewerId) { }
    public record StaffEntry(Long id, String sender, Long senderId, String content, Instant createdAt,
            boolean unread, boolean urgent, List<String> readBy) { }
    public record StaffConversation(List<StaffEntry> messages, long unreadCount, boolean canSend, Long viewerId) { }
    public Conversation list(Long id,String email) {
        var user=actor(email); var incident=authorized(id,user);
        Long read=lastRead(id,user.getId(),"STUDENT");
        var messages=incident.getNotes().stream().filter(n -> n.getKind()==InvestigationNote.Kind.MESSAGE && n.getVisibility()==InvestigationNote.Visibility.STUDENT_VISIBLE)
                .map(n -> new Entry(n.getId(),n.getAuthor().getName(),n.getAuthor().getId(),n.getContent(),n.getCreatedAt(),n.getId()>read && !n.getAuthor().getId().equals(user.getId()))).toList();
        return new Conversation(messages,messages.stream().filter(Entry::unread).count(),incident.getAssignedTechnician()!=null && incident.getStatus()!=IncidentStatus.CLOSED,user.getId());
    }
    public Conversation send(Long id,String content,String email) {
        var user=actor(email); var incident=authorized(id,user);
        if(incident.getAssignedTechnician()==null || incident.getStatus()==IncidentStatus.CLOSED) throw new IllegalStateException("Messaging is available after assignment and before closure.");
        incident.addNote(user,content,InvestigationNote.Visibility.STUDENT_VISIBLE,InvestigationNote.Kind.MESSAGE);
        incident.record(user,"MESSAGE_SENT","Sent a message to the incident conversation.",InvestigationNote.Visibility.STUDENT_VISIBLE);
        incidents.flush();
        events.publish(id,user.getId(),"MESSAGE_SENT","A new message is available in the incident conversation.");
        return list(id,email);
    }
    public void read(Long id,Long messageId,String email) {
        var user=actor(email); var incident=authorized(id,user);
        if(messageId==null || incident.getNotes().stream().noneMatch(n -> n.getId().equals(messageId)
                && n.getKind()==InvestigationNote.Kind.MESSAGE && n.getVisibility()==InvestigationNote.Visibility.STUDENT_VISIBLE))
            throw new IllegalArgumentException("Select a message from this conversation.");
        saveRead(id,user.getId(),messageId,"STUDENT");
    }

    public StaffConversation listInternal(Long id,String email) {
        var user=actor(email); var incident=authorized(id,user); requireStaff(user,incident);
        long read=lastRead(id,user.getId(),"INTERNAL");
        var messages=incident.getNotes().stream()
                .filter(n -> n.getKind()==InvestigationNote.Kind.MESSAGE && n.getVisibility()==InvestigationNote.Visibility.INTERNAL)
                .map(n -> new StaffEntry(n.getId(),n.getAuthor().getName(),n.getAuthor().getId(),n.getContent(),n.getCreatedAt(),
                        n.getId()>read && !n.getAuthor().getId().equals(user.getId()),n.isUrgent(),internalReaders(id,n)))
                .toList();
        boolean canSend=incident.getAssignedTechnician()!=null && incident.getStatus()!=IncidentStatus.CLOSED;
        return new StaffConversation(messages,messages.stream().filter(StaffEntry::unread).count(),canSend,user.getId());
    }

    public StaffConversation sendInternal(Long id,String content,boolean urgent,String email) {
        var user=actor(email); var incident=authorized(id,user); requireStaff(user,incident);
        if(urgent && user.getRole()!=Role.ADMIN)
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,"Only an administrator may mark an internal instruction urgent.");
        if(incident.getAssignedTechnician()==null || incident.getStatus()==IncidentStatus.CLOSED)
            throw new IllegalStateException("Internal chat is available after technician assignment and before incident closure.");
        incident.addNote(user,content,InvestigationNote.Visibility.INTERNAL,InvestigationNote.Kind.MESSAGE,urgent);
        incident.record(user,"INTERNAL_MESSAGE_SENT","An internal staff message was sent."+(urgent?" It was marked urgent." : ""),InvestigationNote.Visibility.INTERNAL);
        incidents.flush();
        Set<Long> recipients=new LinkedHashSet<>();
        if(incident.getAssignedTechnician()!=null) recipients.add(incident.getAssignedTechnician().getId());
        incident.getCollaborators().forEach(c -> recipients.add(c.getTechnician().getId()));
        events.publishTo(id,user.getId(),"INTERNAL_MESSAGE_SENT",null,null,
                "A new internal staff message is available for this incident.",recipients);
        return listInternal(id,email);
    }

    public void readInternal(Long id,Long messageId,String email) {
        var user=actor(email); var incident=authorized(id,user); requireStaff(user,incident);
        if(messageId==null || incident.getNotes().stream().noneMatch(n -> n.getId().equals(messageId)
                && n.getKind()==InvestigationNote.Kind.MESSAGE && n.getVisibility()==InvestigationNote.Visibility.INTERNAL))
            throw new IllegalArgumentException("Select an internal message from this conversation.");
        saveRead(id,user.getId(),messageId,"INTERNAL");
    }

    private void requireStaff(User user,Incident incident) {
        if(user.getRole()!=Role.ADMIN && !(user.getRole()==Role.TECHNICIAN && incident.participates(user.getId())))
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,"Only incident administrators and participating technicians may access internal chat.");
    }
    private long lastRead(Long incidentId,Long userId,String channel) {
        return jdbc.query("select last_read_message_id from incident_message_reads where incident_id=? and user_id=? and channel=?",
                rs -> rs.next()?rs.getLong(1):0L,incidentId,userId,channel);
    }
    private void saveRead(Long incidentId,Long userId,Long messageId,String channel) {
        jdbc.update("insert into incident_message_reads(incident_id,user_id,last_read_message_id,channel) values(?,?,?,?) "
                + "on conflict(incident_id,user_id,channel) do update set last_read_message_id=greatest(incident_message_reads.last_read_message_id,excluded.last_read_message_id)",
                incidentId,userId,messageId,channel);
    }
    private List<String> internalReaders(Long incidentId,InvestigationNote message) {
        return jdbc.queryForList("select distinct u.name from incident_message_reads r join app_users u on u.id=r.user_id "
                + "where r.incident_id=? and r.channel='INTERNAL' and r.last_read_message_id>=? and r.user_id<>? and u.enabled "
                + "and (u.role='ADMIN' or r.user_id=(select assigned_technician_id from incidents where id=?) "
                + "or exists(select 1 from incident_collaborators c where c.incident_id=? and c.technician_id=r.user_id)) order by u.name",
                String.class,incidentId,message.getId(),message.getAuthor().getId(),incidentId,incidentId);
    }
}
