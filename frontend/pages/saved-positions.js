
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabasejs';
import NavBar from '@/components/NavBar';
import { useRouter } from 'next/router';
import dynamic from 'next/dynamic';
const Chessboard = dynamic(() => import('chessboardjsx'), { ssr: false });

export default function SavedPositions() {
  const r = useRouter();
  const [user, setUser] = useState(null);
  const [positions, setPositions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) {
        r.replace('/login');
        return;
      }
      setUser(auth.user);

      const { data, error } = await supabase
        .from('saved_positions')
        .select('*')
        .eq('user_id', auth.user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching saved positions:', error);
      } else {
        setPositions(data);
      }
      setLoading(false);
    })();
  }, []);

  async function deletePosition(id) {
    const { error } = await supabase
      .from('saved_positions')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting position:', error);
    } else {
      setPositions(positions.filter(p => p.id !== id));
    }
  }

  if (loading) return <p>Loading...</p>;

  return (
    <>
      <NavBar user={user} />
      <div className="container">
        <h1 className="text-2xl font-bold my-4">Saved Positions</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {positions.map(pos => (
            <div key={pos.id} className="card">
              <Chessboard
                position={pos.fen}
                width={300}
                draggable={false}
              />
              <div className="p-4">
                <p className="text-sm text-gray-500">Saved on: {new Date(pos.created_at).toLocaleDateString()}</p>
                <p className="font-mono bg-gray-800 p-2 rounded mt-2 whitespace-nowrap overflow-x-auto">{pos.fen}</p>
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
          <p>You haven't saved any positions yet.</p>
        )}
      </div>
    </>
  );
}
