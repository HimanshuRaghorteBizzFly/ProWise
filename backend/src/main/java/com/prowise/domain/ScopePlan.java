package com.prowise.domain;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Scope versions (task 3.2, domain rules "Scope versions"). Pure Java, no Spring.
 *
 * <p>A version is a set of leaves with points. A draft applies changes to the active version: ADD a leaf, REMOVE a
 * leaf, CANCEL a leaf (it stays counted in the denominator, earning nothing, until it is removed), SPLIT a leaf into
 * parts (the leaf becomes a parent and never earns credit), REWEIGHT a leaf. One unit (points); weights must be
 * positive; each leaf changes at most once per draft.
 */
public final class ScopePlan {

    private ScopePlan() {}

    public enum Kind { ADD, REMOVE, CANCEL, SPLIT, REWEIGHT }

    public record Leaf(String id, BigDecimal weight, boolean cancelled) {}

    /** {@code target} is the leaf changed (or the new leaf for ADD); {@code parts} are the new leaves of a SPLIT. */
    public record Change(Kind kind, String target, BigDecimal weight, List<Leaf> parts) {}

    /**
     * Leaves of the version that results from applying {@code changes} to {@code base}.
     *
     * @throws IllegalArgumentException with a user-facing message for an invalid draft
     */
    public static List<Leaf> apply(List<Leaf> base, List<Change> changes) {
        if (changes == null || changes.isEmpty()) throw new IllegalArgumentException("A scope change needs at least one change.");
        Map<String, Leaf> leaves = new LinkedHashMap<>();
        base.forEach(leaf -> leaves.put(leaf.id(), leaf));
        Set<String> touched = new HashSet<>();
        for (Change change : changes) {
            if (change.target() == null) throw new IllegalArgumentException("Every change needs its task.");
            if (!touched.add(change.target())) throw new IllegalArgumentException("A task can change only once per scope change.");
            switch (change.kind()) {
                case ADD -> {
                    if (leaves.containsKey(change.target())) throw new IllegalArgumentException("The task is already in scope.");
                    leaves.put(change.target(), new Leaf(change.target(), positive(change.weight()), false));
                }
                case REMOVE -> leaves.remove(existing(leaves, change.target()).id());
                case CANCEL -> {
                    Leaf leaf = existing(leaves, change.target());
                    if (leaf.cancelled()) throw new IllegalArgumentException("The task is already cancelled.");
                    leaves.put(leaf.id(), new Leaf(leaf.id(), leaf.weight(), true));
                }
                case REWEIGHT -> {
                    Leaf leaf = existing(leaves, change.target());
                    BigDecimal weight = positive(change.weight());
                    if (weight.compareTo(leaf.weight()) == 0) throw new IllegalArgumentException("The new points equal the current points.");
                    leaves.put(leaf.id(), new Leaf(leaf.id(), weight, leaf.cancelled()));
                }
                case SPLIT -> {
                    Leaf leaf = existing(leaves, change.target());
                    if (change.parts() == null || change.parts().size() < 2) {
                        throw new IllegalArgumentException("Splitting a task needs at least two parts.");
                    }
                    leaves.remove(leaf.id());
                    for (Leaf part : change.parts()) {
                        if (!touched.add(part.id()) || leaves.containsKey(part.id())) throw new IllegalArgumentException("Duplicate part.");
                        leaves.put(part.id(), new Leaf(part.id(), positive(part.weight()), false));
                    }
                }
            }
        }
        return new ArrayList<>(leaves.values());
    }

    /** Denominator: sum of all leaves of the version, cancelled ones included (until removed). */
    public static BigDecimal total(List<Leaf> leaves) {
        return leaves.stream().map(Leaf::weight).reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    private static Leaf existing(Map<String, Leaf> leaves, String id) {
        Leaf leaf = leaves.get(id);
        if (leaf == null) throw new IllegalArgumentException("The task is not in the current scope.");
        return leaf;
    }

    private static BigDecimal positive(BigDecimal weight) {
        if (weight == null || weight.signum() <= 0) throw new IllegalArgumentException("Points must be greater than 0.");
        return weight;
    }
}
