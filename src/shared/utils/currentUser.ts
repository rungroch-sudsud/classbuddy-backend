import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const CurrentUser = createParamDecorator(
  (data: string | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user;

    // ใช้ @CurrentUser('user_id') → return user.user_id
    return data ? user?.[data] : user;
  },
);
