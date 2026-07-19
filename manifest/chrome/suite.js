import { bootstrap } from '../../core/bootstrap/bootstrap.js';

bootstrap().catch((error) => {
  console.error('[CnC-TA-Suite] Fatal bootstrap failure', error);
});
