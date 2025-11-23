import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { SwaggerTheme, SwaggerThemeNameEnum } from 'swagger-themes';

const API_DOC_PATH_PREFIX = 'docs';
const API_VERSION = '2.2.2-alpha';

export function setupSwagger(app: INestApplication) {
    const config = new DocumentBuilder()
        .setTitle('Class Buddy Backend API')
        .setDescription('API Documentation for Class Buddy')
        .setVersion(API_VERSION)
        .addBearerAuth()
        .build();

    const documentFactory = () => SwaggerModule.createDocument(app, config);

    const theme = new SwaggerTheme();

    SwaggerModule.setup(API_DOC_PATH_PREFIX, app, documentFactory, {
        customCss: theme.getBuffer(SwaggerThemeNameEnum.NORD_DARK), //White Theme use "CLASSIC"
        swaggerOptions: {
            operationsSorter: (a: any, b: any) => {
                const order = ['get', 'post', 'patch', 'put', 'delete'];
                const result =
                    order.indexOf(a.get('method')) -
                    order.indexOf(b.get('method'));
                if (result !== 0) return result;
                return a.get('path').localeCompare(b.get('path'));
            },
            tagsSorter: 'alpha',
            persistAuthorization: true,
        },
    });
}
