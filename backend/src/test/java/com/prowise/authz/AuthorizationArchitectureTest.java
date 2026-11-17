package com.prowise.authz;

import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.methods;

import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

import com.tngtech.archunit.core.domain.JavaClasses;
import com.tngtech.archunit.core.importer.ClassFileImporter;
import com.tngtech.archunit.lang.ArchRule;

@Tag("NFR-06")
class AuthorizationArchitectureTest {

    @Test
    void controllerMethodsMustDeclarePreAuthorizeUnlessWhitelisted() {
        JavaClasses classes = new ClassFileImporter()
                .importPackages("com.prowise");
        ArchRule rule = methods().that().areDeclaredInClassesThat().areAnnotatedWith(
                        org.springframework.web.bind.annotation.RestController.class)
                .and().areNotPrivate()
                .should().beAnnotatedWith(org.springframework.security.access.prepost.PreAuthorize.class);
        rule.check(classes);
    }
}
