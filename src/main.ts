import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { envConfig } from './configs/env.config';
import { setupSwagger } from './infra/docs/swagger.config';
import { ZodValidationPipe } from './shared/validators/zod-validation';


async function bootstrap() {
  try {
    const app = await NestFactory.create(AppModule);

    app.enableCors({
      origin: '*',
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    });


    setupSwagger(app);
    app.useGlobalPipes(new ZodValidationPipe());

    await app.listen(envConfig.port ?? 3000);
    console.log('server is running on port', envConfig.port)

  } catch (err: any) {
    console.error(`[ERROR] : Failed to start the server ${err.message}`);
  }
}

bootstrap();
