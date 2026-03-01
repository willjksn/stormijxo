"use client";

import React from "react";

interface SessionEndModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  fanName?: string;
}

export function SessionEndModal({ open, onClose, onConfirm, fanName }: SessionEndModalProps) {
  if (!open) return null;
  return (
    <div className="admin-posts-overlay" role="dialog" aria-modal="true" aria-labelledby="session-end-title">
      <div className="admin-posts-modal" style={{ maxWidth: 360 }}>
        <h3 id="session-end-title" className="admin-posts-card-heading">End chat session?</h3>
        <p className="admin-posts-hint">
          {fanName ? `This will end the session with ${fanName}.` : "This will end the current chat session."}
        </p>
        <div className="admin-posts-modal-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary" onClick={onConfirm}>
            End session
          </button>
        </div>
      </div>
    </div>
  );
}
