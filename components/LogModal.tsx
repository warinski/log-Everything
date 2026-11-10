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
  
  // Category creation toggle, emoji, color, & fields state
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatIcon, setNewCatIcon] = useState('📁');
  const [newCatColor, setNewCatColor] = useState('#3B82F6');
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
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  const activeCategoryTemplate = categories.find((c) => c._id === selectedCategory);

  const handleAddFieldToNewCategory = () => {
    setNewFields([...newFields, { label: '', type: 'text', required: false, optionsString: '' }]);
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
      setIsCreatingCategory(false);
      
      // Dispatch event to force feed update
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

      // Match the selected category template to grab its emoji and color
      const matchedCategory = categories.find((c) => c._id === selectedCategory);

      const payload = {
        categoryId: selectedCategory || undefined,
        categoryName: matchedCategory?.name || undefined,
        categoryIcon: matchedCategory?.icon || '',     // 👈 Pass emoji icon explicitly
        categoryColor: matchedCategory?.color || '',   // 👈 Pass color explicitly
        title,
        notes,
        tags,
        attributes: dynamicAttributes,
        timestamp: new Date(),
      };

      // console.log('MODAL PAYLOAD BEING SENT:', payload);

      const isEditing = !!initialData;
      const logId = initialData?._id;

      await onSaveLog(payload, isEditing, logId);
      
      // Dispatch event to force feed update
      window.dispatchEvent(new CustomEvent('logCreated'));
      onSuccess();
      onClose();
    } catch (err) {
      console.error('Failed to save log:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-gray-100 pb-4">
          <h2 className="text-lg font-bold text-gray-950">
            {initialData ? 'Edit Log Entry' : 'New Log Entry'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Category Creation Section Toggle */}
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-700 uppercase">Category & Templates</span>
            <button
              type="button"
              onClick={() => setIsCreatingCategory(!isCreatingCategory)}
              className="text-xs font-semibold text-blue-600 hover:underline"
            >
              {isCreatingCategory ? 'Cancel New Category' : '+ Create New Category'}
            </button>
          </div>

          {isCreatingCategory ? (
            <div className="space-y-3 pt-2 border-t border-gray-200">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={newCatIcon}
                  onChange={(e) => setNewCatIcon(e.target.value)}
                  className="w-14 text-center px-2 py-2 bg-white border border-gray-200 rounded-lg text-sm"
                  title="Emoji Icon"
                />
                <input
                  type="text"
                  placeholder="Category Name (e.g. Workouts, Finance)"
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  className="flex-1 px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm"
                />
                <input
                  type="color"
                  value={newCatColor}
                  onChange={(e) => setNewCatColor(e.target.value)}
                  className="w-10 h-9 p-1 bg-white border border-gray-200 rounded-lg cursor-pointer"
                  title="Category Color"
                />
              </div>
              
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-gray-500 uppercase">Custom Fields & Types</span>
                  <button
                    type="button"
                    onClick={handleAddFieldToNewCategory}
                    className="text-xs text-blue-600 font-medium hover:underline"
                  >
                    + Add Field
                  </button>
                </div>
                {newFields.map((field, idx) => (
                  <div key={idx} className="p-3 bg-white border border-gray-200 rounded-lg space-y-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="Field Label (e.g. Distance)"
                        value={field.label}
                        onChange={(e) => {
                          const updated = [...newFields];
                          updated[idx].label = e.target.value;
                          setNewFields(updated);
                        }}
                        className="flex-1 px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs"
                      />
                      <select
                        value={field.type}
                        onChange={(e) => {
                          const updated = [...newFields];
                          updated[idx].type = e.target.value;
                          setNewFields(updated);
                        }}
                        className="px-2 py-1.5 border border-gray-200 rounded-lg text-xs bg-white"
                      >
                        <option value="text">Text</option>
                        <option value="number">Number</option>
                        <option value="select">Dropdown</option>
                        <option value="checkbox">Checkbox</option>
                        <option value="date">Date</option>
                      </select>
                      <button
                        type="button"
                        onClick={() => handleRemoveFieldFromNewCategory(idx)}
                        className="text-red-500 hover:text-red-700 p-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
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
                        className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs"
                      />
                    )}

                    <label className="flex items-center gap-2 text-xs text-gray-600 pt-1">
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
                className="w-full py-2 bg-gray-900 hover:bg-black text-white rounded-lg text-xs font-semibold shadow-xs"
              >
                Save Category Template
              </button>
            </div>
          ) : (
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white"
            >
              <option value="">General Log (No Template)</option>
              {categories.map((cat) => (
                <option key={cat._id} value={cat._id}>
                  {cat.icon ? `${cat.icon} ${cat.name}` : cat.name}
                </option>
              ))}
            </select>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Title</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Morning Jog or API Deployment"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
            />
          </div>

          {/* Dynamic Attributes from Category Template */}
          {activeCategoryTemplate?.fields && activeCategoryTemplate.fields.length > 0 && (
            <div className="p-4 bg-gray-50 rounded-xl space-y-3 border border-gray-100">
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
                        className="w-full px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-sm"
                      >
                        <option value="">Select option...</option>
                        {field.options?.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    ) : fType === 'checkbox' ? (
                      <label className="flex items-center gap-2 text-sm text-gray-700">
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
                        className="w-full px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-sm"
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
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Tags (Comma separated)</label>
            <input
              type="text"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="fitness, cardio, morning"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold shadow-sm"
            >
              {isLoading ? 'Saving...' : initialData ? 'Update Log' : 'Create Log'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}