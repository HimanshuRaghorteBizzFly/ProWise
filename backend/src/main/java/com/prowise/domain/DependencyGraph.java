package com.prowise.domain;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;

/**
 * Finish-to-Start links of one project (task 3.4). A link means "successor cannot start until predecessor is finished".
 * Pure logic: cycle checks, the work affected by a change, and bridging links when a predecessor is removed.
 */
public final class DependencyGraph {

    private DependencyGraph() {}

    public record Link(String predecessor, String successor) {}

    public enum Problem { SELF_LINK, DUPLICATE, CYCLE }

    /** Why a new link is refused, if it is. */
    public static Optional<Problem> canLink(List<Link> links, String predecessor, String successor) {
        if (predecessor.equals(successor)) return Optional.of(Problem.SELF_LINK);
        if (links.contains(new Link(predecessor, successor))) return Optional.of(Problem.DUPLICATE);
        // A cycle appears when the predecessor already (transitively) waits on the successor.
        if (affected(links, successor).contains(predecessor)) return Optional.of(Problem.CYCLE);
        return Optional.empty();
    }

    /** Every item that waits on the given one, directly or through other links, nearest first. */
    public static List<String> affected(List<Link> links, String item) {
        Set<String> seen = new LinkedHashSet<>();
        Deque<String> queue = new ArrayDeque<>(List.of(item));
        while (!queue.isEmpty()) {
            String current = queue.removeFirst();
            for (Link link : links) {
                if (link.predecessor().equals(current) && !link.successor().equals(item) && seen.add(link.successor())) {
                    queue.addLast(link.successor());
                }
            }
        }
        return new ArrayList<>(seen);
    }

    /** Direct predecessors of an item. */
    public static List<String> predecessors(List<Link> links, String item) {
        return links.stream().filter(l -> l.successor().equals(item)).map(Link::predecessor).toList();
    }

    /**
     * Links to add when an item is taken out and its successors should keep waiting on its own predecessors
     * (P -> X -> S becomes P -> S). Links that already exist are not repeated.
     */
    public static List<Link> bridge(List<Link> links, String item) {
        List<Link> added = new ArrayList<>();
        for (String predecessor : predecessors(links, item)) {
            for (Link out : links) {
                if (!out.predecessor().equals(item)) continue;
                Link link = new Link(predecessor, out.successor());
                if (!link.predecessor().equals(link.successor()) && !links.contains(link) && !added.contains(link)) added.add(link);
            }
        }
        return added;
    }
}
