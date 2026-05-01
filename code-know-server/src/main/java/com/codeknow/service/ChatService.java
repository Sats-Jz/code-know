package com.codeknow.service;

import com.codeknow.model.Conversation;
import com.codeknow.model.ConversationRepository;
import com.codeknow.model.Message;
import com.codeknow.model.MessageRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.ai.embedding.EmbeddingModel;
import org.springframework.ai.openai.OpenAiChatModel;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Flux;
import reactor.core.scheduler.Schedulers;

import java.time.LocalDateTime;
import java.util.*;

@Service
public class ChatService {

    private final OpenAiChatModel chatModel;
    private final EmbeddingModel embedModel;
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

    public ChatService(OpenAiChatModel chatModel, EmbeddingModel embedModel,
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
            String title = request.message.length() > 50 ? request.message.substring(0, 50) : request.message;
            conv.setTitle(title);
            conv.setMode(request.mode != null ? request.mode : "explain");
            conv = convRepo.save(conv);
            convId = conv.getId();
        }

        Message userMsg = new Message();
        userMsg.setConversationId(convId);
        userMsg.setRole("user");
        userMsg.setContent(request.message);
        userMsg.setCreatedAt(LocalDateTime.now());
        msgRepo.save(userMsg);

        // Search context (never throw)
        List<String> context = Collections.emptyList();
        try { context = searchContext(repoId, request.message); } catch (Exception e) {
            System.err.println("[RAG] 检索异常: " + e.getMessage());
        }
        String ctx = context.isEmpty() ? "（暂无相关代码片段）" : "以下是相关代码片段：\n\n" + String.join("\n", context);
        String prompt = ctx + "\n\n用户问题: " + request.message;

        final Long finalConvId = convId;
        StringBuilder fullText = new StringBuilder();

        return Flux.<String>create(sink -> {
            try {
                sink.next(ssEvent("meta", Map.of("conversation_id", finalConvId)));

                // True streaming via Spring AI
                var promptObj = new org.springframework.ai.chat.prompt.Prompt(
                    java.util.List.of(
                        new org.springframework.ai.chat.messages.SystemMessage(SYSTEM_PROMPT),
                        new org.springframework.ai.chat.messages.UserMessage(prompt)
                    )
                );

                chatModel.stream(promptObj)
                    .doOnNext(chatResponse -> {
                        String delta = chatResponse.getResult().getOutput().getContent();
                        if (delta != null && !delta.isEmpty()) {
                            fullText.append(delta);
                            sink.next(ssEvent("text", delta));
                        }
                    })
                    .doOnComplete(() -> {
                        saveAssistantMessage(finalConvId, fullText.toString());
                        sink.next(ssEvent("done", Map.of()));
                        sink.complete();
                    })
                    .doOnError(e -> {
                        System.err.println("[Chat] 流式错误: " + e.getMessage());
                        saveAssistantMessage(finalConvId, fullText.toString());
                        sink.next(ssEvent("done", Map.of()));
                        sink.complete();
                    })
                    .subscribe();
            } catch (Exception e) {
                System.err.println("[Chat] 异常: " + e.getMessage());
                sink.next(ssEvent("error", Map.of("error", e.getMessage())));
                sink.complete();
            }
        }).subscribeOn(Schedulers.boundedElastic());
    }

    private void saveAssistantMessage(Long convId, String text) {
        try {
            if (text.isEmpty()) return;
            Message aiMsg = new Message();
            aiMsg.setConversationId(convId);
            aiMsg.setRole("assistant");
            aiMsg.setContent(text);
            aiMsg.setCreatedAt(LocalDateTime.now());
            msgRepo.save(aiMsg);
        } catch (Exception e) {
            System.err.println("[Chat] 保存消息失败: " + e.getMessage());
        }
    }

    private String ssEvent(String event, Object data) {
        try {
            String json = mapper.writeValueAsString(data);
            return "event: " + event + "\ndata: " + json + "\n\n";
        } catch (Exception e) {
            return "event: error\ndata: {}\n\n";
        }
    }

    private List<String> searchContext(Long repoId, String query) {
        List<String> results = new ArrayList<>();
        float[] emb = embedModel.embed(query);
        System.out.println("[RAG] embedding成功, 维度=" + emb.length);
        ChromaDBService.ChromaQueryResult qr = chromaDB.query(repoId, emb, 15);
        System.out.println("[RAG] ChromaDB返回 " + qr.documents.size() + " 个chunk");
        for (String doc : qr.documents) results.add(doc);
        return results;
    }

    public List<Conversation> getConversations(Long repoId) {
        return convRepo.findByRepoIdOrderByCreatedAtDesc(repoId);
    }

    public List<Message> getMessages(Long conversationId) {
        return msgRepo.findByConversationIdOrderByCreatedAtAsc(conversationId);
    }
}
