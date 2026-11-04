import {Module} from '@nestjs/common';
import {CoreModule} from './common/core.module';
import {UsersModule} from './users/users.module';

@Module({imports: [CoreModule, UsersModule]})
export class AppModule {}
