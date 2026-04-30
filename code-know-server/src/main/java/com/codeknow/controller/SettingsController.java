package com.codeknow.controller;

import com.codeknow.service.ChromaDBService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@RestController
@RequestMapping("/api/settings")
public class SettingsController {

    private final ChromaDBService chromaDB;

    @Value("${deepseek.api-key}")
    private String deepseekKey;

    public SettingsController(ChromaDBService chromaDB) {
        this.chromaDB = chromaDB;
    }

    @GetMapping
    public Map<String, Object> getSettings() {
        return Map.of(
            "deepseekConfigured", deepseekKey != null && !deepseekKey.isBlank(),
            "chromadbUrl", "http://localhost:8000",
            "dataDir", "./repos"
        );
    }

    @PostMapping("/test-connection")
    public ResponseEntity<Map<String, Object>> testConnection() {
        boolean chromaOk = chromaDB.isHealthy();
        boolean deepseekOk = deepseekKey != null && !deepseekKey.isBlank();
        return ResponseEntity.ok(Map.of("deepseek", deepseekOk, "chromadb", chromaOk));
    }
}
