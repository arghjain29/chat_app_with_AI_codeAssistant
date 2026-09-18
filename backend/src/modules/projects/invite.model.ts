import { Schema, model, type HydratedDocument, type InferSchemaType } from 'mongoose';

const inviteSchema = new Schema(
  {
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    /** SHA-256 of the token in the link. A database leak can't be turned into working invites. */
    tokenHash: { type: String, required: true, unique: true },
    role: { type: String, enum: ['editor', 'viewer'], required: true },
    expiresAt: { type: Date, required: true },
    maxUses: { type: Number, default: null },
    uses: { type: Number, default: 0 },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    revokedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

// Let MongoDB clean up invites a day after they expire.
inviteSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 24 * 60 * 60 });

export type Invite = InferSchemaType<typeof inviteSchema>;
export type InviteDoc = HydratedDocument<Invite>;
export const InviteModel = model('Invite', inviteSchema);
