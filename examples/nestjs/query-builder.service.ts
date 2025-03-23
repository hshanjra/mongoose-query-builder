import { Injectable } from "@nestjs/common";
import { Connection } from "mongoose";
import { InjectConnection } from "@nestjs/mongoose";
import { QueryBuilder } from "../../src";
import { GraphQueryConfig, GraphQueryResponse } from "../../src/types";

@Injectable()
export class QueryBuilderService {
  private queryBuilder: QueryBuilder;

  constructor(@InjectConnection() private connection: Connection) {
    this.queryBuilder = new QueryBuilder(connection);
  }

  /**
   * Execute a query using the provided configuration
   */
  async graph<T extends Document>(
    config: GraphQueryConfig<T>
  ): Promise<GraphQueryResponse<T>> {
    // Use model name string instead of model instance
    return this.queryBuilder.graph<T>(config);
  }
}
