package com.codeknow.service;

import com.codeknow.model.Repo;
import com.codeknow.model.RepoRepository;
import org.springframework.ai.embedding.EmbeddingModel;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.*;
import java.nio.file.*;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class RepoService {

    private final RepoRepository repoRepo;
    private final ChromaDBService chromaDB;
    private final EmbeddingModel embedModel;

    @Value("${codeknow.data-dir}")
    private String dataDir;

    private static final Set<String> CODE_EXTS = Set.of(
        ".ts", ".tsx", ".js", ".jsx", ".py", ".rs", ".go", ".java", ".sol",
        ".c", ".cpp", ".h", ".rb", ".php"
    );
    private static final Set<String> IGNORE_DIRS = Set.of(
        "node_modules", ".git", "dist", "build", ".next", "target", "__pycache__"
    );

    public RepoService(RepoRepository repoRepo, ChromaDBService chromaDB, EmbeddingModel embedModel) {
        this.repoRepo = repoRepo;
        this.chromaDB = chromaDB;
        this.embedModel = embedModel;
    }

    public List<Repo> listRepos() {
        return repoRepo.findAllByOrderByUpdatedAtDesc();
    }

    public Repo getRepo(Long id) {
        return repoRepo.findById(id).orElse(null);
    }

    public Repo importLocal(String localPath) {
        String name = Paths.get(localPath).getFileName().toString();
        Repo repo = new Repo();
        repo.setName(name);
        repo.setIndexStatus("importing");
        repo = repoRepo.save(repo);
        final Long repoId = repo.getId();
        new Thread(() -> processImport(repoId, "local", localPath, null)).start();
        return repo;
    }

    public Repo importGit(String gitUrl) {
        String name = gitUrl.substring(gitUrl.lastIndexOf('/') + 1).replace(".git", "");
        Repo repo = new Repo();
        repo.setName(name);
        repo.setGitUrl(gitUrl);
        repo.setIndexStatus("importing");
        repo = repoRepo.save(repo);
        final Long repoId = repo.getId();
        new Thread(() -> processImport(repoId, "git", null, gitUrl)).start();
        return repo;
    }

    private void processImport(Long repoId, String type, String localPath, String gitUrl) {
        try {
            Repo repo = repoRepo.findById(repoId).orElse(null);
            if (repo == null) return;

            String repoPath = dataDir + File.separator + repo.getName();
            if ("local".equals(type)) {
                copyDir(Paths.get(localPath), Paths.get(repoPath));
            } else {
                new ProcessBuilder("git", "clone", "--depth", "1", gitUrl, repoPath)
                    .inheritIO().start().waitFor();
            }

            List<String> files = scanFiles(repoPath);
            int lineCount = countLines(repoPath, files);
            String language = detectPrimaryLang(files);

            repo.setPath(repoPath);
            repo.setFileCount(files.size());
            repo.setLineCount(lineCount);
            repo.setLanguage(language);
            repo.setIndexStatus("indexing");
            repo.setUpdatedAt(java.time.LocalDateTime.now());
            repoRepo.save(repo);

            int totalChunks = 0;
            List<String> batchIds = new ArrayList<>();
            List<float[]> batchEmbs = new ArrayList<>();
            List<Map<String, String>> batchMeta = new ArrayList<>();
            List<String> batchDocs = new ArrayList<>();

            for (String file : files) {
                String content = Files.readString(Paths.get(repoPath, file));
                List<String> chunks = chunkContent(content);
                if (chunks.isEmpty()) continue;

                for (int i = 0; i < chunks.size(); i++) {
                    String chunk = chunks.get(i);
                    // BGE-M3 限制 8192 tokens，截断到 ~5000 tokens 安全范围
                    if (chunk.length() > 20000) chunk = chunk.substring(0, 20000);
                    try {
                        float[] emb = embedModel.embed(chunk);
                        batchIds.add("repo_" + repoId + "_chunk_" + totalChunks);
                        batchEmbs.add(emb);
                        Map<String, String> meta = new HashMap<>();
                        meta.put("filePath", file);
                        meta.put("chunkIndex", String.valueOf(i));
                        batchMeta.add(meta);
                        batchDocs.add(chunk);
                        totalChunks++;
                    } catch (Exception e) {
                        // skip failed embeddings
                    }

                    if (batchIds.size() >= 20) {
                        chromaDB.addChunks(repoId, batchIds, batchEmbs, batchMeta, batchDocs);
                        batchIds.clear(); batchEmbs.clear(); batchMeta.clear(); batchDocs.clear();
                    }
                }
            }
            if (!batchIds.isEmpty()) {
                chromaDB.addChunks(repoId, batchIds, batchEmbs, batchMeta, batchDocs);
            }

            repo.setIndexStatus("ready");
            repo.setUpdatedAt(java.time.LocalDateTime.now());
            repoRepo.save(repo);
        } catch (Exception e) {
            Repo repo = repoRepo.findById(repoId).orElse(null);
            if (repo != null) {
                repo.setIndexStatus("error");
                repo.setUpdatedAt(java.time.LocalDateTime.now());
                repoRepo.save(repo);
            }
            e.printStackTrace();
        }
    }

    public void deleteRepo(Long id) {
        chromaDB.deleteCollection(id);
        repoRepo.deleteById(id);
    }

    // --- File browsing ---
    public List<Map<String, Object>> getFileTree(Long repoId, String dir) throws IOException {
        Repo repo = getRepo(repoId);
        if (repo == null || repo.getPath() == null) return List.of();
        Path fullPath = Paths.get(repo.getPath(), dir);
        if (!Files.exists(fullPath)) return List.of();
        return Files.list(fullPath)
            .filter(p -> !p.getFileName().toString().startsWith("."))
            .filter(p -> !IGNORE_DIRS.contains(p.getFileName().toString()))
            .map(p -> {
                Map<String, Object> node = new HashMap<>();
                node.put("name", p.getFileName().toString());
                String rel = dir.isEmpty() ? p.getFileName().toString() : dir + "/" + p.getFileName();
                node.put("path", rel);
                node.put("type", Files.isDirectory(p) ? "directory" : "file");
                return node;
            })
            .sorted((a, b) -> {
                String ta = (String) a.get("type"), tb = (String) b.get("type");
                if (!ta.equals(tb)) return ta.equals("directory") ? -1 : 1;
                return ((String) a.get("name")).compareToIgnoreCase((String) b.get("name"));
            })
            .collect(Collectors.toList());
    }

    public Map<String, String> getFileContent(Long repoId, String filePath) throws IOException {
        Repo repo = getRepo(repoId);
        if (repo == null || repo.getPath() == null) return Map.of();
        Path fullPath = Paths.get(repo.getPath(), filePath);
        if (!Files.exists(fullPath)) return Map.of();
        String content = Files.readString(fullPath);
        String ext = filePath.substring(filePath.lastIndexOf('.') + 1);
        String lang = extToLang(ext);
        Map<String, String> result = new HashMap<>();
        result.put("path", filePath);
        result.put("content", content);
        result.put("language", lang);
        return result;
    }

    // --- Helpers ---
    private List<String> scanFiles(String root) throws IOException {
        Path rootPath = Paths.get(root);
        return Files.walk(rootPath)
            .filter(Files::isRegularFile)
            .map(p -> rootPath.relativize(p).toString().replace('\\', '/'))
            .filter(f -> {
                int dot = f.lastIndexOf('.');
                if (dot < 0) return false;
                return CODE_EXTS.contains(f.substring(dot).toLowerCase());
            })
            .filter(f -> Arrays.stream(f.split("/")).noneMatch(IGNORE_DIRS::contains))
            .collect(Collectors.toList());
    }

    private int countLines(String root, List<String> files) {
        int total = 0;
        for (String f : files) {
            try { total += Files.readAllLines(Paths.get(root, f)).size(); } catch (Exception e) {}
        }
        return total;
    }

    private String detectPrimaryLang(List<String> files) {
        return files.stream()
            .map(f -> {
                int dot = f.lastIndexOf('.');
                return dot >= 0 ? f.substring(dot + 1) : "unknown";
            })
            .collect(Collectors.groupingBy(e -> e, Collectors.counting()))
            .entrySet().stream().max(Map.Entry.comparingByValue())
            .map(Map.Entry::getKey).orElse("unknown");
    }

    private List<String> chunkContent(String content) {
        List<String> chunks = new ArrayList<>();
        String[] lines = content.split("\n");
        int window = 30, overlap = 8;
        int i = 0;
        while (i < lines.length) {
            int end = Math.min(i + window, lines.length);
            chunks.add(String.join("\n", Arrays.copyOfRange(lines, i, end)));
            i += window - overlap;
        }
        return chunks;
    }

    private void copyDir(Path src, Path dest) throws IOException {
        Files.walk(src).forEach(s -> {
            try {
                Path d = dest.resolve(src.relativize(s));
                if (Files.isDirectory(s)) Files.createDirectories(d);
                else Files.copy(s, d, StandardCopyOption.REPLACE_EXISTING);
            } catch (Exception e) {}
        });
    }

    private String extToLang(String ext) {
        return switch (ext.toLowerCase()) {
            case "ts" -> "typescript"; case "tsx" -> "tsx";
            case "js" -> "javascript"; case "jsx" -> "javascript";
            case "py" -> "python"; case "rs" -> "rust";
            case "go" -> "go"; case "java" -> "java"; case "sol" -> "solidity";
            default -> ext;
        };
    }
}
