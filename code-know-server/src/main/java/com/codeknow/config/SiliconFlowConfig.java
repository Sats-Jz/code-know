package com.codeknow.config;

import org.springframework.ai.embedding.EmbeddingModel;
import org.springframework.ai.embedding.EmbeddingRequest;
import org.springframework.ai.openai.OpenAiEmbeddingModel;
import org.springframework.ai.openai.OpenAiEmbeddingOptions;
import org.springframework.ai.openai.api.OpenAiApi;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;

import java.util.List;

@Configuration
public class SiliconFlowConfig {

    @Value("${siliconflow.api-key}")
    private String apiKey;

    @Value("${siliconflow.base-url}")
    private String baseUrl;

    @Bean
    @Primary
    public EmbeddingModel embeddingModel() {
        var api = new OpenAiApi(baseUrl.replace("/v1", ""), apiKey);
        var model = new OpenAiEmbeddingModel(api);

        // Return a wrapper that always uses BAAI/bge-m3
        return new EmbeddingModel() {
            @Override
            public org.springframework.ai.embedding.EmbeddingResponse call(EmbeddingRequest request) {
                var opts = OpenAiEmbeddingOptions.builder()
                    .withModel("BAAI/bge-m3")
                    .build();
                var newRequest = new EmbeddingRequest(request.getInstructions(), opts);
                return model.call(newRequest);
            }

            @Override
            public float[] embed(String text) {
                return embed(List.of(text)).get(0);
            }

            @Override
            public List<float[]> embed(List<String> texts) {
                return call(new EmbeddingRequest(texts, OpenAiEmbeddingOptions.builder().withModel("BAAI/bge-m3").build()))
                    .getResults().stream().map(r -> r.getOutput()).toList();
            }

            @Override
            public float[] embed(org.springframework.ai.document.Document document) {
                return embed(document.getContent());
            }
        };
    }
}
