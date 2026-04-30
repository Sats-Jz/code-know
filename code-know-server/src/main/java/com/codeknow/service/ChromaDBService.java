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

    private static final String PREFIX = "repo_";

    private void ensureCollection(Long repoId) {
        String name = PREFIX + repoId;
        try {
            rest.getForEntity(baseUrl + "/api/v2/collections/" + name, String.class);
        } catch (Exception e) {
            // Create if not exists
            Map<String, Object> body = new HashMap<>();
            body.put("name", name);
            rest.postForEntity(baseUrl + "/api/v2/collections", body, String.class);
        }
    }

    public void deleteCollection(Long repoId) {
        String name = PREFIX + repoId;
        try {
            rest.delete(baseUrl + "/api/v2/collections/" + name);
        } catch (Exception e) { /* ignore */ }
    }

    public void addChunks(Long repoId, List<String> ids, List<float[]> embeddings,
                          List<Map<String, String>> metadatas, List<String> documents) {
        ensureCollection(repoId);
        String name = PREFIX + repoId;

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
        rest.postForEntity(baseUrl + "/api/v2/collections/" + name + "/add",
            new HttpEntity<>(root.toString(), headers), String.class);
    }

    public ChromaQueryResult query(Long repoId, float[] embedding, int topK) {
        String name = PREFIX + repoId;
        try {
            ObjectNode root = mapper.createObjectNode();
            ArrayNode qe = root.putArray("queryEmbeddings");
            ArrayNode e = qe.addArray();
            for (float f : embedding) e.add(f);
            root.put("nResults", topK);

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            ResponseEntity<String> resp = rest.postForEntity(
                baseUrl + "/api/v2/collections/" + name + "/query",
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
            return result;
        } catch (Exception e) {
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
