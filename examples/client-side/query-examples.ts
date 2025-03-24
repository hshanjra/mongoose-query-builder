/**
 * Client-side Query Examples for Mongoose Query Builder
 * 
 * This file demonstrates how to construct and send queries to a backend API
 * that uses the mongoose-query-builder package. Examples are provided for
 * both Axios and native Fetch API.
 */

// Axios examples
import axios from 'axios';

// Base API URL - replace with your actual API endpoint
const API_BASE_URL = 'https://api.example.com';

/**
 * Basic query example with essential parameters
 */
async function fetchProductsBasic() {
  try {
    // Example 1: Simple query with basic parameters using URL query string
    // This automatically appends parameters to the URL in the format: 
    // ?page=1&limit=10&sort=price:desc&fields=name,price,category,description&category=electronics&price_gte=100&isActive=true
    const response = await axios.get(`${API_BASE_URL}/api/products`, {
      params: {
        // Pagination
        page: 1,
        limit: 10,
        
        // Sorting (single field)
        sort: 'price:desc',
        
        // Field selection
        fields: 'name,price,category,description',
        
        // Simple filtering
        category: 'electronics',
        price_gte: 100,
        isActive: true
      }
    });
    
    const { data, metadata } = response.data;
    
    console.log('Products:', data);
    console.log('Metadata:', metadata);
    
    // Example of how to use the pagination metadata
    const { currentPage, totalPages, hasNextPage } = metadata;
    console.log(`Showing page ${currentPage} of ${totalPages}`);
    
    if (hasNextPage) {
      console.log('More products available on next page');
    }
    
    return data;
  } catch (error) {
    console.error('Error fetching products:', error);
    throw error;
  }
}

/**
 * Advanced query example with complex parameters
 */
async function fetchProductsAdvanced() {
  try {
    // Example 2: Advanced query with complex filtering, sorting, expansion
    // All parameters are passed in the URL query string
    const params = {
      // Full-text search
      search: 'wireless headphones',
      searchLanguage: 'english',
      searchScore: true,
      
      // Multiple filters with operators
      price_gte: 50,
      price_lte: 500,
      category: 'electronics',
      'tags_in': 'premium,wireless,bluetooth', // Array-based filtering as comma-separated values
      status: 'active',
      
      // Multiple sorting criteria as comma-separated values
      sort: 'score:desc,price:asc',
      
      // Relationship population with field selection
      expand: 'category(name,slug),reviews(rating,comment)',
      
      // Pagination
      page: 1,
      limit: 20,
      
      // Field selection as comma-separated values
      fields: 'name,price,description,category,tags,rating'
    };

    const response = await axios.get(`${API_BASE_URL}/api/products/search`, { params });
    
    const { data, metadata } = response.data;
    
    console.log('Products matching search:', data);
    console.log('Search metadata:', metadata);
    
    // Process the search results
    const productsWithHighRating = data.filter(product => product.rating > 4);
    console.log(`Found ${productsWithHighRating.length} highly rated products`);
    
    return data;
  } catch (error) {
    console.error('Error searching products:', error);
    throw error;
  }
}

/**
 * Handling more complex scenarios with array-based parameters in URL query string
 */
async function fetchProductsWithArrayParams() {
  try {
    // For complex array parameters, we need to manually build the URL
    const urlSearchParams = new URLSearchParams();
    
    // Pagination
    urlSearchParams.append('page', '1');
    urlSearchParams.append('limit', '15');
    
    // Multiple tag filtering - each one gets added separately
    // This will create tags_in=premium&tags_in=wireless&tags_in=noise-cancelling in the URL
    urlSearchParams.append('tags_in', 'premium');
    urlSearchParams.append('tags_in', 'wireless');
    urlSearchParams.append('tags_in', 'noise-cancelling');
    
    // Price range
    urlSearchParams.append('price_gte', '100');
    urlSearchParams.append('price_lte', '300');
    
    // Status
    urlSearchParams.append('status', 'active');
    
    // Multiple category filtering - each one gets added separately
    urlSearchParams.append('category_in', 'electronics');
    urlSearchParams.append('category_in', 'audio');
    
    // Date range filtering
    urlSearchParams.append('createdAt_gte', '2024-01-01');
    urlSearchParams.append('createdAt_lte', '2024-12-31');
    
    // Make the request with manually constructed query string
    // This creates a URL like: /api/products?page=1&limit=15&tags_in=premium&tags_in=wireless&...
    const response = await axios.get(`${API_BASE_URL}/api/products?${urlSearchParams.toString()}`);
    
    const { data, metadata } = response.data;
    
    console.log('Products with array parameters:', data);
    console.log('Metadata:', metadata);
    
    return data;
  } catch (error) {
    console.error('Error with array parameters:', error);
    throw error;
  }
}

