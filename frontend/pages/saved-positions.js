
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabasejs';
import { useRouter } from 'next/router';
import dynamic from 'next/dynamic';
import { useAuth } from '@/lib/AuthProvider';
import PageWithHeader from '@/components/PageWithHeader';
import toast from 'react-hot-toast';
import LoadingSpinner from '@/components/LoadingSpinner';

import Chessboard from 'chessboardjsx';

export default function SavedPositions() {
  const [newFen, setNewFen] = useState('');
  const [saving, setSaving] = useState(false);
  const [fenError, setFenError] = useState(null);

  function isValidFen(fen) {
    if (!fen) return false;
    const rows = fen.split(' ')[0].split('/');
    if (rows.length !== 8) return false;
    for (const row of rows) {
      let count = 0;
      for (const char of row) {
        if (/[1-8]/.test(char)) count += parseInt(char);
        else count += 1;
      }
      if (count !== 8) return false;
    }
    return true;
  }

  async function savePosition(e) {
    e.preventDefault();
    setFenError(null);
    if (!isValidFen(newFen)) {
      setFenError('Invalid FEN. Please enter a valid 8x8 FEN string.');
      return;
    }
    if (positions.some(p => p.fen === newFen)) {
      setFenError('This position is already saved.');
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase
        .from('saved_positions')
        .insert({ user_id: user.id, fen: newFen });
      if (error) throw error;
      toast.success('Position saved!');
      setNewFen('');
      fetchSavedPositions();
    } catch (error) {
      toast.error('Error saving position: ' + error.message);
    } finally {
      setSaving(false);
    }
  }
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [positions, setPositions] = useState([]);
  const [positionsLoading, setPositionsLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login');
    } else if (user) {
      fetchSavedPositions();
    }
  }, [user, authLoading, router]);

  async function fetchSavedPositions() {
    if (!user) return;
    setPositionsLoading(true);
    try {
      const { data, error } = await supabase
        .from('saved_positions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setPositions(data);
    } catch (error) {
      toast.error('Failed to fetch saved positions: ' + error.message);
    } finally {
      setPositionsLoading(false);
    }
  }

  async function deletePosition(id) {
    try {
      const { error } = await supabase
        .from('saved_positions')
        .delete()
        .eq('id', id);
      if (error) throw error;
      setPositions(positions.filter(p => p.id !== id));
      toast.success('Position deleted.');
    } catch (error) {
      toast.error('Error deleting position: ' + error.message);
    }
  }

  if (authLoading || positionsLoading) {
    return (
      <PageWithHeader user={user} title="Saved Positions">
        <LoadingSpinner />
      </PageWithHeader>
    );
  }

  return (
    <PageWithHeader user={user} title="Saved Positions">
      <form onSubmit={savePosition} className="mb-6 flex gap-2">
        <input
          type="text"
          value={newFen}
          onChange={e => setNewFen(e.target.value)}
          placeholder="Enter FEN to save"
          className="input flex-1"
        />
        <button type="submit" className="btn bg-accent" disabled={saving}>Save Position</button>
      </form>
      {fenError && <p className="text-red-500 mb-4">{fenError}</p>}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {positions.map(pos => (
          <div key={pos.id} className="card">
            <Chessboard
              position={pos.fen}
              width={300}
              draggable={false}
            />
            <div className="p-4">
              <p className="text-sm text-muted">Saved on: {new Date(pos.created_at).toLocaleDateString()}</p>
              <p className="font-mono bg-[#222222] p-2 rounded mt-2 whitespace-nowrap overflow-x-auto">{pos.fen}</p>
              <button
                onClick={() => deletePosition(pos.id)}
                className="btn bg-red-600 hover:bg-red-700 mt-2"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
      {positions.length === 0 && (
        <p className="text-center text-text">You haven't saved any positions yet.</p>
      )}
    </PageWithHeader>
  );
}
