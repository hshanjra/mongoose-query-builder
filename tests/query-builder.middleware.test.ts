import { Request, Response, NextFunction } from 'express';
import { createTestServer } from './test-utils/setup';
import request from 'supertest';
import { Server } from 'http';
import { Express } from 'express';

describe('Query Builder Middleware', () => {
    let app: Express;
    let server: Server;
    let cleanup: () => Promise<void>;

    beforeAll(async () => {
        const testEnv = await createTestServer();
        app = testEnv.app;
        server = testEnv.server;
        cleanup = testEnv.cleanup;
    });

    afterAll(async () => {
        await cleanup();
    });

    it('should parse empty query parameters correctly', async () => {
        const response = await request(app)
            .get('/test')
            .expect(200);

        expect(response.body.queryOptions).toBeDefined();
        expect(response.body.queryOptions.filters).toEqual({});
        expect(response.body.queryOptions.sort).toBeUndefined();
        expect(response.body.queryOptions.pagination).toEqual({ page: 1, limit: 10 });
    });

    it('should parse filters correctly', async () => {
        const response = await request(app)
            .get('/test')
            .query({
                price_gte: '100',
                price_lte: '500',
                category: 'electronics',
                tags_in: 'phone,tablet'
            })
            .expect(200);

        expect(response.body.queryOptions.filters).toEqual({
            price_gte: 100,
            price_lte: 500,
            category: 'electronics',
            tags_in: ['phone', 'tablet']
        });
    });

    it('should parse sorting parameters correctly', async () => {
        const response = await request(app)
            .get('/test')
            .query({
                sort: 'price:desc,name:asc'
            })
            .expect(200);

        expect(response.body.queryOptions.sort).toEqual([
            { field: 'price', order: 'desc' },
            { field: 'name', order: 'asc' }
        ]);
    });

    it('should handle pagination parameters', async () => {
        const response = await request(app)
            .get('/test')
            .query({
                page: '2',
                limit: '20'
            })
            .expect(200);

        expect(response.body.queryOptions.pagination).toEqual({
            page: 2,
            limit: 20
        });
    });

    it('should handle field selection', async () => {
        const response = await request(app)
            .get('/test')
            .query({
                fields: 'name,price,category'
            })
            .expect(200);

        expect(response.body.queryOptions.fields).toEqual(['name', 'price', 'category']);
    });

    it('should handle population/expand parameters', async () => {
        const response = await request(app)
            .get('/test')
            .query({
                expand: 'author,comments'
            })
            .expect(200);

        expect(response.body.queryOptions.expand).toEqual([
            { path: 'author' },
            { path: 'comments' }
        ]);
    });

    it('should handle complex expand parameters with field selection', async () => {
        const response = await request(app)
            .get('/test')
            .query({
                expand: 'author(name,email),comments(text,date)'
            })
            .expect(200);

        expect(response.body.queryOptions.expand).toEqual([
            { path: 'author', select: ['name', 'email'] },
            { path: 'comments', select: ['text', 'date'] }
        ]);
    });

    it('should handle full-text search parameters', async () => {
        const response = await request(app)
            .get('/test')
            .query({
                search: 'test query',
                searchLanguage: 'english',
                searchScore: 'true'
            })
            .expect(200);

        expect(response.body.queryOptions.fullTextSearch).toEqual({
            searchText: 'test query',
            language: 'english',
            sortByScore: true
        });
    });

    it('should handle invalid query parameters gracefully', async () => {
        const response = await request(app)
            .get('/test')
            .query({
                page: 'invalid',
                limit: 'invalid',
                sort: 'invalid:direction'
            })
            .expect(200);

        expect(response.body.queryOptions.pagination).toEqual({ page: 1, limit: 10 });
        expect(response.body.queryOptions.sort).toBeUndefined();
    });
});