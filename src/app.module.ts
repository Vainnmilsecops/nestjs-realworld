import {Module} from '@nestjs/common';
import {CoreModule} from './common/core.module';

@Module({imports: [CoreModule]})
export class AppModule {}
