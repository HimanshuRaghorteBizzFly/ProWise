package com.prowise.developer;

import java.time.Instant;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "code_review_comments")
public class CodeReviewCommentEntity {

    @Id
    @Column(name = "id", length = 64)
    private String id;

    @Column(name = "review_id", nullable = false, length = 64)
    private String reviewId;

    @Column(name = "author_id", nullable = false, length = 64)
    private String authorId;

    @Column(name = "author_name", length = 150)
    private String authorName;

    @Column(name = "comment", nullable = false, columnDefinition = "TEXT")
    private String comment;

    @Column(name = "line_number")
    private Integer lineNumber;

    @Column(name = "file_path", length = 255)
    private String filePath;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    public CodeReviewCommentEntity() {}

    public CodeReviewCommentEntity(String id, String reviewId, String authorId, String authorName, String comment, Integer lineNumber, String filePath) {
        this.id = id;
        this.reviewId = reviewId;
        this.authorId = authorId;
        this.authorName = authorName;
        this.comment = comment;
        this.lineNumber = lineNumber;
        this.filePath = filePath;
        this.createdAt = Instant.now();
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public String getReviewId() { return reviewId; }
    public void setReviewId(String reviewId) { this.reviewId = reviewId; }
    public String getAuthorId() { return authorId; }
    public void setAuthorId(String authorId) { this.authorId = authorId; }
    public String getAuthorName() { return authorName; }
    public void setAuthorName(String authorName) { this.authorName = authorName; }
    public String getComment() { return comment; }
    public void setComment(String comment) { this.comment = comment; }
    public Integer getLineNumber() { return lineNumber; }
    public void setLineNumber(Integer lineNumber) { this.lineNumber = lineNumber; }
    public String getFilePath() { return filePath; }
    public void setFilePath(String filePath) { this.filePath = filePath; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
}
