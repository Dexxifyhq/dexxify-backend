import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const connectionUrl = configService.get<string>('database.pooler');

        return {
          type: 'postgres' as const,
          url: connectionUrl,
          entities: [__dirname + '/entities/*.entity{.ts,.js}'],
          autoLoadEntities: true,
          synchronize: false,
          // logging: configService.get<string>('app.nodeEnv') === 'development',
          logging: true,
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
