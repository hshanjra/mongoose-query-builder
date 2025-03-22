import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { Product, ProductSchema } from "./product.schema";
import { ProductController } from "./product.controller";
import { QueryBuilderService } from "./query-builder.service";

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Product.name, schema: ProductSchema }]),
  ],
  controllers: [ProductController],
  providers: [QueryBuilderService],
})
export class ProductModule {}
