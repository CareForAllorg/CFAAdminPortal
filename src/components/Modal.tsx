import type { ReactNode } from 'react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  wide?: boolean;
}

export function Modal({ open, onClose, title, subtitle, children, wide }: ModalProps) {
  if (!open) { return null; }

  return (
    <div
      className="fixed inset-0 bg-sidebar/55 z-[200] flex items-center justify-center p-5"
      onClick={(e) => { if (e.target === e.currentTarget) { onClose(); } }}
    >
      <div className={`bg-white rounded-2xl ${wide ? 'w-[760px]' : 'w-[440px]'} max-w-full max-h-[85vh] overflow-y-auto shadow-[0_24px_60px_rgba(20,34,74,0.3)]`}>
        <div className="px-6 pt-[22px] pb-4 border-b border-border flex items-start justify-between gap-3">
          <div>
            <div className="font-heading text-[19px] text-brand tracking-[0.01em]">{title}</div>
            {subtitle ? <div className="text-[12px] text-muted mt-[3px]">{subtitle}</div> : null}
          </div>
          <button
            onClick={onClose}
            className="w-[30px] h-[30px] rounded-full border-none bg-bg text-muted flex items-center justify-center cursor-pointer shrink-0 text-[15px] transition-colors duration-150 hover:bg-accent hover:text-white"
          >
            <i className="ti ti-x" />
          </button>
        </div>
        <div className="px-6 pt-[18px] pb-6">{children}</div>
      </div>
    </div>
  );
}
