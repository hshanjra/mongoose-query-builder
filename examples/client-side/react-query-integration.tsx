/**
 * React Query Integration Example for Mongoose Query Builder
 * 
 * This file demonstrates how to use the Mongoose Query Builder with React Query,
 * showing a complete implementation pattern for modern React applications.
 * All query parameters are properly passed via URL query strings.
 */

// This file would typically be in a React project
// The code below is for illustration purposes

/*
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';

// API client for products
const API_URL = 'https://api.example.com/api';

// Product type definition
interface Product {
  _id: string;
  name: string;
  price: number;
  category: string;
  description?: string;
  image?: string;
  tags?: string[];
  rating?: number;
  inStock?: boolean;
  createdAt: string;
}

// Response type from the mongoose-query-builder API
interface QueryResponse<T> {
  data: T[];
  metadata: {
    totalCount: number;
    currentPage: number;
    pageSize: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
    executionTimeMs: number;
    query?: {
      filters?: Record<string, any>;
      sort?: Record<string, string>;
      pagination?: {
        page?: number;
        limit?: number;
      };
    };
  };
}

// Query options interface
interface ProductQueryOptions {
  page?: number;
  limit?: number;
  sort?: string;
  category?: string;
  search?: string;
  minPrice?: number;
  maxPrice?: number;
  tags?: string[];
  expand?: string[];
  fields?: string[];
}

/**
 * Converts the ProductQueryOptions object to URL parameters
 * This ensures all parameters are passed in the URL string,
 * not in the request body
 */
const buildUrlParams = (options: ProductQueryOptions): URLSearchParams => {
  const params = new URLSearchParams();
  
  // Add pagination
  if (options.page) params.append('page', options.page.toString());
  if (options.limit) params.append('limit', options.limit.toString());
  
  // Add sorting
  if (options.sort) params.append('sort', options.sort);
  
  // Add search
  if (options.search) {
    params.append('search', options.search);
    params.append('searchScore', 'true');
  }
  
  // Add filters
  if (options.category) params.append('category', options.category);
  if (options.minPrice) params.append('price_gte', options.minPrice.toString());
  if (options.maxPrice) params.append('price_lte', options.maxPrice.toString());
  
  // Add array parameters (each value gets its own parameter with same key)
  if (options.tags && options.tags.length > 0) {
    options.tags.forEach(tag => params.append('tags_in', tag));
  }
  
  // Add expansion/population
  if (options.expand && options.expand.length > 0) {
    options.expand.forEach(path => params.append('expand', path));
  }
  
  // Add field selection
  if (options.fields && options.fields.length > 0) {
    params.append('fields', options.fields.join(','));
  }
  
  return params;
};

// Fetch products function using URL parameters
const fetchProducts = async (options: ProductQueryOptions): Promise<QueryResponse<Product>> => {
  const params = buildUrlParams(options);
  
  // Using the params in the URL string, not request body
  const response = await axios.get(`${API_URL}/products?${params.toString()}`);
  return response.data;
};

// Alternative approach using axios params option (also puts parameters in URL)
const fetchProductsWithAxiosParams = async (options: ProductQueryOptions): Promise<QueryResponse<Product>> => {
  // For simple params, axios params object works well
  // Complex array parameters need special handling
  let params: Record<string, any> = {
    // Basic parameters
    ...(options.page && { page: options.page }),
    ...(options.limit && { limit: options.limit }),
    ...(options.sort && { sort: options.sort }),
    ...(options.search && { 
      search: options.search,
      searchScore: true 
    }),
    ...(options.category && { category: options.category }),
    ...(options.minPrice && { price_gte: options.minPrice }),
    ...(options.maxPrice && { price_lte: options.maxPrice }),
  };
  
  // For field selection - simple string format
  if (options.fields && options.fields.length > 0) {
    params.fields = options.fields.join(',');
  }
  
  // For array parameters like tags where each value gets a separate URL parameter,
  // we need to use URLSearchParams instead
  if (options.tags || options.expand) {
    const urlParams = buildUrlParams(options);
    // Use the URL string approach instead
    const response = await axios.get(`${API_URL}/products?${urlParams.toString()}`);
    return response.data;
  }
  
  // Regular axios params approach (still puts everything in URL string for GET requests)
  const response = await axios.get(`${API_URL}/products`, { params });
  return response.data;
};

