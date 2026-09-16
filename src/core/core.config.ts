import { ClsModuleOptions } from 'nestjs-cls';
import { ThrottlerModuleOptions } from '@nestjs/throttler';

export const clsModuleConfig: ClsModuleOptions = {
  global: true,
  middleware: {
    mount: true,
  },
};

export const throttlerConfig: ThrottlerModuleOptions = [
  {
    name: 'default',
    ttl: 60000,
    limit: 100,
  },
];
