'use client';

import { useState, useEffect } from 'react';
import { X, Trash2, AlertCircle } from 'lucide-react';
import { LogItem } from '@/components/LogCard';

export interface CategoryTemplate {
  _id: string;
  name: string;
  color?: string;
  icon?: string;
  fields?: Array<{
    key?: string;
    name?: string;
    label?: string;
    type?: string;
    fieldType?: string;
    required: boolean;
    options?: string[];
  }>;
}

interface LogModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: CategoryTemplate[];
  userId: string;
  initialData?: LogItem | null;
  onSaveLog: (logData: any, isEditing: boolean, logId?: string) => Promise<void>;
  onCreateCategory: (catData: any) => Promise<void>;
  onSuccess: () => void;
}

export default function LogModal({
  isOpen,
  onClose,
  categories,
  userId,
  initialData,
  onSaveLog,
  onCreateCategory,
  onSuccess,
}: LogModalProps) {
  const [title, setTitle] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [notes, setNotes] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [dynamicAttributes, setDynamicAttributes] = useState<Record<string, any>>({});

  // Category creation toggle, emoji, color, & fields state
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatIcon, setNewCatIcon] = useState('📁');
  const [newCatColor, setNewCatColor] = useState('#3B82F6');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [newFields, setNewFields] = useState<Array<{ label: string; type: string; required: boolean; optionsString?: string; }>>([]);
  
  // User-friendly error state
  const [formError, setFormError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (initialData) {
      setTitle(initialData.title || '');
      setSelectedCategory(initialData.categoryId || '');
      setNotes(initialData.notes || '');
      setTagsInput(initialData.tags ? initialData.tags.join(', ') : '');
      setDynamicAttributes(initialData.attributes || {});
    } else {
      setTitle('');
      setSelectedCategory('');
      setNotes('');
      setTagsInput('');
      setDynamicAttributes({});
    }
    setIsCreatingCategory(false);
    setShowEmojiPicker(false);
    setFormError(null);
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  const activeCategoryTemplate = categories.find((c) => c._id === selectedCategory);

  const handleAddFieldToNewCategory = () => {
    setNewFields([...newFields, { label: '', type: 'text', required: true, optionsString: '' }]);
  };

  const handleRemoveFieldFromNewCategory = (index: number) => {
    setNewFields(newFields.filter((_, i) => i !== index));
  };

  const handleSaveNewCategory = async () => {
    setFormError(null);
    if (!newCatName.trim()) {
      setFormError('Category name is required.');
      return;
    }

    try {
      setIsLoading(true);
      const formattedFields = newFields.map((f) => ({
        name: f.label.trim().toLowerCase().replace(/\s+/g, '_'),
        label: f.label.trim(),
        fieldType: f.type,
        required: f.required,
        options: f.type === 'select' && f.optionsString 
          ? f.optionsString.split(',').map(o => o.trim()).filter(Boolean) 
          : undefined,
      }));

      await onCreateCategory({
        userId,
        name: newCatName.trim(),
        icon: newCatIcon,
        color: newCatColor,
        fields: formattedFields,
      });

      setNewCatName('');
      setNewCatIcon('📁');
      setNewCatColor('#3B82F6');
      setNewFields([]);
      setIsCreatingCategory(false);
      setShowEmojiPicker(false);
      
      window.dispatchEvent(new CustomEvent('categoryCreated'));
      onSuccess();
    } catch (err: any) {
      console.error('Failed to create category:', err);
      if (err.message && err.message.includes('already exists')) {
        setFormError('A category with this name already exists.');
      } else {
        setFormError(err.message || 'Could not create category template.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    // 🔍 Input Validation: Check Title
    if (!title.trim()) {
      setFormError('Title is required for log entries.');
      return;
    }

    // 🔍 Input Validation: Check Required Dynamic Attributes
    if (activeCategoryTemplate?.fields && activeCategoryTemplate.fields.length > 0) {
      for (const field of activeCategoryTemplate.fields) {
        if (field.required) {
          const fieldKey = field.name || field.label.toLowerCase().replace(/\s+/g, '_');
          const val = dynamicAttributes[fieldKey];
          if (val === undefined || val === null || String(val).trim() === '') {
            setFormError(`"${field.label}" is a required field.`);
            return;
          }
        }
      }
    }

    setIsLoading(true);

    try {
      const tags = tagsInput
        ? tagsInput.split(',').map((t) => t.trim().replace(/^#/, '')).filter(Boolean)
        : [];

      const logData = {
        userId,
        categoryId: selectedCategory || undefined,
        categoryName: activeCategoryTemplate?.name || 'General',
        categoryIcon: activeCategoryTemplate?.icon || '📁',
        categoryColor: activeCategoryTemplate?.color || '#3B82F6',
        title: title.trim(),
        notes: notes.trim(),
        tags,
        attributes: dynamicAttributes,
        timestamp: new Date(),
      };

      await onSaveLog(logData, Boolean(initialData), initialData?._id);
      window.dispatchEvent(new CustomEvent('logCreated'));
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Failed to save log:', err);
      setFormError(err.message || 'Failed to save log entry.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl flex flex-col max-h-[90vh] overflow-hidden my-auto box-border">
        {/* Modal Header */}
        <div className="px-5 sm:px-6 py-4 border-b border-blue-100 flex items-center justify-between bg-white shrink-0">
          <h2 className="text-sm sm:text-base font-bold text-blue-950 uppercase tracking-wider">
            {initialData ? 'Edit Log Entry' : 'New Log Entry'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 flex-1 box-border">
          {/* User-Friendly Error Banner */}
          {formError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-xs text-red-700 font-medium">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          {/* Category Selection / Creation Section */}
          {!isCreatingCategory ? (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
                  Category Template
                </label>
              </div>

              <select
                value={selectedCategory}
                onChange={(e) => {
                  setSelectedCategory(e.target.value);
                  setDynamicAttributes({});
                  if (formError) setFormError(null);
                }}
                style={{ fontSize: '16px' }}
                className="w-full px-3.5 py-2.5 bg-white border border-blue-100 rounded-xl text-gray-900 focus:outline-none focus:border-blue-500 text-xs sm:text-sm cursor-pointer"
              >
                <option value="">General (Default)</option>
                {categories.map((cat) => (
                  <option key={cat._id} value={cat._id}>
                    {cat.icon ? `${cat.icon} ${cat.name}` : cat.name}
                  </option>
                ))}
              </select>

              <div className="flex justify-end pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setIsCreatingCategory(true);
                    setFormError(null);
                  }}
                  className="text-xs font-semibold text-blue-600 hover:underline cursor-pointer"
                >
                  + Create New Category
                </button>
              </div>
            </div>
          ) : (
            /* Inline Category Creator */
            <div className="p-4 bg-blue-50/40 border border-blue-100 rounded-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-blue-100 pb-2">
                <span className="text-xs font-bold text-blue-900 uppercase tracking-wider">New Category Template</span>
              </div>

              <div className="flex items-center gap-2 relative">
                <div className="relative shrink-0">
                  <button
                    type="button"
                    onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                    style={{ fontSize: '20px' }}
                    className="w-10 h-10 sm:w-11 sm:h-11 flex items-center justify-center bg-white border border-blue-100 rounded-xl hover:bg-gray-50 cursor-pointer shadow-2xs"
                  >
                    {newCatIcon}
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
                            setNewCatIcon(emoji);
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
                  placeholder="Category Name..."
                  value={newCatName}
                  onChange={(e) => {
                    setNewCatName(e.target.value);
                    if (formError) setFormError(null);
                  }}
                  style={{ fontSize: '16px' }}
                  className="flex-1 min-w-0 px-3 py-2.5 bg-white border border-blue-100 rounded-xl text-gray-900 focus:outline-none focus:border-blue-500 text-xs sm:text-sm"
                />

                <div className="relative w-10 h-10 sm:w-11 sm:h-11 flex items-center justify-center shrink-0">
                  <input
                    type="color"
                    value={newCatColor}
                    onChange={(e) => setNewCatColor(e.target.value)}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                  />
                  <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl border-2 border-white shadow-sm" style={{ backgroundColor: newCatColor }} />
                </div>
              </div>

              {/* Custom Fields Section */}
              <div className="space-y-3 pt-2">
                <div className="space-y-0.5">
                  <span className="text-xs font-bold text-gray-700 uppercase tracking-wider block">Custom Fields & Types</span>
                  <p className="text-[11px] text-gray-500">Define the attributes you want to track for this category.</p>
                </div>

                {newFields.map((field, idx) => (
                  <div key={idx} className="p-3 bg-white border border-blue-100 rounded-xl space-y-2.5">
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        required
                        placeholder="Field Label (e.g. Status)"
                        value={field.label}
                        onChange={(e) => {
                          const updated = [...newFields];
                          updated[idx].label = e.target.value;
                          setNewFields(updated);
                        }}
                        style={{ fontSize: '16px' }}
                        className="flex-1 min-w-0 px-3 py-2 bg-white border border-blue-100 rounded-lg text-xs"
                      />
                      <select
                        value={field.type}
                        onChange={(e) => {
                          const updated = [...newFields];
                          updated[idx].type = e.target.value;
                          setNewFields(updated);
                        }}
                        style={{ fontSize: '16px' }}
                        className="w-28 sm:w-32 px-2 py-2 bg-white border border-blue-100 rounded-lg text-xs cursor-pointer shrink-0"
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
                        onClick={() => handleRemoveFieldFromNewCategory(idx)}
                        className="text-red-500 hover:text-red-700 p-1 cursor-pointer shrink-0"
                        title="Remove Field"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    {field.type === 'select' && (
                      <div>
                        <input
                          type="text"
                          placeholder="Options (comma separated, e.g. Low, Medium, High)"
                          value={field.optionsString || ''}
                          onChange={(e) => {
                            const updated = [...newFields];
                            updated[idx].optionsString = e.target.value;
                            setNewFields(updated);
                          }}
                          style={{ fontSize: '16px' }}
                          className="w-full px-3 py-1.5 bg-blue-50/50 border border-blue-100 rounded-lg text-xs text-gray-800 focus:outline-none focus:border-blue-500"
                        />
                      </div>
                    )}
                  </div>
                ))}

                <button
                  type="button"
                  onClick={handleAddFieldToNewCategory}
                  className="w-full py-2.5 border-2 border-dashed border-blue-200 hover:border-blue-400 rounded-xl text-xs font-semibold text-blue-600 hover:bg-blue-50/50 flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  + Add Field
                </button>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreatingCategory(false)}
                  className="px-3 py-1.5 border border-blue-100 rounded-lg text-xs text-gray-600 hover:bg-gray-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveNewCategory}
                  disabled={isLoading}
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold cursor-pointer disabled:opacity-50"
                >
                  Save Template
                </button>
              </div>
            </div>
          )}

          {/* Title Input (Required) */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
              Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Morning Jog or API Deployment"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                if (formError) setFormError(null);
              }}
              style={{ fontSize: '16px' }}
              className="w-full px-3.5 py-2.5 bg-white border border-blue-100 rounded-xl text-gray-900 focus:outline-none focus:border-blue-500 text-xs sm:text-sm"
            />
          </div>

          {/* Dynamic Specialized Fields (if category selected) */}
          {activeCategoryTemplate?.fields && activeCategoryTemplate.fields.length > 0 && (
            <div className="space-y-3 p-4 bg-blue-50/40 border border-blue-100 rounded-2xl">
              <span className="text-xs font-bold text-blue-950 uppercase tracking-wider block">
                {activeCategoryTemplate.name} Attributes
              </span>

              {activeCategoryTemplate.fields.map((field: any) => {
                const fieldKey = field.name || field.label.toLowerCase().replace(/\s+/g, '_');
                const fieldType = field.fieldType || field.type || 'text';

                return (
                  <div key={fieldKey} className="space-y-1">
                    <label className="block text-xs font-semibold text-gray-700">
                      {field.label} {field.required && <span className="text-red-500">*</span>}
                    </label>

                    {fieldType === 'checkbox' || fieldType === 'boolean' ? (
                      <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={Boolean(dynamicAttributes[fieldKey])}
                          onChange={(e) => {
                            setDynamicAttributes({ ...dynamicAttributes, [fieldKey]: e.target.checked });
                            if (formError) setFormError(null);
                          }}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                        />
                        Yes / True
                      </label>
                    ) : fieldType === 'select' && field.options ? (
                      <select
                        value={dynamicAttributes[fieldKey] || ''}
                        onChange={(e) => {
                          setDynamicAttributes({ ...dynamicAttributes, [fieldKey]: e.target.value });
                          if (formError) setFormError(null);
                        }}
                        style={{ fontSize: '16px' }}
                        className="w-full px-3.5 py-2 bg-white border border-blue-100 rounded-xl text-xs sm:text-sm cursor-pointer"
                      >
                        <option value="">Select option...</option>
                        {field.options.map((opt: string) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type={fieldType === 'number' || fieldType === 'currency' ? 'number' : fieldType === 'date' ? 'date' : fieldType === 'time' ? 'time' : 'text'}
                        required={field.required}
                        value={dynamicAttributes[fieldKey] !== undefined ? dynamicAttributes[fieldKey] : ''}
                        onChange={(e) => {
                          setDynamicAttributes({ ...dynamicAttributes, [fieldKey]: e.target.value });
                          if (formError) setFormError(null);
                        }}
                        style={{ fontSize: '16px' }}
                        className="w-full px-3.5 py-2 bg-white border border-blue-100 rounded-xl text-xs sm:text-sm"
                        placeholder={`Enter ${field.label.toLowerCase()}...`}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Tags */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">Tags (comma separated)</label>
            <input
              type="text"
              placeholder="e.g. health, cardio, urgent"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              style={{ fontSize: '16px' }}
              className="w-full px-3.5 py-2.5 bg-white border border-blue-100 rounded-xl text-gray-900 focus:outline-none focus:border-blue-500 text-xs sm:text-sm"
            />
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">Notes / Details</label>
            <textarea
              rows={3}
              placeholder="Add optional notes..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              style={{ fontSize: '16px' }}
              className="w-full px-3.5 py-2.5 bg-white border border-blue-100 rounded-xl text-gray-900 focus:outline-none focus:border-blue-500 text-xs sm:text-sm resize-none"
            />
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-5 sm:px-6 py-4 border-t border-blue-100 bg-white flex justify-end gap-2 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-blue-100 rounded-xl font-medium text-xs text-gray-600 hover:bg-gray-50 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isLoading}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-xs cursor-pointer disabled:opacity-50"
          >
            {isLoading ? 'Saving...' : initialData ? 'Save Changes' : 'Create Log'}
          </button>
        </div>
      </div>
    </div>
  );
}