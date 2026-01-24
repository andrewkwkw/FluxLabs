import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  icon?: React.ReactNode;
}

export const Input: React.FC<InputProps> = ({ label, icon, className = '', ...props }) => {
  return (
    <div className="mb-4">
      <label className="block text-gray-300 text-sm font-bold mb-2">{label}</label>
      <div className="relative">
        {icon && (
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-500">
            {icon}
          </div>
        )}
        <input
          className={`bg-[#1a1a1a] border border-[#333] text-white text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 ${icon ? 'pl-10' : ''} ${className} placeholder-gray-600 focus:outline-none focus:border-gray-500 transition-colors`}
          {...props}
        />
      </div>
    </div>
  );
};