/**
 * Alternative pattern using Axios directly with URL string
 */
async function fetchProductsWithDirectUrlString() {
  try {
    // Manually constructing the query string for full visibility
    const queryString = 
      'page=1&limit=10' +
      '&sort=price:desc' +
      '&fields=name,price,category' + 
      '&category=electronics' +
      '&price_gte=100' +
      '&tags_in=premium&tags_in=wireless';  // Note multiple tags_in parameters
    
    // Direct URL string approach, avoids any risk of body parameters
    const response = await axios.get(`${API_BASE_URL}/api/products?${queryString}`);
    
    const { data, metadata } = response.data;
    console.log('Products with direct URL string:', data);
    
    return data;
  } catch (error) {
    console.error('Error fetching with direct URL string:', error);
    throw error;
  }
}

/**
 * Native Fetch API examples
 */

/**
 * Basic query using native fetch API with explicit query string
 */
async function fetchProductsWithFetch() {
  try {
    // Build the query string explicitly using URLSearchParams
    const params = new URLSearchParams({
      page: '1',
      limit: '10',
      sort: 'createdAt:desc',
      fields: 'name,price,category,image',
      category: 'electronics',
      price_gte: '100',
      isActive: 'true'
    });
    
    // Make the fetch request with the query string explicitly in the URL
    // This creates: /api/products?page=1&limit=10&sort=createdAt:desc&...
    const response = await fetch(`${API_BASE_URL}/api/products?${params.toString()}`);
    
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    
    const { data, metadata } = await response.json();
    
    console.log('Products fetched with native fetch:', data);
    console.log('Metadata:', metadata);
    
    return data;
  } catch (error) {
    console.error('Error fetching with native fetch:', error);
    throw error;
  }
}

/**
 * Advanced query using native fetch API with explicit handling of array parameters
 */
async function searchProductsWithFetch() {
  try {
    // Build complex parameters with proper array handling
    const params = new URLSearchParams();
    
    // Full-text search
    params.append('search', 'premium wireless');
    params.append('searchScore', 'true');
    
    // Filtering
    params.append('price_gte', '50');
    params.append('price_lte', '500');
    params.append('category', 'electronics');
    params.append('status', 'active');
    
    // Handle array parameters correctly by appending multiple times with the same key
    // This will generate tags_in=premium&tags_in=wireless&tags_in=bluetooth in the URL
    const tags = ['premium', 'wireless', 'bluetooth'];
    tags.forEach(tag => params.append('tags_in', tag));
    
    // Sorting (multiple) - append each sort parameter separately
    params.append('sort', 'score:desc');
    params.append('sort', 'price:asc');
    
    // Field selection
    params.append('fields', 'name,price,description,category,tags,rating');
    
    // Population/expansion
    params.append('expand', 'category(name,slug)');
    params.append('expand', 'reviews(rating,comment)');
    
    // Pagination
    params.append('page', '1');
    params.append('limit', '20');
    
    // Make the fetch request with explicit query string in the URL
    const response = await fetch(`${API_BASE_URL}/api/products/search?${params.toString()}`);
    
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    
    const { data, metadata } = await response.json();
    
    console.log('Search results with fetch:', data);
    console.log('Search metadata:', metadata);
    
    return data;
  } catch (error) {
    console.error('Error searching with fetch:', error);
    throw error;
  }
}

/**
 * Sample using direct URL string (maximum visibility)
 */
async function searchProductsWithDirectUrlString() {
  try {
    // Manually constructing the query string for full transparency
    // URL will be: /api/products/search?search=wireless&price_gte=100&sort=price:asc&expand=category
    const url = `${API_BASE_URL}/api/products/search?` + 
                `search=wireless&` +
                `price_gte=100&` +
                `price_lte=500&` +
                `tags_in=premium&tags_in=wireless&` +
                `sort=price:asc&` + 
                `expand=category(name,slug)&` +
                `page=1&limit=20`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    
    const { data, metadata } = await response.json();
    console.log('Results with direct URL string:', data);
    
    return data;
  } catch (error) {
    console.error('Error with direct URL string:', error);
    throw error;
  }
}

