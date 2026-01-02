// modules/auth/guards/roles.guard.ts
import {
    Injectable,
    CanActivate,
    ExecutionContext,
    ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { Role } from '../role/role.enum';

@Injectable()
export class RolesGuard implements CanActivate {
    constructor(private reflector: Reflector) {}

    canActivate(context: ExecutionContext): boolean {
        const canProceed: boolean = true;

        const requiredRoles = this.reflector.getAllAndOverride<Role[]>(
            ROLES_KEY,
            [context.getHandler(), context.getClass()],
        );

        const noRequiredRoles = !requiredRoles;

        if (noRequiredRoles) return canProceed;

        const { user } = context.switchToHttp().getRequest();
        if (!user) throw new ForbiddenException('Unauthorized');

        const hasRole = requiredRoles.includes(user.role as Role);
        if (!hasRole) {
            throw new ForbiddenException('You do not have permission (roles)');
        }

        return canProceed;
    }
}
