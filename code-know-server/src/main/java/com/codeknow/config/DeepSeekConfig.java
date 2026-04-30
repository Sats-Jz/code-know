package com.codeknow.config;

import org.springframework.ai.openai.OpenAiChatModel;
import org.springframework.ai.openai.OpenAiChatOptions;
import org.springframework.ai.openai.api.OpenAiApi;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;

@Configuration
public class DeepSeekConfig {

    @Value("${deepseek.api-key}")
    private String apiKey;

    @Value("${deepseek.base-url}")
    private String baseUrl;

    @Bean
    @Primary
    public OpenAiChatModel deepSeekChatModel() {
        var options = OpenAiChatOptions.builder()
            .withModel("deepseek-v4-pro")
            .build();
        return new OpenAiChatModel(new OpenAiApi(baseUrl, apiKey), options);
    }
}
