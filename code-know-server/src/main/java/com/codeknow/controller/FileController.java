package com.codeknow.controller;

import com.codeknow.service.RepoService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@RestController
@RequestMapping("/api/repos/{id}")
public class FileController {

    private final RepoService repoService;

    public FileController(RepoService repoService) {
        this.repoService = repoService;
    }

    @GetMapping("/tree")
    public ResponseEntity<List<Map<String, Object>>> getTree(
            @PathVariable Long id, @RequestParam(defaultValue = "") String dir) {
        try {
            return ResponseEntity.ok(repoService.getFileTree(id, dir));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().build();
        }
    }

    @GetMapping("/file")
    public ResponseEntity<Map<String, String>> getFile(
            @PathVariable Long id, @RequestParam String path) {
        try {
            Map<String, String> result = repoService.getFileContent(id, path);
            return result.isEmpty() ? ResponseEntity.notFound().build() : ResponseEntity.ok(result);
        } catch (Exception e) {
            return ResponseEntity.internalServerError().build();
        }
    }
}
