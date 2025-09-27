import { applyDecorators, Type } from '@nestjs/common';
import {
    ApiOkResponse,
    ApiCreatedResponse,
    ApiNoContentResponse,
    ApiBadRequestResponse,
    ApiUnauthorizedResponse,
    ApiForbiddenResponse,
    ApiNotFoundResponse,
    ApiInternalServerErrorResponse,
} from '@nestjs/swagger';



export function CommonErrorResponses() {
    return applyDecorators(
        ApiBadRequestResponse({ description: 'Validation error' }),
        ApiUnauthorizedResponse({ description: 'Unauthorized' }),
        ApiForbiddenResponse({ description: 'Forbidden' }),
        ApiNotFoundResponse({ description: 'Not found' }),
        ApiInternalServerErrorResponse({ description: 'Internal server error' }),
    );
}


export function OkResponse(type?: Type<unknown>, description = 'OK') {
    return applyDecorators(ApiOkResponse({ description, ...(type ? { type } : {}) }));
}


export function OkArrayResponse(type: Type<unknown>, description = 'OK') {
    return applyDecorators(ApiOkResponse({ description, type, isArray: true }));
}


export function CreatedResponse(description: string, type?: Type<unknown>): MethodDecorator {
  return applyDecorators(
    ApiCreatedResponse({
      description,
      ...(type ? { type } : {}),
    }),
  );
}


export function NoContentResponse(description = 'No content') {
    return applyDecorators(ApiNoContentResponse({ description }));
}