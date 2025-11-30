'use client';

import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, Eye, EyeOff, Calendar, ExternalLink, RefreshCw, Sparkles, X } from 'lucide-react';
import { useToast } from '@/components/ToastContainer';
import { authFetch } from '@/lib/authFetch';

interface PopUpAd {
  id: string;
  title: string;
  description?: string;
  image_url?: string;
  cta_text?: string;
  cta_link?: string;
  is_active: boolean;
  start_date?: string;
  end_date?: string;
  display_frequency: string;
  created_at: string;
}

export default function PopUpAdManager() {
  const [popUps, setPopUps] = useState<PopUpAd[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    image_url: '',
    cta_text: '',
    cta_link: '',
    is_active: true,
    start_date: '',
    end_date: '',
    display_frequency: 'once_per_session',
  });

  const { showSuccess, showError, showInfo } = useToast();

  useEffect(() => {
    fetchPopUps();
  }, []);

  const fetchPopUps = async () => {
    try {
      setIsLoading(true);
      const response = await authFetch('/api/admin/popup-ads');
      const result = await response.json();
      if (result.success) {
        setPopUps(result.data);
      }
    } catch (error) {
      console.error('Error fetching pop-ups:', error);
      showError('Failed to load pop-up ads');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.title.trim()) {
      showError('Title is required');
      return;
    }

    try {
      const url = editingId
        ? `/api/admin/popup-ads/${editingId}`
        : '/api/admin/popup-ads';
      
      const method = editingId ? 'PUT' : 'POST';

      const response = await authFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const result = await response.json();

      if (result.success) {
        showSuccess(editingId ? '✅ Pop-up updated!' : '✅ Pop-up created!');
        fetchPopUps();
        resetForm();
      } else {
        showError(result.error || 'Failed to save pop-up');
      }
    } catch (error) {
      console.error('Error saving pop-up:', error);
      showError('Failed to save pop-up ad');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this pop-up ad?')) return;

    try {
      const response = await authFetch(`/api/admin/popup-ads/${id}`, {
        method: 'DELETE',
      });

      const result = await response.json();
      if (result.success) {
        showSuccess('🗑️ Pop-up deleted!');
        fetchPopUps();
      } else {
        showError('Failed to delete pop-up');
      }
    } catch (error) {
      console.error('Error deleting pop-up:', error);
      showError('Failed to delete pop-up ad');
    }
  };

  const toggleActive = async (popUp: PopUpAd) => {
    try {
      const response = await authFetch(`/api/admin/popup-ads/${popUp.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...popUp, is_active: !popUp.is_active }),
      });

      const result = await response.json();
      if (result.success) {
        showInfo(popUp.is_active ? 'Pop-up deactivated' : 'Pop-up activated');
        fetchPopUps();
      }
    } catch (error) {
      console.error('Error toggling active state:', error);
      showError('Failed to update pop-up');
    }
  };

  const handleEdit = (popUp: PopUpAd) => {
    setFormData({
      title: popUp.title,
      description: popUp.description || '',
      image_url: popUp.image_url || '',
      cta_text: popUp.cta_text || '',
      cta_link: popUp.cta_link || '',
      is_active: popUp.is_active,
      start_date: popUp.start_date?.split('T')[0] || '',
      end_date: popUp.end_date?.split('T')[0] || '',
      display_frequency: popUp.display_frequency,
    });
    setEditingId(popUp.id);
    setIsCreating(true);
  };

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      image_url: '',
      cta_text: '',
      cta_link: '',
      is_active: true,
      start_date: '',
      end_date: '',
      display_frequency: 'once_per_session',
    });
    setIsCreating(false);
    setEditingId(null);
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-24 bg-white/[0.02] border border-white/[0.05] rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h2 
            className="text-2xl sm:text-3xl font-bold mb-1"
            style={{ 
              background: 'linear-gradient(45deg, white, #fb57ff)', 
              WebkitBackgroundClip: 'text', 
              WebkitTextFillColor: 'transparent', 
              backgroundClip: 'text' 
            }}
          >
            Pop-Up Ads
          </h2>
          <p className="text-sm text-gray-500">
            Manage landing page announcements and promotions
          </p>
        </div>
        
        <button
          onClick={() => setIsCreating(!isCreating)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg transition-all active:scale-95 font-semibold min-h-[44px]"
          style={{ background: 'linear-gradient(45deg, black, #fb57ff)' }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'linear-gradient(45deg, #fb57ff, black)';
            e.currentTarget.style.transform = 'scale(1.02)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'linear-gradient(45deg, black, #fb57ff)';
            e.currentTarget.style.transform = 'scale(1)';
          }}
        >
          {isCreating ? (
            <>
              <X className="w-4 h-4" />
              <span>Cancel</span>
            </>
          ) : (
            <>
              <Plus className="w-4 h-4" />
              <span>Create Pop-Up</span>
            </>
          )}
        </button>
      </div>

      {/* Create/Edit Form */}
      {isCreating && (
        <div className="bg-white/[0.02] border border-white/[0.05] rounded-lg p-6 animate-in slide-in-from-top duration-300">
          <h3 className="text-xl font-semibold text-white mb-4">
            {editingId ? 'Edit Pop-Up' : 'Create New Pop-Up'}
          </h3>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Title */}
            <div>
              <label className="block text-sm text-gray-400 mb-2 font-medium">
                Title <span style={{ color: '#fb57ff' }}>*</span>
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full bg-white/[0.02] border border-white/[0.05] text-white rounded-lg px-4 py-3 focus:outline-none focus:border-[#fb57ff]/30 transition-colors"
                placeholder="Enter pop-up title"
                required
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm text-gray-400 mb-2 font-medium">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full bg-white/[0.02] border border-white/[0.05] text-white rounded-lg px-4 py-3 h-24 focus:outline-none focus:border-[#fb57ff]/30 transition-colors resize-none"
                placeholder="Enter description (optional)"
              />
            </div>

            {/* Image URL */}
            <div>
              <label className="block text-sm text-gray-400 mb-2 font-medium">
                Image URL
              </label>
              <input
                type="url"
                value={formData.image_url}
                onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                className="w-full bg-white/[0.02] border border-white/[0.05] text-white rounded-lg px-4 py-3 focus:outline-none focus:border-[#fb57ff]/30 transition-colors"
                placeholder="https://example.com/image.jpg"
              />
              {formData.image_url && (
                <div className="mt-2 rounded-lg overflow-hidden border border-white/[0.05]">
                  <img 
                    src={formData.image_url} 
                    alt="Preview" 
                    className="w-full h-32 object-cover"
                    onError={(e) => {
                      e.currentTarget.src = '';
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                </div>
              )}
            </div>

            {/* CTA Fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-400 mb-2 font-medium">
                  Button Text
                </label>
                <input
                  type="text"
                  value={formData.cta_text}
                  onChange={(e) => setFormData({ ...formData, cta_text: e.target.value })}
                  className="w-full bg-white/[0.02] border border-white/[0.05] text-white rounded-lg px-4 py-3 focus:outline-none focus:border-[#fb57ff]/30 transition-colors"
                  placeholder="Learn More"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-2 font-medium">
                  Button Link
                </label>
                <input
                  type="url"
                  value={formData.cta_link}
                  onChange={(e) => setFormData({ ...formData, cta_link: e.target.value })}
                  className="w-full bg-white/[0.02] border border-white/[0.05] text-white rounded-lg px-4 py-3 focus:outline-none focus:border-[#fb57ff]/30 transition-colors"
                  placeholder="https://example.com"
                />
              </div>
            </div>

            {/* Date Range */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-400 mb-2 font-medium">
                  Start Date (Optional)
                </label>
                <input
                  type="date"
                  value={formData.start_date}
                  onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                  className="w-full bg-white/[0.02] border border-white/[0.05] text-white rounded-lg px-4 py-3 focus:outline-none focus:border-[#fb57ff]/30 transition-colors"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-2 font-medium">
                  End Date (Optional)
                </label>
                <input
                  type="date"
                  value={formData.end_date}
                  onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                  className="w-full bg-white/[0.02] border border-white/[0.05] text-white rounded-lg px-4 py-3 focus:outline-none focus:border-[#fb57ff]/30 transition-colors"
                />
              </div>
            </div>

            {/* Display Frequency */}
            <div>
              <label className="block text-sm text-gray-400 mb-2 font-medium">
                Display Frequency
              </label>
              <select
                value={formData.display_frequency}
                onChange={(e) => setFormData({ ...formData, display_frequency: e.target.value })}
                className="w-full bg-white/[0.02] border border-white/[0.05] text-white rounded-lg px-4 py-3 focus:outline-none focus:border-[#fb57ff]/30 transition-colors cursor-pointer"
              >
                <option value="once_per_session">Once per session</option>
                <option value="once_per_day">Once per day</option>
                <option value="every_visit">Every visit</option>
              </select>
            </div>

            {/* Active Toggle */}
            <div className="flex items-center gap-3 bg-white/[0.02] px-4 py-3 rounded-lg border border-white/[0.05]">
              <input
                type="checkbox"
                checked={formData.is_active}
                onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                className="w-5 h-5 rounded cursor-pointer"
                style={{ accentColor: '#fb57ff' }}
              />
              <label className="text-white font-medium cursor-pointer">
                Active (show to users)
              </label>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                className="flex-1 px-6 py-3 text-white rounded-lg font-semibold transition-all active:scale-95"
                style={{ background: 'linear-gradient(45deg, black, #fb57ff)' }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'linear-gradient(45deg, #fb57ff, black)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'linear-gradient(45deg, black, #fb57ff)';
                }}
              >
                {editingId ? 'Update Pop-Up' : 'Create Pop-Up'}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="px-6 py-3 bg-white/[0.05] hover:bg-white/[0.08] border border-white/[0.05] text-white rounded-lg font-semibold transition-all active:scale-95"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Pop-Up List */}
      {popUps.length === 0 ? (
        <div className="text-center py-12 animate-in zoom-in-95 duration-300">
          <div className="text-5xl mb-4">📢</div>
          <p className="text-lg text-white mb-2 font-semibold">No pop-up ads yet</p>
          <p className="text-sm text-gray-600 mb-4">Create your first pop-up to engage visitors</p>
          <button
            onClick={() => setIsCreating(true)}
            className="px-6 py-3 text-white rounded-lg font-semibold transition-all active:scale-95"
            style={{ background: 'linear-gradient(45deg, black, #fb57ff)' }}
          >
            Create Your First Pop-Up
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {popUps.map((popUp, index) => (
            <div
              key={popUp.id}
              className="bg-white/[0.02] border border-white/[0.05] hover:bg-white/[0.04] rounded-lg p-4 transition-all duration-300 animate-in slide-in-from-left"
              style={{ animationDelay: `${index * 50}ms` }}
              onMouseEnter={(e) => e.currentTarget.style.borderColor = 'rgba(251, 87, 255, 0.3)'}
              onMouseLeave={(e) => e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.05)'}
            >
              <div className="flex flex-col lg:flex-row gap-4">
                {/* Image Preview */}
                {popUp.image_url && (
                  <div className="lg:w-32 h-20 rounded-lg overflow-hidden border border-white/[0.05] flex-shrink-0">
                    <img 
                      src={popUp.image_url} 
                      alt={popUp.title} 
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <h3 className="text-lg font-bold text-white truncate">
                          {popUp.title}
                        </h3>
                        <span
                          className={`px-2 py-0.5 rounded text-xs font-semibold ${
                            popUp.is_active
                              ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                              : 'bg-gray-500/20 text-gray-400 border border-gray-500/30'
                          }`}
                        >
                          {popUp.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                      {popUp.description && (
                        <p className="text-gray-400 text-sm line-clamp-2">
                          {popUp.description}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Meta Info */}
                  <div className="flex flex-wrap gap-3 text-xs text-gray-500">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {popUp.display_frequency.replace('_', ' ')}
                    </span>
                    {popUp.cta_link && (
                      <a 
                        href={popUp.cta_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 hover:text-[#fb57ff] transition-colors"
                      >
                        <ExternalLink className="w-3 h-3" />
                        {popUp.cta_text || 'Link'}
                      </a>
                    )}
                    {(popUp.start_date || popUp.end_date) && (
                      <span>
                        {popUp.start_date && new Date(popUp.start_date).toLocaleDateString()}
                        {popUp.start_date && popUp.end_date && ' - '}
                        {popUp.end_date && new Date(popUp.end_date).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex lg:flex-col gap-2 justify-end">
                  <button
                    onClick={() => toggleActive(popUp)}
                    className="flex items-center gap-2 px-3 py-2 bg-white/[0.05] hover:bg-white/[0.08] border border-white/[0.05] text-white rounded-lg transition-all active:scale-95 text-sm"
                    title={popUp.is_active ? 'Deactivate' : 'Activate'}
                  >
                    {popUp.is_active ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                  <button
                    onClick={() => handleEdit(popUp)}
                    className="flex items-center gap-2 px-3 py-2 bg-white/[0.05] hover:bg-white/[0.08] border border-white/[0.05] text-white rounded-lg transition-all active:scale-95 text-sm"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(popUp.id)}
                    className="flex items-center gap-2 px-3 py-2 bg-red-600/20 hover:bg-red-600/30 border border-red-600/30 text-red-400 rounded-lg transition-all active:scale-95 text-sm"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}