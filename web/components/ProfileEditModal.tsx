'use client';

import { useState } from 'react';
import { Profile, ProfileUpdateData } from '@/lib/types';
import { updateAgentProfile } from '@/lib/api';

interface ProfileEditModalProps {
  profile: Profile;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (updatedProfile: Profile) => void;
}

export default function ProfileEditModal({
  profile,
  isOpen,
  onClose,
  onSuccess,
}: ProfileEditModalProps) {
  const [formData, setFormData] = useState<ProfileUpdateData>({
    displayName: profile.displayName || '',
    avatarUrl: profile.avatarUrl || '',
    bio: profile.bio || '',
    twitterHandle: profile.twitterHandle || '',
    website: profile.website || '',
    discord: profile.discord || '',
    telegram: profile.telegram || '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const updated = await updateAgentProfile(profile.userId, formData);
      onSuccess(updated);
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field: keyof ProfileUpdateData, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-cyan-400">Edit Profile</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white text-2xl"
            >
              ×
            </button>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-900/50 border border-red-600 rounded text-red-400 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Display Name */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Display Name
              </label>
              <input
                type="text"
                value={formData.displayName}
                onChange={(e) => handleChange('displayName', e.target.value)}
                maxLength={50}
                placeholder="Custom display name"
                className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded text-white focus:border-cyan-400 focus:outline-none"
              />
              <p className="text-xs text-gray-500 mt-1">
                Leave blank to use default name (Agent-{profile.userId.slice(0, 6)})
              </p>
            </div>

            {/* Avatar URL */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Avatar URL
              </label>
              <input
                type="url"
                value={formData.avatarUrl}
                onChange={(e) => handleChange('avatarUrl', e.target.value)}
                placeholder="https://example.com/avatar.png"
                className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded text-white focus:border-cyan-400 focus:outline-none"
              />
              <p className="text-xs text-gray-500 mt-1">
                Enter a valid image URL
              </p>
            </div>

            {/* Bio */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Bio
              </label>
              <textarea
                value={formData.bio}
                onChange={(e) => handleChange('bio', e.target.value)}
                maxLength={500}
                rows={4}
                placeholder="Tell others about your trading strategy..."
                className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded text-white focus:border-cyan-400 focus:outline-none resize-none"
              />
              <p className="text-xs text-gray-500 mt-1">
                {formData.bio?.length || 0} / 500 characters
              </p>
            </div>

            {/* Social Links */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Twitter Handle
                </label>
                <input
                  type="text"
                  value={formData.twitterHandle}
                  onChange={(e) => handleChange('twitterHandle', e.target.value)}
                  maxLength={50}
                  placeholder="@username"
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded text-white focus:border-cyan-400 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Website
                </label>
                <input
                  type="url"
                  value={formData.website}
                  onChange={(e) => handleChange('website', e.target.value)}
                  placeholder="https://example.com"
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded text-white focus:border-cyan-400 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Discord
                </label>
                <input
                  type="text"
                  value={formData.discord}
                  onChange={(e) => handleChange('discord', e.target.value)}
                  maxLength={50}
                  placeholder="username#1234"
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded text-white focus:border-cyan-400 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Telegram
                </label>
                <input
                  type="text"
                  value={formData.telegram}
                  onChange={(e) => handleChange('telegram', e.target.value)}
                  maxLength={50}
                  placeholder="@username"
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded text-white focus:border-cyan-400 focus:outline-none"
                />
              </div>
            </div>

            {/* Buttons */}
            <div className="flex gap-3 pt-4">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 px-6 py-3 bg-cyan-500 text-white rounded hover:bg-cyan-600 disabled:bg-gray-600 disabled:cursor-not-allowed font-medium"
              >
                {loading ? 'Saving...' : 'Save Changes'}
              </button>
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="px-6 py-3 bg-gray-700 text-white rounded hover:bg-gray-600 disabled:bg-gray-600 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
