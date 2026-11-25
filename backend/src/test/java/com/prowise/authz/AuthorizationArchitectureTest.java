package com.prowise.authz;

import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.methods;
import static org.assertj.core.api.Assertions.assertThat;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;

import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.RestController;

import com.tngtech.archunit.base.DescribedPredicate;
import com.tngtech.archunit.core.domain.JavaClasses;
import com.tngtech.archunit.core.domain.JavaMethod;
import com.tngtech.archunit.core.domain.JavaModifier;
import com.tngtech.archunit.core.importer.ClassFileImporter;
import com.tngtech.archunit.core.importer.ImportOption;
import com.tngtech.archunit.lang.ArchCondition;
import com.tngtech.archunit.lang.ConditionEvents;
import com.tngtech.archunit.lang.SimpleConditionEvent;

/**
 * Every controller method declares {@code @PreAuthorize}, and the expression must fit its kind of route:
 * <ul>
 *   <li>{@code permitAll()} only for methods in {@link #PUBLIC_ENDPOINTS};</li>
 *   <li>bare {@code isAuthenticated()} only for methods in {@link #AUTHENTICATED_ONLY_ENDPOINTS};</li>
 *   <li>tenant packages must decide through {@code @permissionService} (membership + scoped grant);</li>
 *   <li>platform packages must require a platform authority and never tenant permissions.</li>
 * </ul>
 */
@Tag("NFR-06")
@Tag("T05")
class AuthorizationArchitectureTest {

    /** Unauthenticated by design: health, error rendering, sign-in/up, token refresh and password reset. */
    static final Set<String> PUBLIC_ENDPOINTS = Set.of(
            "com.prowise.common.api.HealthController.health",
            "com.prowise.common.api.JsonErrorController.error",
            "com.prowise.identity.AuthController.signup",
            "com.prowise.identity.AuthController.verifyEmail",
            "com.prowise.identity.AuthController.signin",
            "com.prowise.identity.AuthController.login",
            "com.prowise.identity.AuthController.refresh",
            "com.prowise.identity.AuthController.forgotPassword",
            "com.prowise.identity.AuthController.resetPassword",
            "com.prowise.identity.AuthController.activateAccount",
            "com.prowise.operator.auth.OperatorAuthController.login",
            "com.prowise.operator.auth.OperatorAuthController.refresh",
            "com.prowise.operator.auth.OperatorAuthController.forgotPassword",
            "com.prowise.operator.auth.OperatorAuthController.resetPassword",
            "com.prowise.operator.auth.OperatorAuthController.acceptInvitation",
            // The emailed invitation link, before an account exists: preview and create the account (single use).
            "com.prowise.org.InvitationAcceptController.publicPreview",
            "com.prowise.org.InvitationAcceptController.activate",
            // GitHub calls it without a session: authenticated by the HMAC signature of the connection's secret.
            "com.prowise.integration.github.GitHubController.webhook");

    /** Identity-level routes with no tenant object: the service itself checks membership where it matters. */
    static final Set<String> AUTHENTICATED_ONLY_ENDPOINTS = Set.of(
            "com.prowise.identity.AuthController.logout",
            "com.prowise.identity.AuthController.changePassword",
            "com.prowise.identity.AuthController.me",
            "com.prowise.identity.AuthController.sessions",
            "com.prowise.identity.AuthController.revokeSession",
            "com.prowise.identity.AuthController.revokeOtherSessions",
            "com.prowise.identity.OrganizationSwitchController.switchOrganization",
            "com.prowise.org.OrganizationController.create",
            "com.prowise.org.InvitationAcceptController.preview",
            "com.prowise.org.InvitationAcceptController.accept");

    private static final List<String> PLATFORM_PACKAGES = List.of("com.prowise.operator", "com.prowise.superadmin");
    private static final List<String> IDENTITY_PACKAGES = List.of("com.prowise.identity", "com.prowise.common");

    private static final JavaClasses CLASSES = new ClassFileImporter()
            .withImportOption(ImportOption.Predefined.DO_NOT_INCLUDE_TESTS)
            .importPackages("com.prowise");

    private static final DescribedPredicate<JavaMethod> HANDLER = DescribedPredicate.describe("controller handler",
            method -> method.getOwner().isAnnotatedWith(RestController.class)
                    && !method.getModifiers().contains(JavaModifier.PRIVATE)
                    && !method.getModifiers().contains(JavaModifier.STATIC)
                    && !method.getModifiers().contains(JavaModifier.SYNTHETIC));

    @Test
    void everyControllerMethodDeclaresPreAuthorize() {
        methods().that(HANDLER).should().beAnnotatedWith(PreAuthorize.class).check(CLASSES);
    }

    @Test
    void preAuthorizeExpressionsMatchTheRouteKind() {
        methods().that(HANDLER).and().areAnnotatedWith(PreAuthorize.class)
                .should(new ArchCondition<>("use an expression allowed for its route kind") {
                    @Override
                    public void check(JavaMethod method, ConditionEvents events) {
                        String name = method.getOwner().getName() + "." + method.getName();
                        String expression = method.getAnnotationOfType(PreAuthorize.class).value().replace(" ", "");
                        String pkg = method.getOwner().getPackageName();
                        String problem = null;
                        if (expression.contains("permitAll()") && !PUBLIC_ENDPOINTS.contains(name)) {
                            problem = "permitAll() outside PUBLIC_ENDPOINTS";
                        } else if (expression.equals("isAuthenticated()") && !AUTHENTICATED_ONLY_ENDPOINTS.contains(name)) {
                            problem = "bare isAuthenticated() outside AUTHENTICATED_ONLY_ENDPOINTS";
                        } else if (!PUBLIC_ENDPOINTS.contains(name) && !AUTHENTICATED_ONLY_ENDPOINTS.contains(name)) {
                            boolean platform = PLATFORM_PACKAGES.stream().anyMatch(pkg::startsWith);
                            boolean identity = IDENTITY_PACKAGES.stream().anyMatch(pkg::startsWith);
                            if (platform && (expression.contains("@permissionService") || !expression.contains("hasAuthority("))) {
                                problem = "platform route must require a platform authority";
                            } else if (!platform && !identity && !expression.contains("@permissionService.")) {
                                problem = "tenant route must decide through @permissionService";
                            }
                        }
                        if (problem != null) {
                            events.add(SimpleConditionEvent.violated(method, name + ": " + problem + " [" + expression + "]"));
                        }
                    }
                })
                .check(CLASSES);
    }

    @Test
    void exceptionListsOnlyNameExistingMethodsWithTheExpectedExpression() {
        List<String> stale = new ArrayList<>();
        check(PUBLIC_ENDPOINTS, "permitAll()", stale);
        check(AUTHENTICATED_ONLY_ENDPOINTS, "isAuthenticated()", stale);
        assertThat(stale).as("exception list entries that no longer match a controller method").isEmpty();
    }

    private static void check(Set<String> names, String expected, List<String> stale) {
        for (String name : names) {
            int dot = name.lastIndexOf('.');
            boolean ok = CLASSES.contain(name.substring(0, dot))
                    && CLASSES.get(name.substring(0, dot)).getMethods().stream()
                            .filter(m -> m.getName().equals(name.substring(dot + 1)))
                            .anyMatch(m -> m.isAnnotatedWith(PreAuthorize.class)
                                    && m.getAnnotationOfType(PreAuthorize.class).value().replace(" ", "").equals(expected));
            if (!ok) stale.add(name);
        }
    }
}
