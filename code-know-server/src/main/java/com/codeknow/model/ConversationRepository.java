package com.codeknow.model;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface ConversationRepository extends JpaRepository<Conversation, Long> {
    List<Conversation> findByRepoIdOrderByCreatedAtDesc(Long repoId);
}
