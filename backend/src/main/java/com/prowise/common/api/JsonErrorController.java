package com.prowise.common.api;

import java.util.List;

import jakarta.servlet.RequestDispatcher;
import jakarta.servlet.http.HttpServletRequest;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.web.servlet.error.ErrorController;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import io.swagger.v3.oas.annotations.Hidden;

/**
 * Replaces Spring Boot's whitelabel/BasicErrorController so failures outside Spring MVC
 * (servlet filters, container errors) still return the standard error shape, without details.
 */
@Hidden
@RestController
public class JsonErrorController implements ErrorController {

    private static final Logger log = LoggerFactory.getLogger(JsonErrorController.class);

    @RequestMapping("${server.error.path:${error.path:/error}}")
    ResponseEntity<ApiError> error(HttpServletRequest request) {
        Object statusAttribute = request.getAttribute(RequestDispatcher.ERROR_STATUS_CODE);
        HttpStatusCode status = statusAttribute instanceof Integer code
                ? HttpStatusCode.valueOf(code)
                : HttpStatus.INTERNAL_SERVER_ERROR;
        if (status.value() < 400) {
            status = HttpStatus.INTERNAL_SERVER_ERROR;
        }
        Object failure = request.getAttribute(RequestDispatcher.ERROR_EXCEPTION);
        if (failure instanceof Throwable throwable) {
            log.error("Unhandled error outside MVC (request_id={})", RequestIdFilter.currentRequestId(request),
                    throwable);
        }
        return ApiExceptionHandler.respond(status, ApiExceptionHandler.codeFor(status),
                ApiExceptionHandler.messageFor(status), List.of(), request);
    }
}
