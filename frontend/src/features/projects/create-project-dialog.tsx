import { CreateProjectInputSchema } from '@codecollab/shared';
import { Link, useNavigate } from '@tanstack/react-router';
import { useState, type FormEvent, type ReactNode } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Field, Input, Textarea } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { ApiError } from '@/lib/api';
import { useCreateProject } from './api';

const TEMPLATE_OPTIONS = [
  {
    value: 'starter',
    label: 'Starter web page',
    description: 'HTML, CSS and JavaScript you can run right away',
  },
  { value: 'blank', label: 'Empty project', description: 'No files. Bring any language.' },
] as const;

export function CreateProjectDialog({ trigger }: { trigger: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [errors, setErrors] = useState<{
    name?: string;
    description?: string;
    form?: string;
    upgrade?: boolean;
  }>({});
  const create = useCreateProject();
  const navigate = useNavigate();

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.currentTarget));
    const parsed = CreateProjectInputSchema.safeParse(data);
    if (!parsed.success) {
      const f = parsed.error.flatten().fieldErrors;
      setErrors({ name: f.name?.[0], description: f.description?.[0] });
      return;
    }
    setErrors({});
    create.mutate(parsed.data, {
      onSuccess: (project) => {
        setOpen(false);
        toast.success(`Created ${project.name}`);
        void navigate({ to: '/projects/$projectId', params: { projectId: project.id } });
      },
      onError: (err) =>
        setErrors({
          form: err instanceof ApiError ? err.message : 'Couldn’t create the project. Try again.',
          upgrade: err instanceof ApiError && err.code === 'PLAN_LIMIT',
        }),
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setErrors({});
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent title="New project" description="You can invite people once it’s created.">
        <form onSubmit={onSubmit} className="grid gap-4" noValidate>
          <Field id="project-name" label="Name" error={errors.name}>
            <Input
              id="project-name"
              name="name"
              autoFocus
              maxLength={60}
              placeholder="e.g. Checkout redesign"
              aria-invalid={!!errors.name}
              aria-describedby={errors.name ? 'project-name-error' : undefined}
            />
          </Field>
          <Field
            id="project-description"
            label="Description"
            hint="Optional. Helps teammates know what this is for."
            error={errors.description}
          >
            <Textarea
              id="project-description"
              name="description"
              maxLength={280}
              rows={3}
              aria-invalid={!!errors.description}
              aria-describedby={
                errors.description ? 'project-description-error' : 'project-description-hint'
              }
            />
          </Field>
          <Field id="project-template" label="Start with">
            <Select
              id="project-template"
              name="template"
              defaultValue="starter"
              options={TEMPLATE_OPTIONS}
            />
          </Field>
          {errors.form && (
            <p role="alert" className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
              {errors.form}{' '}
              {errors.upgrade && (
                <Link
                  to="/pricing"
                  search={{ checkout: undefined }}
                  className="font-medium underline"
                >
                  See plans
                </Link>
              )}
            </p>
          )}
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="secondary">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? 'Creating…' : 'Create project'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
