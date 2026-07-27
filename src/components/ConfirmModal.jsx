import React from 'react';
export default function ConfirmModal({ title, message, confirmLabel = 'Confirm', onConfirm, onCancel }) {
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={title}>
      <div className="modal confirm-modal">
        <h2>{title}</h2>
        <p>{message}</p>
        <div className="confirm-actions">
          <button type="button" className="menu-button-ghost" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="menu-button-primary" onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
