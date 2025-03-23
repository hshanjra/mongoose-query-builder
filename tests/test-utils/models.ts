import { Document } from "mongoose";

// User document interface for tests
export interface UserDocument extends Document {
  name: string;
  email: string;
  age: number;
  isActive: boolean;
  posts: PostDocument[];
}

// Post document interface for tests
export interface PostDocument extends Document {
  title: string;
  content: string;
  status: string;
  tags: string[];
  viewCount: number;
  author: {
    name: string;
    email?: string;
  };
  createdAt: Date;
}
