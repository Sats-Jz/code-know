package com.codeknow.controller;

import com.codeknow.model.Repo;
import com.codeknow.service.RepoService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@RestController
@RequestMapping("/api/repos")
public class RepoController {

    private final RepoService repoService;

    public RepoController(RepoService repoService) {
        this.repoService = repoService;
    }

    @GetMapping
    public List<Repo> listRepos() {
        return repoService.listRepos();
    }

    @GetMapping("/{id}")
    public ResponseEntity<Repo> getRepo(@PathVariable Long id) {
        Repo repo = repoService.getRepo(id);
        return repo != null ? ResponseEntity.ok(repo) : ResponseEntity.notFound().build();
    }

    @PostMapping
    public ResponseEntity<Repo> createRepo(@RequestBody Map<String, String> body) {
        String type = body.get("type");
        if ("local".equals(type)) {
            return ResponseEntity.status(201).body(repoService.importLocal(body.get("localPath")));
        } else if ("git".equals(type)) {
            return ResponseEntity.status(201).body(repoService.importGit(body.get("gitUrl")));
        }
        return ResponseEntity.badRequest().build();
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Map<String, Object>> deleteRepo(@PathVariable Long id) {
        repoService.deleteRepo(id);
        return ResponseEntity.ok(Map.of("success", true));
    }
}
