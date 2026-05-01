package com.codeknow;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class CodeKnowApplication {
    public static void main(String[] args) {
        // 强制 JDK HttpClient 用 HTTP/1.1，防止 DeepSeek API HTTP/2 EOF 错误
        System.setProperty("jdk.httpclient.allowRestrictedHeaders", "host");
        System.setProperty("jdk.httpclient.version", "1.1");
        SpringApplication.run(CodeKnowApplication.class, args);
    }
}
