import { Schema, model, type HydratedDocument, type InferSchemaType } from 'mongoose';
import { PLAN_IDS } from '@codecollab/shared';

const userSchema = new Schema(
  {
    clerkId: { type: String, required: true, unique: true, index: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    username: { type: String, required: true, unique: true, trim: true },
    avatarUrl: { type: String, default: null },
    plan: { type: String, enum: PLAN_IDS, default: 'free', required: true },
  },
  { timestamps: true },
);

export type User = InferSchemaType<typeof userSchema>;
export type UserDoc = HydratedDocument<User>;
export const UserModel = model('User', userSchema);
