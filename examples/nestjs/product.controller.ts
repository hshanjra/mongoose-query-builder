import {
  Controller,
  Get,
  Query,
  InternalServerErrorException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { Product, ProductDocument } from "./product.schema";
import { QueryBuilderService } from "./query-builder.service";

@Controller("products")
export class ProductController {
  constructor(
    @InjectModel(Product.name) private productModel: Model<ProductDocument>,
    private queryBuilderService: QueryBuilderService
  ) {}

  @Get()
  async findAll(
    @Query("fields") fields?: string,
    @Query("filters") filters?: string,
    @Query("page") page?: number,
    @Query("limit") limit?: number,
    @Query("sort") sort?: string,
    @Query("expand") expand?: string,
    @Query("search") search?: string
  ) {
    try {
      // Parse query parameters
      const parsedFilters = filters ? JSON.parse(filters) : undefined;

      // Build query options
      const queryOptions = {
        fields: fields,
        filters: parsedFilters,
        pagination: { page, limit },
        sort: sort,
        expand: expand,
        ...(search
          ? {
              fullTextSearch: {
                searchText: search,
                sortByScore: true,
              },
            }
          : {}),
      };

      // Use the query builder service with the injected model
      const result = await this.queryBuilderService.query(
        this.productModel,
        queryOptions
      );

      return result;
    } catch (error) {
      console.error("Error querying products:", error);
      throw new InternalServerErrorException(
        "Failed to query products: " + error.message
      );
    }
  }
}
