import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabasejs';

export default function TournamentSystem({ user }) {
  const [tournaments, setTournaments] = useState([]);
  const [name, setName] = useState('');

  useEffect(() => {
    supabase.from('tournaments').select('*').then(({ data }) => setTournaments(data || []));
  }, []);

  async function createTournament() {
    if (!name) return;
    await supabase.from('tournaments').insert({ name, creator: user.id });
    setName('');
    alert('Tournament created!');
  }

  async function joinTournament(tournamentId) {
    await supabase.from('tournament_players').insert({ tournament_id: tournamentId, user_id: user.id });
    alert('Joined tournament!');
  }

  return (
    <div className="card mt-4">
      <h3 className="font-bold mb-2">Tournaments</h3>
      <input value={name} onChange={e => setName(e.target.value)} placeholder="Tournament Name" className="input" />
      <button className="btn ml-2" onClick={createTournament}>Create</button>
      <ul className="mt-2">
        {tournaments.map(t => (
          <li key={t.id}>
            {t.name} <button className="btn ml-2" onClick={() => joinTournament(t.id)}>Join</button>
          </li>
        ))}
      </ul>
    </div>
  );
}
