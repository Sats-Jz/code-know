package com.codeknow.config;

import org.springframework.ai.openai.OpenAiChatModel;
import org.springframework.ai.openai.api.OpenAiApi;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class DeepSeekConfig {

    @Value("${deepseek.api-key}")
    private String apiKey;

    @Value("${deepseek.base-url}")
    private String baseUrl;

    @Bean
    public OpenAiApi deepSeekApi() {
        return new OpenAiApi(baseUrl, apiKey);
    }

    @Bean
    public OpenAiChatModel deepSeekChatModel(OpenAiApi deepSeekApi) {
        return new OpenAiChatModel(deepSeekApi);
    }
}
