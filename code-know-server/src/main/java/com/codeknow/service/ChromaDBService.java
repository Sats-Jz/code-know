package com.codeknow.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.springframework.http.*;
import java.util.*;

@Service
public class ChromaDBService {

    private final RestTemplate rest = new RestTemplate();
    private final ObjectMapper mapper = new ObjectMapper();

    @Value("${chromadb.url}")
    private String baseUrl;

    private static final String DB_PATH = "/api/v2/tenants/default/databases";
    private static final String DB_NAME = "default";
    private String collectionsPath() { return DB_PATH + "/" + DB_NAME + "/collections"; }

    private final Map<Long, String> collectionUuids = new HashMap<>();
    private boolean dbReady = false;

    private synchronized void ensureDatabase() {
        if (dbReady) return;
        // GET to check if DB exists
        try {
            rest.getForEntity(baseUrl + DB_PATH, String.class);
        } catch (Exception e) { /* ignore */ }
        // Create DB if needed (POST once)
        try {
            Map<String, String> body = Map.of("name", DB_NAME);
            rest.postForEntity(baseUrl + DB_PATH, body, String.class);
        } catch (Exception e) { /* might already exist */ }
        dbReady = true;
    }

    private String getOrCreateCollection(Long repoId) {
        ensureDatabase();
        if (collectionUuids.containsKey(repoId)) return collectionUuids.get(repoId);

        String name = "repo_" + repoId;
        // Try to find existing collection
        try {
            String resp = rest.getForEntity(baseUrl + collectionsPath(), String.class).getBody();
            JsonNode arr = mapper.readTree(resp);
            for (JsonNode col : arr) {
                if (name.equals(col.get("name").asText())) {
                    String uuid = col.get("id").asText();
                    collectionUuids.put(repoId, uuid);
                    return uuid;
                }
            }
        } catch (Exception e) { /* empty or error */ }

        // Create new collection
        Map<String, String> body = new HashMap<>();
        body.put("name", name);
        String resp = rest.postForEntity(baseUrl + collectionsPath(), body, String.class).getBody();
        try {
            JsonNode json = mapper.readTree(resp);
            String uuid = json.get("id").asText();
            collectionUuids.put(repoId, uuid);
            System.out.println("[ChromaDB] 创建集合 " + name + " uuid=" + uuid);
            return uuid;
        } catch (Exception e) {
            return name; // fallback
        }
    }

    public void deleteCollection(Long repoId) {
        String uuid = collectionUuids.remove(repoId);
        if (uuid == null) uuid = getOrCreateCollection(repoId);
        try {
            rest.delete(baseUrl + collectionsPath() + "/" + uuid);
        } catch (Exception e) { /* ignore */ }
    }

    public void addChunks(Long repoId, List<String> ids, List<float[]> embeddings,
                          List<Map<String, String>> metadatas, List<String> documents) {
        String uuid = getOrCreateCollection(repoId);

        ObjectNode root = mapper.createObjectNode();
        ArrayNode idsArr = root.putArray("ids");
        ArrayNode embArr = root.putArray("embeddings");
        ArrayNode metaArr = root.putArray("metadatas");
        ArrayNode docArr = root.putArray("documents");

        for (int i = 0; i < ids.size(); i++) {
            idsArr.add(ids.get(i));
            ArrayNode emb = embArr.addArray();
            for (float f : embeddings.get(i)) emb.add(f);
            ObjectNode meta = metaArr.addObject();
            if (metadatas.get(i) != null) metadatas.get(i).forEach(meta::put);
            docArr.add(documents.get(i));
        }

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        var resp = rest.postForEntity(baseUrl + collectionsPath() + "/" + uuid + "/add",
            new HttpEntity<>(root.toString(), headers), String.class);
        System.out.println("[ChromaDB] 写入 " + ids.size() + " chunks, 状态=" + resp.getStatusCode());
    }

    public ChromaQueryResult query(Long repoId, float[] embedding, int topK) {
        try {
            String uuid = getOrCreateCollection(repoId);
            ObjectNode root = mapper.createObjectNode();
            ArrayNode qe = root.putArray("query_embeddings");
            ArrayNode e = qe.addArray();
            for (float f : embedding) e.add(f);
            root.put("n_results", topK);

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            ResponseEntity<String> resp = rest.postForEntity(
                baseUrl + collectionsPath() + "/" + uuid + "/query",
                new HttpEntity<>(root.toString(), headers), String.class);

            JsonNode json = mapper.readTree(resp.getBody());
            ChromaQueryResult result = new ChromaQueryResult();
            if (json.has("ids") && json.get("ids").size() > 0) {
                json.get("ids").get(0).forEach(n -> result.ids.add(n.asText()));
            }
            if (json.has("distances") && json.get("distances").size() > 0) {
                json.get("distances").get(0).forEach(n -> result.distances.add(n.asDouble()));
            }
            if (json.has("documents") && json.get("documents").size() > 0) {
                json.get("documents").get(0).forEach(n -> result.documents.add(n.asText()));
            }
            System.out.println("[ChromaDB] 查询返回 " + result.ids.size() + " 条结果");
            return result;
        } catch (Exception e) {
            System.err.println("[ChromaDB] 查询失败: " + e.getMessage());
            return new ChromaQueryResult();
        }
    }

    public boolean isHealthy() {
        try {
            rest.getForEntity(baseUrl + "/api/v2/heartbeat", String.class);
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    public static class ChromaQueryResult {
        public List<String> ids = new ArrayList<>();
        public List<Double> distances = new ArrayList<>();
        public List<String> documents = new ArrayList<>();
    }
}