/**
 * React example with hooks (utilizing axios)
 */
// This is a simplified example of how you might use the query builder in a React component
function ReactQueryExample() {
  /* 
  import React, { useState, useEffect } from 'react';
  import axios from 'axios';
  
  function ProductList() {
    const [products, setProducts] = useState([]);
    const [metadata, setMetadata] = useState({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [filters, setFilters] = useState({
      category: 'electronics',
      price_gte: 100,
      isActive: true
    });
    const [pagination, setPagination] = useState({ page: 1, limit: 10 });
    const [sort, setSort] = useState('price:desc');
    
    useEffect(() => {
      async function fetchProducts() {
        try {
          setLoading(true);
          
          // All parameters are passed in URL query string via params object
          const response = await axios.get('https://api.example.com/api/products', {
            params: {
              ...filters,
              page: pagination.page,
              limit: pagination.limit,
              sort,
              fields: 'name,price,category,image'
            }
          });
          
          const { data, metadata } = response.data;
          
          setProducts(data);
          setMetadata(metadata);
          setError(null);
        } catch (err) {
          setError(err.message);
        } finally {
          setLoading(false);
        }
      }
      
      fetchProducts();
    }, [filters, pagination, sort]);
    
    // Helper to build and execute a search query with tags (array parameter example)
    const searchWithTags = async (term, tags) => {
      try {
        // For array parameters, construct query string manually
        const params = new URLSearchParams();
        
        // Add search term
        params.append('search', term);
        
        // Add pagination
        params.append('page', '1');
        params.append('limit', '20');
        
        // Add each tag as a separate tags_in parameter
        tags.forEach(tag => params.append('tags_in', tag));
        
        const response = await axios.get(`https://api.example.com/api/products/search?${params.toString()}`);
        return response.data;
      } catch (err) {
        console.error('Search error:', err);
        throw err;
      }
    };
    
    const handlePageChange = (page) => {
      setPagination(prev => ({ ...prev, page }));
    };
    
    const handleSortChange = (event) => {
      setSort(event.target.value);
    };
    
    const handleFilterChange = (name, value) => {
      setFilters(prev => ({ ...prev, [name]: value }));
      setPagination(prev => ({ ...prev, page: 1 })); // Reset to first page on filter change
    };
    
    if (loading) return <div>Loading...</div>;
    if (error) return <div>Error: {error}</div>;
    
    return (
      <div>
        <h1>Products</h1>
        
        {/* Filter controls */}
        <div className="filters">
          <select 
            value={filters.category} 
            onChange={(e) => handleFilterChange('category', e.target.value)}
          >
            <option value="electronics">Electronics</option>
            <option value="clothing">Clothing</option>
            <option value="books">Books</option>
          </select>
          
          <input
            type="number"
            value={filters.price_gte}
            onChange={(e) => handleFilterChange('price_gte', Number(e.target.value))}
            placeholder="Min Price"
          />
          
          <select 
            value={sort} 
            onChange={handleSortChange}
          >
            <option value="price:asc">Price: Low to High</option>
            <option value="price:desc">Price: High to Low</option>
            <option value="name:asc">Name: A to Z</option>
            <option value="createdAt:desc">Newest First</option>
          </select>
        </div>
        
        {/* Product list */}
        <div className="product-list">
          {products.map(product => (
            <div key={product._id} className="product-card">
              <h3>{product.name}</h3>
              <p>${product.price}</p>
              <p>Category: {product.category}</p>
            </div>
          ))}
        </div>
        
        {/* Pagination */}
        <div className="pagination">
          <button 
            disabled={!metadata.hasPrevPage} 
            onClick={() => handlePageChange(pagination.page - 1)}
          >
            Previous
          </button>
          <span>Page {metadata.currentPage} of {metadata.totalPages}</span>
          <button 
            disabled={!metadata.hasNextPage} 
            onClick={() => handlePageChange(pagination.page + 1)}
          >
            Next
          </button>
        </div>
      </div>
    );
  }
  */
}

