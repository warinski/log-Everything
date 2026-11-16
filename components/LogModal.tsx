'use client';

import { useState, useEffect } from 'react';
import { X, Trash2 } from 'lucide-react';
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
  
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatIcon, setNewCatIcon] = useState('📁');
  const [newCatColor, setNewCatColor] = useState('#3B82F6');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [newFields, setNewFields] = useState<Array<{ 
    label: string; 
    type: string; 
    required: boolean; 
    optionsString?: string;
  }>>([]);

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
    if (!newCatName.trim()) return;
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
      setIsCreatingCategory(false); // Reappears dropdown here on save
      setShowEmojiPicker(false);
      
      window.dispatchEvent(new CustomEvent('categoryCreated'));
      onSuccess();
    } catch (err) {
      console.error('Failed to create category:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const tags = tagsInput
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);

      const matchedCategory = categories.find((c) => c._id === selectedCategory);

      const payload = {
        categoryId: selectedCategory || undefined,
        categoryName: matchedCategory?.name || '',
        categoryIcon: matchedCategory?.icon || '',
        categoryColor: matchedCategory?.color || '',
        title,
        notes,
        tags,
        attributes: dynamicAttributes,
        timestamp: new Date(),
      };

      const isEditing = !!initialData;
      const logId = initialData?._id;

      await onSaveLog(payload, isEditing, logId);
      
      window.dispatchEvent(new CustomEvent('logCreated'));
      onSuccess();
      onClose();
    } catch (err) {
      console.error('Failed to save log:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Currency formatter helper: 123456.7 -> "123,456.70"
  const formatCurrencyValue = (val: any) => {
    if (val === undefined || val === null || val === '') return '';
    const num = parseFloat(val.toString().replace(/,/g, ''));
    if (isNaN(num)) return val;
    return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      {/* Modal Wrapper constrained to max 90vh with flex column layout to keep header/footer static */}
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        
        {/* Fixed Header */}
        <div className="px-6 py-4 border-b border-blue-100 flex items-center justify-between bg-white shrink-0">
          <h2 className="text-lg font-bold text-gray-950">
            {initialData ? 'Edit Log Entry' : 'New Log Entry'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* Category & Templates Section */}
          <div className="bg-blue-50/30 border border-blue-100 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-gray-700 uppercase">Category & Templates</span>
            </div>

            {/* Toggle between dropdown view and new category creation form */}
            {!isCreatingCategory ? (
              <div className="space-y-2">
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  style={{ fontSize: '16px' }}
                  className="w-full px-3 py-2.5 border border-blue-100 rounded-lg text-gray-700 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer"
                >
                  <option value="">General Log (No Template)</option>
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
                      setShowEmojiPicker(false);
                      setSelectedCategory('');
                    }}
                    className="text-xs font-semibold text-blue-600 hover:underline cursor-pointer"
                  >
                    Create New Category
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3 pt-2 border-t border-blue-100">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-blue-600 uppercase">New Category Template</span>
                  <button
                    type="button"
                    onClick={() => {
                      setIsCreatingCategory(false);
                      setShowEmojiPicker(false);
                    }}
                    className="text-xs font-semibold text-red-500 hover:underline cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>

                <div className="flex items-center gap-2 relative">
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                      style={{ fontSize: '20px' }}
                      className="w-9 h-9 flex items-center justify-center bg-white border border-blue-100 rounded-lg hover:bg-gray-50 cursor-pointer shadow-xs shrink-0"
                      title="Choose Emoji"
                    >
                      {newCatIcon}
                    </button>

                    {showEmojiPicker && (
                      <div className="absolute left-0 mt-2 p-2 bg-white border border-blue-100 rounded-xl shadow-xl grid grid-cols-4 gap-1.5 z-30 w-48">
                        {['📁', '💼', '🏃‍♂️', '💰', '🎯', '📚', '⚡', '💡', '🔥', '🍎', 
                          '💻', '🛠️', '🎨', '✈️', '🛒', '🧘‍♂️', '🚀', '⭐', '❤️', '📅',
                          '🏠', '💪', '☕', '🍔', '🐶', '🐱', '🎵', '🎮', '📈', 
                          '📝', '🧠', '💊', '💧', '☀️', '🌙', '🚗', '🎓', '🎁', '📌'].map((emoji) => (
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
                    placeholder="Category Name (e.g. Workouts, Finance)"
                    value={newCatName}
                    onChange={(e) => setNewCatName(e.target.value)}
                    style={{ fontSize: '16px' }}
                    className="flex-1 px-3 py-2 bg-white border border-blue-100 rounded-lg text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500/20 focus:border-blue-500 min-w-0"
                  />
                  
                  <input
                    type="color"
                    value={newCatColor}
                    onChange={(e) => setNewCatColor(e.target.value)}
                    className="w-9 h-9 p-0.5 bg-white border border-blue-100 rounded-lg cursor-pointer shrink-0 [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:rounded-full [&::-webkit-color-swatch]:border-none [&::-moz-color-swatch]:rounded-full [&::-moz-color-swatch]:border-none"
                    title="Category Color"
                  />
                </div>
                
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-gray-500 uppercase">Custom Fields & Types</span>
                    <button
                      type="button"
                      onClick={handleAddFieldToNewCategory}
                      className="text-xs text-blue-600 font-medium hover:underline cursor-pointer"
                    >
                      + Add Field
                    </button>
                  </div>
                  {newFields.map((field, idx) => (
                    <div key={idx} className="p-3 bg-white border border-blue-100 rounded-lg space-y-2">
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          placeholder="Field Label (e.g. Amount)"
                          value={field.label}
                          onChange={(e) => {
                            const updated = [...newFields];
                            updated[idx].label = e.target.value;
                            setNewFields(updated);
                          }}
                          style={{ fontSize: '16px' }}
                          className="flex-1 px-3 py-2.5 border border-blue-100 rounded-lg text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500/20 focus:border-blue-500 min-w-0"
                        />
                        <select
                          value={field.type}
                          onChange={(e) => {
                            const updated = [...newFields];
                            updated[idx].type = e.target.value;
                            setNewFields(updated);
                          }}
                          style={{ fontSize: '16px' }}
                          className="px-3 py-2.5 border border-blue-100 rounded-lg text-gray-700 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer shrink-0"
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
                          className="text-red-500 hover:text-red-700 p-1 cursor-pointer shrink-0 flex items-center justify-center"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      {field.type === 'select' && (
                        <input
                          type="text"
                          placeholder="Options separated by comma (e.g. Low, Medium, High)"
                          value={field.optionsString || ''}
                          onChange={(e) => {
                            const updated = [...newFields];
                            updated[idx].optionsString = e.target.value;
                            setNewFields(updated);
                          }}
                          style={{ fontSize: '16px' }}
                          className="w-full px-3 py-2.5 border border-blue-100 rounded-lg text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500/20 focus:border-blue-500"
                        />
                      )}

                      <label className="flex items-center gap-2 text-xs text-gray-600 pt-1 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={field.required}
                          onChange={(e) => {
                            const updated = [...newFields];
                            updated[idx].required = e.target.checked;
                            setNewFields(updated);
                          }}
                          className="rounded border-gray-300"
                        />
                        Required field
                      </label>
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={handleSaveNewCategory}
                  disabled={!newCatName.trim()}
                  style={{ fontSize: '16px' }}
                  className="w-full py-2.5 bg-gray-900 hover:bg-black text-white rounded-xl font-semibold shadow-xs cursor-pointer"
                >
                  Save Category Template
                </button>
              </div>
            )}
          </div>

          <form onSubmit={handleSubmit} id="log-form" className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Title</label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Morning Jog or API Deployment"
                style={{ fontSize: '16px' }}
                className="w-full px-3 py-2.5 border border-blue-100 rounded-lg text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500/20 focus:border-blue-500"
              />
            </div>

            {/* Dynamic Attributes from Category Template */}
            {activeCategoryTemplate?.fields && activeCategoryTemplate.fields.length > 0 && (
              <div className="p-4 bg-blue-50/30 rounded-xl space-y-3 border border-blue-100">
                <span className="text-xs font-bold text-gray-700 uppercase tracking-wide">
                  Template Attributes ({activeCategoryTemplate.name})
                </span>
                {activeCategoryTemplate.fields.map((field) => {
                  const fieldKey = field.key || field.name || '';
                  const fieldLabel = field.label || field.name || '';
                  const fType = field.type || field.fieldType || 'text';

                  return (
                    <div key={fieldKey}>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        {fieldLabel} {field.required && '*'}
                      </label>

                      {fType === 'select' ? (
                        <select
                          required={field.required}
                          value={dynamicAttributes[fieldKey] || ''}
                          onChange={(e) =>
                            setDynamicAttributes({
                              ...dynamicAttributes,
                              [fieldKey]: e.target.value,
                            })
                          }
                          style={{ fontSize: '16px' }}
                          className="w-full px-3 py-2.5 bg-white border border-blue-100 rounded-lg text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer"
                        >
                          <option value="">Select option...</option>
                          {field.options?.map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                      ) : fType === 'checkbox' ? (
                        <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={!!dynamicAttributes[fieldKey]}
                            onChange={(e) =>
                              setDynamicAttributes({
                                ...dynamicAttributes,
                                [fieldKey]: e.target.checked,
                              })
                            }
                            className="rounded border-gray-300"
                          />
                          {fieldLabel}
                        </label>
                      ) : fType === 'time' ? (
                        <input
                          type="time"
                          required={field.required}
                          value={dynamicAttributes[fieldKey] || ''}
                          onChange={(e) =>
                            setDynamicAttributes({
                              ...dynamicAttributes,
                              [fieldKey]: e.target.value,
                            })
                          }
                          style={{ fontSize: '16px' }}
                          className="w-full px-3 py-2.5 bg-white border border-blue-100 rounded-lg text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500/20 focus:border-blue-500"
                        />
                      ) : fType === 'currency' ? (
                        <input
                          type="text"
                          required={field.required}
                          value={dynamicAttributes[fieldKey] !== undefined ? dynamicAttributes[fieldKey] : ''}
                          onChange={(e) => {
                            setDynamicAttributes({
                              ...dynamicAttributes,
                              [fieldKey]: e.target.value,
                            });
                          }}
                          onBlur={(e) => {
                            const formatted = formatCurrencyValue(e.target.value);
                            setDynamicAttributes({
                              ...dynamicAttributes,
                              [fieldKey]: formatted,
                            });
                          }}
                          placeholder="0.00"
                          style={{ fontSize: '16px' }}
                          className="w-full px-3 py-2.5 bg-white border border-blue-100 rounded-lg text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500/20 focus:border-blue-500"
                        />
                      ) : (
                        <input
                          type={fType === 'number' ? 'number' : fType === 'date' ? 'date' : 'text'}
                          required={field.required}
                          value={dynamicAttributes[fieldKey] || ''}
                          onChange={(e) =>
                            setDynamicAttributes({
                              ...dynamicAttributes,
                              [fieldKey]: fType === 'number' ? Number(e.target.value) : e.target.value,
                            })
                          }
                          style={{ fontSize: '16px' }}
                          className="w-full px-3 py-2.5 bg-white border border-blue-100 rounded-lg text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500/20 focus:border-blue-500"
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Notes / Details</label>
              <textarea
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add optional notes..."
                style={{ fontSize: '16px' }}
                className="w-full px-3 py-2.5 border border-blue-100 rounded-lg text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500/20 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Tags (Comma separated)</label>
              <input
                type="text"
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                placeholder="fitness, cardio, morning"
                style={{ fontSize: '16px' }}
                className="w-full px-3 py-2.5 border border-blue-100 rounded-lg text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500/20 focus:border-blue-500"
              />
            </div>
          </form>
        </div>

        {/* Fixed Footer */}
        <div className="px-6 py-3 border-t border-blue-100 bg-white flex justify-end gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            style={{ fontSize: '16px' }}
            className="px-4 py-2.5 border border-blue-100 rounded-xl font-medium text-gray-600 hover:bg-gray-50 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="log-form"
            disabled={isLoading}
            style={{ fontSize: '16px', backgroundColor: '#2563EB' }}
            className="px-5 py-2.5 hover:bg-blue-700 text-white rounded-xl font-semibold shadow-xs cursor-pointer transition-all"
          >
            {isLoading ? 'Saving...' : initialData ? 'Update Log' : 'Create Log'}
          </button>
        </div>

      </div>
    </div>
  );
}