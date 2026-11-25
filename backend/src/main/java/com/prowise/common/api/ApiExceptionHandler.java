package com.prowise.common.api;

import java.util.List;

import jakarta.servlet.http.HttpServletRequest;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authorization.AuthorizationDeniedException;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.validation.BindException;
import org.springframework.web.ErrorResponseException;
import org.springframework.web.HttpMediaTypeNotSupportedException;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.bind.MissingRequestHeaderException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.HandlerMethodValidationException;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.servlet.NoHandlerFoundException;
import org.springframework.web.servlet.resource.NoResourceFoundException;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;

/** Maps every exception raised inside Spring MVC to the standard error shape. */
@RestControllerAdvice
public class ApiExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(ApiExceptionHandler.class);
    private static final PropertyNamingStrategies.NamingBase SNAKE_CASE =
            (PropertyNamingStrategies.NamingBase) PropertyNamingStrategies.SNAKE_CASE;

    @ExceptionHandler(ApiException.class)
    ResponseEntity<ApiError> handleApi(ApiException exception, HttpServletRequest request) {
        return respond(exception.status(), exception.code(), exception.getMessage(), exception.fieldErrors(), request);
    }

    /** JPA @Version conflict (task 1.4): same 409 STALE_VERSION as the JDBC expectedVersion check. */
    @ExceptionHandler(org.springframework.dao.OptimisticLockingFailureException.class)
    ResponseEntity<ApiError> handleOptimisticLock(Exception exception, HttpServletRequest request) {
        return respond(HttpStatus.CONFLICT, ErrorCodes.STALE_VERSION,
                "The record was changed by someone else. Reload and try again.", List.of(), request);
    }

    @ExceptionHandler({NoResourceFoundException.class, NoHandlerFoundException.class})
    ResponseEntity<ApiError> handleNotFound(Exception exception, HttpServletRequest request) {
        return respond(HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND, "The requested resource was not found.",
                List.of(), request);
    }

    @ExceptionHandler(HttpRequestMethodNotSupportedException.class)
    ResponseEntity<ApiError> handleMethod(HttpRequestMethodNotSupportedException exception,
            HttpServletRequest request) {
        return respond(HttpStatus.METHOD_NOT_ALLOWED, ErrorCodes.METHOD_NOT_ALLOWED,
                "This method is not allowed for the resource.", List.of(), request);
    }

    @ExceptionHandler(BindException.class) // includes MethodArgumentNotValidException
    ResponseEntity<ApiError> handleBind(BindException exception, HttpServletRequest request) {
        List<ApiError.FieldError> fieldErrors = exception.getBindingResult().getFieldErrors().stream()
                .map(error -> new ApiError.FieldError(jsonName(error.getField()), error.getDefaultMessage()))
                .toList();
        return validationFailed(fieldErrors, request);
    }

    @ExceptionHandler(HandlerMethodValidationException.class)
    ResponseEntity<ApiError> handleMethodValidation(HandlerMethodValidationException exception,
            HttpServletRequest request) {
        List<ApiError.FieldError> fieldErrors = exception.getAllValidationResults().stream()
                .flatMap(result -> result.getResolvableErrors().stream()
                        .map(error -> new ApiError.FieldError(
                                result.getMethodParameter().getParameterName(), error.getDefaultMessage())))
                .toList();
        return validationFailed(fieldErrors, request);
    }

    @ExceptionHandler(MissingServletRequestParameterException.class)
    ResponseEntity<ApiError> handleMissingParameter(MissingServletRequestParameterException exception,
            HttpServletRequest request) {
        return validationFailed(List.of(new ApiError.FieldError(exception.getParameterName(), "is required")),
                request);
    }

    @ExceptionHandler(MissingRequestHeaderException.class)
    ResponseEntity<ApiError> handleMissingHeader(MissingRequestHeaderException exception,
            HttpServletRequest request) {
        return validationFailed(List.of(new ApiError.FieldError(exception.getHeaderName(), "is required")), request);
    }

    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    ResponseEntity<ApiError> handleTypeMismatch(MethodArgumentTypeMismatchException exception,
            HttpServletRequest request) {
        return validationFailed(List.of(new ApiError.FieldError(exception.getName(), "has an invalid format")),
                request);
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    ResponseEntity<ApiError> handleUnreadable(HttpMessageNotReadableException exception,
            HttpServletRequest request) {
        return respond(HttpStatus.BAD_REQUEST, ErrorCodes.MALFORMED_REQUEST, "The request body could not be read.",
                List.of(), request);
    }

    @ExceptionHandler(HttpMediaTypeNotSupportedException.class)
    ResponseEntity<ApiError> handleMediaType(HttpMediaTypeNotSupportedException exception,
            HttpServletRequest request) {
        return respond(HttpStatus.UNSUPPORTED_MEDIA_TYPE, ErrorCodes.UNSUPPORTED_MEDIA_TYPE,
                "This content type is not supported.", List.of(), request);
    }

    @ExceptionHandler(ErrorResponseException.class) // includes ResponseStatusException
    ResponseEntity<ApiError> handleErrorResponse(ErrorResponseException exception, HttpServletRequest request) {
        HttpStatusCode status = exception.getStatusCode();
        return respond(status, codeFor(status), messageFor(status), List.of(), request);
    }

    @ExceptionHandler(AuthorizationDeniedException.class)
    ResponseEntity<ApiError> handleAuthorizationDenied(AuthorizationDeniedException exception,
            HttpServletRequest request) {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        boolean anonymous = authentication == null || authentication instanceof AnonymousAuthenticationToken;
        if (anonymous) {
            return respond(HttpStatus.UNAUTHORIZED, ErrorCodes.UNAUTHORIZED, "Authentication is required.",
                    List.of(), request);
        }
        return respond(HttpStatus.FORBIDDEN, ErrorCodes.FORBIDDEN, "You are not allowed to perform this action.",
                List.of(), request);
    }

    @ExceptionHandler(Exception.class)
    ResponseEntity<ApiError> handleUnexpected(Exception exception, HttpServletRequest request) {
        log.error("Unhandled exception on {} {}", request.getMethod(), request.getRequestURI(), exception);
        return respond(HttpStatus.INTERNAL_SERVER_ERROR, ErrorCodes.INTERNAL_ERROR, "An unexpected error occurred.",
                List.of(), request);
    }

    private ResponseEntity<ApiError> validationFailed(List<ApiError.FieldError> fieldErrors,
            HttpServletRequest request) {
        return respond(HttpStatus.BAD_REQUEST, ErrorCodes.VALIDATION_FAILED, "The request has invalid fields.",
                fieldErrors, request);
    }

    static ResponseEntity<ApiError> respond(HttpStatusCode status, String code, String message,
            List<ApiError.FieldError> fieldErrors, HttpServletRequest request) {
        String requestId = RequestIdFilter.currentRequestId(request);
        // Read by ApiErrorRecordingFilter for the API error log; the response itself is unchanged.
        request.setAttribute(ApiErrorRecordingFilter.ERROR_CODE_ATTRIBUTE, code);
        return ResponseEntity.status(status)
                .header(RequestIdFilter.REQUEST_ID_HEADER, requestId)
                .contentType(MediaType.APPLICATION_JSON)
                .body(new ApiError(code, message, requestId, fieldErrors));
    }

    static String codeFor(HttpStatusCode status) {
        if (status.is5xxServerError()) {
            return ErrorCodes.INTERNAL_ERROR;
        }
        HttpStatus known = HttpStatus.resolve(status.value());
        return known == null ? "HTTP_" + status.value() : known.name();
    }

    static String messageFor(HttpStatusCode status) {
        if (status.value() == 404) {
            return "The requested resource was not found.";
        }
        if (status.is5xxServerError()) {
            return "An unexpected error occurred.";
        }
        HttpStatus known = HttpStatus.resolve(status.value());
        return known == null ? "The request failed." : known.getReasonPhrase() + ".";
    }

    /** Report the field as the client sent it: snake_case, except the literal expectedVersion name. */
    private static String jsonName(String javaField) {
        if (ApiHeaders.EXPECTED_VERSION.equals(javaField)) {
            return javaField;
        }
        return SNAKE_CASE.translate(javaField);
    }
}