/**
 * Angular example with HttpClient - URL parameters only
 */
function AngularQueryExample() {
  /*
  // product.service.ts
  import { Injectable } from '@angular/core';
  import { HttpClient, HttpParams } from '@angular/common/http';
  import { Observable } from 'rxjs';
  
  @Injectable({
    providedIn: 'root'
  })
  export class ProductService {
    private apiUrl = 'https://api.example.com/api/products';
    
    constructor(private http: HttpClient) {}
    
    getProducts(options: {
      filters?: any,
      pagination?: { page: number; limit: number },
      sort?: string | string[],
      fields?: string[],
      expand?: string[]
    }): Observable<any> {
      let params = new HttpParams();
      
      // Add pagination
      if (options.pagination) {
        params = params.set('page', options.pagination.page.toString());
        params = params.set('limit', options.pagination.limit.toString());
      }
      
      // Add sorting
      if (options.sort) {
        if (Array.isArray(options.sort)) {
          options.sort.forEach(sortItem => {
            params = params.append('sort', sortItem);
          });
        } else {
          params = params.set('sort', options.sort);
        }
      }
      
      // Add field selection
      if (options.fields && options.fields.length > 0) {
        params = params.set('fields', options.fields.join(','));
      }
      
      // Add expansions
      if (options.expand && options.expand.length > 0) {
        options.expand.forEach(expand => {
          params = params.append('expand', expand);
        });
      }
      
      // Add filters
      if (options.filters) {
        Object.keys(options.filters).forEach(key => {
          const value = options.filters[key];
          
          if (Array.isArray(value)) {
            // Handle array values (e.g., tags_in: ['tag1', 'tag2']) by appending multiple parameters
            value.forEach(item => {
              params = params.append(key, item);
            });
          } else {
            params = params.set(key, value.toString());
          }
        });
      }
      
      // Using only HttpParams ensures all parameters are in the URL query string
      // NOT in the request body
      return this.http.get(this.apiUrl, { params });
    }
    
    searchProducts(query: string, options: any = {}): Observable<any> {
      let params = new HttpParams();
      
      // Add search parameters
      params = params.set('search', query);
      params = params.set('searchScore', 'true');
      
      // Add other options
      if (options.filters) {
        Object.keys(options.filters).forEach(key => {
          const value = options.filters[key];
          if (Array.isArray(value)) {
            value.forEach(item => {
              params = params.append(key, item);
            });
          } else {
            params = params.set(key, value.toString());
          }
        });
      }
      
      if (options.pagination) {
        params = params.set('page', options.pagination.page.toString());
        params = params.set('limit', options.pagination.limit.toString());
      }
      
      // Using only HttpParams for URL query string params
      return this.http.get(`${this.apiUrl}/search`, { params });
    }
  }
  
  // Usage example in a component
  import { Component, OnInit } from '@angular/core';
  import { ProductService } from './product.service';
  
  @Component({
    selector: 'app-product-list',
    templateUrl: './product-list.component.html'
  })
  export class ProductListComponent implements OnInit {
    products = [];
    metadata: any = {};
    
    constructor(private productService: ProductService) {}
    
    ngOnInit() {
      // All parameters are passed as URL query parameters via HttpParams
      this.productService.getProducts({
        filters: {
          category: 'electronics',
          price_gte: 100,
          tags_in: ['premium', 'wireless'] // Will be sent as multiple URL parameters
        },
        pagination: { page: 1, limit: 10 },
        sort: 'price:desc',
        fields: ['name', 'price', 'category', 'image']
      }).subscribe(
        response => {
          this.products = response.data;
          this.metadata = response.metadata;
        }
      );
    }
  }
  */
}

/**
 * Vue example (Options API) with axios - URL parameters only
 */
