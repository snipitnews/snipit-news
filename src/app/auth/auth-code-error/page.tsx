'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

export default function AuthCodeError() {
  const searchParams = useSearchParams();
  const error = searchParams.get('error');
  const errorDescription = searchParams.get('error_description');
  const details = searchParams.get('details');

  const getErrorMessage = () => {
    if (error?.includes('code verifier') || error?.includes('non-empty')) {
      return 'Email magic link authentication failed. This usually means the link needs to be verified differently.';
    }
    if (error === 'otp_expired') {
      return 'The magic link has expired. Please request a new one.';
    }
    if (error === 'access_denied') {
      return 'Access was denied. Please try again.';
    }
    if (error === 'session_not_found') {
      return 'Could not establish a session. Please try requesting a new magic link.';
    }
    if (errorDescription) {
      return decodeURIComponent(errorDescription).replace(/\+/g, ' ');
    }
    if (error) {
      return decodeURIComponent(error).replace(/\+/g, ' ');
    }
    return 'There was an error with your authentication link.';
  };

  return (
    <div className="min-h-screen bg-[#1a1a1a] flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-[#1a1a1a] border border-[#FFA500]/20 rounded-lg p-8 text-center">
        <div className="w-16 h-16 bg-red-900/20 border border-red-500/30 rounded-full flex items-center justify-center mx-auto mb-4">
          <span className="text-2xl">⚠️</span>
        </div>
        <h1 className="text-2xl font-medium text-white mb-4">
          Authentication Error
        </h1>
        <p className="text-gray-400 mb-6">
          {getErrorMessage()}
        </p>
        {details && (
          <div className="mb-6 p-4 bg-yellow-900/20 border border-yellow-500/30 rounded-lg">
            <p className="text-sm text-yellow-400">
              <strong>Details:</strong> {decodeURIComponent(details).replace(/\+/g, ' ')}
            </p>
          </div>
        )}
        <ul className="text-left text-sm text-gray-400 mb-6 space-y-2">
          <li>• The link may have expired (links expire after 1 hour)</li>
          <li>• The link may have already been used</li>
          <li>• There may be a configuration issue</li>
          <li>• Check the browser console for detailed debugging information</li>
        </ul>
        <div className="space-y-3">
          <Link
            href="/"
            className="inline-block w-full bg-gradient-to-r from-[#FFA500] to-[#FF6B47] text-[#1a1a1a] px-6 py-2 rounded-lg hover:from-[#FFD700] hover:to-[#FFA500] transition-all font-medium"
          >
            Request New Magic Link
          </Link>
          {error && (
            <div className="mt-4 p-3 bg-[#1a1a1a] border border-[#FFA500]/20 rounded text-left">
              <p className="text-xs text-gray-400 font-mono break-all">
                <strong>Error:</strong> {decodeURIComponent(error).replace(/\+/g, ' ')}
              </p>
              {errorDescription && (
                <p className="text-xs text-gray-400 font-mono break-all mt-2">
                  <strong>Description:</strong> {decodeURIComponent(errorDescription).replace(/\+/g, ' ')}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
