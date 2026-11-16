FROM maven:3.9-eclipse-temurin-21 AS build

WORKDIR /workspace
COPY backend/pom.xml backend/pom.xml
COPY database/migrations database/migrations
COPY backend/src backend/src
RUN mvn -f backend/pom.xml -DskipTests package

FROM eclipse-temurin:21-jre-jammy

RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/* \
    && useradd --system --uid 10001 --create-home prowise

WORKDIR /app
COPY --from=build /workspace/backend/target/*.jar /app/app.jar
RUN chown -R prowise:prowise /app

USER prowise
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD curl --fail --silent http://127.0.0.1:8080/v1/health || exit 1
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
