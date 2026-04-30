package com.codeknow.controller;

import com.codeknow.model.Conversation;
import com.codeknow.model.Message;
import com.codeknow.service.ChatService;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import reactor.core.publisher.Flux;

import java.util.List;

@RestController
@RequestMapping("/api/repos/{repoId}")
public class ChatController {

    private final ChatService chatService;

    public ChatController(ChatService chatService) {
        this.chatService = chatService;
    }

    @PostMapping("/chat")
    public Flux<String> chat(@PathVariable Long repoId, @RequestBody ChatService.ChatRequest request) {
        return chatService.chatStream(repoId, request);
    }

    @GetMapping("/conversations")
    public List<Conversation> getConversations(@PathVariable Long repoId) {
        return chatService.getConversations(repoId);
    }

    @GetMapping("/conversations/{cid}")
    public List<Message> getMessages(@PathVariable Long repoId, @PathVariable Long cid) {
        return chatService.getMessages(cid);
    }
}
