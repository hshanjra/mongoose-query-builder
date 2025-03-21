# Mongoose Query Builder

Mongoose Query Builder is a powerful and flexible library little inspired by GraphQL that simplifies complex MongoDB queries in Mongoose. This package provides a clean, intuitive interface for building queries with support for search, filtering, sorting, pagination, population, field selection, and more.

## Features

- **Dynamic Model Loading**: Use model names directly without importing models
- **Search**: Full-text search with score sorting and language support
- **Filtering**: Rich filtering API with comparison and logical operators
- **Default Filters**: Enforce constraints on all queries (e.g., only show published items)
- **Sorting**: Simple sorting by single or multiple fields
- **Pagination**: Built-in pagination with comprehensive metadata
- **Population**: Populate related documents with field selection
- **Field Selection**: Control which fields to include/exclude
- **Field Removal**: Remove specific fields from results
- **Restricted Fields**: Control which fields can be populated

## Installation

```bash
npm install mongoose-query-builder
```

## Basic Usage

```javascript
const { QueryBuilder } = require('mongoose-query-builder');

// Initialize the query builder
const query = new QueryBuilder();

// Execute a query
const { data, metadata } = await query.graph({
    entity: 'User',                    // Model name
    fields: ['name', 'email', 'age'],  // Fields to select
    filters: {
        age_gte: 18,                   // Filter: age >= 18
        status: 'active'               // Filter: status === 'active'
    },
    pagination: {
        page: 1,
        limit: 10
    }
});

console.log('Users:', data);
console.log('Metadata:', metadata);
```

## Query Options

### Configuration Object

```typescript
interface QueryConfig {
    entity: string;                    // Required: Mongoose model name
    fields?: string[];                 // Optional: Fields to select
    filters?: Record<string, any>;     // Optional: Query filters
    pagination?: {
        page?: number;
        limit?: number;
    };
    sort?: string | string[] | {       // Optional: Sort configuration
        field: string;
        order: 'asc' | 'desc';
    }[];
    expand?: {                         // Optional: Population configuration
        path: string;
        select?: string[];
    }[];
    fullTextSearch?: {                 // Optional: Full-text search
        searchText: string;
        language?: string;
        sortByScore?: boolean;
    };
    defaultFilters?: Record<string, any>; // Optional: Default filters
    restrictedFields?: string[];       // Optional: Fields to restrict
}
```

### Filter Operators

Support for MongoDB-style operators with a simpler syntax:

- **Comparison**
  - `_eq`: Equal to (default)
  - `_ne`: Not equal to
  - `_gt`: Greater than
  - `_gte`: Greater than or equal to
  - `_lt`: Less than
  - `_lte`: Less than or equal to
  - `_in`: Matches any value in array
  - `_nin`: Matches none of the values in array

- **Logical**
  - `_and`: Logical AND
  - `_or`: Logical OR
  - `_not`: Logical NOT

- **Array**
  - `_all`: Matches arrays with all elements
  - `_size`: Matches array size
  - `_elemMatch`: Matches array elements

Example:
```javascript
const { data } = await query.graph({
    entity: 'Product',
    filters: {
        price_gte: 100,
        price_lte: 500,
        category_in: ['electronics', 'gadgets'],
        tags_all: ['premium', 'wireless']
    }
});
```

### Sorting

Multiple formats supported:

```javascript
// String format
const { data } = await query.graph({
    entity: 'User',
    sort: 'age:desc'
});

// Array of strings
const { data } = await query.graph({
    entity: 'User',
    sort: ['age:desc', 'name:asc']
});

// Object format
const { data } = await query.graph({
    entity: 'User',
    sort: [
        { field: 'age', order: 'desc' },
        { field: 'name', order: 'asc' }
    ]
});
```

### Field Selection

```javascript
// Array format
const { data } = await query.graph({
    entity: 'User',
    fields: ['name', 'email', 'age']
});

// String format (comma-separated)
const { data } = await query.graph({
    entity: 'User',
    fields: 'name,email,age'
});
```

### Population (Expanding Relations)

```javascript
const { data } = await query.graph({
    entity: 'Post',
    expand: [
        {
            path: 'author',
            select: ['name', 'email']
        },
        {
            path: 'comments',
            select: ['content', 'createdAt']
        }
    ]
});
```

### Full-Text Search

```javascript
const { data } = await query.graph({
    entity: 'Product',
    fullTextSearch: {
        searchText: 'wireless headphones',
        language: 'english',
        sortByScore: true
    },
    filters: {
        price_lt: 1000
    }
});
```

### Express Integration

```javascript
const express = require('express');
const { QueryBuilder, queryBuilderMiddleware } = require('mongoose-query-builder');

const app = express();

// Apply middleware to parse query parameters
app.use(queryBuilderMiddleware({
    maxLimit: 50,
    defaultLimit: 20
}));

app.get('/api/products', async (req, res) => {
    try {
        const query = new QueryBuilder();
        const { data, metadata } = await query.graph({
            entity: 'Product',
            ...req.queryOptions
        });
        res.json({ data, metadata });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});
```

### Response Format

```javascript
{
    "data": [/* Array of documents matching the query */],
    "metadata": {
        "totalCount": 100,        // Total matching documents
        "currentPage": 1,         // Current page number
        "pageSize": 10,          // Items per page
        "totalPages": 10,        // Total number of pages
        "hasNextPage": true,     // Whether there are more pages
        "hasPrevPage": false,    // Whether there are previous pages
        "executionTimeMs": 45,   // Query execution time
        "query": {               // Original query parameters
            "filters": {},
            "sort": {},
            "pagination": {},
            "fields": [],
            "fullTextSearch": {}
        }
    }
}
```

## Contributing

Contributions are welcome! Please feel free to submit a pull request.

## License

This project is licensed under the MIT License.