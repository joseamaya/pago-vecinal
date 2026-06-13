import { useState } from 'react';

const INITIAL_FORM = {};

export function useDialog(initialFormData = {}) {
  const [open, setOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({ ...INITIAL_FORM, ...initialFormData });

  const handleOpen = (item = null, customFormData = null) => {
    if (item) {
      setEditingItem(item);
      if (customFormData) {
        setFormData(customFormData);
      }
    } else {
      setEditingItem(null);
      setFormData({ ...INITIAL_FORM, ...initialFormData });
    }
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
    setEditingItem(null);
    setFormData({ ...INITIAL_FORM, ...initialFormData });
  };

  const updateFormField = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  return {
    open,
    editingItem,
    formData,
    setFormData,
    handleOpen,
    handleClose,
    updateFormField,
  };
}
