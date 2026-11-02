import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ElasticsearchModule } from '@nestjs/elasticsearch';
import { ClientOptions } from '@elastic/elasticsearch';
import { BuscaService } from './busca.service';

@Global()
@Module({
  imports: [
    ElasticsearchModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService): ClientOptions => {
        const node = configService.getOrThrow<string>('ELASTICSEARCH_NODE');
        const username = configService.get<string>('ELASTICSEARCH_USERNAME');
        const password = configService.get<string>('ELASTICSEARCH_PASSWORD');
        const apiKey = configService.get<string>('ELASTICSEARCH_API_KEY');

        const options: ClientOptions = {
          node,
        };

        if (apiKey) {
          options.auth = { apiKey };
        } else if (username && password) {
          options.auth = { username, password };
        }

        return options;
      },
    }),
  ],
  providers: [BuscaService],
  exports: [ElasticsearchModule, BuscaService],
})
export class BuscaModule {}
