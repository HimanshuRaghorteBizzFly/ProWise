package com.prowise.superadmin.plans;

import java.util.UUID;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

@Entity
@Table(name = "plan_features")
public class PlanFeatureEntity {

    @Id
    @Column(name = "id", nullable = false)
    private UUID id = UUID.randomUUID();

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "plan_id", nullable = false)
    private PlanEntity plan;

    @Column(name = "feature_text", nullable = false, length = 255)
    private String featureText;

    @Column(name = "sort_order", nullable = false)
    private int sortOrder = 0;

    public PlanFeatureEntity() {}

    public PlanFeatureEntity(PlanEntity plan, String featureText, int sortOrder) {
        this.id = UUID.randomUUID();
        this.plan = plan;
        this.featureText = featureText;
        this.sortOrder = sortOrder;
    }

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }

    public PlanEntity getPlan() { return plan; }
    public void setPlan(PlanEntity plan) { this.plan = plan; }

    public String getFeatureText() { return featureText; }
    public void setFeatureText(String featureText) { this.featureText = featureText; }

    public int getSortOrder() { return sortOrder; }
    public void setSortOrder(int sortOrder) { this.sortOrder = sortOrder; }
}
