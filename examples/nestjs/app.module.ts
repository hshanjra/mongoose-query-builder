import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { ProductModule } from "./product.module";

@Module({
  imports: [
    MongooseModule.forRoot("mongodb://localhost:27017/your-database-name", {
      // Your mongoose connection options here
    }),
    ProductModule,
    // Register other modules here
  ],
})
export class AppModule {}
