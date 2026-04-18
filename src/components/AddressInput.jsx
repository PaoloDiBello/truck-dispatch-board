import { useState, useEffect, useRef, useCallback } from 'react';
import { MapPin, Loader } from 'lucide-react';

const cache = {};

async function fetchSuggestions(query, apiKey) {
  if (!query || query.trim().length < 2) return [];
  const key = `${apiKey}:${query.trim().toLowerCase()}`;
  if (cache[key]) return cache[key];

  // Try ORS geocoding first (better quality, truck-aware)
  if (apiKey) {
    try {
      const res = await fetch(
        `https://api.openrouteservice.org/geocode/autocomplete?api_key=${apiKey}&text=${encodeURIComponent(query)}&size=6&layers=locality,county,region,country`,
        { headers: { 'Accept-Language': 'es' } }
      );
      const data = await res.json();
      if (data.features?.length) {
        const results = data.features.map(f => ({
          label: f.properties.label,
          short: f.properties.name || f.properties.label.split(',')[0],
        }));
        cache[key] = results;
        return results;
      }
    } catch { /* fall through */ }
  }

  // Fallback: Nominatim
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5&addressdetails=1`,
      { headers: { 'Accept-Language': 'es' } }
    );
    const data = await res.json();
    const results = data.map(r => ({
      label: r.display_name,
      short: r.name || r.display_name.split(',')[0],
    }));
    cache[key] = results;
    return results;
  } catch {
    return [];
  }
}

export function AddressInput({ value, onChange, placeholder, apiKey, icon, className = '' }) {
  const [query, setQuery]           = useState(value || '');
  const [suggestions, setSuggestions] = useState([]);
  const [open, setOpen]             = useState(false);
  const [loading, setLoading]       = useState(false);
  const [activeIdx, setActiveIdx]   = useState(-1);
  const debounceRef = useRef(null);
  const containerRef = useRef(null);

  // Sync if parent value changes externally
  useEffect(() => { setQuery(value || ''); }, [value]);

  // Close on outside click
  useEffect(() => {
    const handler = (e) => { if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const search = useCallback(async (q) => {
    if (!q || q.trim().length < 2) { setSuggestions([]); setOpen(false); return; }
    setLoading(true);
    const results = await fetchSuggestions(q, apiKey);
    setSuggestions(results);
    setOpen(results.length > 0);
    setLoading(false);
    setActiveIdx(-1);
  }, [apiKey]);

  const handleChange = (e) => {
    const val = e.target.value;
    setQuery(val);
    onChange(val);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(val), 300);
  };

  const select = (item) => {
    setQuery(item.short);
    onChange(item.short);
    setSuggestions([]);
    setOpen(false);
    setActiveIdx(-1);
  };

  const handleKeyDown = (e) => {
    if (!open) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx(i => Math.min(i + 1, suggestions.length - 1)); }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, -1)); }
    if (e.key === 'Enter' && activeIdx >= 0) { e.preventDefault(); select(suggestions[activeIdx]); }
    if (e.key === 'Escape') { setOpen(false); setActiveIdx(-1); }
  };

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      <input
        value={query}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onFocus={() => suggestions.length > 0 && setOpen(true)}
        placeholder={placeholder}
        className="w-full px-3 py-2.5 pr-8 text-sm font-medium border border-slate-200 rounded-lg focus:border-blue-400 focus:ring-2 focus:ring-blue-100 focus:outline-none transition"
        autoComplete="off"
      />
      <span className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-300">
        {loading ? <Loader className="w-3.5 h-3.5 animate-spin" /> : icon}
      </span>

      {open && suggestions.length > 0 && (
        <ul className="absolute z-50 top-full mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden max-h-52 overflow-y-auto">
          {suggestions.map((s, i) => (
            <li key={i}>
              <button
                type="button"
                onMouseDown={(e) => { e.preventDefault(); select(s); }}
                className={`w-full flex items-start gap-2.5 px-3 py-2.5 text-left hover:bg-slate-50 transition ${activeIdx === i ? 'bg-blue-50' : ''}`}
              >
                <MapPin className="w-3.5 h-3.5 text-slate-400 flex-shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <div className="text-sm font-medium text-slate-800 truncate">{s.short}</div>
                  {s.label !== s.short && (
                    <div className="text-xs text-slate-400 truncate">{s.label}</div>
                  )}
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
