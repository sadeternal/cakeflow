import React from 'react';
import { Input } from './input';

export const formatCPF = (value) => {
  const numbers = value.replace(/\D/g, '');
  if (numbers.length <= 3) return numbers;
  if (numbers.length <= 6) return `${numbers.slice(0, 3)}.${numbers.slice(3)}`;
  if (numbers.length <= 9) return `${numbers.slice(0, 3)}.${numbers.slice(3, 6)}.${numbers.slice(6)}`;
  return `${numbers.slice(0, 3)}.${numbers.slice(3, 6)}.${numbers.slice(6, 9)}-${numbers.slice(9, 11)}`;
};

export const formatTelefone = (value) => {
  const numbers = value.replace(/\D/g, '');
  if (numbers.length <= 2) return numbers;
  if (numbers.length <= 6) return `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`;
  if (numbers.length <= 10) return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 6)}-${numbers.slice(6)}`;
  return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7, 11)}`;
};

export const formatMoeda = (value) => {
  const numbers = value.replace(/\D/g, '');
  if (!numbers) return '';
  const amount = parseInt(numbers) / 100;
  return amount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export const CPFInput = React.forwardRef(({ value, onChange, ...props }, ref) => {
  const handleChange = (e) => {
    const formatted = formatCPF(e.target.value);
    onChange({ ...e, target: { ...e.target, value: formatted } });
  };

  return <Input ref={ref} {...props} value={value} onChange={handleChange} maxLength={14} />;
});

export const TelefoneInput = React.forwardRef(({ value, onChange, ...props }, ref) => {
  const handleChange = (e) => {
    const formatted = formatTelefone(e.target.value);
    onChange({ ...e, target: { ...e.target, value: formatted } });
  };

  return <Input ref={ref} {...props} value={value} onChange={handleChange} maxLength={15} />;
});

export const MoedaInput = React.forwardRef(({ value, onChange, ...props }, ref) => {
  const handleChange = (e) => {
    const formatted = formatMoeda(e.target.value);
    onChange({ ...e, target: { ...e.target, value: formatted } });
  };

  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">R$</span>
      <Input 
        ref={ref} 
        {...props} 
        value={value} 
        onChange={handleChange} 
        className={`pl-10 ${props.className || ''}`}
      />
    </div>
  );
});

CPFInput.displayName = 'CPFInput';
TelefoneInput.displayName = 'TelefoneInput';
MoedaInput.displayName = 'MoedaInput';