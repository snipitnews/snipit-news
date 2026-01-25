'use client';

import { useState } from 'react';
import Navigation from '@/components/Navigation';
import { Mail, Send, CheckCircle, AlertCircle } from 'lucide-react';

export default function ContactPage() {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    message: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const isFormValid =
    formData.firstName.trim() !== '' &&
    formData.lastName.trim() !== '' &&
    formData.email.trim() !== '' &&
    formData.message.trim() !== '' &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email);

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    // Reset status when user starts typing again
    if (submitStatus !== 'idle') {
      setSubmitStatus('idle');
      setErrorMessage('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isFormValid) return;

    setIsSubmitting(true);
    setSubmitStatus('idle');
    setErrorMessage('');

    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (response.ok) {
        setSubmitStatus('success');
        // Reset form on success
        setFormData({
          firstName: '',
          lastName: '',
          email: '',
          message: '',
        });
      } else {
        setSubmitStatus('error');
        setErrorMessage(data.error || 'Something went wrong. Please try again.');
      }
    } catch {
      setSubmitStatus('error');
      setErrorMessage('Failed to send message. Please try again later.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Navigation />
      <main className="min-h-screen bg-[#1a1a1a] py-14">
        <div className="max-w-screen-xl mx-auto px-4 md:px-8">
          {/* Header */}
          <div className="max-w-lg mx-auto space-y-3 text-center">
            <div className="flex items-center justify-center space-x-2">
              <Mail className="w-5 h-5 text-[#FFA500]" />
              <h3 className="text-[#FFA500] font-semibold">Contact</h3>
            </div>
            <p className="text-white text-3xl font-semibold sm:text-4xl">
              Get in touch
            </p>
            <p className="text-gray-400">
              We&apos;d love to hear from you! Please fill out the form below.
            </p>
          </div>

          {/* Form */}
          <div className="mt-12 max-w-lg mx-auto">
            {submitStatus === 'success' ? (
              <div className="text-center py-12 space-y-4">
                <div className="w-16 h-16 mx-auto rounded-full bg-green-500/20 flex items-center justify-center">
                  <CheckCircle className="w-8 h-8 text-green-500" />
                </div>
                <h4 className="text-xl font-semibold text-white">
                  Message sent!
                </h4>
                <p className="text-gray-400">
                  Thank you for reaching out. We&apos;ll get back to you as soon as
                  possible.
                </p>
                <button
                  onClick={() => setSubmitStatus('idle')}
                  className="mt-4 px-6 py-2 text-[#FFA500] border border-[#FFA500]/30 rounded-lg hover:bg-[#FFA500]/10 transition-colors"
                >
                  Send another message
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                {/* Name Fields */}
                <div className="flex flex-col items-center gap-y-5 gap-x-6 [&>*]:w-full sm:flex-row">
                  <div>
                    <label className="font-medium text-gray-300">
                      First name <span className="text-[#FFA500]">*</span>
                    </label>
                    <input
                      type="text"
                      name="firstName"
                      value={formData.firstName}
                      onChange={handleInputChange}
                      required
                      placeholder="John"
                      className="w-full mt-2 px-3 py-2 text-white bg-[#2a2a2a] outline-none border border-[#FFA500]/20 focus:border-[#FFA500] shadow-sm rounded-lg placeholder-gray-500 transition-colors"
                    />
                  </div>
                  <div>
                    <label className="font-medium text-gray-300">
                      Last name <span className="text-[#FFA500]">*</span>
                    </label>
                    <input
                      type="text"
                      name="lastName"
                      value={formData.lastName}
                      onChange={handleInputChange}
                      required
                      placeholder="Doe"
                      className="w-full mt-2 px-3 py-2 text-white bg-[#2a2a2a] outline-none border border-[#FFA500]/20 focus:border-[#FFA500] shadow-sm rounded-lg placeholder-gray-500 transition-colors"
                    />
                  </div>
                </div>

                {/* Email Field */}
                <div>
                  <label className="font-medium text-gray-300">
                    Email <span className="text-[#FFA500]">*</span>
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    required
                    placeholder="john@example.com"
                    className="w-full mt-2 px-3 py-2 text-white bg-[#2a2a2a] outline-none border border-[#FFA500]/20 focus:border-[#FFA500] shadow-sm rounded-lg placeholder-gray-500 transition-colors"
                  />
                </div>

                {/* Message Field */}
                <div>
                  <label className="font-medium text-gray-300">
                    Message <span className="text-[#FFA500]">*</span>
                  </label>
                  <textarea
                    name="message"
                    value={formData.message}
                    onChange={handleInputChange}
                    required
                    placeholder="How can we help you?"
                    className="w-full mt-2 h-36 px-3 py-2 resize-none text-white bg-[#2a2a2a] outline-none border border-[#FFA500]/20 focus:border-[#FFA500] shadow-sm rounded-lg placeholder-gray-500 transition-colors"
                  />
                </div>

                {/* Error Message */}
                {submitStatus === 'error' && (
                  <div className="flex items-center space-x-2 text-red-400 bg-red-400/10 px-4 py-3 rounded-lg">
                    <AlertCircle className="w-5 h-5 flex-shrink-0" />
                    <span className="text-sm">{errorMessage}</span>
                  </div>
                )}

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={!isFormValid || isSubmitting}
                  className={`w-full px-4 py-3 font-medium rounded-lg duration-150 flex items-center justify-center space-x-2 ${
                    isFormValid && !isSubmitting
                      ? 'bg-[#FFA500] text-black hover:bg-[#FFB833] active:bg-[#FFA500]'
                      : 'bg-gray-700 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  {isSubmitting ? (
                    <>
                      <svg
                        className="animate-spin h-5 w-5"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        />
                      </svg>
                      <span>Sending...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      <span>Send Message</span>
                    </>
                  )}
                </button>

                <p className="text-center text-sm text-gray-500">
                  All fields marked with <span className="text-[#FFA500]">*</span>{' '}
                  are required
                </p>
              </form>
            )}
          </div>
        </div>
      </main>
    </>
  );
}