function VueQueryExample() {
  /*
  // ProductList.vue
  <template>
    <div>
      <div class="filters">
        <select v-model="category" @change="resetPageAndLoad">
          <option value="electronics">Electronics</option>
          <option value="clothing">Clothing</option>
          <option value="books">Books</option>
        </select>
        
        <input 
          type="number" 
          v-model.number="minPrice" 
          @change="resetPageAndLoad" 
          placeholder="Min Price"
        />
        
        <select v-model="sortBy" @change="loadProducts">
          <option value="price:asc">Price: Low to High</option>
          <option value="price:desc">Price: High to Low</option>
          <option value="name:asc">Name: A to Z</option>
          <option value="createdAt:desc">Newest First</option>
        </select>
      </div>
      
      <div v-if="loading">Loading...</div>
      <div v-else-if="error">Error: {{ error }}</div>
      <div v-else>
        <div class="product-list">
          <div v-for="product in products" :key="product._id" class="product-card">
            <h3>{{ product.name }}</h3>
            <p>${{ product.price }}</p>
            <p>Category: {{ product.category }}</p>
          </div>
        </div>
        
        <div class="pagination">
          <button 
            :disabled="!metadata.hasPrevPage" 
            @click="prevPage"
          >
            Previous
          </button>
          <span>Page {{ metadata.currentPage }} of {{ metadata.totalPages }}</span>
          <button 
            :disabled="!metadata.hasNextPage" 
            @click="nextPage"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  </template>
  
  <script>
  import axios from 'axios';
  
  export default {
    data() {
      return {
        products: [],
        metadata: {},
        loading: true,
        error: null,
        
        // Query parameters
        currentPage: 1,
        pageSize: 10,
        sortBy: 'price:desc',
        category: 'electronics',
        minPrice: 100,
        selectedTags: [] // For array parameter example
      };
    },
    
    created() {
      this.loadProducts();
    },
    
    methods: {
      async loadProducts() {
        try {
          this.loading = true;
          
          // Basic query with all parameters in URL
          const response = await axios.get('https://api.example.com/api/products', {
            params: {
              page: this.currentPage,
              limit: this.pageSize,
              sort: this.sortBy,
              fields: 'name,price,category,image',
              category: this.category,
              price_gte: this.minPrice,
              isActive: true
            }
          });
          
          this.products = response.data.data;
          this.metadata = response.data.metadata;
          this.error = null;
        } catch (err) {
          this.error = err.message;
        } finally {
          this.loading = false;
        }
      },
      
      // Example with array parameters
      async searchWithTags() {
        try {
          this.loading = true;
          
          // For array parameters, build query string manually
          const params = new URLSearchParams();
          params.append('page', this.currentPage.toString());
          params.append('limit', this.pageSize.toString());
          params.append('category', this.category);
          
          // Add each tag as a separate parameter
          this.selectedTags.forEach(tag => {
            params.append('tags_in', tag);
          });
          
          // Make request with manually constructed query string
          const response = await axios.get(`https://api.example.com/api/products?${params.toString()}`);
          
          this.products = response.data.data;
          this.metadata = response.data.metadata;
          this.error = null;
        } catch (err) {
          this.error = err.message;
        } finally {
          this.loading = false;
        }
      },
      
      resetPageAndLoad() {
        this.currentPage = 1;
        this.loadProducts();
      },
      
      nextPage() {
        if (this.metadata.hasNextPage) {
          this.currentPage++;
          this.loadProducts();
        }
      },
      
      prevPage() {
        if (this.metadata.hasPrevPage) {
          this.currentPage--;
          this.loadProducts();
        }
      }
    }
  };
  </script>
  */
}

// Execute examples
(async () => {
  try {
    console.log('----- Basic Axios Query (URL params) -----');
    // await fetchProductsBasic();
    
    console.log('----- Advanced Axios Query (URL params) -----');
    // await fetchProductsAdvanced();
    
    console.log('----- Array Parameters Query (URL params) -----');
    // await fetchProductsWithArrayParams();
    
    console.log('----- Direct URL String Query -----');
    // await fetchProductsWithDirectUrlString();
    
    console.log('----- Basic Fetch Query (URL params) -----');
    // await fetchProductsWithFetch();
    
    console.log('----- Advanced Fetch Query (URL params) -----');
    // await searchProductsWithFetch();
    
    console.log('----- Direct URL String with Fetch -----');
    // await searchProductsWithDirectUrlString();
    
    console.log('All examples completed!');
  } catch (error) {
    console.error('Error executing examples:', error);
  }
})();

// Export examples for reuse
export {
  fetchProductsBasic,
  fetchProductsAdvanced,
  fetchProductsWithArrayParams,
  fetchProductsWithDirectUrlString,
  fetchProductsWithFetch,
  searchProductsWithFetch,
  searchProductsWithDirectUrlString
};