package com.codeknow.config;

import org.springframework.ai.openai.OpenAiEmbeddingModel;
import org.springframework.ai.openai.api.OpenAiApi;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;

@Configuration
public class SiliconFlowConfig {

    @Value("${siliconflow.api-key}")
    private String apiKey;

    @Value("${siliconflow.base-url}")
    private String baseUrl;

    @Bean
    @Primary
    public OpenAiEmbeddingModel embeddingModel() {
        // baseUrl 不要带 /v1，OpenAiApi 会自动拼接
        return new OpenAiEmbeddingModel(new OpenAiApi(baseUrl.replace("/v1", ""), apiKey));
    }
}
