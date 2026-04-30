package com.codeknow.controller;

import com.codeknow.model.Conversation;
import com.codeknow.model.Message;
import com.codeknow.service.ChatService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.*;
import reactor.core.publisher.Flux;
import java.util.List;

@RestController
@RequestMapping("/api/repos/{repoId}")
@Tag(name = "AI 对话", description = "基于 RAG 的流式 AI 问答 + 对话历史管理")
public class ChatController {

    private final ChatService chatService;
    public ChatController(ChatService chatService) { this.chatService = chatService; }

    @PostMapping("/chat")
    @Operation(summary = "发送消息（SSE 流式）", description = "返回 Server-Sent Events 流，包含 text/chart/references/meta/done 事件")
    public Flux<String> chat(
            @PathVariable @Parameter(description = "仓库ID") Long repoId,
            @RequestBody @Parameter(description = "{\"message\":\"问题\",\"conversation_id\":可选,\"mode\":\"explain|trace|compare\"}") ChatService.ChatRequest request) {
        return chatService.chatStream(repoId, request);
    }

    @GetMapping("/conversations")
    @Operation(summary = "对话列表", description = "获取该仓库的所有历史对话")
    public List<Conversation> getConversations(@PathVariable Long repoId) {
        return chatService.getConversations(repoId);
    }

    @GetMapping("/conversations/{cid}")
    @Operation(summary = "对话消息", description = "获取指定对话的全部消息记录")
    public List<Message> getMessages(@PathVariable Long repoId, @PathVariable @Parameter(description = "对话ID") Long cid) {
        return chatService.getMessages(cid);
    }
}
