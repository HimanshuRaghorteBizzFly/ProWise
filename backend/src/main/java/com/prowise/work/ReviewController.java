package com.prowise.work;

import java.util.List;
import java.util.UUID;

import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.prowise.work.ReviewService.ChecksRequest;
import com.prowise.work.ReviewService.DecisionRequest;
import com.prowise.work.ReviewService.ReasonRequest;
import com.prowise.work.ReviewService.ReviewEvent;
import com.prowise.work.ReviewService.SubmitRequest;
import com.prowise.work.ReviewService.Task;
import com.prowise.work.StructuredProgressService.ProgressView;

/**
 * Tasks 3.3 and 3.5 routes. The membership is checked here; assignee, reviewer, task.review and project.edit rules
 * are checked in ReviewService against the task and its project.
 */
@RestController
@RequestMapping("/v1/organizations/{orgId}")
public class ReviewController {

    private static final String MEMBER = "@permissionService.member(authentication, #orgId)";

    private final ReviewService reviews;
    private final StructuredProgressService progress;

    public ReviewController(ReviewService reviews, StructuredProgressService progress) {
        this.reviews = reviews;
        this.progress = progress;
    }

    @GetMapping("/my-tasks")
    @PreAuthorize(MEMBER)
    List<Task> myTasks(@PathVariable UUID orgId, Authentication authentication) {
        return reviews.myTasks(orgId, authentication);
    }

    @GetMapping("/review-queue")
    @PreAuthorize(MEMBER)
    List<Task> reviewQueue(@PathVariable UUID orgId, Authentication authentication) {
        return reviews.reviewQueue(orgId, authentication);
    }

    @PostMapping("/projects/{projectId}/work-items/{itemId}/submit")
    @PreAuthorize(MEMBER)
    Task submit(@PathVariable UUID orgId, @PathVariable String projectId, @PathVariable String itemId, Authentication authentication,
            @RequestBody SubmitRequest request) {
        return reviews.submit(orgId, projectId, itemId, authentication, request);
    }

    @PostMapping("/projects/{projectId}/work-items/{itemId}/approve")
    @PreAuthorize(MEMBER)
    Task approve(@PathVariable UUID orgId, @PathVariable String projectId, @PathVariable String itemId, Authentication authentication,
            @RequestBody DecisionRequest request) {
        return reviews.approve(orgId, projectId, itemId, authentication, request);
    }

    @PostMapping("/projects/{projectId}/work-items/{itemId}/request-changes")
    @PreAuthorize(MEMBER)
    Task requestChanges(@PathVariable UUID orgId, @PathVariable String projectId, @PathVariable String itemId,
            Authentication authentication, @RequestBody DecisionRequest request) {
        return reviews.requestChanges(orgId, projectId, itemId, authentication, request);
    }

    @PostMapping("/projects/{projectId}/work-items/{itemId}/reopen")
    @PreAuthorize(MEMBER)
    Task reopen(@PathVariable UUID orgId, @PathVariable String projectId, @PathVariable String itemId, Authentication authentication,
            @RequestBody ReasonRequest request) {
        return reviews.reopen(orgId, projectId, itemId, authentication, request);
    }

    @PutMapping("/projects/{projectId}/work-items/{itemId}/checks")
    @PreAuthorize(MEMBER)
    Task setChecks(@PathVariable UUID orgId, @PathVariable String projectId, @PathVariable String itemId, Authentication authentication,
            @RequestBody ChecksRequest request) {
        return reviews.setChecks(orgId, projectId, itemId, authentication, request);
    }

    @GetMapping("/projects/{projectId}/work-items/{itemId}/review")
    @PreAuthorize(MEMBER)
    Task view(@PathVariable UUID orgId, @PathVariable String projectId, @PathVariable String itemId, Authentication authentication) {
        return reviews.view(orgId, projectId, itemId, authentication);
    }

    @GetMapping("/projects/{projectId}/work-items/{itemId}/reviews")
    @PreAuthorize(MEMBER)
    List<ReviewEvent> history(@PathVariable UUID orgId, @PathVariable String projectId, @PathVariable String itemId,
            Authentication authentication) {
        return reviews.history(orgId, projectId, itemId, authentication);
    }

    @GetMapping("/projects/{projectId}/progress")
    @PreAuthorize(MEMBER)
    ProgressView progress(@PathVariable UUID orgId, @PathVariable String projectId, Authentication authentication) {
        return progress.view(orgId, projectId, authentication);
    }
}
