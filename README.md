# Mongoose Query Builder

Mongoose Query Builder is a powerful and flexible library designed to simplify the process of building complex queries in Mongoose. This package provides a global query builder that allows developers to handle queries directly from incoming requests, making it easier to implement search, filtering, sorting, pagination, population, field selection, and more.

## Features

- **Search**: Easily implement search functionality with customizable search operators.
- **Full-Text Search**: Leverage MongoDB's text indices for efficient full-text searching.
- **Filtering**: Apply various filtering criteria to your queries using built-in filter operators.
- **Default Filters**: Enforce constraints on all queries (e.g., only show published items).
- **Sorting**: Sort query results based on specified fields and order.
- **Pagination**: Handle pagination of query results with ease.
- **Population**: Populate related documents while managing restricted fields.
- **Field Selection**: Specify which fields to include or exclude in the results.
- **Field Removal**: Remove specific fields from the results as needed.
- **Restricted Fields**: Control which fields can be populated based on your application's requirements.

## Installation

To install the Mongoose Query Builder, use npm:

```bash
npm install mongoose-query-builder
```

## Query Lifecycle

Here's how a typical query flows from browser to response using Mongoose Query Builder:

1. **Client Request**: Browser sends a request with URL-encoded query parameters
```javascript
GET /api/posts?status=published&category=tech&sort=createdAt:desc&page=1&limit=10&fields=title,content,author
```

2. **Server Processing**: Express middleware parses and transforms URL parameters into QueryBuilder options
```javascript
app.get('/api/posts', async (req, res) => {
    try {
        // Parse URL parameters into QueryBuilder options
        const queryOptions = {
            filters: {
                status: req.query.status,
                category: req.query.category
            },
            sorting: req.query.sort?.split(',').map(sortItem => {
                const [field, order] = sortItem.split(':');
                return { field, order };
            }),
            pagination: {
                page: parseInt(req.query.page) || 1,
                limit: parseInt(req.query.limit) || 10
            },
            selectFields: req.query.fields?.split(',')
        };
        
        const queryBuilder = new QueryBuilder(Post, queryOptions);
        const response = await queryBuilder.execute();
        res.json(response);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});
```

3. **Query Building**: QueryBuilder constructs the MongoDB query
4. **Execution**: Query is executed and results are processed
5. **Response**: Standardized response is sent back to client

## Query Options

### Filtering Options
```typescript
interface QueryOptions {
    // Regular filters applied based on user input
    filters?: Record<string, any>;
    
    // Default filters that are always applied
    defaultFilters?: Record<string, any>;
    
    // Sorting configuration
    sorting?: {
        field: string;
        order: 'asc' | 'desc';
    }[];
    
    // Pagination settings
    pagination?: {
        page: number;
        limit: number;
    };
    
    // Fields to select (inclusion)
    selectFields?: string[] | string;
    
    // Fields to exclude
    removeFields?: string[];
    
    // Fields that cannot be queried
    restrictedFields?: string[];
    
    // Population configuration
    populate?: {
        path: string;
        select?: string[];
    }[];
    
    // Full-text search configuration
    fullTextSearch?: {
        searchText: string;
        language?: string;
        caseSensitive?: boolean;
        diacriticSensitive?: boolean;
        sortByScore?: boolean;
    };
}
```

### Filter Operators

The following operators are supported in filter queries:

- **Comparison Operators**
  - `eq`: Equal to
  - `ne`: Not equal to
  - `gt`: Greater than
  - `gte`: Greater than or equal to
  - `lt`: Less than
  - `lte`: Less than or equal to
  - `in`: Matches any value in array
  - `nin`: Matches none of the values in array

- **Logical Operators**
  - `and`: Logical AND
  - `or`: Logical OR
  - `not`: Logical NOT

- **Text Search Operators**
  - `regex`: Regular expression match
  - `text`: Full-text search

Example of using operators:
```javascript
const queryBuilder = new QueryBuilder(Product, {
    filters: {
        price_gte: 100,        // Price >= 100
        category_in: ['electronics', 'gadgets'],  // Category is either electronics or gadgets
        name_regex: '^iPhone'  // Name starts with iPhone
    }
});
```

## Usage Examples

### Basic Query with Filtering and Sorting
```javascript
const { QueryBuilder } = require('mongoose-query-builder');

// Initialize the QueryBuilder with your Mongoose model
const queryBuilder = new QueryBuilder(YourModel, {
    filters: { status: 'active', price_gte: 100 },
    sorting: [{ field: 'createdAt', order: 'desc' }],
    pagination: { page: 1, limit: 20 },
    selectFields: ['name', 'price', 'description']
});

// Execute the query
const results = await queryBuilder.execute();
```

### Full-Text Search with Field Selection
```javascript
// First, create text indices on the fields you want to search
YourModel.schema.index({ title: 'text', description: 'text' });

const queryBuilder = new QueryBuilder(YourModel, {
    fullTextSearch: {
        searchText: 'mongodb text search',
        sortByScore: true,
        language: 'english'
    },
    selectFields: ['title', 'description', 'score'],
    pagination: { page: 1, limit: 10 }
});

const results = await queryBuilder.execute();
```

### Population with Field Selection
```javascript
const queryBuilder = new QueryBuilder(Post, {
    filters: { status: 'published' },
    populate: [
        { 
            path: 'author',
            select: ['name', 'email']
        },
        {
            path: 'comments',
            select: ['content', 'createdAt']
        }
    ],
    sorting: [
        { field: 'createdAt', order: 'desc' }
    ]
});

const results = await queryBuilder.execute();
```

### Query Response Format
```javascript
{
    "data": [/* Array of documents matching the query */],
    "meta": {
        "totalCount": 100,
        "currentPage": 1,
        "pageSize": 10,
        "totalPages": 10,
        "hasNextPage": true,
        "hasPrevPage": false,
        "executionTimeMs": 45,
        "query": {
            "filters": {/* Applied filters */},
            "sort": {/* Applied sorting */},
            "pagination": {/* Pagination settings */},
            "fields": {/* Selected fields */},
            "fullTextSearch": {/* Search settings if used */}
        }
    }
}
```

### Express Middleware Example
```javascript
const { queryBuilderMiddleware } = require('mongoose-query-builder');

// Apply middleware to parse query parameters
app.use(queryBuilderMiddleware);

app.get('/api/products', async (req, res) => {
    try {
        const queryBuilder = new QueryBuilder(Product, req.queryBuilder);
        const response = await queryBuilder.execute();
        res.json(response);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});
```

### Default Filters with Security
```javascript
// Enforce visibility rules on all queries
const queryBuilder = new QueryBuilder(Document, {
    defaultFilters: { 
        status: 'published',
        organizationId: req.user.organizationId // Always scope to user's org
    },
    restrictedFields: ['secretKey', 'internalNotes'], // These fields can never be queried
    filters: req.query.filters // User's filters are combined with default filters
});

const results = await queryBuilder.execute();
```

## Contributing

Contributions are welcome! Please feel free to submit a pull request or open an issue for any enhancements or bug fixes.

## License

This project is licensed under the MIT License. See the LICENSE file for more details.