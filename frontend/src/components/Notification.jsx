import React from 'react';

const styles = {
  success: 'bg-emerald-50 border-emerald-200 text-emerald-800',
  error: 'bg-rose-50 border-rose-200 text-rose-800',
  warning: 'bg-amber-50 border-amber-200 text-amber-900',
  info: 'bg-blue-50 border-blue-200 text-blue-800',
};

const Notification = ({ type = 'info', title, message, onClose }) => {
  return (
    <div className={`border rounded-xl p-4 shadow-sm ${styles[type] || styles.info}`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          {title && <h4 className="font-semibold">{title}</h4>}
          {message && <p className="text-sm mt-1 leading-relaxed">{message}</p>}
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="text-sm font-medium opacity-70 hover:opacity-100"
          >
            Dismiss
          </button>
        )}
      </div>
    </div>
  );
};

export default Notification;
