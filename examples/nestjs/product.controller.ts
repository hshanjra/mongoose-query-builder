import { Controller, Get } from "@nestjs/common";
import { ProductDocument } from "./product.schema";
import { QueryBuilderService } from "./query-builder.service";
import { GraphQueryConfig } from "../../src/types";
import {
  QueryParams,
  Pagination,
  Sort,
  Search,
  Fields,
  Expand,
  Filters,
} from "./query-decorators";

@Controller("products")
export class ProductController {
  constructor(private readonly queryBuilderService: QueryBuilderService) {}

  // Example 1: Using the combined QueryParams decorator
  @Get()
  async findAll(
    @QueryParams() queryParams: Partial<GraphQueryConfig<ProductDocument>>
  ) {
    return this.queryBuilderService.graph<ProductDocument>({
      entity: "Product",
      ...queryParams,
    });
  }

  // Example 2: Using individual decorators for more granular control
  @Get("search")
  async search(
    @Search() search,
    @Filters() filters,
    @Sort() sort,
    @Pagination() pagination,
    @Fields() fields,
    @Expand() expand
  ) {
    return this.queryBuilderService.graph<ProductDocument>({
      entity: "Product",
      ...(search && { fullTextSearch: search }),
      ...(filters && { filters }),
      ...(sort && { sort }),
      ...(pagination && { pagination }),
      ...(fields && { fields }),
      ...(expand && { expand }),
    });
  }

  // Example 3: Combining path parameters with query parameters
  @Get("category/:categoryId")
  async findByCategory(
    @Param("categoryId") categoryId: string,
    @QueryParams() queryParams: Partial<GraphQueryConfig<ProductDocument>>
  ) {
    return this.queryBuilderService.graph<ProductDocument>({
      entity: "Product",
      ...queryParams,
      filters: {
        ...(queryParams.filters || {}),
        category: categoryId,
      },
    });
  }

  // Example 4: Using specific decorators with default values
  @Get("featured")
  async findFeatured(
    @Pagination() pagination = { page: 1, limit: 10 },
    @Fields() fields = ["name", "price", "description", "image"]
  ) {
    return this.queryBuilderService.graph<ProductDocument>({
      entity: "Product",
      pagination,
      fields,
      filters: {
        isFeatured: true,
        isActive: true,
      },
    });
  }
}
