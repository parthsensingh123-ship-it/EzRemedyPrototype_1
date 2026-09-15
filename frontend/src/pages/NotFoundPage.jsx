import React from 'react';
import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <div className="max-w-content mx-auto px-6 py-24 text-center">
      <p className="text-sm text-faint mb-3">404</p>
      <h1 className="font-display text-3xl text-ink mb-4">This page doesn't exist.</h1>
      <p className="text-sm text-muted mb-8">Check the address, or head back to the homepage.</p>
      <Link to="/" className="btn-primary">
        Back to home
      </Link>
    </div>
  );
}
