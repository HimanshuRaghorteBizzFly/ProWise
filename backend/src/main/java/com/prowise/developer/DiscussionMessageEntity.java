package com.prowise.developer;

import java.time.Instant;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "discussion_messages")
public class DiscussionMessageEntity {

    @Id
    @Column(name = "id", length = 64)
    private String id;

    @Column(name = "discussion_id", nullable = false, length = 64)
    private String discussionId;

    @Column(name = "author_id", nullable = false, length = 64)
    private String authorId;

    @Column(name = "author_name", length = 150)
    private String authorName;

    @Column(name = "content", nullable = false, columnDefinition = "TEXT")
    private String content;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    public DiscussionMessageEntity() {}

    public DiscussionMessageEntity(String id, String discussionId, String authorId, String authorName, String content) {
        this.id = id;
        this.discussionId = discussionId;
        this.authorId = authorId;
        this.authorName = authorName;
        this.content = content;
        this.createdAt = Instant.now();
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public String getDiscussionId() { return discussionId; }
    public void setDiscussionId(String discussionId) { this.discussionId = discussionId; }
    public String getAuthorId() { return authorId; }
    public void setAuthorId(String authorId) { this.authorId = authorId; }
    public String getAuthorName() { return authorName; }
    public void setAuthorName(String authorName) { this.authorName = authorName; }
    public String getContent() { return content; }
    public void setContent(String content) { this.content = content; }
    public String getMessage() { return content; }
    public void setMessage(String message) { this.content = message; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
}
