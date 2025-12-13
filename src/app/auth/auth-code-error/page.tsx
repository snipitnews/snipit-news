'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

export default function AuthCodeError() {
  const searchParams = useSearchParams();
  const error = searchParams.get('error');
  const errorDescription = searchParams.get('error_description');

  const getErrorMessage = () => {
    if (error === 'otp_expired') {
      return 'The magic link has expired. Please request a new one.';
    }
    if (error === 'access_denied') {
      return 'Access was denied. Please try again.';
    }
    if (errorDescription) {
      return errorDescription.replace(/\+/g, ' ');
    }
    return 'There was an error with your authentication link.';
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8 text-center">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <span className="text-2xl">⚠️</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-4">
          Authentication Error
        </h1>
        <p className="text-gray-600 mb-6">
          {getErrorMessage()}
        </p>
        <ul className="text-left text-sm text-gray-600 mb-6 space-y-2">
          <li>• The link may have expired (links expire after 1 hour)</li>
          <li>• The link may have already been used</li>
          <li>• There may be a configuration issue</li>
        </ul>
        <div className="space-y-3">
          <Link
            href="/"
            className="inline-block w-full bg-gradient-to-r from-orange-400 to-orange-500 text-white px-6 py-2 rounded-lg hover:from-orange-500 hover:to-orange-600 transition-colors"
          >
            Request New Magic Link
          </Link>
          {error && (
            <p className="text-xs text-gray-500 mt-4">
              Error code: {error}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
