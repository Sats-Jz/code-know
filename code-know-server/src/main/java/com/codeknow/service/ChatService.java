package com.codeknow.service;

import com.codeknow.model.Conversation;
import com.codeknow.model.ConversationRepository;
import com.codeknow.model.Message;
import com.codeknow.model.MessageRepository;
import com.codeknow.service.ChromaDBService.ChromaQueryResult;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.ai.openai.OpenAiChatModel;
import org.springframework.ai.openai.OpenAiEmbeddingModel;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Flux;

import java.time.LocalDateTime;
import java.util.*;

@Service
public class ChatService {

    private final OpenAiChatModel chatModel;
    private final OpenAiEmbeddingModel embedModel;
    private final ChromaDBService chromaDB;
    private final ConversationRepository convRepo;
    private final MessageRepository msgRepo;
    private final ObjectMapper mapper = new ObjectMapper();

    private static final String SYSTEM_PROMPT = """
        你是一个资深代码架构师。基于提供的代码片段回答用户问题。
        回答要求：
        - 引用具体文件路径和行号
        - 如需展示调用链或架构关系，用 [chart:类型]...[/chart] 包裹 Mermaid 代码
        - 代码示例使用标准 Markdown 代码块，标注语言
        - 解释要清晰深入，逐层分析
        - 如果信息不足，明确指出
        """;

    public ChatService(OpenAiChatModel chatModel, OpenAiEmbeddingModel embedModel,
                       ChromaDBService chromaDB, ConversationRepository convRepo, MessageRepository msgRepo) {
        this.chatModel = chatModel;
        this.embedModel = embedModel;
        this.chromaDB = chromaDB;
        this.convRepo = convRepo;
        this.msgRepo = msgRepo;
    }

    public record ChatRequest(String message, Long conversationId, String mode) {}

    public Flux<String> chatStream(Long repoId, ChatRequest request) {
        Long convId = request.conversationId;
        if (convId == null) {
            Conversation conv = new Conversation();
            conv.setRepoId(repoId);
            conv.setTitle(request.message.length() > 50 ? request.message.substring(0, 50) : request.message);
            conv.setMode(request.mode != null ? request.mode : "explain");
            conv = convRepo.save(conv);
            convId = conv.getId();
        }

        // Save user message
        Message userMsg = new Message();
        userMsg.setConversationId(convId);
        userMsg.setRole("user");
        userMsg.setContent(request.message);
        userMsg.setCreatedAt(LocalDateTime.now());
        msgRepo.save(userMsg);

        // Search context
        List<String> context = searchContext(repoId, request.message);

        // Build prompt
        String ctx = "以下是相关代码片段：\n\n" + String.join("\n", context);
        String prompt = ctx + "\n\n用户问题: " + request.message;

        final Long finalConvId = convId;
        return Flux.create(sink -> {
            try {
                // Send conversation_id first
                sink.next("{\"type\":\"meta\",\"conversation_id\":" + finalConvId + "}");

                var response = chatModel.call(new org.springframework.ai.chat.prompt.Prompt(
                    new org.springframework.ai.chat.messages.SystemMessage(SYSTEM_PROMPT),
                    new org.springframework.ai.chat.messages.UserMessage(prompt)
                ));
                String text = response.getResult().getOutput().getContent();

                // Stream word by word for SSE effect
                for (String word : text.split("(?<=\\S)(?=\\s)")) {
                    sink.next("{\"type\":\"text\",\"data\":\"" + escapeJson(word) + "\"}");
                    Thread.sleep(20);
                }

                // Save assistant message
                Message aiMsg = new Message();
                aiMsg.setConversationId(finalConvId);
                aiMsg.setRole("assistant");
                aiMsg.setContent(text);
                aiMsg.setCreatedAt(LocalDateTime.now());
                msgRepo.save(aiMsg);

                sink.next("{\"type\":\"done\"}");
                sink.complete();
            } catch (Exception e) {
                sink.error(e);
            }
        });
    }

    private List<String> searchContext(Long repoId, String query) {
        List<String> results = new ArrayList<>();
        try {
            float[] emb = embedModel.embed(query);
            ChromaQueryResult qr = chromaDB.query(repoId, emb, 15);
            for (int i = 0; i < qr.documents.size(); i++) {
                results.add(qr.documents.get(i));
            }
        } catch (Exception e) {
            // embedding failed, return empty context
        }
        return results;
    }

    private String escapeJson(String s) {
        return s.replace("\\", "\\\\").replace("\"", "\\\"")
                .replace("\n", "\\n").replace("\r", "\\r")
                .replace("\t", "\\t");
    }

    // --- Conversation management ---
    public List<Conversation> getConversations(Long repoId) {
        return convRepo.findByRepoIdOrderByCreatedAtDesc(repoId);
    }

    public List<Message> getMessages(Long conversationId) {
        return msgRepo.findByConversationIdOrderByCreatedAtAsc(conversationId);
    }
}
