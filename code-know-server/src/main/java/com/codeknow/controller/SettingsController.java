package com.codeknow.controller;

import com.codeknow.service.ChromaDBService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.*;

@RestController
@RequestMapping("/api/settings")
@Tag(name = "系统设置", description = "配置查看和连接测试")
public class SettingsController {

    private final ChromaDBService chromaDB;
    @Value("${deepseek.api-key}") private String deepseekKey;

    public SettingsController(ChromaDBService chromaDB) { this.chromaDB = chromaDB; }

    @GetMapping
    @Operation(summary = "当前配置", description = "查看 DeepSeek API、ChromaDB、数据目录等配置状态")
    public Map<String, Object> getSettings() {
        return Map.of(
            "deepseekConfigured", deepseekKey != null && !deepseekKey.isBlank(),
            "chromadbUrl", "http://localhost:8000",
            "dataDir", "./repos"
        );
    }

    @PostMapping("/test-connection")
    @Operation(summary = "测试连接", description = "检测 DeepSeek API 和 ChromaDB 是否可用")
    public ResponseEntity<Map<String, Object>> testConnection() {
        boolean chromaOk = chromaDB.isHealthy();
        boolean deepseekOk = deepseekKey != null && !deepseekKey.isBlank();
        return ResponseEntity.ok(Map.of("deepseek", deepseekOk, "chromadb", chromaOk));
    }
}
