import { UpdateProjectInputSchema, type Project } from '@codecollab/shared';
import { useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Field, Input, Textarea } from '@/components/ui/input';
import { useUpdateProject } from '../api';
import { Section } from './section';

export function GeneralSection({ project }: { project: Project }) {
  const isOwner = project.role === 'owner';
  const update = useUpdateProject(project.id);
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description);
  const [error, setError] = useState<string>();

  const dirty = name !== project.name || description !== project.description;

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const parsed = UpdateProjectInputSchema.safeParse({ name, description });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message);
      return;
    }
    setError(undefined);
    update.mutate(parsed.data, { onSuccess: () => toast.success('Changes saved') });
  };

  return (
    <Section
      title="General"
      description={
        isOwner ? 'Shown to everyone in the project.' : 'Only the owner can change these.'
      }
    >
      <form onSubmit={onSubmit} className="grid gap-4" noValidate>
        <Field id="settings-name" label="Name" error={error}>
          <Input
            id="settings-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={60}
            disabled={!isOwner}
            aria-invalid={!!error}
          />
        </Field>
        <Field id="settings-description" label="Description">
          <Textarea
            id="settings-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={280}
            rows={3}
            disabled={!isOwner}
          />
        </Field>
        {isOwner && (
          <div className="flex justify-end gap-2">
            {dirty && (
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setName(project.name);
                  setDescription(project.description);
                  setError(undefined);
                }}
              >
                Discard
              </Button>
            )}
            <Button type="submit" disabled={!dirty || update.isPending}>
              {update.isPending ? 'Saving…' : 'Save changes'}
            </Button>
          </div>
        )}
      </form>
    </Section>
  );
}
