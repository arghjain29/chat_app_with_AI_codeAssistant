import { Schema, model, type HydratedDocument, type InferSchemaType } from 'mongoose';
import { ROLES } from '@codecollab/shared';

/** The only source of truth for who can access a project, and how. */
const membershipSchema = new Schema(
  {
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    role: { type: String, enum: ROLES, required: true },
  },
  { timestamps: true },
);

membershipSchema.index({ projectId: 1, userId: 1 }, { unique: true });

export type Membership = InferSchemaType<typeof membershipSchema>;
export type MembershipDoc = HydratedDocument<Membership>;
export const MembershipModel = model('Membership', membershipSchema);
