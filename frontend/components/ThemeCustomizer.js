import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabasejs'

export const BOARD_THEMES = {
  default: {
    light: '#f0d9b5',
    dark: '#b58863',
    selected: 'rgba(20, 85, 30, 0.5)'
  },
  blue: {
    light: '#dee3e6',
    dark: '#8ca2ad',
    selected: 'rgba(20, 85, 150, 0.5)'
  },
  green: {
    light: '#ffffdd',
    dark: '#86a666',
    selected: 'rgba(20, 130, 30, 0.5)'
  },
  tournament: {
    light: '#e6e6e6',
    dark: '#4a7169',
    selected: 'rgba(20, 110, 90, 0.5)'
  },
  walnut: {
    light: '#E8C99B',
    dark: '#B27942',
    selected: 'rgba(120, 60, 30, 0.5)'
  }
}

const PIECE_THEMES = [
  'default',
  'alpha',
  'chess7',
  'companion',
  'classical',
  'bases',
  'california'
]

export default function ThemeCustomizer({ userId }) {
  const [preferences, setPreferences] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadPreferences()
  }, [userId])

  async function loadPreferences() {
    if (!userId) return

    const { data, error } = await supabase
      .from('user_preferences')
      .select('*')
      .eq('user_id', userId)
      .single()

    if (error && error.code !== 'PGRST116') { // PGRST116 is "not found"
      console.error('Error loading preferences:', error)
      toast.error('Error loading preferences: ' + error.message)
      return
    }

    if (data) {
      setPreferences(data)
    } else {
      // Create default preferences
      const { data: newPrefs } = await supabase
        .from('user_preferences')
        .insert({
          user_id: userId,
          board_theme: 'default',
          piece_theme: 'default'
        })
        .select()
        .single()
      
      if (newPrefs) {
        setPreferences(newPrefs)
      }
    }
    setLoading(false)
  }

  async function updatePreference(key, value) {
    if (!userId || !preferences) return

    const { error } = await supabase
      .from('user_preferences')
      .update({ [key]: value, updated_at: new Date().toISOString() })
      .eq('user_id', userId)

    if (!error) {
      setPreferences(prev => ({ ...prev, [key]: value }))
    }
  }

  if (loading) return <div>Loading preferences...</div>
  if (!preferences) return null

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium mb-3">Board Theme</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {Object.entries(BOARD_THEMES).map(([name, colors]) => (
            <button
              key={name}
              onClick={() => updatePreference('board_theme', name)}
              className={`p-1 rounded-lg ${preferences.board_theme === name ? 'ring-2 ring-blue-500' : ''}`}
             >
              <div className="grid grid-cols-2 w-full aspect-square">
                <div style={{ backgroundColor: colors.light }} />
                <div style={{ backgroundColor: colors.dark }} />
                <div style={{ backgroundColor: colors.dark }} />
                <div style={{ backgroundColor: colors.light }} />
              </div>
              <div className="text-sm mt-1 text-center capitalize">{name}</div>
            </button>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-lg font-medium mb-3">Piece Theme</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {PIECE_THEMES.map(theme => (
            <button
              key={theme}
              onClick={() => updatePreference('piece_theme', theme)}
              className={`p-2 rounded-lg ${
                preferences.piece_theme === theme ? 'ring-2 ring-blue-500 bg-[#233041]' : 'hover:bg-[#233041]'
              }`}
            >
              <img 
                src={`/pieces/${theme}/wN.png`}
                alt={theme}
                className="w-12 h-12 mx-auto"
              />
              <div className="text-sm mt-1 text-center capitalize">{theme}</div>
            </button>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-lg font-medium mb-3">Game Settings</h3>
        <div className="space-y-3">
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={preferences.sound_enabled}
              onChange={e => updatePreference('sound_enabled', e.target.checked)}
              className="w-4 h-4"
            />
            <span>Sound Effects</span>
          </label>

          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={preferences.premoves_enabled}
              onChange={e => updatePreference('premoves_enabled', e.target.checked)}
              className="w-4 h-4"
            />
            <span>Enable Premoves</span>
          </label>

          <div>
            <label className="block mb-2">Piece Movement</label>
            <select
              value={preferences.piece_drag_mode}
              onChange={e => updatePreference('piece_drag_mode', e.target.value)}
              className="w-full max-w-xs bg-[#0e141b] rounded-lg px-3 py-2"
            >
              <option value="drag">Drag and Drop</option>
              <option value="click">Click to Move</option>
            </select>
          </div>

          <div>
            <label className="block mb-2">Animation Speed</label>
            <input
              type="range"
              min="0"
              max="500"
              step="50"
              value={preferences.animation_duration}
              onChange={e => updatePreference('animation_duration', parseInt(e.target.value))}
              className="w-full max-w-xs"
            />
            <div className="text-sm text-gray-400">{preferences.animation_duration}ms</div>
          </div>
        </div>
      </div>
    </div>
  )
}
