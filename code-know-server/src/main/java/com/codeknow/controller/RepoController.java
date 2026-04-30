package com.codeknow.controller;

import com.codeknow.model.Repo;
import com.codeknow.service.RepoService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.*;

@RestController
@RequestMapping("/api/repos")
@Tag(name = "仓库管理", description = "代码仓库的导入、查询、删除")
public class RepoController {

    private final RepoService repoService;

    public RepoController(RepoService repoService) { this.repoService = repoService; }

    @GetMapping
    @Operation(summary = "仓库列表", description = "获取所有已导入的仓库，按更新时间倒序")
    public List<Repo> listRepos() { return repoService.listRepos(); }

    @GetMapping("/{id}")
    @Operation(summary = "仓库详情")
    public ResponseEntity<Repo> getRepo(@PathVariable @Parameter(description = "仓库ID") Long id) {
        Repo repo = repoService.getRepo(id);
        return repo != null ? ResponseEntity.ok(repo) : ResponseEntity.notFound().build();
    }

    @PostMapping
    @Operation(summary = "导入仓库", description = "支持两种方式：{\"type\":\"local\",\"localPath\":\"/path\"} 或 {\"type\":\"git\",\"gitUrl\":\"https://...\"}")
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
    @Operation(summary = "删除仓库", description = "同时删除 ChromaDB 向量数据和磁盘文件")
    public ResponseEntity<Map<String, Object>> deleteRepo(@PathVariable @Parameter(description = "仓库ID") Long id) {
        repoService.deleteRepo(id);
        return ResponseEntity.ok(Map.of("success", true));
    }
}