// React Query hooks
export const useProducts = (options: ProductQueryOptions) => {
  return useQuery<QueryResponse<Product>, Error>({
    queryKey: ['products', options],
    queryFn: () => fetchProducts(options), // Using the URL parameter approach
    keepPreviousData: true,
  });
};

// Product search hook
export const useProductSearch = (searchTerm: string, options: Omit<ProductQueryOptions, 'search'>) => {
  return useQuery<QueryResponse<Product>, Error>({
    queryKey: ['products', 'search', searchTerm, options],
    queryFn: () => fetchProducts({ ...options, search: searchTerm }), // URL parameter approach
    enabled: searchTerm.length > 2, // Only search when term is at least 3 chars
    keepPreviousData: true,
  });
};

// Component using these hooks
export const ProductList: React.FC = () => {
  // State for query parameters
  const [queryOptions, setQueryOptions] = useState<ProductQueryOptions>({
    page: 1,
    limit: 10,
    sort: 'createdAt:desc',
    fields: ['name', 'price', 'category', 'image', 'rating'],
  });
  
  // Search state
  const [searchTerm, setSearchTerm] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  
  // Use the appropriate hook based on whether we're searching
  const { 
    data,
    isLoading,
    isError,
    error
  } = isSearching 
    ? useProductSearch(searchTerm, { ...queryOptions, sort: 'score:desc' })
    : useProducts(queryOptions);
  
  // Handler for page changes
  const handlePageChange = (newPage: number) => {
    setQueryOptions(prev => ({ ...prev, page: newPage }));
  };
  
  // Handler for category filter
  const handleCategoryChange = (category: string) => {
    setQueryOptions(prev => ({ 
      ...prev, 
      category: category || undefined,
      page: 1, // Reset to first page on filter change
    }));
  };
  
  // Handler for price range
  const handlePriceRangeChange = (min: number, max: number) => {
    setQueryOptions(prev => ({ 
      ...prev, 
      minPrice: min || undefined,
      maxPrice: max || undefined,
      page: 1, // Reset to first page on filter change
    }));
  };
  
  // Handler for tag selection (array parameter example)
  const handleTagsChange = (selectedTags: string[]) => {
    setQueryOptions(prev => ({
      ...prev,
      tags: selectedTags.length > 0 ? selectedTags : undefined,
      page: 1,
    }));
  };
  
  // Handler for sort change
  const handleSortChange = (sortOption: string) => {
    setQueryOptions(prev => ({ ...prev, sort: sortOption }));
  };
  
  // Handler for search
  const handleSearch = (term: string) => {
    setSearchTerm(term);
    setIsSearching(term.length > 0);
    setQueryOptions(prev => ({ ...prev, page: 1 })); // Reset to first page
  };
  
  // Handle errors
  if (isError) {
    return <div className="error-message">Error: {error.message}</div>;
  }
  
  // Render loading state
  if (isLoading && !data) {
    return <div className="loading">Loading products...</div>;
  }
  
  // Destructure data and metadata
  const { data: products = [], metadata = {} } = data || {};
  const { 
    totalCount = 0,
    currentPage = 1,
    totalPages = 1,
    hasNextPage = false,
    hasPrevPage = false
  } = metadata;
  
  return (
    <div className="product-list-container">
      {/* Search bar */}
      <div className="search-bar">
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Search products..."
        />
        {isSearching && (
          <button onClick={() => handleSearch('')}>Clear</button>
        )}
      </div>
      
      {/* Filters */}
      <div className="filters">
        <div className="filter-group">
          <label>Category:</label>
          <select
            value={queryOptions.category || ''}
            onChange={(e) => handleCategoryChange(e.target.value)}
          >
            <option value="">All Categories</option>
            <option value="Electronics">Electronics</option>
            <option value="Audio">Audio</option>
            <option value="Computers">Computers</option>
          </select>
        </div>
        
        <div className="filter-group">
          <label>Price Range:</label>
          <div className="price-inputs">
            <input
              type="number"
              placeholder="Min"
              value={queryOptions.minPrice || ''}
              onChange={(e) => handlePriceRangeChange(
                Number(e.target.value) || 0,
                queryOptions.maxPrice || Infinity
              )}
            />
            <span>to</span>
            <input
              type="number"
              placeholder="Max"
              value={queryOptions.maxPrice || ''}
              onChange={(e) => handlePriceRangeChange(
                queryOptions.minPrice || 0,
                Number(e.target.value) || Infinity
              )}
            />
          </div>
        </div>
        
        <div className="filter-group">
          <label>Sort By:</label>
          <select
            value={queryOptions.sort}
            onChange={(e) => handleSortChange(e.target.value)}
          >
            <option value="createdAt:desc">Newest First</option>
            <option value="price:asc">Price: Low to High</option>
            <option value="price:desc">Price: High to Low</option>
            <option value="rating:desc">Top Rated</option>
          </select>
        </div>
        
        {/* Tag filter example for array params */}
        <div className="filter-group">
          <label>Tags:</label>
          <div className="tag-options">
            {['premium', 'wireless', 'bluetooth', 'sale'].map(tag => (
              <label key={tag}>
                <input
                  type="checkbox"
                  checked={queryOptions.tags?.includes(tag) || false}
                  onChange={(e) => {
                    const currentTags = queryOptions.tags || [];
                    const newTags = e.target.checked
                      ? [...currentTags, tag]
                      : currentTags.filter(t => t !== tag);
                    handleTagsChange(newTags);
                  }}
                />
                {tag}
              </label>
            ))}
          </div>
        </div>
      </div>
      
      {/* Results summary */}
      <div className="results-summary">
        {totalCount > 0 ? (
          <p>
            Showing {products.length} of {totalCount} products
            {isSearching ? ` matching "${searchTerm}"` : ''}
          </p>
        ) : (
          <p>No products found{isSearching ? ` matching "${searchTerm}"` : ''}</p>
        )}
      </div>
      
      {/* Product grid */}
      <div className="product-grid">
        {products.map((product) => (
          <div key={product._id} className="product-card">
            {product.image && (
              <img src={product.image} alt={product.name} />
            )}
            <h3>{product.name}</h3>
            <p className="price">${product.price.toFixed(2)}</p>
            <p className="category">{product.category}</p>
            {product.rating && (
              <div className="rating">
                Rating: {product.rating.toFixed(1)}
              </div>
            )}
            {product.tags && product.tags.length > 0 && (
              <div className="tags">
                {product.tags.map(tag => (
                  <span key={tag} className="tag">{tag}</span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
      
      {/* Pagination */}
      {totalPages > 1 && (
        <div className="pagination">
          <button
            disabled={!hasPrevPage}
            onClick={() => handlePageChange(currentPage - 1)}
          >
            Previous
          </button>
          
          <span className="page-info">
            Page {currentPage} of {totalPages}
          </span>
          
          <button
            disabled={!hasNextPage}
            onClick={() => handlePageChange(currentPage + 1)}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
};

// Using the component in a parent component
export const App: React.FC = () => {
  return (
    <div className="app">
      <header>
        <h1>Product Catalog</h1>
      </header>
      <main>
        <ProductList />
      </main>
    </div>
  );
};
*/

// This code would be part of a React application
// It demonstrates how to use React Query with Mongoose Query Builder
// and properly pass all parameters via URL query strings
export {};