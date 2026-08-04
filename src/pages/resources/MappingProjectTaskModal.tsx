import { Modal } from '../../components/Modal';
import type { MappingProject } from './useMappingProjects';

interface MappingProjectTaskModalProps {
  item: MappingProject | null;
  onClose: () => void;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-[3px] py-[11px] border-b border-border last:border-b-0">
      <div className="text-[10.5px] font-bold text-muted uppercase tracking-[0.06em]">{label}</div>
      <div className="text-[14px] text-text font-semibold">{children}</div>
    </div>
  );
}

// Read-only "Task" view -- the requirements call this out as distinct from
// Edit: display region, mapping level, project title, description, link.
export function MappingProjectTaskModal({ item, onClose }: MappingProjectTaskModalProps) {
  return (
    <Modal open={item !== null} onClose={onClose} title={item?.country ?? ''}>
      {item ? (
        <>
          <Field label="Region">{item.region}</Field>
          <Field label="Mapping Level">{item.mapping_level || 'Not set'}</Field>
          <Field label="Project Description">{item.description}</Field>
          <Field label="Project Link">
            {item.url ? (
              <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-brand hover:underline">
                {item.url}
              </a>
            ) : (
              'No link'
            )}
          </Field>
        </>
      ) : null}
    </Modal>
  );
}
