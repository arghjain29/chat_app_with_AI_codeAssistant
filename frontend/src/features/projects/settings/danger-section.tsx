import type { Project } from '@codecollab/shared';
import { useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Field, Input } from '@/components/ui/input';
import { useDeleteProject } from '../api';
import { Section } from './section';

export function DangerSection({ project }: { project: Project }) {
  const [confirm, setConfirm] = useState('');
  const del = useDeleteProject(project.id);
  const navigate = useNavigate();
  const matches = confirm.trim() === project.name;

  return (
    <Section
      tone="danger"
      title="Delete project"
      description="Removes the project, its files, chat and invite links for everyone. This can’t be undone."
    >
      <Dialog onOpenChange={(o) => !o && setConfirm('')}>
        <DialogTrigger asChild>
          <Button variant="danger">Delete this project</Button>
        </DialogTrigger>
        <DialogContent
          title={`Delete ${project.name}?`}
          description={`All ${project.memberCount} ${project.memberCount === 1 ? 'member loses' : 'members lose'} access immediately, and everything in the project is deleted.`}
        >
          <form
            className="grid gap-5"
            onSubmit={(e) => {
              e.preventDefault();
              if (!matches) return;
              del.mutate(undefined, {
                onSuccess: () => {
                  toast.success(`Deleted ${project.name}`);
                  void navigate({ to: '/dashboard' });
                },
              });
            }}
          >
            <Field id="confirm-delete" label={`Type “${project.name}” to confirm`}>
              <Input
                id="confirm-delete"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete="off"
                autoFocus
              />
            </Field>
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="secondary">
                  Cancel
                </Button>
              </DialogClose>
              <Button type="submit" variant="danger" disabled={!matches || del.isPending}>
                {del.isPending ? 'Deleting…' : 'Delete project'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Section>
  );
}
