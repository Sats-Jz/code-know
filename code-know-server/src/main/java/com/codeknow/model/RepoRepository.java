package com.codeknow.model;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface RepoRepository extends JpaRepository<Repo, Long> {
    List<Repo> findAllByOrderByUpdatedAtDesc();
}
