import type { ButtonHTMLAttributes } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'outline' | 'danger';
}

const base = 'px-[22px] py-[9px] rounded-lg text-[13px] font-bold font-sans cursor-pointer transition-colors duration-150';

const variants: Record<NonNullable<ButtonProps['variant']>, string> = {
  primary: 'bg-brand text-white border-none hover:bg-brand-dark',
  outline:
    'bg-transparent text-brand border-[1.5px] border-brand hover:bg-brand hover:text-white disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none',
  danger: 'bg-accent text-white border-none hover:bg-[#e6454d] disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none',
};

export function Button({ variant = 'primary', className = '', ...props }: ButtonProps) {
  return <button className={`${base} ${variants[variant]} ${className}`} {...props} />;
}
