
import { useState } from 'react';
import { supabase } from '@/lib/supabasejs';
import toast from 'react-hot-toast';

export default function TagEditor({ game }) {
  const [newTag, setNewTag] = useState('');
  const [loading, setLoading] = useState(false);

  async function addTag() {
    if (!newTag.trim()) return;
    if (game.tags && game.tags.includes(newTag.trim())) {
      toast.error('Tag already exists.');
      return;
    }

    setLoading(true);
    const updatedTags = [...(game.tags || []), newTag.trim()];
    const { error } = await supabase
      .from('games')
      .update({ tags: updatedTags })
      .eq('id', game.id);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Tag added!');
      setNewTag('');
    }
    setLoading(false);
  }

  async function removeTag(tagToRemove) {
    setLoading(true);
    const updatedTags = game.tags.filter(t => t !== tagToRemove);
    const { error } = await supabase
      .from('games')
      .update({ tags: updatedTags })
      .eq('id', game.id);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Tag removed!');
    }
    setLoading(false);
  }

  return (
    <div className="mt-3">
      <h3 className="text-lg font-bold">Tags</h3>
      <div className="flex flex-wrap gap-2 mt-2">
        {(game.tags || []).map(tag => (
          <div key={tag} className="flex items-center bg-gray-700 rounded-full px-3 py-1 text-sm">
            <span>{tag}</span>
            <button onClick={() => removeTag(tag)} className="ml-2 text-red-500 hover:text-red-400">
              &times;
            </button>
          </div>
        ))}
      </div>
      <div className="mt-3 flex gap-2">
        <input
          type="text"
          value={newTag}
          onChange={e => setNewTag(e.target.value)}
          placeholder="Add a tag"
          className="input"
          disabled={loading}
        />
        <button onClick={addTag} className="btn" disabled={loading}>
          {loading ? 'Adding...' : 'Add'}
        </button>
      </div>
    </div>
  );
}
