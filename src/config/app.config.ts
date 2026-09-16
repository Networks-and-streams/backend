import { ConfigModuleOptions } from '@nestjs/config';

import corsConfig from './loaders/cors.config';
import appConfig from './loaders/app.config';

export const appConfigModule: ConfigModuleOptions = {
  isGlobal: true,
  load: [corsConfig, appConfig],
};
