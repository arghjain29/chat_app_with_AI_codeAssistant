import { Schema, model, type HydratedDocument, type InferSchemaType } from 'mongoose';

const projectSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 60 },
    /** URL-friendly name, unique per owner (not globally, unlike v1). */
    slug: { type: String, required: true },
    description: { type: String, default: '', maxlength: 280 },
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  },
  { timestamps: true },
);

projectSchema.index({ ownerId: 1, slug: 1 }, { unique: true });

export type Project = InferSchemaType<typeof projectSchema>;
export type ProjectDoc = HydratedDocument<Project>;
export const ProjectModel = model('Project', projectSchema);
