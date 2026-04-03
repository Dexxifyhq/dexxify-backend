import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const connectionUrl = configService.get<string>('database.url');

        return {
          type: 'postgres' as const,
          // If DATABASE_URL is set, use it. Otherwise fall back to individual params.
          ...(connectionUrl
            ? { url: connectionUrl }
            : {
                host: configService.get<string>('database.host'),
                port: configService.get<number>('database.port'),
                username: configService.get<string>('database.username'),
                password: configService.get<string>('database.password'),
                database: configService.get<string>('database.database'),
              }),
          entities: [__dirname + '/entities/*.entity{.ts,.js}'],
          autoLoadEntities: true,
          synchronize: false, // use migrations
          logging: configService.get<string>('app.nodeEnv') === 'development',
          ssl:
            configService.get<string>('app.nodeEnv') === 'production'
              ? { rejectUnauthorized: false }
              : false,
        };
      },
    }),
  ],
})
export class DatabaseModule {}
