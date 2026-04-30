package com.codeknow.config;

import org.springframework.ai.openai.OpenAiEmbeddingModel;
import org.springframework.ai.openai.api.OpenAiApi;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class SiliconFlowConfig {

    @Value("${siliconflow.api-key}")
    private String apiKey;

    @Value("${siliconflow.base-url}")
    private String baseUrl;

    @Bean("siliconFlowApi")
    public OpenAiApi siliconFlowApi() {
        return new OpenAiApi(baseUrl, apiKey);
    }

    @Bean
    public OpenAiEmbeddingModel embeddingModel() {
        return new OpenAiEmbeddingModel(siliconFlowApi());
    }
}
