package com.prowise.domain;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;

import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

import com.prowise.domain.DependencyGraph.Link;
import com.prowise.domain.DependencyGraph.Problem;

@Tag("T24")
class DependencyGraphTest {

    private static final List<Link> CHAIN = List.of(new Link("A", "B"), new Link("B", "C"));

    @Test
    void refusesSelfDuplicateAndCycles() {
        assertThat(DependencyGraph.canLink(CHAIN, "A", "A")).contains(Problem.SELF_LINK);
        assertThat(DependencyGraph.canLink(CHAIN, "A", "B")).contains(Problem.DUPLICATE);
        assertThat(DependencyGraph.canLink(CHAIN, "B", "A")).contains(Problem.CYCLE);
        assertThat(DependencyGraph.canLink(CHAIN, "C", "A")).contains(Problem.CYCLE); // indirect loop A -> B -> C -> A
        assertThat(DependencyGraph.canLink(CHAIN, "A", "C")).isEmpty();
    }

    @Test
    void affectedWorkIsEverythingDownstream() {
        List<Link> links = List.of(new Link("A", "B"), new Link("B", "C"), new Link("A", "D"), new Link("X", "Y"));
        assertThat(DependencyGraph.affected(links, "A")).containsExactly("B", "D", "C");
        assertThat(DependencyGraph.affected(links, "C")).isEmpty();
    }

    @Test
    void bridgingKeepsSuccessorsWaitingOnTheRemovedItemsPredecessors() {
        List<Link> links = List.of(new Link("P", "X"), new Link("X", "S1"), new Link("X", "S2"), new Link("P", "S2"));
        assertThat(DependencyGraph.bridge(links, "X")).containsExactly(new Link("P", "S1"));
        assertThat(DependencyGraph.bridge(List.of(new Link("X", "S")), "X")).isEmpty(); // no predecessor: nothing to bridge
    }
}
