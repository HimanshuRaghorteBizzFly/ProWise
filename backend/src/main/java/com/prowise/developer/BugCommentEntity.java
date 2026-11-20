package com.prowise.developer;

import java.time.Instant;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "bug_comments")
public class BugCommentEntity {

    @Id
    @Column(name = "id", length = 64)
    private String id;

    @Column(name = "bug_id", nullable = false, length = 64)
    private String bugId;

    @Column(name = "author_id", nullable = false, length = 64)
    private String authorId;

    @Column(name = "author_name", length = 150)
    private String authorName;

    @Column(name = "content", nullable = false, columnDefinition = "TEXT")
    private String content;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    public BugCommentEntity() {}

    public BugCommentEntity(String id, String bugId, String authorId, String authorName, String content) {
        this.id = id;
        this.bugId = bugId;
        this.authorId = authorId;
        this.authorName = authorName;
        this.content = content;
        this.createdAt = Instant.now();
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public String getBugId() { return bugId; }
    public void setBugId(String bugId) { this.bugId = bugId; }
    public String getAuthorId() { return authorId; }
    public void setAuthorId(String authorId) { this.authorId = authorId; }
    public String getAuthorName() { return authorName; }
    public void setAuthorName(String authorName) { this.authorName = authorName; }
    public String getContent() { return content; }
    public void setContent(String content) { this.content = content; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }

    /** Tenant scope (task 1.3); every query filters by it. */
    @Column(name = "org_id")
    private java.util.UUID orgId;

    public java.util.UUID getOrgId() { return orgId; }
    public void setOrgId(java.util.UUID orgId) { this.orgId = orgId; }
}
