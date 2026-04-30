package com.codeknow.controller;

import com.codeknow.service.RepoService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.*;

@RestController
@RequestMapping("/api/repos/{id}")
@Tag(name = "文件浏览", description = "仓库文件树和代码查看")
public class FileController {

    private final RepoService repoService;
    public FileController(RepoService repoService) { this.repoService = repoService; }

    @GetMapping("/tree")
    @Operation(summary = "文件树", description = "获取指定目录下的文件和子目录列表")
    public ResponseEntity<List<Map<String, Object>>> getTree(
            @PathVariable @Parameter(description = "仓库ID") Long id,
            @RequestParam(defaultValue = "") @Parameter(description = "子目录路径，空表示根目录") String dir) {
        try { return ResponseEntity.ok(repoService.getFileTree(id, dir)); }
        catch (Exception e) { return ResponseEntity.internalServerError().build(); }
    }

    @GetMapping("/file")
    @Operation(summary = "文件内容", description = "获取指定文件的内容、语言类型")
    public ResponseEntity<Map<String, String>> getFile(
            @PathVariable @Parameter(description = "仓库ID") Long id,
            @RequestParam @Parameter(description = "文件相对路径") String path) {
        try {
            Map<String, String> result = repoService.getFileContent(id, path);
            return result.isEmpty() ? ResponseEntity.notFound().build() : ResponseEntity.ok(result);
        } catch (Exception e) { return ResponseEntity.internalServerError().build(); }
    }
}
