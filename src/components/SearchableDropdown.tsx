import React, { useState, useEffect, useRef, KeyboardEvent } from 'react';
import { supabase } from '../lib/supabase';
import { Search, Loader2, X } from 'lucide-react';

interface SearchableDropdownProps {
  table: string;
  searchFields: string[];
  displayField: string;
  onSelect: (item: any) => void;
  placeholder?: string;
  className?: string;
  value?: string;
  helperFields?: string[];
}

export function SearchableDropdown({
  table,
  searchFields,
  displayField,
  onSelect,
  placeholder = 'Search...',
  className = '',
  value = '',
  helperFields = []
}: SearchableDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState(value);
  const [results, setResults] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setSearchQuery(value);
  }, [value]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const fetchResults = async () => {
      if (!searchQuery || searchQuery.length < 1) {
        setResults([]);
        return;
      }

      setIsLoading(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) return;

        const tablesWithUserId = ['customers', 'suppliers', 'company_settings', 'products', 'warehouses'];
        const hasUserIdFilter = tablesWithUserId.includes(table);

        let query = supabase.from(table).select('*');

        if (hasUserIdFilter) {
          query = query.eq('user_id', session.user.id);
        }

        // Search across all fields using individual ilike filters
        let filteredQuery = query;
        if (searchFields.length === 1) {
          filteredQuery = query.ilike(searchFields[0], `%${searchQuery}%`);
        } else {
          const orFilters = searchFields.map(field => `${field}.ilike.%${searchQuery}%`).join(',');
          filteredQuery = query.or(orFilters);
        }

        const { data, error } = await filteredQuery.limit(10);

        if (error) {
          console.error('Search error:', error);
          setResults([]);
          return;
        }
        setResults(data || []);
      } catch (err) {
        console.error('Search error:', err);
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    };

    const timeoutId = setTimeout(fetchResults, 300);
    return () => clearTimeout(timeoutId);
  }, [searchQuery, table, searchFields]);

  const handleSelect = (item: any) => {
    setSearchQuery(item[displayField]);
    setIsOpen(false);
    setResults([]);
    onSelect(item);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown') setIsOpen(true);
      return;
    }
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setActiveIndex(prev => (prev < results.length - 1 ? prev + 1 : prev));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setActiveIndex(prev => (prev > 0 ? prev - 1 : prev));
        break;
      case 'Enter':
        e.preventDefault();
        if (activeIndex >= 0 && activeIndex < results.length) {
          handleSelect(results[activeIndex]);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        break;
    }
  };

  const highlightText = (text: string, highlight: string) => {
    if (!text) return <span></span>;
    if (!highlight.trim()) return <span>{text}</span>;
    const parts = text.toString().split(new RegExp(`(${highlight})`, 'gi'));
    return (
      <span>
        {parts.map((part, i) =>
          part.toLowerCase() === highlight.toLowerCase() ?
            <span key={i} className="bg-yellow-200 font-bold">{part}</span> :
            part
        )}
      </span>
    );
  };

  // Product card renderer
  const renderProductItem = (item: any, index: number) => (
    <div
      key={item.id}
      onClick={() => handleSelect(item)}
      onMouseEnter={() => setActiveIndex(index)}
      className={`px-3 py-2 cursor-pointer border-b border-slate-100 last:border-0 transition-colors ${
        activeIndex === index ? 'bg-amber-50' : 'hover:bg-slate-50'
      }`}
    >
      <div className="flex justify-between items-start gap-2">
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold text-slate-900 truncate">
            {highlightText(item.name || '', searchQuery)}
          </div>
          <div className="flex gap-2 mt-0.5 flex-wrap">
            {item.sku && (
              <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-mono">
                {highlightText(item.sku || '', searchQuery)}
              </span>
            )}
            {item.part_no && (
              <span className="text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded font-mono">
                {highlightText(item.part_no || '', searchQuery)}
              </span>
            )}
            {item.brand && (
              <span className="text-[10px] bg-green-50 text-green-700 px-1.5 py-0.5 rounded font-bold uppercase">
                {item.brand}
              </span>
            )}
            {item.hsn_code && (
              <span className="text-[10px] text-slate-400">
                HSN: {item.hsn_code}
              </span>
            )}
          </div>
        </div>
        <div className="text-right shrink-0">
          {item.mrp && (
            <div className="text-sm font-black text-slate-900">₹{Number(item.mrp).toFixed(2)}</div>
          )}
          {item.gst_rate !== undefined && item.gst_rate !== null && (
            <div className="text-[10px] text-slate-400">GST: {item.gst_rate}%</div>
          )}
        </div>
      </div>
    </div>
  );

  // Customer card renderer
  const renderCustomerItem = (item: any, index: number) => (
    <div
      key={item.id}
      onClick={() => handleSelect(item)}
      onMouseEnter={() => setActiveIndex(index)}
      className={`px-3 py-2 cursor-pointer border-b border-slate-100 last:border-0 transition-colors ${
        activeIndex === index ? 'bg-amber-50' : 'hover:bg-slate-50'
      }`}
    >
      <div className="flex justify-between items-start gap-2">
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold text-slate-900 truncate">
            {highlightText(item.name || '', searchQuery)}
          </div>
          <div className="flex gap-2 mt-0.5 flex-wrap">
            {item.mobile && (
              <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                📱 {item.mobile}
              </span>
            )}
            {item.gstin && item.gstin !== 'URD' && (
              <span className="text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded font-mono">
                {item.gstin}
              </span>
            )}
            {item.route && (
              <span className="text-[10px] bg-green-50 text-green-700 px-1.5 py-0.5 rounded">
                {item.route}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setIsOpen(true);
            setActiveIndex(-1);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="w-full pl-10 pr-10 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
        />
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        {isLoading ? (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 animate-spin" />
        ) : searchQuery && (
          <button
            type="button"
            onClick={() => {
              setSearchQuery('');
              setResults([]);
              inputRef.current?.focus();
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 hover:bg-slate-100 rounded-full"
          >
            <X className="w-3.5 h-3.5 text-slate-400" />
          </button>
        )}
      </div>

      {isOpen && searchQuery.length >= 1 && (
        <div className="absolute z-[200] w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-2xl overflow-hidden min-w-[320px]">
          {isLoading ? (
            <div className="px-4 py-3 text-sm text-slate-500 text-center flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Searching...
            </div>
          ) : results.length > 0 ? (
            <div className="max-h-72 overflow-y-auto">
              {results.map((item, index) =>
                table === 'products'
                  ? renderProductItem(item, index)
                  : renderCustomerItem(item, index)
              )}
            </div>
          ) : (
            <div className="px-4 py-3 text-sm text-slate-500 text-center italic">
              No results found for "{searchQuery}"
            </div>
          )}
        </div>
      )}
    </div>
  );
}
