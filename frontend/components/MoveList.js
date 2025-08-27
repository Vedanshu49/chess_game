export default function MoveList({ logs, onAnnotate }){
  // logs: [{uci,san,move_number,annotation,time_taken_seconds}]
  const pairs=[]
  for(let i=0;i<logs.length;i+=2){
    const white = logs[i]
    const black = logs[i+1]
    pairs.push({n: Math.floor(i/2)+1, white, black})
  }

  const handleAnnotate = (log) => {
    const annotation = prompt('Enter annotation (!, ?, !!, ??, etc.):');
    if (annotation) {
      onAnnotate(log.id, annotation);
    }
  };

  function formatMoveTime(seconds) {
    if (seconds === null || seconds === undefined) return '';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `(${m}:${s.toString().padStart(2, '0')})`;
  }

  return (
    <div className="bg-[#0e141b] border border-[#233041] rounded-xl p-3 h-[460px] overflow-auto font-mono text-sm" aria-label="Move list" tabIndex={0}>
      {pairs.length===0 ? <div>No moves yet.</div> :
        <table className="w-full" aria-label="Moves table">
          <tbody>
            {pairs.map((p)=>
              <tr key={p.n} className="border-b border-[#1c2836]">
                <td className="pr-2 text-muted">{p.n}.</td>
                <td className="pr-2">
                  {p.white?.san || p.white?.uci || ""} {p.white?.annotation}
                  <span className="text-xs text-muted ml-1">{formatMoveTime(p.white?.time_taken_seconds)}</span>
                  <button onClick={() => handleAnnotate(p.white)} className="ml-2 text-accent" aria-label={`Annotate move ${p.white?.san}`}>✎</button>
                </td>
                <td>
                  {p.black?.san || p.black?.uci || ""} {p.black?.annotation}
                  {p.black && <span className="text-xs text-muted ml-1">{formatMoveTime(p.black?.time_taken_seconds)}</span>}
                  {p.black && <button onClick={() => handleAnnotate(p.black)} className="ml-2 text-accent" aria-label={`Annotate move ${p.black?.san}`}>✎</button>}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      }
    </div>
  )
}
