'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { FolderKanban, Plus, Pencil, Trash2, X, Check, Layers, FileText, Search, AlertCircle } from 'lucide-react';
import { getUserCategories, updateCategory, deleteCategory, createCategory } from '@/lib/actions/categoryActions';
import { getFilteredLogs, updateCategoryNameInLogs } from '@/lib/actions/logActions';
import { CategoryTemplate } from '@/components/LogModal';

interface CategoriesClientProps {
  userId: string;
}

export default function CategoriesClient({ userId }: CategoriesClientProps) {
  const router = useRouter();
  const [categories, setCategories] = useState<CategoryTemplate[]>([]);
  const [categoryCounts, setCategoryCounts] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(true);

  // Search filter state
  const [searchQuery, setSearchQuery] = useState('');

  // Edit / Create Modal state
  const [editingCategory, setEditingCategory] = useState<CategoryTemplate | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  // Form states
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('📁');
  const [color, setColor] = useState('#3B82F6');
  const [fields, setFields] = useState<Array<{ name: string; label: string; fieldType: string; required: boolean; options?: string[]; optionsString?: string }>>([]);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  
  // User-friendly error state located inside the modal
  const [formError, setFormError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      const [fetchedCategories, fetchedLogs] = await Promise.all([
        getUserCategories(userId),
        getFilteredLogs({ userId }),
      ]);

      setCategories(fetchedCategories || []);

      // Calculate log counts per category ID
      const counts: Record<string, number> = {};
      (fetchedLogs || []).forEach((log: any) => {
        const catId = log.categoryId;
        if (catId) {
          counts[catId] = (counts[catId] || 0) + 1;
        }
      });
      setCategoryCounts(counts);
    } catch (err) {
      console.error('Failed to load categories and logs:', err);
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Filtered categories based on search query
  const filteredCategories = useMemo(() => {
    if (!searchQuery.trim()) return categories;
    const q = searchQuery.toLowerCase();
    return categories.filter((cat) => {
      const nameMatch = cat.name.toLowerCase().includes(q);
      const fieldMatch = cat.fields?.some(
        (f: any) =>
          (f.label && f.label.toLowerCase().includes(q)) ||
          (f.name && f.name.toLowerCase().includes(q)) ||
          (f.fieldType && f.fieldType.toLowerCase().includes(q))
      );
      return nameMatch || fieldMatch;
    });
  }, [categories, searchQuery]);

  const handleOpenEdit = (cat: CategoryTemplate) => {
    setEditingCategory(cat);
    setName(cat.name);
    setIcon(cat.icon || '📁');
    setColor(cat.color || '#3B82F6');
    setFields(
      ((cat.fields as any[]) || []).map((f) => ({
        ...f,
        optionsString: f.options ? f.options.join(', ') : '',
      }))
    );
    setIsCreating(false);
    setFormError(null);
  };

  const handleOpenCreate = () => {
    setEditingCategory(null);
    setName('');
    setIcon('📁');
    setColor('#3B82F6');
    setFields([]);
    setIsCreating(true);
    setFormError(null);
  };

  const handleAddField = () => {
    setFields([...fields, { name: '', label: '', fieldType: 'text', required: true, optionsString: '' }]);
  };

  const handleRemoveField = (index: number) => {
    setFields(fields.filter((_, i) => i !== index));
  };

  const handleSaveCategory = async () => {
    setFormError(null);

    if (!name.trim()) {
      setFormError('Category name is required.');
      return;
    }

    try {
      const formattedFields = fields.map((f) => ({
        name: f.name || f.label.trim().toLowerCase().replace(/\s+/g, '_'),
        label: f.label.trim(),
        fieldType: f.fieldType,
        required: f.required ?? true,
        options: f.fieldType === 'select' && f.optionsString 
          ? f.optionsString.split(',').map((o) => o.trim()).filter(Boolean) 
          : undefined,
      }));

      if (isCreating) {
        await createCategory({
          userId,
          name: name.trim(),
          icon,
          color,
          fields: formattedFields,
        });
      } else if (editingCategory) {
        await updateCategory(editingCategory._id, {
          name: name.trim(),
          icon,
          color,
          fields: formattedFields,
        });

        if (editingCategory.name !== name.trim()) {
          await updateCategoryNameInLogs(editingCategory._id, name.trim(), icon, color);
        }
      }

      window.location.reload();
    } catch (err: any) {
      console.error('Failed to save category template:', err);
      if (err.message && err.message.includes('already exists')) {
        setFormError('A category with this name already exists. Please choose a different name.');
      } else {
        setFormError(err.message || 'Could not save category template. Please try again.');
      }
    }
  };

  const handleDelete = async (catId: string) => {
    if (!window.confirm('Are you sure you want to delete this category template? Associated logs will remain as general logs.')) {
      return;
    }
    try {
      await deleteCategory(catId);
      window.location.reload();
    } catch (err) {
      console.error('Failed to delete category:', err);
    }
  };

  return (
    <div className="max-w-7xl mx-auto flex flex-col space-y-4 px-2 sm:px-4 pb-12">
      {/* Header & Add Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
        <div>
          <h1 className="text-sm sm:text-xl font-bold tracking-tight text-gray-900">Categories & Templates</h1>
        </div>

        <button
          onClick={handleOpenCreate}
          className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-semibold rounded-xl shadow-xs transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" /> Create Category
        </button>
      </div>

      {/* Search Bar for Categories & Fields */}
      <div className="relative shrink-0">
        <Search className="absolute left-3.5 top-3 w-4 h-4 text-blue-500" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search categories or custom fields (e.g., Workouts, Distance)..."
          style={{ fontSize: '16px' }}
          className="w-full pl-10 pr-4 py-2.5 bg-white border border-blue-100 rounded-xl text-gray-900 focus:outline-none focus:border-blue-500 text-xs sm:text-sm shadow-2xs"
        />
      </div>

      {/* Categories Grid */}
      {isLoading ? (
        <div className="p-12 text-center text-sm text-gray-400">Loading categories...</div>
      ) : filteredCategories.length === 0 ? (
        <div className="bg-white border border-blue-100 rounded-2xl p-12 text-center space-y-3 shadow-2xs">
          <FolderKanban className="w-12 h-12 text-blue-300 mx-auto" />
          <p className="text-sm font-medium text-gray-600">
            {categories.length === 0 ? 'No category templates created yet.' : 'No categories match your search.'}
          </p>
          {categories.length === 0 && (
            <button
              onClick={handleOpenCreate}
              className="text-xs font-semibold text-blue-600 hover:underline cursor-pointer"
            >
              Create your first category template
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCategories.map((cat) => {
            const logCount = categoryCounts[cat._id] || 0;
            return (
              <div
                key={cat._id}
                className="bg-white border border-blue-100 rounded-2xl p-5 shadow-2xs flex flex-col justify-between space-y-4 hover:border-blue-300 transition-all"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span
                      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm font-bold"
                      style={{
                        backgroundColor: cat.color ? `${cat.color}15` : '#EFF6FF',
                        color: cat.color || '#2563EB',
                      }}
                    >
                      <span className="text-lg">{cat.icon || '📁'}</span>
                      <span>{cat.name}</span>
                    </span>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleOpenEdit(cat)}
                        className="p-1.5 text-gray-400 hover:text-blue-600 rounded-lg hover:bg-blue-50 transition-colors cursor-pointer"
                        title="Edit Category"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(cat._id)}
                        className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors cursor-pointer"
                        title="Delete Category"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Associated Logs Count Badge */}
                  <div className="flex items-center gap-1.5 text-xs text-gray-500 font-medium bg-blue-50/50 px-3 py-1.5 rounded-xl border border-blue-100/60 w-fit">
                    <FileText className="w-3.5 h-3.5 text-blue-500" />
                    <span>
                      <strong className="text-gray-900">{logCount}</strong> {logCount === 1 ? 'log entry' : 'log entries'}
                    </span>
                  </div>

                  {/* Fields list preview */}
                  <div className="space-y-1.5 pt-2 border-t border-blue-50">
                    <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block">
                      Custom Fields ({cat.fields?.length || 0})
                    </span>
                    {cat.fields && cat.fields.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {cat.fields.map((f: any, idx: number) => (
                          <span
                            key={idx}
                            className="text-[11px] bg-blue-50/70 text-blue-800 px-2 py-0.5 rounded-md font-medium border border-blue-100"
                          >
                            {f.label || f.name} <span className="text-blue-400">({f.fieldType || f.type})</span>
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-gray-400 italic">No custom fields defined.</p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Edit / Create Modal */}
      {(isCreating || editingCategory) && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl flex flex-col max-h-[85vh] overflow-hidden my-auto box-border">
            {/* Modal Header */}
            <div className="px-5 sm:px-6 py-4 border-b border-blue-100 flex items-center justify-between bg-white shrink-0">
              <h2 className="text-sm sm:text-base font-bold text-blue-950 uppercase tracking-wider">
                {isCreating ? 'New Category Template' : 'Edit Category Template'}
              </h2>
              <button
                onClick={() => {
                  setIsCreating(false);
                  setEditingCategory(null);
                  setFormError(null);
                }}
                className="text-gray-400 hover:text-gray-600 p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body / Scrollable Content */}
            <div className="p-4 sm:p-6 overflow-y-auto space-y-4 flex-1 box-border">
              {/* User-friendly error message banner */}
              {formError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2.5 text-xs text-red-700 font-medium">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div className="flex items-center gap-2 relative">
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                    style={{ fontSize: '20px' }}
                    className="w-11 h-11 sm:w-12 sm:h-12 flex items-center justify-center bg-white border border-blue-100 rounded-2xl hover:bg-gray-50 cursor-pointer shadow-2xs shrink-0"
                  >
                    {icon}
                  </button>

                  {showEmojiPicker && (
                    <div className="absolute left-0 mt-2 p-2 bg-white border border-blue-100 rounded-xl shadow-xl grid grid-cols-5 gap-1.5 z-30 w-64 max-h-60 overflow-y-auto">
                      {[
                        // Original 20 emojis
                        '📁', '💼', '🏃‍♂️', '💰', '🎯', '📚', '⚡', '💡', '🔥', '🍎', 
                        '💻', '🛠️', '🎨', '✈️', '🛒', '🧘‍♂️', '🚀', '⭐', '❤️', '📅',
                        // 30 requested & diverse new emojis (5 columns layout)
                        '⛽', '💇‍♂️', '🛌', '⏰', '🧹', '🔧', '🍿', '🙏', '🍔', '💧',
                        '💊', '☕', '🚗', '💊', '🧠', '📊', '📈', '🏠', '🎮', '🎵',
                        '🐶', '🐱', '☀️', '🌙', '🎁', '📌', '🏋️‍♂️', '🥗', '🍻', '💊'
                      ].filter((emoji, index, self) => self.indexOf(emoji) === index).map((emoji) => (
                        <button
                          key={emoji}
                          type="button"
                          onClick={() => {
                            setIcon(emoji);
                            setShowEmojiPicker(false);
                          }}
                          className="h-9 flex items-center justify-center hover:bg-blue-50 rounded-lg text-xl transition-colors cursor-pointer"
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <input
                  type="text"
                  required
                  placeholder="Category Name (e.g. Workouts)"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (formError) setFormError(null);
                  }}
                  style={{ fontSize: '16px' }}
                  className="flex-1 min-w-0 px-3.5 py-2.5 sm:py-3 bg-white border border-blue-100 rounded-2xl text-gray-900 focus:outline-none focus:border-blue-500 text-xs sm:text-sm box-border"
                />

                {/* Round Color Picker */}
                <div className="relative w-11 h-11 sm:w-12 sm:h-12 flex items-center justify-center shrink-0">
                  <input
                    type="color"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    title="Category Color"
                  />
                  <div
                    className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl border-2 border-white shadow-sm transition-transform hover:scale-105 cursor-pointer"
                    style={{ backgroundColor: color }}
                  />
                </div>
              </div>

              {/* Custom Fields Section with Natural UX Flow */}
              <div className="space-y-3 pt-2">
                <div className="space-y-1">
                  <span className="text-xs font-bold text-gray-700 uppercase tracking-wider block">Custom Fields & Types</span>
                  <p className="text-[11px] text-gray-400">Define the attributes you want to track for this category.</p>
                </div>

                {/* Existing Fields List */}
                {fields.map((field, idx) => {
                  const isExistingField = editingCategory?.fields?.some(
                    (f: any) => f.name === field.name || f.label === field.label
                  );

                  return (
                    <div key={idx} className="p-3.5 sm:p-4 bg-white border border-blue-100 rounded-2xl space-y-3 shadow-2xs box-border">
                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 box-border">
                        <input
                          type="text"
                          required
                          placeholder="Field (e.g. Distance)"
                          value={field.label}
                          onChange={(e) => {
                            const updated = [...fields];
                            updated[idx].label = e.target.value;
                            setFields(updated);
                          }}
                          style={{ fontSize: '16px' }}
                          className="w-full sm:flex-1 min-w-0 px-3.5 py-2.5 bg-white border border-blue-100 rounded-xl text-gray-900 focus:outline-none focus:border-blue-500 text-xs sm:text-sm box-border"
                        />
                        <div className="flex items-center gap-2 justify-between sm:justify-start box-border">
                          <select
                            value={field.fieldType}
                            disabled={Boolean(isExistingField)}
                            onChange={(e) => {
                              const updated = [...fields];
                              updated[idx].fieldType = e.target.value;
                              setFields(updated);
                            }}
                            style={{ fontSize: '16px' }}
                            className={`flex-1 sm:w-32 px-3.5 py-2.5 border border-blue-100 rounded-xl text-xs sm:text-sm box-border ${
                              isExistingField
                                ? 'bg-gray-100 text-gray-500 cursor-not-allowed'
                                : 'bg-white text-gray-700 cursor-pointer focus:outline-none focus:border-blue-500'
                            }`}
                            title={isExistingField ? 'Field type cannot be changed once created to preserve analytics consistency' : 'Field Type'}
                          >
                            <option value="text">Text</option>
                            <option value="number">Number</option>
                            <option value="currency">Currency</option>
                            <option value="time">Time</option>
                            <option value="select">Dropdown</option>
                            <option value="checkbox">Checkbox</option>
                            <option value="date">Date</option>
                          </select>
                          <button
                            type="button"
                            onClick={() => handleRemoveField(idx)}
                            className="text-red-500 hover:text-red-700 p-2 cursor-pointer shrink-0"
                            title="Remove Field"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Dropdown Options Input */}
                      {field.fieldType === 'select' && (
                        <div>
                          <input
                            type="text"
                            placeholder="Options (comma separated, e.g. Low, Medium, High)"
                            value={field.optionsString || ''}
                            onChange={(e) => {
                              const updated = [...fields];
                              updated[idx].optionsString = e.target.value;
                              setFields(updated);
                            }}
                            style={{ fontSize: '16px' }}
                            className="w-full px-3.5 py-2 bg-blue-50/50 border border-blue-100 rounded-xl text-xs sm:text-sm text-gray-800 focus:outline-none focus:border-blue-500"
                          />
                        </div>
                      )}

                      {/* Required Field Checkbox */}
                      <div className="flex items-center justify-between pt-1 border-t border-blue-50 box-border">
                        <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={field.required ?? true}
                            onChange={(e) => {
                              const updated = [...fields];
                              updated[idx].required = e.target.checked;
                              setFields(updated);
                            }}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer w-4 h-4"
                          />
                          Required field
                        </label>

                        {isExistingField && (
                          <span className="text-[10px] text-gray-400 italic">
                            🔒 Type locked
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}

                {/* Add Field Button positioned naturally below the input fields */}
                <button
                  type="button"
                  onClick={handleAddField}
                  className="w-full py-2.5 border-2 border-dashed border-blue-200 hover:border-blue-400 rounded-xl text-xs font-semibold text-blue-600 hover:bg-blue-50/50 flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  + Add Field
                </button>
              </div>
            </div>

            {/* Modal Footer / Action Buttons */}
            <div className="px-5 sm:px-6 py-4 border-t border-blue-100 bg-white flex justify-end gap-2 shrink-0 box-border">
              <button
                type="button"
                onClick={() => {
                  setIsCreating(false);
                  setEditingCategory(null);
                  setFormError(null);
                }}
                className="px-4 py-2 border border-blue-100 rounded-xl font-medium text-xs text-gray-600 hover:bg-gray-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveCategory}
                style={{ backgroundColor: '#2563EB' }}
                className="px-4 py-2 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-xs cursor-pointer"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}